import type { ReportStatus } from "@/lib/reporting/status";

export type EfcLevel = "1" | "2" | "3";

export type EfcDefinition = {
  level: EfcLevel;
  title: string;
  code: "EFC01" | "EFC02" | "EFC03";
  legacyCodes: [string, string];
};

export const EFC_DEFINITIONS: Record<EfcLevel, EfcDefinition> = {
  "1": {
    level: "1",
    title: "Evaluación formativa y continua 1",
    code: "EFC01",
    legacyCodes: ["AF01", "af1"],
  },
  "2": {
    level: "2",
    title: "Evaluación formativa y continua 2",
    code: "EFC02",
    legacyCodes: ["AF02", "af2"],
  },
  "3": {
    level: "3",
    title: "Evaluación formativa y continua 3",
    code: "EFC03",
    legacyCodes: ["AF03", "af3"],
  },
};

export function getEfcDefinition(level: string): EfcDefinition | null {
  if (level === "1" || level === "2" || level === "3") {
    return EFC_DEFINITIONS[level];
  }
  return null;
}

export type EfcActivityResult = {
  name: string;
  module: "forum" | "assign" | "quiz" | "other";
  score: ReportStatus;
  feedback: ReportStatus;
};

export type EfcCourseResult = {
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
  porcentaje: number;
  actividades: EfcActivityResult[];
};

export type EfcApiResponse = {
  level: EfcLevel;
  code: EfcDefinition["code"];
  title: string;
  categoryId: number;
  hierarchy: {
    programs: number;
    semesters: number;
    programNames: string[];
    semesterNames: string[];
  };
  summary: {
    high: number;
    medium: number;
    low: number;
    noActivity: number;
    categoryMismatch: number;
    totalCourses: number;
    repeatedCourses: number;
  };
  maxActivities: number;
  results: EfcCourseResult[];
  message?: string;
};
