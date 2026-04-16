import { NextRequest, NextResponse } from "next/server";

import {
  getCategoriesByParent,
  getCategoryInfo,
  getCoursesByCategory,
  getCourseById,
  getCourseContents,
  getCourseModule,
  getPagesByCourse,
  getForumsByCourse,
  getGradeItems,
  getEnrolledUsers,
  getForumDiscussions,
} from "@/lib/moodle/moodle.service";
import { getPresentationSectionNumber } from "@/lib/moodle/validators/course-content.validator";
import type { CourseSection } from "@/lib/moodle/types";

// ── Types ──────────────────────────────────────────────────────────────────────

type MoodleConfig = {
  moodleUrl: string;
  token: string;
};

type AlistamientoApiRequest = {
  /** Category-based scan: provide categoryId */
  categoryId?: number;
  /** Individual course lookup: provide courseId */
  courseId?: number;
  moodleConfig: MoodleConfig;
  photoValidationTexts?: string[];
};

type Status = "CUMPLE" | "NO CUMPLE" | "NO APLICA" | "NO EXISTE";

type CourseResult = {
  date: string;
  userIds: string;
  userDoc: string;
  teacherNames: string;
  teacherEmails: string;
  program: string;
  semester: string;
  group: string;
  courseId: number;
  courseName: string;
  courseCode: string;
  courseFormat: string;
  nombreProfesor: Status;
  correoProfesor: Status;
  horarioAtencion: Status;
  fotografia: Status;
  foroConsulta: Status;
  unidades: Status[];
  efc01Actividades: Status;
  efc01Ponderaciones: Status;
  efc02Actividades: Status;
  efc02Ponderaciones: Status;
  efc03Actividades: Status;
  efc03Ponderaciones: Status;
  porcentaje: number;
};

type CounterState = { fails: number; success: number };

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS = {
  fails:     "NO CUMPLE" as const,
  success:   "CUMPLE"    as const,
  notApply:  "NO APLICA" as const,
  notExist:  "NO EXISTE" as const,
};

const PAGE_ID  = "DP01";
const FORUM_ID = "FC01";

const DEFAULT_PHOTO_VALIDATION_TEXTS = [
  "insertar foto de tamano 200",
  "insertar foto de tamaño 200",
];

const EFC_DEFS = [
  { codes: ["EFC01", "AF01", "af1"] as const, target: 0.30 },
  { codes: ["EFC02", "AF02", "af2"] as const, target: 0.30 },
  { codes: ["EFC03", "AF03", "af3"] as const, target: 0.40 },
] as const;

const EPS = 0.025; // tolerance for weight comparisons

// ── Text helpers ───────────────────────────────────────────────────────────────

const normalizeText = (input: string) =>
  input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ñ/g, "n");

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const splitNameTokens = (value: string) =>
  normalizeText(value)
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

// ── Validation helpers ─────────────────────────────────────────────────────────

const mark = (state: CounterState, ok: boolean): Status => {
  if (ok) { state.success += 1; return STATUS.success; }
  state.fails += 1;
  return STATUS.fails;
};

const nameValidate = (state: CounterState, contentName: string, fullName: string): Status => {
  const contentParts  = splitNameTokens(contentName);
  const fullNameParts = splitNameTokens(fullName);
  return mark(state, contentParts.some((p) => fullNameParts.includes(p)));
};

const emailValidate = (state: CounterState, content: string, email: string): Status => {
  const lower = content.toLowerCase();
  if (email && lower.includes(email.toLowerCase())) return mark(state, true);
  return mark(state, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(content));
};

const validateOpeningHours = (state: CounterState, content: string): Status => {
  const lower = content.toLowerCase();
  if (lower.includes("indicar las horas de atencion que tendra para sus estudiantes")) {
    return mark(state, false);
  }
  return mark(state, /(lunes|martes|miercoles|jueves|viernes|sabado|sabados|domingo|domingos)/i.test(lower));
};

const sanitizePhotoValidationTexts = (texts: unknown): string[] => {
  if (!Array.isArray(texts)) return DEFAULT_PHOTO_VALIDATION_TEXTS;
  const clean = texts.map((t) => String(t ?? "").trim().toLowerCase()).filter(Boolean);
  return clean.length > 0 ? clean : DEFAULT_PHOTO_VALIDATION_TEXTS;
};

const validateFotografia = (state: CounterState, content: string, blocked: string[]): Status => {
  const lower = content.toLowerCase();
  return mark(state, !blocked.some((b) => lower.includes(b)));
};

/** Matches a real date like 24/02/2026 or 2/3/2026 */
const REAL_DATE_RE = /\b\d{1,2}\/\d{1,2}\/\d{4}\b/;

const validateDateUnit = (state: CounterState, summary: string): Status => {
  const text = stripHtml(summary);
  // FAIL if the placeholder is still present
  if (text.includes("DD/MM/AAAA")) return mark(state, false);
  // CUMPLE only if at least one real date exists (e.g. 24/02/2026)
  return mark(state, REAL_DATE_RE.test(text));
};

// ── Sections date validation (from course contents) ────────────────────────────

/** Normalise a section name for exclusion checks (strip accents, lowercase). */
const normalizeSectionName = (name: string) =>
  name.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

function validateSectionDates(
  state: CounterState,
  sections: CourseSection[],
  /** Section number (0-based) of the presentation/bienvenida section.
   *  Content units start at presentationSectionNumber + 1. */
  presentationSectionNumber: number,
): Status[] {
  const firstContentSection = presentationSectionNumber + 1;

  const candidateSections = sections
    .filter((s) => {
      // Only content sections (skip general + teacher presentation)
      if (s.section < firstContentSection) return false;
      // Must be reachable by the token (teacher view)
      if (!s.uservisible) return false;
      // Ignore sections beyond the course's configured numsections
      if (s.hiddenbynumsections !== 0) return false;
      const name = normalizeSectionName(s.name ?? "");
      // Skip the "Presentación" structural section — it never carries dates
      if (name.includes("presentaci")) return false;
      // Skip sections addressed to students from another institution
      if (name.includes("unicamacho")) return false;
      return true;
    })
    .sort((a, b) => a.section - b.section);

  const statuses: Status[] = candidateSections.map((s) => {
    // Sections hidden from students: validation does not apply
    if (s.visible !== 1) return STATUS.notApply;
    // Visible sections: validate that dates have been filled in
    return validateDateUnit(state, s.summary ?? "");
  });

  // Pad / trim to 8 slots
  while (statuses.length < 8) statuses.push(STATUS.notApply);
  return statuses.slice(0, 8);
}

// ── EFC grade validation via grade items (idnumber-based) ─────────────────────
//
// Strategy: gradereport_user_get_grade_items returns all items in gradebook order:
//   [course total] → [EFC01 category total] → [activities in EFC01] → [EFC02 category total] → …
//
// 1. Find each EFC category item by idnumber (never by name — names vary per course).
// 2. Count activities by scanning items between this category total and the next one.
// 3. Check ponderaciones via the category item's weightraw / percentageraw.

function validateEfc(
  state: CounterState,
  gradeItems: import("@/lib/moodle/types").GradeItem[],
  codes: readonly string[],
  target: number,
): { actividades: Status; ponderaciones: Status } {
  // ── 1. Find the EFC category item by idnumber ─────────────────────────────
  const categoryItem = gradeItems.find(
    (item) => item.itemtype === "category" && codes.some((c) => item.idnumber === c),
  );

  if (!categoryItem) {
    state.fails += 2; // actividades + ponderaciones
    return { actividades: STATUS.notExist, ponderaciones: STATUS.notExist };
  }

  // ── 2. Count activities that follow this category total in the flat list ───
  let inCategory = false;
  let activityCount = 0;
  for (const item of gradeItems) {
    if (item.itemtype === "category" && codes.some((c) => item.idnumber === c)) {
      inCategory = true;
      continue;
    }
    if (inCategory) {
      // Stop when we hit the next category or course total
      if (item.itemtype === "category" || item.itemtype === "course") break;
      activityCount++;
    }
  }
  const actividades = mark(state, activityCount > 0);

  // ── 3. Ponderaciones: EFC category item's weight in the course ────────────
  const weightRaw     = categoryItem.weightraw     ?? null;
  const percentageRaw = categoryItem.percentageraw ?? null;

  const weightOk  = weightRaw     !== null && Math.abs(weightRaw - target)           <= EPS;
  const percentOk = percentageRaw !== null && Math.abs(percentageRaw / 100 - target) <= EPS;
  const ponderaciones = mark(state, weightOk || percentOk);

  return { actividades, ponderaciones };
}

// ── Per-course processing ──────────────────────────────────────────────────────

async function processCourse(
  moodleUrl: string,
  token: string,
  courseId: number,
  courseName: string,
  courseCode: string,
  courseFormat: string,
  program: string,
  semester: string,
  currentDate: string,
  photoValidationTexts: string[],
): Promise<CourseResult> {
  const state: CounterState = { fails: 0, success: 0 };

  // Fetch all data in parallel for performance
  const [sections, pages, forums, teachers] = await Promise.all([
    getCourseContents(moodleUrl, token, courseId).catch(() => [] as Awaited<ReturnType<typeof getCourseContents>>),
    getPagesByCourse(moodleUrl, token, courseId).catch(() => []),
    getForumsByCourse(moodleUrl, token, courseId).catch(() => []),
    getEnrolledUsers(moodleUrl, token, courseId, { roleId: 3, limit: 10 }).catch(() => []),
  ]);

  // ── Teacher info ────────────────────────────────────────────────────────────
  const teacherNames   = teachers.map((t) => t.fullname.trim()).join(" | ");
  const teacherEmails  = teachers.map((t) => (t.email ?? "").toLowerCase()).join(" | ");
  const teacherIds     = teachers.map((t) => String(t.id)).join(" | ");
  const teacherDocs    = teachers.map((t) => t.idnumber ?? "").filter(Boolean).join(" | ");

  // ── Grade items (needs a valid user ID — use first teacher) ─────────────────
  const sampleUserId = teachers[0]?.id ?? null;
  let gradeItems: Awaited<ReturnType<typeof getGradeItems>> = [];
  if (sampleUserId) {
    gradeItems = await getGradeItems(moodleUrl, token, courseId, sampleUserId).catch(() => []);
  }

  // ── Find presentation section ───────────────────────────────────────────────
  const preferredSection = getPresentationSectionNumber(courseFormat);
  const orderedSections  = [
    ...sections.filter((s) => s.section === preferredSection),
    ...sections.filter((s) => s.section !== preferredSection),
  ];

  // ── DP01 professor presentation page ────────────────────────────────────────
  // Collect ALL page modules across all sections (presentation section first).
  // There may be multiple page modules per section; we must check each one's
  // idnumber via getCourseModule to find the one marked DP01.
  let nombreProfesor: Status;
  let correoProfesor: Status;
  let horarioAtencion: Status;
  let fotografia: Status;

  type CourseModule = (typeof sections)[0]["modules"][0];
  const allPageModules: CourseModule[] = orderedSections.flatMap((s) =>
    s.modules.filter((m) => m.modname === "page"),
  );

  // Fetch all module details in parallel, then find the DP01 entry
  const pageDetails = await Promise.all(
    allPageModules.map((m) =>
      getCourseModule(moodleUrl, token, m.id)
        .then((d) => ({ mod: m, detail: d }))
        .catch(() => ({ mod: m, detail: null })),
    ),
  );

  const dp01Entry = pageDetails.find((e) => e.detail?.idnumber === PAGE_ID);

  if (dp01Entry) {
    const pageContent = pages.find((p) => p.id === dp01Entry.mod.instance);
    const content     = pageContent?.content ?? "";
    const pageName    = dp01Entry.mod.name ?? "";

    nombreProfesor  = nameValidate(state, pageName, teacherNames || "—");
    correoProfesor  = emailValidate(state, content, teacherEmails || "—");
    horarioAtencion = validateOpeningHours(state, content);
    fotografia      = validateFotografia(state, content, photoValidationTexts);
  } else {
    nombreProfesor  = STATUS.notExist;
    correoProfesor  = STATUS.notExist;
    horarioAtencion = STATUS.notExist;
    fotografia      = STATUS.notExist;
    state.fails += 4;
  }

  // ── FC01 consultation forum with discussions ────────────────────────────────
  let foroConsulta: Status;

  // Find all forum modules in the presentation section (or any section as fallback)
  const presentationSection = sections.find((s) => s.section === preferredSection);
  const forumModules = presentationSection?.modules.filter((m) => m.modname === "forum") ?? [];

  // Also search other sections as fallback
  const allForumModules = sections.flatMap((s) => s.modules.filter((m) => m.modname === "forum"));
  const candidateForumModules = [
    ...forumModules,
    ...allForumModules.filter((m) => !forumModules.find((fm) => fm.id === m.id)),
  ];

  // Fetch all forum module details in parallel, then find FC01
  const forumDetails = await Promise.all(
    candidateForumModules.map((fm) =>
      getCourseModule(moodleUrl, token, fm.id)
        .then((d) => ({ fm, detail: d }))
        .catch(() => ({ fm, detail: null })),
    ),
  );

  let fc01ForumInstance: number | null = null;
  for (const { fm, detail } of forumDetails) {
    if (detail?.idnumber === FORUM_ID && detail.visible === 1 && detail.visibleoncoursepage === 1) {
      const forumData = forums.find((f) => f.cmid === fm.id);
      if (forumData) { fc01ForumInstance = forumData.id; break; }
    }
  }

  if (fc01ForumInstance !== null) {
    const discussions = await getForumDiscussions(moodleUrl, token, fc01ForumInstance, 1).catch(() => []);
    foroConsulta = mark(state, discussions.length > 0);
  } else {
    foroConsulta = mark(state, false);
  }

  // ── Section dates ───────────────────────────────────────────────────────────
  // Use the actual section where DP01 was found as the presentation boundary.
  // Falling back to the format-based preferred section if DP01 was not found.
  const dp01Section = dp01Entry
    ? sections.find((s) => s.modules.some((m) => m.id === dp01Entry.mod.id))
    : undefined;
  const presentationSectionActual = dp01Section?.section ?? preferredSection;
  const unidades = validateSectionDates(state, sections, presentationSectionActual);

  // ── EFC categories ──────────────────────────────────────────────────────────
  // If no grade items were loaded, mark everything as NO EXISTE
  let efc01Actividades: Status;
  let efc01Ponderaciones: Status;
  let efc02Actividades: Status;
  let efc02Ponderaciones: Status;
  let efc03Actividades: Status;
  let efc03Ponderaciones: Status;

  if (gradeItems.length === 0) {
    efc01Actividades   = STATUS.notExist;
    efc01Ponderaciones = STATUS.notExist;
    efc02Actividades   = STATUS.notExist;
    efc02Ponderaciones = STATUS.notExist;
    efc03Actividades   = STATUS.notExist;
    efc03Ponderaciones = STATUS.notExist;
    state.fails += 6;
  } else {
    const [efc1, efc2, efc3] = EFC_DEFS.map((efc) =>
      validateEfc(state, gradeItems, efc.codes, efc.target),
    );
    efc01Actividades   = efc1!.actividades;
    efc01Ponderaciones = efc1!.ponderaciones;
    efc02Actividades   = efc2!.actividades;
    efc02Ponderaciones = efc2!.ponderaciones;
    efc03Actividades   = efc3!.actividades;
    efc03Ponderaciones = efc3!.ponderaciones;
  }

  // ── Percentage ──────────────────────────────────────────────────────────────
  const total      = state.fails + state.success;
  const porcentaje = total > 0 ? Math.round((100 / total) * state.success) : 0;

  const group = (courseName.split("*").pop() ?? "").trim();

  return {
    date:         currentDate,
    userIds:      teacherIds,
    userDoc:      teacherDocs,
    teacherNames: teacherNames || "Sin docentes",
    teacherEmails,
    program,
    semester,
    group,
    courseId,
    courseName,
    courseCode,
    courseFormat,
    nombreProfesor:     nombreProfesor!,
    correoProfesor:     correoProfesor!,
    horarioAtencion:    horarioAtencion!,
    fotografia:         fotografia!,
    foroConsulta,
    unidades,
    efc01Actividades:   efc01Actividades!,
    efc01Ponderaciones: efc01Ponderaciones!,
    efc02Actividades:   efc02Actividades!,
    efc02Ponderaciones: efc02Ponderaciones!,
    efc03Actividades:   efc03Actividades!,
    efc03Ponderaciones: efc03Ponderaciones!,
    porcentaje,
  };
}

// ── Individual course lookup ───────────────────────────────────────────────────

async function handleIndividualCourse(
  moodleUrl: string,
  token: string,
  courseId: number,
  photoValidationTexts: string[],
  currentDate: string,
): Promise<NextResponse> {
  const course = await getCourseById(moodleUrl, token, courseId);

  // Walk up the category chain to get program / semester names
  const semesterCat = await getCategoryInfo(moodleUrl, token, course.categoryid).catch(() => null);
  const programCat  = semesterCat
    ? await getCategoryInfo(moodleUrl, token, semesterCat.parent).catch(() => null)
    : null;

  const programName  = programCat?.name  ?? "";
  const semesterName = semesterCat?.name ?? "";

  const result = await processCourse(
    moodleUrl,
    token,
    course.id,
    course.fullname,
    course.shortname,
    course.format ?? "topics",
    programName,
    semesterName,
    currentDate,
    photoValidationTexts,
  );

  const summary = {
    high:         result.porcentaje >= 80 ? 1 : 0,
    medium:       result.porcentaje >= 51 && result.porcentaje <= 79 ? 1 : 0,
    low:          result.porcentaje >= 1  && result.porcentaje <= 50 ? 1 : 0,
    noActivity:   result.porcentaje === 0 ? 1 : 0,
    totalCourses: 1,
    repeatedCourses: 0,
  };

  return NextResponse.json({
    mode:        "individual",
    courseId,
    totalCourses: 1,
    hierarchy: {
      programs:     programCat  ? 1 : 0,
      semesters:    semesterCat ? 1 : 0,
      programNames:  programCat  ? [programCat.name]  : [],
      semesterNames: semesterCat ? [semesterCat.name] : [],
    },
    summary,
    results: [result],
  });
}

// ── Batch helpers ──────────────────────────────────────────────────────────────

/** Number of courses processed concurrently. Each course fires ~5 parallel Moodle
 *  WS calls, so BATCH_SIZE=4 means ~20 concurrent requests max — safe for most
 *  Moodle instances without triggering rate limits. */
const BATCH_SIZE = 4;

/** Process `items` in sequential batches of `size`, each batch running in parallel. */
async function batchProcess<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  size: number,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    results.push(...await Promise.all(batch.map(fn)));
  }
  return results;
}

// ── Route handler ──────────────────────────────────────────────────────────────

/** Extend serverless function timeout (Vercel / similar platforms). */
export const maxDuration = 300;

export const POST = async (request: NextRequest) => {
  try {
    const body = (await request.json()) as Partial<AlistamientoApiRequest>;

    const moodleConfig = body.moodleConfig;
    if (!moodleConfig?.moodleUrl?.trim() || !moodleConfig?.token?.trim()) {
      return NextResponse.json(
        { message: "Configuración de Moodle inválida. Se requieren moodleUrl y token." },
        { status: 400 },
      );
    }

    const { moodleUrl, token } = moodleConfig;
    const photoValidationTexts = sanitizePhotoValidationTexts(body.photoValidationTexts);
    const currentDate = new Date().toISOString().replace("T", " ").slice(0, 19);

    // ── Individual course mode ────────────────────────────────────────────────
    if (body.courseId !== undefined) {
      const courseId = Number(body.courseId);
      if (!Number.isInteger(courseId) || courseId <= 0) {
        return NextResponse.json(
          { message: "El campo courseId debe ser un número entero positivo." },
          { status: 400 },
        );
      }
      return handleIndividualCourse(moodleUrl, token, courseId, photoValidationTexts, currentDate);
    }

    // ── Category mode ─────────────────────────────────────────────────────────
    const categoryId = Number(body.categoryId);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return NextResponse.json(
        { message: "Se requiere categoryId o courseId como número entero positivo." },
        { status: 400 },
      );
    }

    // ── Category hierarchy ────────────────────────────────────────────────────
    const programCategories = await getCategoriesByParent(moodleUrl, token, categoryId);

    let semesterCategories = programCategories.length > 0
      ? (await Promise.all(
          programCategories.map((p) => getCategoriesByParent(moodleUrl, token, p.id)),
        )).flat()
      : [];

    // Fallback: no nested structure — treat categoryId itself as the semester level
    if (semesterCategories.length === 0) {
      semesterCategories = await getCategoriesByParent(moodleUrl, token, categoryId);
    }
    if (semesterCategories.length === 0) {
      const selfCat = await getCategoryInfo(moodleUrl, token, categoryId).catch(() => null);
      if (selfCat) semesterCategories = [selfCat];
    }

    const programNameById = new Map(programCategories.map((p) => [p.id, p.name]));

    // ── Collect all courses across all semesters in parallel ──────────────────
    type CourseTask = {
      courseId: number; courseName: string; courseCode: string;
      courseFormat: string; programName: string; semesterName: string;
    };

    const allCourseTasks: CourseTask[] = (
      await Promise.all(
        semesterCategories.map(async (semester) => {
          const courses = await getCoursesByCategory(moodleUrl, token, semester.id).catch(() => []);
          const programName = programNameById.get(semester.parent) ?? "";
          return courses.map((course) => ({
            courseId:     course.id,
            courseName:   course.fullname,
            courseCode:   course.shortname,
            courseFormat: course.format ?? "topics",
            programName,
            semesterName: semester.name,
          }));
        }),
      )
    ).flat();

    // ── Process courses in parallel batches ───────────────────────────────────
    const results = await batchProcess(
      allCourseTasks,
      (task) => processCourse(
        moodleUrl, token,
        task.courseId, task.courseName, task.courseCode, task.courseFormat,
        task.programName, task.semesterName,
        currentDate, photoValidationTexts,
      ),
      BATCH_SIZE,
    );

    // ── Summary ───────────────────────────────────────────────────────────────
    const uniqueIds       = new Set(results.map((r) => r.courseId));
    const repeatedCourses = results.length - uniqueIds.size;

    const summary = {
      high:         results.filter((r) => r.porcentaje >= 80).length,
      medium:       results.filter((r) => r.porcentaje >= 51 && r.porcentaje <= 79).length,
      low:          results.filter((r) => r.porcentaje >= 1  && r.porcentaje <= 50).length,
      noActivity:   results.filter((r) => r.porcentaje === 0).length,
      totalCourses: results.length,
      repeatedCourses,
    };

    const programNames = Array.from(new Set(programCategories.map((p) => p.name))).sort((a, b) =>
      a.localeCompare(b, "es"),
    );
    const semesterNames = Array.from(new Set(semesterCategories.map((s) => s.name))).sort((a, b) =>
      a.localeCompare(b, "es"),
    );

    return NextResponse.json({
      mode: "category",
      categoryId,
      totalCourses: results.length,
      hierarchy: {
        programs:     programCategories.length,
        semesters:    semesterCategories.length,
        programNames,
        semesterNames,
      },
      summary,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    return NextResponse.json(
      { message: `Error en alistamiento API: ${message}` },
      { status: 500 },
    );
  }
};
