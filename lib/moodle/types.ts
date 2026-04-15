export interface MoodleCategory {
  id: number;
  name: string;
  idnumber: string;
  description: string;
  parent: number;
  coursecount: number;
  visible: number;
  depth: number;
  path: string;
}

export interface MoodleCourseFormatOption {
  name: string;
  value: string;
}

export interface MoodleCourseCustomField {
  name: string;
  shortname: string;
  type: string;
  valueraw: string;
  value: string;
}

/** Full shape returned by core_course_get_courses / core_course_get_courses_by_field */
export interface MoodleCourse {
  // ── Required fields ─────────────────────────────────────────────────────────
  id: number;
  shortname: string;
  categoryid: number;
  fullname: string;
  displayname: string;
  summary: string;
  summaryformat: number;       // 1=HTML, 0=MOODLE, 2=PLAIN, 4=MARKDOWN
  format: string;              // weeks, topics, social, site, onetopic…
  startdate: number;
  enddate: number;
  showactivitydates: number;
  showcompletionconditions: number;

  // ── Optional fields ──────────────────────────────────────────────────────────
  idnumber?: string;
  categorysortorder?: number;
  showgrades?: number;         // 1=shown, 0=hidden
  newsitems?: number;
  /** @deprecated use courseformatoptions */
  numsections?: number;
  maxbytes?: number;
  showreports?: number;        // 1=shown, 0=hidden
  visible?: number;            // 1=available, 0=not available
  /** @deprecated use courseformatoptions */
  hiddensections?: number;
  groupmode?: number;          // 0=no group, 1=separate, 2=visible
  groupmodeforce?: number;     // 1=yes, 0=no
  defaultgroupingid?: number;
  timecreated?: number;
  timemodified?: number;
  enablecompletion?: number;
  completionnotify?: number;   // 1=yes, 0=no
  lang?: string;
  forcetheme?: string;
  courseformatoptions?: MoodleCourseFormatOption[];
  customfields?: MoodleCourseCustomField[];

  // ── Image fields (not in core spec but returned by some endpoints) ───────────
  /** Direct image URL — Moodle 3.6+ via core_course_get_courses_by_field */
  courseimage?: string;
  /** Overview files (older Moodle versions) */
  overviewfiles?: Array<{ fileurl: string; mimetype?: string }>;
}

/** Dynamic set of field → expected-value pairs. Only active fields are included. */
export type ValidationRules = Record<string, string | number | boolean>;

export interface CourseError {
  field: string;
  expected: string | number | boolean;
  actual: string | number | null | undefined;
}

export interface CourseValidationResult {
  id: number;
  shortname: string;
  fullname: string;
  idnumber: string;
  categoryId: number;
  categoryName: string;
  // ── Configuración general ────────────────────────────────────────────────────
  visible: number;
  format: string;
  maxbytes: number;
  enablecompletion: number;
  lang: string;
  startdate: number;
  enddate: number;
  forcetheme: string;
  summaryformat: number;
  // ── Configuración de apariencia ──────────────────────────────────────────────
  newsitems: number;
  showgrades: number;
  showreports: number;
  showactivitydates: number;
  showcompletionconditions: number;
  // ── Configuración de grupos ──────────────────────────────────────────────────
  groupmode: number;
  groupmodeforce: number;
  defaultgroupingid: number;
  // ── Finalización ────────────────────────────────────────────────────────────
  completionnotify: number;
  // ── Estado de validación ─────────────────────────────────────────────────────
  status: "OK" | "FAIL";
  errors: CourseError[];
  /** Direct URL to the course in Moodle: {moodleUrl}/course/view.php?id={id} */
  courseUrl: string;
  /** Resolved overview image URL (undefined if none available) */
  overviewImageUrl?: string;
}

export interface CourseSummary {
  id: number;
  shortname: string;
  fullname: string;
  idnumber: string;
  status: "OK" | "FAIL";
  errorCount: number;
}

export interface CategoryNode {
  id: number;
  name: string;
  idnumber: string;
  parent: number;
  coursecount: number;
  children: CategoryNode[];
  courses: CourseSummary[];
}

export interface RevisionCursosResponse {
  total: number;
  ok: number;
  fallos: number;
  errorsByField: Record<string, number>;
  results: CourseValidationResult[];
  categoryTree: CategoryNode[];
  message?: string;
}

// ── Content Validation Types ─────────────────────────────────────────────────

export interface CourseSection {
  id: number;
  name: string;
  visible: number;
  summary: string;
  section: number;
  hiddenbynumsections: number;
  uservisible: boolean;
  modules: CourseModule[];
}

export interface ModuleContent {
  /** "file" for uploaded files, "url" for external links */
  type: string;
  filename: string;
  fileurl: string;
  mimetype?: string;
  filesize?: number;
}

export interface CourseModule {
  id: number;
  name: string;
  instance: number;
  contextid: number;
  visible: number;
  uservisible: boolean;
  visibleoncoursepage: number;
  modname: string;
  modplural?: string;
  onclick?: string;
  completion: number;
  availability: string | null;
  idnumber?: string;
  contents?: ModuleContent[];
}

export interface CourseModuleDetail {
  id: number;
  course: number;
  name: string;
  idnumber: string;
  visible: number;
  visibleoncoursepage: number;
}

export interface MoodlePage {
  id: number;
  course: number;
  name: string;
  intro: string;
  content: string;
  contentformat: number;
  timemodified: number;
}

export interface MoodleForum {
  id: number;
  course: number;
  name: string;
  /** "general" | "news" | "single" | "eachuser" | "blog" | "qanda" */
  type: string;
  intro: string;
  cmid: number;
  timemodified: number;
  // Additional fields returned by mod_forum_get_forums_by_courses
  forcesubscribe?: number;
  /** 0 = no rating; otherwise an aggregate type */
  assessed?: number;
  /** Positive = max points; negative = scale ID; 0 = no rating */
  scale?: number;
  maxbytes?: number;
  maxattachments?: number;
  completiondiscussions?: number;
  completionreplies?: number;
}

// ── Activity Settings API types ───────────────────────────────────────────────

export interface MoodleAssignmentConfig {
  plugin: string;
  subtype: string;
  name: string;
  value: string;
}

export interface MoodleAssignment {
  id: number;
  cmid: number;
  course: number;
  name: string;
  /** Maximum grade (positive) or scale ID (negative) */
  grade: number;
  teamsubmission: number;
  duedate: number;
  allowsubmissionsfromdate: number;
  submissiondrafts: number;
  sendnotifications: number;
  requiresubmissionstatement: number;
  blindmarking: number;
  maxattempts: number;
  completionsubmit: number;
  configs?: MoodleAssignmentConfig[];
}

export interface MoodleQuiz {
  id: number;
  /** cmid */
  coursemodule: number;
  course: number;
  name: string;
  timeopen: number;
  timeclose: number;
  timelimit: number;
  attempts: number;
  grademethod: number;
  questionsperpage: number;
  shuffleanswers: number;
  preferredbehaviour: string;
  overduehandling: string;
  graceperiod: number;
  completionpass: number;
  /** Maximum grade for the quiz */
  grade: number;
}

export interface ValidationCheck {
  passed: boolean;
  expected: string | number | boolean;
  actual: string | number | boolean | null;
  label: string;
}

export interface ProfessorPageChecks {
  visible: ValidationCheck;
  visibleOnCoursePage: ValidationCheck;
  hasName: ValidationCheck;
  idnumber: ValidationCheck;
  hasContent: ValidationCheck;
}

export interface ForumChecks {
  visible: ValidationCheck;
  visibleOnCoursePage: ValidationCheck;
  idnumber: ValidationCheck;
  forumType: ValidationCheck;
}

export interface MeetingChecks {
  visible: ValidationCheck;
  userVisible: ValidationCheck;
  visibleOnCoursePage: ValidationCheck;
  modplural: ValidationCheck;
}

export interface AttendanceChecks {
  visible: ValidationCheck;
  userVisible: ValidationCheck;
  visibleOnCoursePage: ValidationCheck;
}

export interface MicrocurriculumChecks {
  visible: ValidationCheck;
  userVisible: ValidationCheck;
  visibleOnCoursePage: ValidationCheck;
  hasDocument: ValidationCheck;
}

export interface SectionDateCheck {
  sectionNumber: number;
  sectionName: string;
  hasStartDate: ValidationCheck;
  hasEndDate: ValidationCheck;
  passed: boolean;
}

export interface GradeTreeNode {
  id: string;
  name: string;
  iscategory: boolean;
  haschildcategories?: boolean;
  children: GradeTreeNode[] | null;
}

export interface GradebookCategoryCheck {
  expectedName: string;
  found: boolean;
  categoryId: string | null;
  exists: ValidationCheck;
  emptyChildren: ValidationCheck;
  passed: boolean;
}

export interface MoodleEnrolledUser {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  fullname: string;
  email: string;
  idnumber?: string;
}

export interface GradeItemGrade {
  userid: number;
  /** Grade value as a string (e.g. "4.50000") or null/"-" when ungraded */
  grade: string | null;
  locked: boolean;
  hidden: boolean;
  feedback?: string | null;
  feedbackformat?: number;
}

export interface GradeItem {
  id: number;
  itemname: string | null;
  itemtype: string;
  itemmodule: string | null;
  idnumber: string;
  categoryid: number | null;
  /** Instance ID of the activity (links to assign.id, quiz.id, forum.id, etc.) */
  iteminstance?: number;
  grademin?: number;
  grademax?: number;
  /** Pass grade (e.g. 3.0) */
  gradepass?: number;
  cmid?: number;
  /** Grade values for the requested user(s) */
  grades?: GradeItemGrade[];
}

export interface GradeCategoryItem {
  itemId: number;
  itemname: string;
  idnumber: string;
  hasIdnumber: ValidationCheck;
}

export interface MoodleBlock {
  instanceid: number;
  name: string;
  region: string;
  weight: number;
  visible: boolean;
}

/** One ValidationCheck per required block name */
export type BlocksChecks = Record<string, ValidationCheck>;

// ── Activity Settings check types ─────────────────────────────────────────────

export interface AssignActivityChecks {
  grade: ValidationCheck;               // Puntuación máxima = 5
  teamSubmission: ValidationCheck;       // Sin entrega por grupos
  dueDate: ValidationCheck;             // Sin fecha de entrega
  allowSubmissionsFrom: ValidationCheck; // Sin fecha de inicio de entregas
  completionSubmit: ValidationCheck;     // Finalización: debe entregar
  completionView: ValidationCheck;       // Finalización automática activada
  maxFiles: ValidationCheck;             // Máx. archivos = 3
  feedbackComments: ValidationCheck;     // Retroalimentación: Comentarios
  feedbackPdf: ValidationCheck;          // Retroalimentación: Anotaciones PDF
  feedbackFile: ValidationCheck;         // Retroalimentación: Archivos
  feedbackOffline: ValidationCheck;      // Retroalimentación: Hoja offline
  gradePass: ValidationCheck;            // Calificación para aprobar: 3,0
}

export interface AssignActivityCheck {
  cmid: number;
  name: string;
  checks: AssignActivityChecks;
  passed: boolean;
}

export interface QuizActivityChecks {
  grade: ValidationCheck;           // Puntuación máxima = 5
  timeOpen: ValidationCheck;        // Sin fecha de apertura
  timeClose: ValidationCheck;       // Sin fecha de cierre
  completionPass: ValidationCheck;  // Finalización: debe aprobar
  completionView: ValidationCheck;  // Finalización automática activada
  gradePass: ValidationCheck;       // Calificación para aprobar: 3,0
}

export interface QuizActivityCheck {
  cmid: number;
  name: string;
  checks: QuizActivityChecks;
  passed: boolean;
}

export interface ForumActivityChecks {
  scale: ValidationCheck;                 // Puntuación máxima = 5
  completionDiscussions: ValidationCheck; // Finalización: mínimo 1 discusión
  completionView: ValidationCheck;        // Finalización automática activada
}

export interface ForumActivityCheck {
  cmid: number;
  name: string;
  checks: ForumActivityChecks;
  passed: boolean;
}

export interface ActivitySettingsResult {
  assignments: AssignActivityCheck[];
  quizzes: QuizActivityCheck[];
  forums: ForumActivityCheck[];
  error?: string;
  passed: boolean;
}

export interface CourseContentValidationResult {
  courseId: number;
  courseName: string;
  courseFormat: string;
  totalSections: number;
  presentationSection: number;
  professorPage: {
    found: boolean;
    cmid: number | null;
    checks: ProfessorPageChecks;
    contentHtml: string | null;
    passed: boolean;
  };
  consultationForum: {
    found: boolean;
    cmid: number | null;
    checks: ForumChecks;
    passed: boolean;
  };
  meeting: {
    found: boolean;
    cmid: number | null;
    checks: MeetingChecks;
    passed: boolean;
  };
  attendance: {
    found: boolean;
    cmid: number | null;
    checks: AttendanceChecks;
    passed: boolean;
  };
  microcurriculum: {
    found: boolean;
    cmid: number | null;
    checks: MicrocurriculumChecks;
    fileUrl: string | null;
    passed: boolean;
  };
  blocks: {
    checks: BlocksChecks;
    passed: boolean;
  };
  sectionDates: {
    /** Only visible sections with section.section > 0 */
    sections: SectionDateCheck[];
    passed: boolean;
  };
  gradebook: {
    /** From core_grades_get_grade_tree: name exists + children null per EFC */
    categories: GradebookCategoryCheck[];
    /** From gradereport_user_get_grade_items: all category items with idnumber check */
    categoryItems: GradeCategoryItem[];
    /** From gradereport_user_get_grade_items: one check per required EFC code */
    efcChecks: Record<string, ValidationCheck>;
    /** Set when any grade endpoint was unavailable */
    error?: string;
    passed: boolean;
  };
  activitySettings: ActivitySettingsResult;
  /** Direct URL to the course in Moodle: {moodleUrl}/course/view.php?id={courseId} */
  courseUrl: string;
  passed: boolean;
}

export interface BatchValidationResult {
  categoryId: number;
  categoryName: string;
  totalCourses: number;
  passed: number;
  failed: number;
  results: CourseContentValidationResult[];
  executionTimeMs: number;
}
