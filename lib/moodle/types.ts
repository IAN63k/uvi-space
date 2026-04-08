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
