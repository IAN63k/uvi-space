import type {
  ValidationCheck,
  CourseContentValidationResult,
  ProfessorPageChecks,
  ForumChecks,
  MeetingChecks,
  AttendanceChecks,
  MicrocurriculumChecks,
  BlocksChecks,
  SectionDateCheck,
  GradebookCategoryCheck,
  GradeCategoryItem,
  GradeTreeNode,
  MoodleAssignmentConfig,
  AssignActivityChecks,
  AssignActivityCheck,
  QuizActivityChecks,
  QuizActivityCheck,
  ForumActivityChecks,
  ForumActivityCheck,
  ActivitySettingsResult,
} from "@/lib/moodle/types";
import {
  getCourseContents,
  getCourseModule,
  getPagesByCourse,
  getForumsByCourse,
  getCourseBlocks,
  getGradeTree,
  getGradeItems,
  getAssignmentsByCourse,
  getQuizzesByCourse,
} from "@/lib/moodle/moodle.service";

// ── Configurable constants ────────────────────────────────────────────────────

/** Fixed sample user used to retrieve the grade book structure.
 *  Grade category idnumbers are course-wide — any enrolled user gives the same result. */
export const GRADEBOOK_SAMPLE_USERID = 37560;

/** EFC idnumbers validated via gradereport_user_get_grade_items */
export const REQUIRED_EFC_CODES = ["EFC01", "EFC02", "EFC03"] as const;

/** EFC category names validated via core_grades_get_grade_tree */
export const REQUIRED_EFC_NAMES = [
  "Evaluación Formativa y Continua 1",
  "Evaluación Formativa y Continua 2",
  "Evaluación Formativa y Continua 3",
] as const;

export const REQUIRED_BLOCKS = [
  "badges",
  "completion_progress",
  "dedication",
  "online_users",
  "completionstatus",
] as const;

export const CONTENT_VALIDATION_CONSTANTS = {
  /** Expected idnumber for the professor presentation page module */
  EXPECTED_PROFESSOR_PAGE_IDNUMBER: "DP01",
  /** Expected idnumber for the consultation forum module */
  EXPECTED_FORUM_IDNUMBER: "FC01",
  /** Expected forum type for general consultation forum */
  EXPECTED_FORUM_TYPE: "general",
  /** Expected modplural for the MS Teams meeting module */
  EXPECTED_MEETING_MODPLURAL: "MS Meetings",
  /** Kept for reference — all known formats use section 0 as the presentation section. */
  TAB_BASED_FORMATS: ["onetopic", "tiles"] as readonly string[],
  // ── Activity settings expected values ────────────────────────────────────────
  /** Maximum grade expected on every graded activity */
  EXPECTED_GRADE_MAX: 5,
  /** Maximum number of uploaded files for assignments */
  EXPECTED_MAX_FILES: 3,
  /** Maximum file upload size for assignments in bytes (5 MB) */
  EXPECTED_MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024,
  /** Accepted file types for assignments */
  EXPECTED_FILE_TYPES: "*",
  /** Pass grade expected on every graded activity */
  EXPECTED_GRADE_PASS: 3,
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the section index that should contain the professor presentation
 * module. All course formats (including onetopic/tiles) use section 0.
 */
export function getPresentationSectionNumber(_format: string): number {
  return 0;
}

function makeCheck(
  passed: boolean,
  expected: string | number | boolean,
  actual: string | number | boolean | null,
  label: string,
): ValidationCheck {
  return { passed, expected, actual, label };
}

function failedPageChecks(expectedIdnumber: string): ProfessorPageChecks {
  const fail = (label: string): ValidationCheck =>
    makeCheck(false, "—", null, label);
  return {
    visible:             fail("Módulo visible"),
    visibleOnCoursePage: fail("Visible en página del curso"),
    hasName:             fail("Tiene nombre"),
    idnumber:            makeCheck(false, expectedIdnumber, null, `Número ID = ${expectedIdnumber}`),
    hasContent:          fail("Tiene contenido"),
  };
}

function failedForumChecks(expectedIdnumber: string): ForumChecks {
  const fail = (label: string): ValidationCheck =>
    makeCheck(false, "—", null, label);
  return {
    visible:             fail("Módulo visible"),
    visibleOnCoursePage: fail("Visible en página del curso"),
    idnumber:            makeCheck(false, expectedIdnumber, null, `Número ID = ${expectedIdnumber}`),
    forumType:           makeCheck(false, CONTENT_VALIDATION_CONSTANTS.EXPECTED_FORUM_TYPE, null, "Tipo de foro: general"),
  };
}

function failedMeetingChecks(): MeetingChecks {
  const fail = (label: string): ValidationCheck =>
    makeCheck(false, "—", null, label);
  return {
    visible:             fail("Módulo visible"),
    userVisible:         fail("Visible para el usuario"),
    visibleOnCoursePage: fail("Visible en página del curso"),
    modplural:           makeCheck(false, CONTENT_VALIDATION_CONSTANTS.EXPECTED_MEETING_MODPLURAL, null, `Tipo: ${CONTENT_VALIDATION_CONSTANTS.EXPECTED_MEETING_MODPLURAL}`),
  };
}

function failedAttendanceChecks(): AttendanceChecks {
  const fail = (label: string): ValidationCheck =>
    makeCheck(false, "—", null, label);
  return {
    visible:             fail("Módulo visible"),
    userVisible:         fail("Visible para el usuario"),
    visibleOnCoursePage: fail("Visible en página del curso"),
  };
}

// ── Section date helpers ──────────────────────────────────────────────────────

/**
 * Strips HTML tags and decodes common entities to get plain text.
 * Used server-side where no DOM is available.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Date value: accepts the literal placeholder "DD/MM/AAAA" OR a real date like "15/03/2025" */
const DATE_VALUE     = String.raw`(DD\/MM\/AAAA|\d{2}\/\d{2}\/\d{4})`;

/**
 * Matches "Fecha de Inicio: DD/MM/AAAA" — accepts placeholder or real date.
 * Handles extra spaces and HTML-stripped text.
 */
const START_DATE_RE  = new RegExp(String.raw`Fecha\s+de\s+Inicio\s*:\s*` + DATE_VALUE, "i");
/**
 * Matches "Fecha de Finalización: DD/MM/AAAA" — accent on ó is optional.
 */
const END_DATE_RE    = new RegExp(String.raw`Fecha\s+de\s+Finalizaci[oó]n\s*:\s*` + DATE_VALUE, "i");

const DOCUMENT_MIMETYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function failedMicrocurriculumChecks(): MicrocurriculumChecks {
  const fail = (label: string): ValidationCheck =>
    makeCheck(false, "—", null, label);
  return {
    visible:             fail("Módulo visible"),
    userVisible:         fail("Visible para el usuario"),
    visibleOnCoursePage: fail("Visible en página del curso"),
    hasDocument:         makeCheck(false, "PDF o Word", null, "Tiene documento adjunto"),
  };
}

// ── Main validator ────────────────────────────────────────────────────────────

/**
 * Validates the content structure of a Moodle course.
 *
 * Rules:
 *  1. Counts real sections (section.section > 0).
 *  2. Identifies the presentation section via getPresentationSectionNumber().
 *  3. Validates the first "page" module inside that section against DP01 rules.
 *  4. Validates the "forum" module with idnumber FC01 in the same section.
 *
 * Performance:
 *  - getCourseContents + getPagesByCourse + getForumsByCourse run in parallel.
 *  - getCourseModule calls are batched in parallel (page + all forum candidates).
 */
export async function validateCourseContent(
  moodleUrl: string,
  token: string,
  courseId: number,
  courseFormat: string,
  courseName: string,
): Promise<CourseContentValidationResult> {
  const expectedPageIdnumber  = CONTENT_VALIDATION_CONSTANTS.EXPECTED_PROFESSOR_PAGE_IDNUMBER;
  const expectedForumIdnumber = CONTENT_VALIDATION_CONSTANTS.EXPECTED_FORUM_IDNUMBER;
  const expectedForumType     = CONTENT_VALIDATION_CONSTANTS.EXPECTED_FORUM_TYPE;

  // --- Parallel fetch: sections + pages + forums + blocks ----------------------
  // assigns, quizzes, grade tree and grade items are fetched separately so that
  // access errors on any of them degrade gracefully without breaking the rest.
  const [sections, pages, forums, courseBlocksList] = await Promise.all([
    getCourseContents(moodleUrl, token, courseId),
    getPagesByCourse(moodleUrl, token, courseId),
    getForumsByCourse(moodleUrl, token, courseId),
    getCourseBlocks(moodleUrl, token, courseId),
  ]);

  let assigns: Awaited<ReturnType<typeof getAssignmentsByCourse>> = [];
  let assignsError: string | null = null;
  let quizzes: Awaited<ReturnType<typeof getQuizzesByCourse>> = [];
  let quizzesError: string | null = null;
  let gradeTree: Awaited<ReturnType<typeof getGradeTree>> | null = null;
  let gradeTreeError: string | null = null;
  let allGradeItems: Awaited<ReturnType<typeof getGradeItems>> = [];
  let gradeItemsError: string | null = null;

  await Promise.all([
    getAssignmentsByCourse(moodleUrl, token, courseId)
      .then((a) => { assigns = a; console.log("[mod_assign_get_assignments]", JSON.stringify(a, null, 2)); })
      .catch((err) => { assignsError = err instanceof Error ? err.message : "Error desconocido"; }),
    getQuizzesByCourse(moodleUrl, token, courseId)
      .then((q) => { quizzes = q; console.log("[mod_quiz_get_quizzes_by_courses]", JSON.stringify(q, null, 2)); })
      .catch((err) => { quizzesError = err instanceof Error ? err.message : "Error desconocido"; }),
    getGradeTree(moodleUrl, token, courseId)
      .then((t) => { gradeTree = t; })
      .catch((err) => { gradeTreeError = err instanceof Error ? err.message : "Error desconocido"; }),
    getGradeItems(moodleUrl, token, courseId, GRADEBOOK_SAMPLE_USERID)
      .then((items) => { allGradeItems = items; })
      .catch((err) => { gradeItemsError = err instanceof Error ? err.message : "Error desconocido"; }),
  ]);

  // --- Rule 1: Count real sections (section index > 0) ----------------------
  const totalSections = sections.filter((s) => s.section > 0).length;

  // --- Rule 2: Find the page module (preferred section first) ----------------
  const preferredSectionNumber = getPresentationSectionNumber(courseFormat);

  const orderedSections = [
    ...sections.filter((s) => s.section === preferredSectionNumber),
    ...sections.filter((s) => s.section !== preferredSectionNumber),
  ];

  let pageModule: (typeof sections)[0]["modules"][0] | undefined;
  let resolvedSectionNumber = preferredSectionNumber;

  for (const section of orderedSections) {
    const mod = section.modules.find((m) => m.modname === "page");
    if (mod) {
      pageModule = mod;
      resolvedSectionNumber = section.section;
      break;
    }
  }

  const presentationSectionNumber = resolvedSectionNumber;

  // --- Collect forum module candidates from presentation section --------------
  const presentationSection = sections.find((s) => s.section === presentationSectionNumber);
  const forumModules = presentationSection?.modules.filter((m) => m.modname === "forum") ?? [];

  // --- Batch all getCourseModule calls in parallel ---------------------------
  const moduleDetailPromises: Promise<void>[] = [];

  let pageModuleDetail: { idnumber: string; visible: number; visibleoncoursepage: number } | undefined;
  if (pageModule) {
    moduleDetailPromises.push(
      getCourseModule(moodleUrl, token, pageModule.id).then((d) => { pageModuleDetail = d; }),
    );
  }

  const forumModuleDetails = new Map<number, { idnumber: string; visible: number; visibleoncoursepage: number }>();
  for (const fm of forumModules) {
    moduleDetailPromises.push(
      getCourseModule(moodleUrl, token, fm.id).then((d) => { forumModuleDetails.set(fm.id, d); }),
    );
  }

  await Promise.all(moduleDetailPromises);

  // ── Professor page validation ──────────────────────────────────────────────

  const professorPageResult: CourseContentValidationResult["professorPage"] = (() => {
    if (!pageModule || !pageModuleDetail) {
      return {
        found: false,
        cmid: null,
        checks: failedPageChecks(expectedPageIdnumber),
        contentHtml: null,
        passed: false,
      };
    }

    const pageContent = pages.find((p) => p.id === pageModule!.instance);
    const contentHtml = pageContent?.content ?? null;
    const hasContentValue = (contentHtml ?? "").trim().length > 0;

    const checks: ProfessorPageChecks = {
      visible: makeCheck(
        pageModule.visible === 1,
        1,
        pageModule.visible,
        "Módulo visible",
      ),
      visibleOnCoursePage: makeCheck(
        pageModule.visibleoncoursepage === 1,
        1,
        pageModule.visibleoncoursepage,
        "Visible en página del curso",
      ),
      hasName: makeCheck(
        pageModule.name.trim().length > 0,
        "no vacío",
        pageModule.name.trim() || "(sin nombre)",
        "Tiene nombre",
      ),
      idnumber: makeCheck(
        pageModuleDetail.idnumber === expectedPageIdnumber,
        expectedPageIdnumber,
        pageModuleDetail.idnumber || "(vacío)",
        `Número ID = ${expectedPageIdnumber}`,
      ),
      hasContent: makeCheck(
        hasContentValue,
        "no vacío",
        hasContentValue
          ? `${(contentHtml ?? "").length} caracteres`
          : "(sin contenido)",
        "Tiene contenido",
      ),
    };

    const passed = Object.values(checks).every((c) => c.passed);
    return { found: true, cmid: pageModule.id, checks, contentHtml, passed };
  })();

  // ── Consultation forum validation ──────────────────────────────────────────

  const consultationForumResult: CourseContentValidationResult["consultationForum"] = (() => {
    // Find the forum module whose getCourseModule detail has idnumber === FC01
    let fc01Module: (typeof forumModules)[0] | undefined;
    let fc01Detail: { idnumber: string; visible: number; visibleoncoursepage: number } | undefined;

    for (const fm of forumModules) {
      const detail = forumModuleDetails.get(fm.id);
      if (detail?.idnumber === expectedForumIdnumber) {
        fc01Module = fm;
        fc01Detail  = detail;
        break;
      }
    }

    if (!fc01Module || !fc01Detail) {
      return {
        found: false,
        cmid: null,
        checks: failedForumChecks(expectedForumIdnumber),
        passed: false,
      };
    }

    // Match to forum list for type field (forums keyed by cmid)
    const forumData = forums.find((f) => f.cmid === fc01Module!.id);
    const forumType = forumData?.type ?? "(desconocido)";

    const checks: ForumChecks = {
      visible: makeCheck(
        fc01Module.visible === 1,
        1,
        fc01Module.visible,
        "Módulo visible",
      ),
      visibleOnCoursePage: makeCheck(
        fc01Module.visibleoncoursepage === 1,
        1,
        fc01Module.visibleoncoursepage,
        "Visible en página del curso",
      ),
      idnumber: makeCheck(
        fc01Detail.idnumber === expectedForumIdnumber,
        expectedForumIdnumber,
        fc01Detail.idnumber || "(vacío)",
        `Número ID = ${expectedForumIdnumber}`,
      ),
      forumType: makeCheck(
        forumType === expectedForumType,
        expectedForumType,
        forumType,
        "Tipo de foro: general",
      ),
    };

    const passed = Object.values(checks).every((c) => c.passed);
    return { found: true, cmid: fc01Module.id, checks, passed };
  })();

  // ── MS Meeting validation ──────────────────────────────────────────────────

  const meetingResult: CourseContentValidationResult["meeting"] = (() => {
    const meetingModule = presentationSection?.modules.find((m) => m.modname === "msmeeting");

    if (!meetingModule) {
      return {
        found: false,
        cmid: null,
        checks: failedMeetingChecks(),
        passed: false,
      };
    }

    const expectedModplural = CONTENT_VALIDATION_CONSTANTS.EXPECTED_MEETING_MODPLURAL;
    const actualModplural   = meetingModule.modplural ?? "(desconocido)";

    const checks: MeetingChecks = {
      visible: makeCheck(
        meetingModule.visible === 1,
        1,
        meetingModule.visible,
        "Módulo visible",
      ),
      userVisible: makeCheck(
        meetingModule.uservisible === true,
        true,
        meetingModule.uservisible,
        "Visible para el usuario",
      ),
      visibleOnCoursePage: makeCheck(
        meetingModule.visibleoncoursepage === 1,
        1,
        meetingModule.visibleoncoursepage,
        "Visible en página del curso",
      ),
      modplural: makeCheck(
        actualModplural === expectedModplural,
        expectedModplural,
        actualModplural,
        `Tipo: ${expectedModplural}`,
      ),
    };

    const passed = Object.values(checks).every((c) => c.passed);
    return { found: true, cmid: meetingModule.id, checks, passed };
  })();

  // ── Attendance validation ──────────────────────────────────────────────────

  const attendanceResult: CourseContentValidationResult["attendance"] = (() => {
    const attendanceModule = presentationSection?.modules.find((m) => m.modname === "attendance");

    if (!attendanceModule) {
      return {
        found: false,
        cmid: null,
        checks: failedAttendanceChecks(),
        passed: false,
      };
    }

    const checks: AttendanceChecks = {
      visible: makeCheck(
        attendanceModule.visible === 1,
        1,
        attendanceModule.visible,
        "Módulo visible",
      ),
      userVisible: makeCheck(
        attendanceModule.uservisible === true,
        true,
        attendanceModule.uservisible,
        "Visible para el usuario",
      ),
      visibleOnCoursePage: makeCheck(
        attendanceModule.visibleoncoursepage === 1,
        1,
        attendanceModule.visibleoncoursepage,
        "Visible en página del curso",
      ),
    };

    const passed = Object.values(checks).every((c) => c.passed);
    return { found: true, cmid: attendanceModule.id, checks, passed };
  })();

  // ── Microcurriculum resource validation ───────────────────────────────────

  const microcurriculumResult: CourseContentValidationResult["microcurriculum"] = (() => {
    // Normalize a string: strip diacritics, collapse whitespace, lowercase
    const normalize = (s: string) =>
      s.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");

    // Accept both "resource" (file upload) and "url" (external link) modules
    const resourceModule = presentationSection?.modules.find(
      (m) =>
        (m.modname === "resource" || m.modname === "url") &&
        normalize(m.name).includes("microcurriculo"),
    );

    if (!resourceModule) {
      return {
        found: false,
        cmid: null,
        checks: failedMicrocurriculumChecks(),
        fileUrl: null,
        passed: false,
      };
    }

    // For "resource" modules: look for PDF/Word file in contents
    // For "url" modules: the content item has type "url" with the target URL in fileurl
    const docFile = resourceModule.contents?.find(
      (c) => c.type === "file" && DOCUMENT_MIMETYPES.has(c.mimetype ?? ""),
    );
    const urlContent = resourceModule.contents?.find((c) => c.type === "url" && c.fileurl);
    const anyContent = resourceModule.contents?.find((c) => c.fileurl);

    const resolvedContent = docFile ?? urlContent ?? anyContent;
    const fileUrl = resolvedContent?.fileurl ?? null;

    // hasDocument passes if there's a PDF/Word file OR a URL content pointing somewhere
    const hasDoc = docFile !== undefined || (urlContent !== undefined && !!urlContent.fileurl);

    const checks: MicrocurriculumChecks = {
      visible: makeCheck(
        resourceModule.visible === 1,
        1,
        resourceModule.visible,
        "Módulo visible",
      ),
      userVisible: makeCheck(
        resourceModule.uservisible === true,
        true,
        resourceModule.uservisible,
        "Visible para el usuario",
      ),
      visibleOnCoursePage: makeCheck(
        resourceModule.visibleoncoursepage === 1,
        1,
        resourceModule.visibleoncoursepage,
        "Visible en página del curso",
      ),
      hasDocument: makeCheck(
        hasDoc,
        "PDF, Word o URL",
        hasDoc ? (resolvedContent?.filename?.trim() || "enlace") : "(sin contenido)",
        "Tiene documento o enlace",
      ),
    };

    const passed = Object.values(checks).every((c) => c.passed);
    return { found: true, cmid: resourceModule.id, checks, fileUrl, passed };
  })();

  // ── Blocks validation ──────────────────────────────────────────────────────

  const blocksResult: CourseContentValidationResult["blocks"] = (() => {
    const presentNames = new Set(courseBlocksList.map((b) => b.name));

    const checks: BlocksChecks = Object.fromEntries(
      REQUIRED_BLOCKS.map((blockName) => {
        const present = presentNames.has(blockName);
        return [
          blockName,
          makeCheck(present, "presente", present ? "presente" : "ausente", blockName),
        ];
      }),
    );

    const passed = Object.values(checks).every((c) => c.passed);
    return { checks, passed };
  })();

  // ── Section dates validation ───────────────────────────────────────────────

  const sectionDatesResult: CourseContentValidationResult["sectionDates"] = (() => {
    // Presentation is always section 0; content sections start at 1.
    const firstContentSection = 1;

    // Only validate visible content sections (section >= firstContentSection)
    // Exclude sections named "Estudiante Unicamacho" or whose name contains "Tema"
    const contentSections = sections.filter((s) => {
      if (s.section < firstContentSection || s.visible !== 1) return false;
      const name = (s.name ?? "").trim();
      if (name === "Estudiante Unicamacho") return false;
      if (/Tema/i.test(name)) return false;
      return true;
    });

    const sectionChecks: SectionDateCheck[] = contentSections.map((s) => {
      const text       = htmlToPlainText(s.summary ?? "");
      const startMatch = START_DATE_RE.exec(text);
      const endMatch   = END_DATE_RE.exec(text);

      const startValue = startMatch?.[1] ?? null;
      const endValue   = endMatch?.[1] ?? null;

      // Passes ONLY when the placeholder "DD/MM/AAAA" is present (not a real date).
      const hasStartDate = makeCheck(
        startValue === "DD/MM/AAAA",
        "DD/MM/AAAA",
        startValue ?? "(no encontrada)",
        "Fecha de inicio",
      );
      const hasEndDate = makeCheck(
        endValue === "DD/MM/AAAA",
        "DD/MM/AAAA",
        endValue ?? "(no encontrada)",
        "Fecha de finalización",
      );

      return {
        sectionNumber: s.section,
        sectionName:   s.name || `Sección ${s.section}`,
        hasStartDate,
        hasEndDate,
        passed: hasStartDate.passed && hasEndDate.passed,
      };
    });

    const passed = sectionChecks.length === 0 || sectionChecks.every((s) => s.passed);
    return { sections: sectionChecks, passed };
  })();

  // ── Gradebook categories validation ───────────────────────────────────────

  const gradebookResult: CourseContentValidationResult["gradebook"] = (() => {
    const combinedError = gradeTreeError ?? gradeItemsError ?? undefined;
    const normalize = (s: string) =>
      s.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");

    // ── Grade tree: name + empty-children checks ──────────────────────────────
    const rootChildren = ((gradeTree as GradeTreeNode | null)?.children ?? []).filter((n: GradeTreeNode) => n.iscategory);

    const categories: GradebookCategoryCheck[] = REQUIRED_EFC_NAMES.map((expectedName) => {
      if (gradeTreeError !== null) {
        return {
          expectedName,
          found: false,
          categoryId: null,
          exists:        makeCheck(false, "presente", `(error: ${gradeTreeError})`, `Categoría "${expectedName}"`),
          emptyChildren: makeCheck(false, "null",     null,                          "Sin ítems en la categoría"),
          passed: false,
        };
      }

      const normalizedExpected = normalize(expectedName);
      const match = rootChildren.find((n: typeof rootChildren[0]) => normalize(n.name) === normalizedExpected);

      const exists = makeCheck(
        match !== undefined,
        "presente",
        match !== undefined ? "presente" : "ausente",
        `Categoría "${expectedName}"`,
      );

      const hasChildren =
        match !== undefined &&
        Array.isArray(match.children) &&
        match.children.length > 0;

      const emptyChildren = makeCheck(
        !hasChildren,
        "null",
        hasChildren ? `${match!.children!.length} ítem(s)` : "null",
        "Sin ítems dentro de la categoría",
      );

      return {
        expectedName,
        found: match !== undefined,
        categoryId: match?.id ?? null,
        exists,
        emptyChildren,
        passed: exists.passed && emptyChildren.passed,
      };
    });

    // ── Grade items: EFC idnumber checks ─────────────────────────────────────
    const categoryGradeItems = allGradeItems.filter((item) => item.itemtype === "category");

    const categoryItems: GradeCategoryItem[] = categoryGradeItems.map((item) => {
      const hasId = (item.idnumber ?? "").trim().length > 0;
      return {
        itemId:   item.id,
        itemname: item.itemname ?? `Categoría ${item.id}`,
        idnumber: item.idnumber ?? "",
        hasIdnumber: makeCheck(
          hasId,
          "no vacío",
          hasId ? item.idnumber : "(vacío)",
          "Tiene número ID",
        ),
      };
    });

    const presentCodes = new Set(categoryGradeItems.map((item) => item.idnumber?.trim()));
    const efcChecks: Record<string, ValidationCheck> = Object.fromEntries(
      REQUIRED_EFC_CODES.map((code) => {
        const found = gradeItemsError === null && presentCodes.has(code);
        return [
          code,
          makeCheck(
            found,
            "presente",
            gradeItemsError !== null ? `(error: ${gradeItemsError})` : found ? "presente" : "ausente",
            `Código ${code}`,
          ),
        ];
      }),
    );

    const allCategoriesOk    = categories.every((c) => c.passed);
    const allItemsHaveId     = categoryItems.every((i) => i.hasIdnumber.passed);
    const allEfcPresent      = Object.values(efcChecks).every((c) => c.passed);
    const passed             = allCategoriesOk && allItemsHaveId && allEfcPresent;

    return { categories, categoryItems, efcChecks, error: combinedError, passed };
  })();

  // ── Activity settings validation ───────────────────────────────────────────

  const activitySettingsResult: ActivitySettingsResult = (() => {
    const { EXPECTED_GRADE_MAX, EXPECTED_GRADE_PASS } = CONTENT_VALIDATION_CONSTANTS;

    // Map cmid → completion mode (from sections data, avoids extra API calls)
    const completionByCmid = new Map<number, number>();
    for (const section of sections) {
      for (const mod of section.modules) {
        completionByCmid.set(mod.id, mod.completion);
      }
    }

    // Map "modname:instanceId" → gradepass (from already-fetched grade items)
    const gradePassMap    = new Map<string, number>();
    // Fallback map by cmid in case iteminstance lookup fails
    const gradePassByCmid = new Map<number, number>();
    for (const item of allGradeItems) {
      if (
        item.itemtype === "mod" &&
        item.itemmodule &&
        item.gradepass !== undefined &&
        item.gradepass > 0
      ) {
        if (item.iteminstance !== undefined) {
          gradePassMap.set(`${item.itemmodule}:${item.iteminstance}`, item.gradepass);
        }
        if (item.cmid !== undefined) {
          gradePassByCmid.set(item.cmid, item.gradepass);
        }
      }
    }

    // Helper: look up a single assign plugin config value
    const getAssignConfig = (
      configs: MoodleAssignmentConfig[] | undefined,
      plugin: string,
      subtype: string,
      name: string,
    ): string | null =>
      configs?.find((c) => c.plugin === plugin && c.subtype === subtype && c.name === name)?.value ?? null;

    // ── Assignments ────────────────────────────────────────────────────────────
    const assignmentChecks: AssignActivityCheck[] = assigns.map((a) => {
      const { EXPECTED_GRADE_MAX, EXPECTED_GRADE_PASS, EXPECTED_MAX_FILES, EXPECTED_MAX_FILE_SIZE_BYTES, EXPECTED_FILE_TYPES } = CONTENT_VALIDATION_CONSTANTS;
      const completionMode = completionByCmid.get(a.cmid) ?? 0;
      const gradePassVal   = gradePassMap.get(`assign:${a.id}`) ?? gradePassByCmid.get(a.cmid);

      // assignsubmission_file plugin configs
      const maxFilesRaw    = getAssignConfig(a.configs, "file", "assignsubmission", "maxfilesubmissions");
      const maxFilesNum    = maxFilesRaw !== null ? parseInt(maxFilesRaw, 10) : null;
      const maxFileSizeRaw = getAssignConfig(a.configs, "file", "assignsubmission", "maxsubmissionsizebytes");
      const maxFileSizeNum = maxFileSizeRaw !== null ? parseInt(maxFileSizeRaw, 10) : null;
      const fileTypesRaw   = getAssignConfig(a.configs, "file", "assignsubmission", "filetypeslist");

      // assignfeedback plugin configs
      const fbComments = getAssignConfig(a.configs, "comments", "assignfeedback", "enabled");
      const fbPdf      = getAssignConfig(a.configs, "editpdf",  "assignfeedback", "enabled");
      const fbFile     = getAssignConfig(a.configs, "file",     "assignfeedback", "enabled");
      const fbOffline  = getAssignConfig(a.configs, "offline",  "assignfeedback", "enabled");

      const checks: AssignActivityChecks = {
        grade: makeCheck(
          a.grade === EXPECTED_GRADE_MAX,
          EXPECTED_GRADE_MAX,
          a.grade,
          `Puntuación máxima = ${EXPECTED_GRADE_MAX}`,
        ),
        teamSubmission: makeCheck(
          a.teamsubmission === 0,
          0,
          a.teamsubmission,
          "Sin entrega por grupos",
        ),
        dueDate: makeCheck(
          a.duedate === 0,
          0,
          a.duedate,
          "Sin fecha de entrega",
        ),
        allowSubmissionsFrom: makeCheck(
          a.allowsubmissionsfromdate === 0,
          0,
          a.allowsubmissionsfromdate,
          "Sin fecha de inicio de entregas",
        ),
        completionSubmit: makeCheck(
          a.completionsubmit === 1,
          1,
          a.completionsubmit,
          "Finalización: debe entregar",
        ),
        completionView: makeCheck(
          completionMode === 2,
          2,
          completionMode,
          "Finalización automática activada",
        ),
        maxFiles: makeCheck(
          maxFilesNum === EXPECTED_MAX_FILES,
          EXPECTED_MAX_FILES,
          maxFilesNum ?? "(no encontrado)",
          `Máx. archivos = ${EXPECTED_MAX_FILES}`,
        ),
        maxFileSize: makeCheck(
          maxFileSizeNum === EXPECTED_MAX_FILE_SIZE_BYTES,
          `${EXPECTED_MAX_FILE_SIZE_BYTES} (5 MB)`,
          maxFileSizeNum ?? "(no encontrado)",
          "Tamaño máximo de archivo = 5 MB",
        ),
        fileTypesList: makeCheck(
          fileTypesRaw === EXPECTED_FILE_TYPES,
          EXPECTED_FILE_TYPES,
          fileTypesRaw ?? "(no encontrado)",
          `Tipos de archivo = ${EXPECTED_FILE_TYPES}`,
        ),
        feedbackComments: makeCheck(
          fbComments === "1",
          "1",
          fbComments ?? "(no encontrado)",
          "Retroalimentación: Comentarios",
        ),
        feedbackPdf: makeCheck(
          fbPdf === "1",
          "1",
          fbPdf ?? "(no encontrado)",
          "Retroalimentación: Anotaciones PDF",
        ),
        feedbackFile: makeCheck(
          fbFile === "1",
          "1",
          fbFile ?? "(no encontrado)",
          "Retroalimentación: Archivos",
        ),
        feedbackOffline: makeCheck(
          fbOffline === "1",
          "1",
          fbOffline ?? "(no encontrado)",
          "Retroalimentación: Hoja de calificación offline",
        ),
        gradePass: makeCheck(
          gradePassVal !== undefined && gradePassVal === EXPECTED_GRADE_PASS,
          EXPECTED_GRADE_PASS,
          gradePassVal ?? "(no encontrada)",
          `Calificación para aprobar: ${EXPECTED_GRADE_PASS},0`,
        ),
      };

      return { cmid: a.cmid, name: a.name, checks, passed: Object.values(checks).every((c) => c.passed) };
    });

    // ── Quizzes ────────────────────────────────────────────────────────────────
    const quizChecks: QuizActivityCheck[] = quizzes.map((q) => {
      const completionMode = completionByCmid.get(q.coursemodule) ?? 0;
      const gradePassVal   = gradePassMap.get(`quiz:${q.id}`) ?? gradePassByCmid.get(q.coursemodule);

      const checks: QuizActivityChecks = {
        grade: makeCheck(
          q.grade === EXPECTED_GRADE_MAX,
          EXPECTED_GRADE_MAX,
          q.grade,
          `Puntuación máxima = ${EXPECTED_GRADE_MAX}`,
        ),
        timeOpen: makeCheck(
          q.timeopen === 0,
          0,
          q.timeopen,
          "Sin fecha de apertura",
        ),
        timeClose: makeCheck(
          q.timeclose === 0,
          0,
          q.timeclose,
          "Sin fecha de cierre",
        ),
        completionPass: makeCheck(
          q.completionpass === 1,
          1,
          q.completionpass,
          "Finalización: debe aprobar",
        ),
        completionView: makeCheck(
          completionMode === 2,
          2,
          completionMode,
          "Finalización automática activada",
        ),
        gradePass: makeCheck(
          gradePassVal !== undefined && gradePassVal === EXPECTED_GRADE_PASS,
          EXPECTED_GRADE_PASS,
          gradePassVal ?? "(no encontrada)",
          `Calificación para aprobar: ${EXPECTED_GRADE_PASS},0`,
        ),
      };

      return { cmid: q.coursemodule, name: q.name, checks, passed: Object.values(checks).every((c) => c.passed) };
    });

    // ── Forums ─────────────────────────────────────────────────────────────────
    const forumChecks: ForumActivityCheck[] = forums.map((f) => {
      const completionMode       = completionByCmid.get(f.cmid) ?? 0;
      const scale                = f.scale ?? 0;
      const completionDiscussions = f.completiondiscussions ?? 0;

      const checks: ForumActivityChecks = {
        scale: makeCheck(
          scale === EXPECTED_GRADE_MAX,
          EXPECTED_GRADE_MAX,
          scale,
          `Puntuación máxima = ${EXPECTED_GRADE_MAX}`,
        ),
        completionDiscussions: makeCheck(
          completionDiscussions >= 1,
          "≥ 1",
          completionDiscussions,
          "Finalización: mínimo 1 discusión",
        ),
        completionView: makeCheck(
          completionMode === 2,
          2,
          completionMode,
          "Finalización automática activada",
        ),
      };

      return { cmid: f.cmid, name: f.name, checks, passed: Object.values(checks).every((c) => c.passed) };
    });

    const combinedActivityError = assignsError ?? quizzesError ?? undefined;

    const passed =
      combinedActivityError === undefined &&
      (assignmentChecks.length === 0 || assignmentChecks.every((a) => a.passed)) &&
      (quizChecks.length      === 0 || quizChecks.every((q) => q.passed))        &&
      (forumChecks.length     === 0 || forumChecks.every((f) => f.passed));

    return {
      assignments: assignmentChecks,
      quizzes:     quizChecks,
      forums:      forumChecks,
      error:       combinedActivityError,
      passed,
    };
  })();

  // ── Overall result ─────────────────────────────────────────────────────────

  const passed =
    professorPageResult.passed &&
    consultationForumResult.passed &&
    meetingResult.passed &&
    attendanceResult.passed &&
    microcurriculumResult.passed &&
    blocksResult.passed &&
    sectionDatesResult.passed &&
    gradebookResult.passed &&
    activitySettingsResult.passed;

  return {
    courseId,
    courseName,
    courseFormat,
    totalSections,
    presentationSection: presentationSectionNumber,
    professorPage: professorPageResult,
    consultationForum: consultationForumResult,
    meeting: meetingResult,
    attendance: attendanceResult,
    microcurriculum: microcurriculumResult,
    blocks: blocksResult,
    sectionDates: sectionDatesResult,
    gradebook: gradebookResult,
    activitySettings: activitySettingsResult,
    courseUrl: `${moodleUrl.replace(/\/$/, "")}/course/view.php?id=${courseId}`,
    passed,
  };
}
