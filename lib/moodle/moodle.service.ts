import https from "node:https";
import axios from "axios";
import type { MoodleCategory, MoodleCourse, ValidationRules, CourseError, CourseValidationResult, CategoryNode, CourseSummary } from "./types";

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

export function validateCourse(course: MoodleCourse, rules: ValidationRules): CourseError[] {
  const errors: CourseError[] = [];

  for (const [field, expected] of Object.entries(rules) as [keyof ValidationRules, string | number][]) {
    const actual = course[field as keyof MoodleCourse];
    if (actual !== expected) {
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
          idnumber: course.idnumber,
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
      idnumber: course.idnumber,
      categoryId: course.categoryid,
      categoryName: categoryNameMap.get(course.categoryid) ?? `Categoría ${course.categoryid}`,
      visible: course.visible,
      format: course.format,
      maxbytes: course.maxbytes,
      enablecompletion: course.enablecompletion,
      lang: course.lang,
      startdate: course.startdate,
      enddate: course.enddate,
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
                idnumber: course.idnumber,
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
