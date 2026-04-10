import https from "node:https";
import axios from "axios";
import type { MoodleCategory, MoodleCourse, ValidationRules, CourseError, CourseValidationResult, CategoryNode, CourseSummary, CourseSection, CourseModuleDetail, MoodlePage, MoodleForum, MoodleBlock } from "./types";

// Axios instance with a custom HTTPS agent that:
// - Disables strict SSL verification (handles self-signed / intermediate certs common in .edu environments)
// - Sets a browser-like User-Agent to avoid WAF rejections
const moodleClient = axios.create({
  timeout: 30_000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; UVI-Space/1.0)",
    "Accept": "application/json, text/plain, */*",
  },
});

type ApiCallParams = {
  moodleUrl: string;
  token: string;
  wsfunction: string;
  extraParams?: Record<string, string | number>;
};

async function apiCall<T>({ moodleUrl, token, wsfunction, extraParams = {} }: ApiCallParams): Promise<T> {
  const base = moodleUrl.replace(/\/$/, "");
  const url = `${base}/webservice/rest/server.php`;

  const { data } = await moodleClient.get<T>(url, {
    params: {
      wstoken: token,
      moodlewsrestformat: "json",
      wsfunction,
      ...extraParams,
    },
  });

  if (data && typeof data === "object" && "exception" in data) {
    const err = data as { message?: string; errorcode?: string; debuginfo?: string };
    const detail = err.debuginfo ? ` (${err.debuginfo})` : "";
    throw new Error((err.message ?? err.errorcode ?? `Error en ${wsfunction}`) + detail);
  }

  return data;
}

async function getDirectSubcategories(moodleUrl: string, token: string, parentId: number): Promise<MoodleCategory[]> {
  const data = await apiCall<MoodleCategory[]>({
    moodleUrl,
    token,
    wsfunction: "core_course_get_categories",
    extraParams: {
      "criteria[0][key]": "parent",
      "criteria[0][value]": parentId,
    },
  });

  return Array.isArray(data) ? data : [];
}

export async function getCategoryInfo(moodleUrl: string, token: string, categoryId: number): Promise<MoodleCategory | null> {
  const data = await apiCall<MoodleCategory[]>({
    moodleUrl,
    token,
    wsfunction: "core_course_get_categories",
    extraParams: {
      "criteria[0][key]": "id",
      "criteria[0][value]": categoryId,
    },
  });

  return Array.isArray(data) && data.length > 0 ? (data[0] ?? null) : null;
}

export async function getAllSubcategoriesFlat(
  moodleUrl: string,
  token: string,
  rootId: number,
  visited = new Set<number>(),
): Promise<MoodleCategory[]> {
  // Guard against cycles or Moodle returning the same category in multiple levels
  if (visited.has(rootId)) return [];
  visited.add(rootId);

  const direct = await getDirectSubcategories(moodleUrl, token, rootId);
  const unique = direct.filter((cat) => !visited.has(cat.id));
  unique.forEach((cat) => visited.add(cat.id));

  const nested = await Promise.all(unique.map((cat) => getAllSubcategoriesFlat(moodleUrl, token, cat.id, visited)));
  return [...unique, ...nested.flat()];
}

export async function getCoursesByCategory(moodleUrl: string, token: string, categoryId: number): Promise<MoodleCourse[]> {
  const data = await apiCall<{ courses?: MoodleCourse[] }>({
    moodleUrl,
    token,
    wsfunction: "core_course_get_courses_by_field",
    extraParams: { field: "category", value: categoryId },
  });

  return data.courses ?? [];
}

export async function getAllCourses(moodleUrl: string, token: string): Promise<MoodleCourse[]> {
  const data = await apiCall<MoodleCourse[]>({
    moodleUrl,
    token,
    wsfunction: "core_course_get_courses",
  });

  return Array.isArray(data) ? data.filter((c) => c.id !== 1) : [];
}

/** Resolves the best available image URL from a Moodle course object.
 *  - Prefers `courseimage` (Moodle 3.6+, public URL, no token needed).
 *  - Falls back to `overviewfiles[0]` (older versions, requires token param).
 */
function resolveCourseImage(course: MoodleCourse, token: string): string | undefined {
  if (course.courseimage) return course.courseimage;

  const imageFile = course.overviewfiles?.find(
    (f) => !f.mimetype || f.mimetype.startsWith("image/"),
  );
  if (imageFile?.fileurl) {
    // Moodle webservice files require the token as a query param
    const sep = imageFile.fileurl.includes("?") ? "&" : "?";
    return `${imageFile.fileurl}${sep}token=${encodeURIComponent(token)}`;
  }

  return undefined;
}

/** Converts a date string "YYYY-MM-DD" to a Unix timestamp (seconds) */
function dateStringToTimestamp(value: string | number): number {
  if (typeof value === "number") return value;
  const ts = Math.floor(new Date(value).getTime() / 1000);
  return isNaN(ts) ? 0 : ts;
}

export function validateCourse(course: MoodleCourse, rules: ValidationRules): CourseError[] {
  const errors: CourseError[] = [];

  for (const [field, expected] of Object.entries(rules)) {
    // ── Validaciones sintéticas de contenido ────────────────────────────────
    if (field === "fullname_contains") {
      const text = String(expected).trim().toLowerCase();
      if (text && !course.fullname.toLowerCase().includes(text)) {
        errors.push({ field, expected, actual: course.fullname });
      }
      continue;
    }

    // ── Validaciones sintéticas de existencia ───────────────────────────────
    if (field === "shortname_exists") {
      if (!course.shortname?.trim()) {
        errors.push({ field, expected, actual: course.shortname ?? "" });
      }
      continue;
    }
    if (field === "idnumber_exists") {
      if (!course.idnumber?.trim()) {
        errors.push({ field, expected, actual: course.idnumber ?? "" });
      }
      continue;
    }
    if (field === "startdate_exists") {
      if (!course.startdate || course.startdate === 0) {
        errors.push({ field, expected, actual: course.startdate ?? 0 });
      }
      continue;
    }
    if (field === "enddate_exists") {
      if (!course.enddate || course.enddate === 0) {
        errors.push({ field, expected, actual: course.enddate ?? 0 });
      }
      continue;
    }

    // ── Validaciones sintéticas de rango de fechas ──────────────────────────
    if (field === "startdate_min") {
      const minTs = dateStringToTimestamp(expected as string | number);
      if (!course.startdate || course.startdate < minTs) {
        errors.push({ field, expected, actual: course.startdate ?? 0 });
      }
      continue;
    }
    if (field === "enddate_max") {
      const maxTs = dateStringToTimestamp(expected as string | number);
      if (!course.enddate || course.enddate > maxTs) {
        errors.push({ field, expected, actual: course.enddate ?? 0 });
      }
      continue;
    }

    // ── Validaciones de igualdad (campos estándar) ───────────────────────────
    // Moodle puede devolver campos como boolean (true/false) o como número (1/0) dependiendo
    // de la versión. Normalizamos ambos lados a número para hacer la comparación correcta.
    const toNum = (v: unknown): unknown => (v === true ? 1 : v === false ? 0 : v);

    const expectedNorm = typeof expected === "boolean" ? (expected ? 1 : 0) : expected;
    const actual       = course[field as keyof MoodleCourse];
    const actualNorm   = toNum(actual);

    if (actualNorm !== expectedNorm) {
      errors.push({ field, expected, actual: actual as string | number | null | undefined });
    }
  }

  return errors;
}

function buildCategoryTree(
  allCategories: MoodleCategory[],
  parentId: number,
  courseMap: Map<number, MoodleCourse[]>,
  resultMap: Map<number, CourseValidationResult>,
): CategoryNode[] {
  return allCategories
    .filter((c) => c.parent === parentId)
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      idnumber: cat.idnumber,
      parent: cat.parent,
      coursecount: cat.coursecount,
      children: buildCategoryTree(allCategories, cat.id, courseMap, resultMap),
      courses: (courseMap.get(cat.id) ?? []).map((course): CourseSummary => {
        const result = resultMap.get(course.id);
        return {
          id: course.id,
          shortname: course.shortname,
          fullname: course.fullname,
          idnumber: course.idnumber ?? "",
          status: result?.status ?? "OK",
          errorCount: result?.errors.length ?? 0,
        };
      }),
    }));
}

export async function runRevision(
  moodleUrl: string,
  token: string,
  rules: ValidationRules,
  categoryId?: number,
): Promise<{
  results: CourseValidationResult[];
  categoryTree: CategoryNode[];
  errorsByField: Record<string, number>;
}> {
  let courses: MoodleCourse[];
  let allCategories: MoodleCategory[] = [];
  let rootCategory: MoodleCategory | null = null;

  if (categoryId) {
    rootCategory = await getCategoryInfo(moodleUrl, token, categoryId);
    const subcategories = await getAllSubcategoriesFlat(moodleUrl, token, categoryId);
    allCategories = rootCategory ? [rootCategory, ...subcategories] : subcategories;

    const allCategoryIds = allCategories.map((c) => c.id);
    const courseArrays = await Promise.all(allCategoryIds.map((id) => getCoursesByCategory(moodleUrl, token, id)));
    const seenIds = new Set<number>();
    courses = [];
    for (const arr of courseArrays) {
      for (const course of arr) {
        if (!seenIds.has(course.id)) {
          seenIds.add(course.id);
          courses.push(course);
        }
      }
    }
  } else {
    courses = await getAllCourses(moodleUrl, token);
  }

  const categoryNameMap = new Map(allCategories.map((c) => [c.id, c.name]));
  const courseMap = new Map<number, MoodleCourse[]>();
  const resultMap = new Map<number, CourseValidationResult>();
  const errorsByField: Record<string, number> = {};

  const results: CourseValidationResult[] = courses.map((course) => {
    const errors = validateCourse(course, rules);

    for (const err of errors) {
      errorsByField[err.field] = (errorsByField[err.field] ?? 0) + 1;
    }

    const result: CourseValidationResult = {
      id: course.id,
      shortname: course.shortname,
      fullname: course.fullname,
      idnumber: course.idnumber ?? "",
      categoryId: course.categoryid,
      categoryName: categoryNameMap.get(course.categoryid) ?? `Categoría ${course.categoryid}`,
      // Configuración general
      visible: course.visible ?? 0,
      format: course.format,
      maxbytes: course.maxbytes ?? 0,
      enablecompletion: course.enablecompletion ?? 0,
      lang: course.lang ?? "",
      startdate: course.startdate,
      enddate: course.enddate,
      forcetheme: course.forcetheme ?? "",
      summaryformat: course.summaryformat ?? 0,
      // Apariencia
      newsitems: course.newsitems ?? 0,
      showgrades: course.showgrades ?? 1,
      showreports: course.showreports ?? 0,
      showactivitydates: course.showactivitydates ?? 0,
      showcompletionconditions: course.showcompletionconditions ?? 0,
      // Grupos
      groupmode: course.groupmode ?? 0,
      groupmodeforce: course.groupmodeforce ?? 0,
      defaultgroupingid: course.defaultgroupingid ?? 0,
      // Finalización
      completionnotify: course.completionnotify ?? 0,
      // Estado
      status: errors.length === 0 ? "OK" : "FAIL",
      errors,
      courseUrl: `${moodleUrl.replace(/\/$/, "")}/course/view.php?id=${course.id}`,
      overviewImageUrl: resolveCourseImage(course, token),
    };

    const existing = courseMap.get(course.categoryid) ?? [];
    existing.push(course);
    courseMap.set(course.categoryid, existing);
    resultMap.set(course.id, result);

    return result;
  });

  const treeRoot = categoryId
    ? rootCategory
      ? [
          {
            id: rootCategory.id,
            name: rootCategory.name,
            idnumber: rootCategory.idnumber,
            parent: rootCategory.parent,
            coursecount: rootCategory.coursecount,
            children: buildCategoryTree(allCategories.filter((c) => c.id !== categoryId), categoryId, courseMap, resultMap),
            courses: (courseMap.get(categoryId) ?? []).map((course): CourseSummary => {
              const result = resultMap.get(course.id);
              return {
                id: course.id,
                shortname: course.shortname,
                fullname: course.fullname,
                idnumber: course.idnumber ?? "",
                status: result?.status ?? "OK",
                errorCount: result?.errors.length ?? 0,
              };
            }),
          },
        ]
      : buildCategoryTree(allCategories, categoryId, courseMap, resultMap)
    : buildCategoryTree(allCategories, 0, courseMap, resultMap);

  return { results, categoryTree: treeRoot, errorsByField };
}

// ── Content inspection endpoints ─────────────────────────────────────────────

/** Fetches all sections and their modules for a given course. */
export async function getCourseContents(
  moodleUrl: string,
  token: string,
  courseId: number,
): Promise<CourseSection[]> {
  const data = await apiCall<CourseSection[]>({
    moodleUrl,
    token,
    wsfunction: "core_course_get_contents",
    extraParams: { courseid: courseId },
  });
  return Array.isArray(data) ? data : [];
}

/** Fetches the full configuration detail of a single course module (cmid). */
export async function getCourseModule(
  moodleUrl: string,
  token: string,
  cmid: number,
): Promise<CourseModuleDetail> {
  const data = await apiCall<{ cm: CourseModuleDetail }>({
    moodleUrl,
    token,
    wsfunction: "core_course_get_course_module",
    extraParams: { cmid },
  });
  return data.cm;
}

/** Fetches a single course by its numeric ID. Throws if not found. */
export async function getCourseById(
  moodleUrl: string,
  token: string,
  courseId: number,
): Promise<MoodleCourse> {
  const data = await apiCall<{ courses?: MoodleCourse[] }>({
    moodleUrl,
    token,
    wsfunction: "core_course_get_courses_by_field",
    extraParams: { field: "id", value: courseId },
  });
  const course = data.courses?.[0];
  if (!course) {
    throw new Error(`Curso con ID ${courseId} no encontrado en Moodle`);
  }
  return course;
}

/** Returns the direct child categories of a given parent category. */
export async function getCategoriesByParent(
  moodleUrl: string,
  token: string,
  parentId: number,
): Promise<MoodleCategory[]> {
  return getDirectSubcategories(moodleUrl, token, parentId);
}

/** Fetches all page-type activity instances for a course in a single call. */
export async function getPagesByCourse(
  moodleUrl: string,
  token: string,
  courseId: number,
): Promise<MoodlePage[]> {
  const data = await apiCall<{ pages?: MoodlePage[] }>({
    moodleUrl,
    token,
    wsfunction: "mod_page_get_pages_by_courses",
    extraParams: { "courseids[0]": courseId },
  });
  return data.pages ?? [];
}

/** Fetches all sidebar blocks configured for a course. */
export async function getCourseBlocks(
  moodleUrl: string,
  token: string,
  courseId: number,
): Promise<MoodleBlock[]> {
  const data = await apiCall<{ blocks?: MoodleBlock[] }>({
    moodleUrl,
    token,
    wsfunction: "core_block_get_course_blocks",
    extraParams: { courseid: courseId },
  });
  return data.blocks ?? [];
}

/** Fetches all forum-type activity instances for a course in a single call.
 *  mod_forum_get_forums_by_courses returns a plain array (not wrapped). */
export async function getForumsByCourse(
  moodleUrl: string,
  token: string,
  courseId: number,
): Promise<MoodleForum[]> {
  const data = await apiCall<MoodleForum[]>({
    moodleUrl,
    token,
    wsfunction: "mod_forum_get_forums_by_courses",
    extraParams: { "courseids[0]": courseId },
  });
  return Array.isArray(data) ? data : [];
}
