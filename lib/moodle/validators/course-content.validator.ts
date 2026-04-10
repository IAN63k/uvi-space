import type {
  ValidationCheck,
  CourseContentValidationResult,
  ProfessorPageChecks,
  ForumChecks,
  MeetingChecks,
  AttendanceChecks,
  MicrocurriculumChecks,
} from "@/lib/moodle/types";
import {
  getCourseContents,
  getCourseModule,
  getPagesByCourse,
  getForumsByCourse,
} from "@/lib/moodle/moodle.service";

// ── Configurable constants ────────────────────────────────────────────────────

export const CONTENT_VALIDATION_CONSTANTS = {
  /** Expected idnumber for the professor presentation page module */
  EXPECTED_PROFESSOR_PAGE_IDNUMBER: "DP01",
  /** Expected idnumber for the consultation forum module */
  EXPECTED_FORUM_IDNUMBER: "FC01",
  /** Expected forum type for general consultation forum */
  EXPECTED_FORUM_TYPE: "general",
  /** Expected modplural for the MS Teams meeting module */
  EXPECTED_MEETING_MODPLURAL: "MS Meetings",
  /**
   * Formats where section 0 is navigation chrome — the professor presentation
   * module lives at section 1. All other formats use section 0.
   * Currently only "onetopic" (tiles layout) applies.
   */
  TAB_BASED_FORMATS: ["onetopic", "tiles"] as readonly string[],
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the section index that should contain the professor presentation
 * module, based on the course format.
 */
export function getPresentationSectionNumber(format: string): number {
  return CONTENT_VALIDATION_CONSTANTS.TAB_BASED_FORMATS.includes(format) ? 1 : 0;
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

  // --- Parallel fetch: sections + all page activities + all forum activities --
  const [sections, pages, forums] = await Promise.all([
    getCourseContents(moodleUrl, token, courseId),
    getPagesByCourse(moodleUrl, token, courseId),
    getForumsByCourse(moodleUrl, token, courseId),
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

  // ── Overall result ─────────────────────────────────────────────────────────

  const passed =
    professorPageResult.passed &&
    consultationForumResult.passed &&
    meetingResult.passed &&
    attendanceResult.passed &&
    microcurriculumResult.passed;

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
    passed,
  };
}
