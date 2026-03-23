import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2";

import type { DatabaseConfig } from "@/lib/database-config";
import { sanitizeDbConfig } from "@/lib/reporting/db-config";

type AlistamientoRequest = {
  categoryId: number;
  roleId?: number;
  photoValidationTexts?: string[];
  dbConfig: DatabaseConfig;
};

type CategoryRow = RowDataPacket & { id: number; name: string; parent: number };

type CourseRow = RowDataPacket & { course_id: number; course_name: string; course_code: string };

type TeacherRow = RowDataPacket & {
  firstname: string;
  lastname: string;
  email: string;
  user_id: number;
  user_doc: string | null;
};

type PageRow = RowDataPacket & { name: string; content: string };

type UnitRow = RowDataPacket & {
  section_id: number;
  name: string | null;
  visible: number;
  summary: string | null;
};

type ForumRow = RowDataPacket & { id: number };

type ForumDiscussionCountRow = RowDataPacket & { dis: number };

type GradeItemRow = RowDataPacket & {
  id: number;
  courseid: number;
  iteminstance: number;
  name: string | null;
  itemmodule: string | null;
  idnumber: string | null;
};

type WeighingRow = RowDataPacket & { gradeSum: number | null };

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

const STATUS = {
  fails: "NO CUMPLE" as const,
  success: "CUMPLE" as const,
  notApply: "NO APLICA" as const,
  notExist: "NO EXISTE" as const,
};

const PAGE_ID = "DP01";

const FORUM_ID = "FC01";

const DEFAULT_PHOTO_VALIDATION_TEXTS = [
  "insertar foto de tamano 200",
  "insertar foto de tamaño 200",
];

const CATEGORY_IDS = [
  { current: "EFC01", old: "AF01", alt: "af1", type: 1 },
  { current: "EFC02", old: "AF02", alt: "af2", type: 2 },
  { current: "EFC03", old: "AF03", alt: "af3", type: 3 },
] as const;

const nearlyEqual = (value: number, target: number, epsilon = 0.01) => {
  return Math.abs(value - target) <= epsilon;
};

const normalizeText = (input: string) => {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ñ/g, "n");
}

const splitNameTokens = (value: string) => {
  return normalizeText(value)
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

const mark = (state: CounterState, ok: boolean): Status => {
  if (ok) {
    state.success += 1;
    return STATUS.success;
  }

  state.fails += 1;
  return STATUS.fails;
}

const nameValidate = (state: CounterState, contentName: string, fullName: string): Status => {
  const contentParts = splitNameTokens(contentName);
  const fullNameParts = splitNameTokens(fullName);

  const matches = contentParts.some((part) => fullNameParts.includes(part));
  return mark(state, matches);
}

const emailValidate = (state: CounterState, content: string, email: string): Status => {
  const normalizedContent = content.toLowerCase();
  const normalizedEmail = email.toLowerCase();

  if (normalizedEmail && normalizedContent.includes(normalizedEmail)) {
    return mark(state, true);
  }

  const hasSomeEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(content);
  return mark(state, hasSomeEmail);
}

const validateOpeningHours = (state: CounterState, content: string): Status => {
  const contentLower = content.toLowerCase();

  if (contentLower.includes("indicar las horas de atencion que tendra para sus estudiantes")) {
    return mark(state, false);
  }

  const hasWeekDay = /(lunes|martes|miercoles|jueves|viernes|sabado|sabados|domingo|domingos)/i.test(contentLower);
  return mark(state, hasWeekDay);
}

const sanitizePhotoValidationTexts = (texts: unknown): string[] => {
  if (!Array.isArray(texts)) {
    return DEFAULT_PHOTO_VALIDATION_TEXTS;
  }

  const cleanTexts = texts
    .map((text) => String(text ?? "").trim().toLowerCase())
    .filter(Boolean);

  return cleanTexts.length > 0 ? cleanTexts : DEFAULT_PHOTO_VALIDATION_TEXTS;
};

const validarFotografia = (state: CounterState, content: string, blockedTexts: string[]): Status => {
  const normalizedContent = content.toLowerCase();
  const hasBlockedText = blockedTexts.some((blockedText) => normalizedContent.includes(blockedText));
  return mark(state, !hasBlockedText);
}

const validateDateUnits = (state: CounterState, summary: string): Status => {
  const hasPlaceholder = summary.includes("DD/MM/AAAA");
  return mark(state, !hasPlaceholder);
}

const validarActividadesCategoria = (state: CounterState, items: GradeItemRow[]): boolean => {
  if (items.length > 0) {
    state.success += 1;
    return true;
  }

  state.fails += 3;
  return false;
}

const validarPonderacionCategoria = (state: CounterState, weighingGrade: number, tipoCategoria: number): Status => {
  if (weighingGrade > 100 || nearlyEqual(weighingGrade, 0)) {
    return mark(state, false);
  }

  if (
    nearlyEqual(weighingGrade, 100) ||
    nearlyEqual(weighingGrade, 1) ||
    nearlyEqual(weighingGrade, 99.99) ||
    nearlyEqual(weighingGrade, 99.9)
  ) {
    return mark(state, true);
  }

  if (tipoCategoria === 1 || tipoCategoria === 2) {
    const ok = nearlyEqual(weighingGrade, 30) || nearlyEqual(weighingGrade, 0.3) || nearlyEqual(weighingGrade, 100);
    return mark(state, ok);
  }

  if (tipoCategoria === 3) {
    const ok = nearlyEqual(weighingGrade, 40) || nearlyEqual(weighingGrade, 0.4);
    return mark(state, ok);
  }

  return mark(state, false);
}

const getPrograms = async (connection: mysql.Connection, mainCategoryId: number) => {
  const [rows] = await connection.execute<CategoryRow[]>(
    `SELECT id, name, parent
     FROM mdl_course_categories
     WHERE parent = ?
     ORDER BY name ASC`,
    [mainCategoryId],
  );
  return rows;
}

const getSemestersByProgramIds = async (connection: mysql.Connection, programIds: number[]) => {
  if (programIds.length === 0) {
    return [] as CategoryRow[];
  }

  const placeholders = programIds.map(() => "?").join(",");
  const [rows] = await connection.execute<CategoryRow[]>(
    `SELECT DISTINCT id, name, parent
     FROM mdl_course_categories
     WHERE parent IN (${placeholders})
     ORDER BY name ASC`,
    programIds,
  );

  return rows;
}

const getCoursesByCategory = async (connection: mysql.Connection, categoryId: number) => {
  const [rows] = await connection.execute<CourseRow[]>(
    `SELECT id as course_id, fullname as course_name, shortname as course_code
     FROM mdl_course
     WHERE category = ?
     ORDER BY fullname ASC`,
    [categoryId],
  );

  return rows;
}

const getTeachersByCourse = async (connection: mysql.Connection, courseId: number, roleId: number) => {
  const [rows] = await connection.execute<TeacherRow[]>(
    `SELECT DISTINCT
      mdl_user.firstname as firstname,
      mdl_user.lastname as lastname,
      mdl_user.email as email,
      mdl_user.id as user_id,
      mdl_user.idnumber as user_doc
     FROM mdl_user
     INNER JOIN mdl_role_assignments ON mdl_role_assignments.userid = mdl_user.id
     INNER JOIN mdl_role ON mdl_role.id = mdl_role_assignments.roleid
     INNER JOIN mdl_user_enrolments ON mdl_user_enrolments.userid = mdl_user.id
     INNER JOIN mdl_enrol ON mdl_enrol.id = mdl_user_enrolments.enrolid
     INNER JOIN mdl_course ON mdl_course.id = mdl_enrol.courseid
     WHERE mdl_course.visible = TRUE
      AND mdl_role.id = ?
      AND mdl_course.id = ?`,
    [roleId, courseId],
  );

  return rows;
}

const getPageByIdNumber = async (connection: mysql.Connection, courseId: number, pageId: string) => {
  const [rows] = await connection.execute<PageRow[]>(
    `SELECT mdl_page.name as name, mdl_page.content as content
     FROM mdl_page
     INNER JOIN mdl_course_modules ON mdl_course_modules.instance = mdl_page.id
     WHERE mdl_course_modules.course = ?
      AND mdl_course_modules.idnumber = ?
     LIMIT 1`,
    [courseId, pageId],
  );

  return rows[0] ?? null;
}

const validateForum = async (connection: mysql.Connection, state: CounterState, courseId: number): Promise<Status> => {
  const [forums] = await connection.execute<ForumRow[]>(
    `SELECT instance AS id
     FROM mdl_course_modules
     WHERE course = ?
     AND idnumber = '${FORUM_ID}'
     AND (visible = 1 AND visibleoncoursepage = 1)`,
    [courseId],
  );

  if (forums.length === 0) {
    return mark(state, false);
  }

  const [discussions] = await connection.execute<ForumDiscussionCountRow[]>(
    `SELECT COUNT(id) as dis
     FROM mdl_forum_discussions
     WHERE forum = ?`,
    [forums[0].id],
  );

  return mark(state, (discussions[0]?.dis ?? 0) > 0);
}

const getUnitsValidation = async (connection: mysql.Connection, state: CounterState, courseId: number): Promise<Status[]> => {
  const [units] = await connection.execute<UnitRow[]>(
    `SELECT DISTINCT
      mdl_course_sections.section as section_id,
      mdl_course_sections.name as name,
      mdl_course_sections.visible as visible,
      mdl_course_sections.summary as summary
     FROM mdl_course_sections
     WHERE mdl_course_sections.course = ?
      AND mdl_course_sections.section != 0
     ORDER BY section_id ASC`,
    [courseId],
  );

  const statuses = units.map((unit) => {
    if (unit.visible === 1) {
      return validateDateUnits(state, unit.summary ?? "");
    }
    return STATUS.notApply;
  });

  while (statuses.length < 8) {
    statuses.push(STATUS.notApply);
  }

  return statuses.slice(0, 8);
}

const getGradeItems = async (connection: mysql.Connection, courseId: number, current: string, old: string, alt: string) => {
  const [rows] = await connection.execute<GradeItemRow[]>(
    `SELECT
      gi.id,
      gi.courseid,
      gi.iteminstance as iteminstance,
      gi.itemname as name,
      gi.itemmodule,
      gi.idnumber
     FROM mdl_grade_items gi
     WHERE gi.courseid = ?
      AND gi.categoryid = (
        SELECT inner_gi.iteminstance
        FROM mdl_grade_items inner_gi
        WHERE inner_gi.courseid = ?
          AND inner_gi.itemtype = 'category'
          AND (
            inner_gi.idnumber = ?
            OR inner_gi.idnumber = ?
            OR inner_gi.idnumber = ?
          )
        LIMIT 1
      )`,
    [courseId, courseId, current, old, alt],
  );

  return rows;
}

const getWeighing = async (connection: mysql.Connection, courseId: number, current: string, old: string, alt: string) => {
  const [rows] = await connection.execute<WeighingRow[]>(
    `SELECT SUM(gi.aggregationcoef) as gradeSum
     FROM mdl_grade_items gi
     WHERE gi.courseid = ?
      AND gi.categoryid = (
        SELECT inner_gi.iteminstance
        FROM mdl_grade_items inner_gi
        WHERE inner_gi.courseid = ?
          AND inner_gi.itemtype = 'category'
          AND (
            inner_gi.idnumber = ?
            OR inner_gi.idnumber = ?
            OR inner_gi.idnumber = ?
          )
        LIMIT 1
      )`,
    [courseId, courseId, current, old, alt],
  );

  return Number(rows[0]?.gradeSum ?? 0);
}

export const POST = async (request: NextRequest) => {
  let connection: mysql.Connection | null = null;

  try {
    const body = (await request.json()) as Partial<AlistamientoRequest>;
    const categoryId = Number(body.categoryId);
    const roleId = Number(body.roleId ?? 3);
    const photoValidationTexts = sanitizePhotoValidationTexts(body.photoValidationTexts);
    const dbConfig = sanitizeDbConfig(body.dbConfig ?? {});

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return NextResponse.json(
        { message: "El campo categoryId debe ser un número entero positivo." },
        { status: 400 },
      );
    }

    if (!dbConfig) {
      return NextResponse.json(
        { message: "Configuración de base de datos inválida." },
        { status: 400 },
      );
    }

    connection = await mysql.createConnection({
      host: dbConfig.server,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      connectTimeout: 15_000,
      charset: "utf8mb4",
    });

    const currentDate = new Date().toISOString().replace("T", " ").slice(0, 19);

    const programCategories = await getPrograms(connection, categoryId);

    let semesters = await getSemestersByProgramIds(
      connection,
      programCategories.map((program) => program.id),
    );

    if (semesters.length === 0) {
      semesters = await getSemestersByProgramIds(connection, [categoryId]);
    }

    if (semesters.length === 0) {
      const [singleCategory] = await connection.execute<CategoryRow[]>(
        `SELECT id, name, parent
         FROM mdl_course_categories
         WHERE id = ?
         LIMIT 1`,
        [categoryId],
      );
      semesters = singleCategory;
    }

    const programNameById = new Map<number, string>(
      programCategories.map((program) => [program.id, program.name]),
    );

    const results: CourseResult[] = [];

    for (const semester of semesters) {
      const courses = await getCoursesByCategory(connection, semester.id);

      for (const course of courses) {
        const state: CounterState = { fails: 0, success: 0 };

        const teachers = await getTeachersByCourse(connection, course.course_id, roleId);
        const teacherNamesArray = teachers.map((teacher) => `${teacher.firstname} ${teacher.lastname}`.trim());
        const teacherEmailsArray = teachers.map((teacher) => teacher.email.toLowerCase());
        const teacherIdsArray = teachers.map((teacher) => String(teacher.user_id));
        const teacherDocArray = teachers.map((teacher) => teacher.user_doc ?? "").filter(Boolean);

        const teachersNames = teacherNamesArray.join(" | ");
        const teachersEmails = teacherEmailsArray.join(" | ");
        const teachersUsersIds = teacherIdsArray.join(" | ");
        const teachersUserDoc = teacherDocArray.join(" | ");

        const page = await getPageByIdNumber(connection, course.course_id, PAGE_ID);

        let nombreProfesor: Status;
        let correoProfesor: Status;
        let horarioAtencion: Status;
        let fotografia: Status;

        if (page) {
          const pageContent = page.content ?? "";
          nombreProfesor = nameValidate(state, page.name ?? "", teachersNames);
          correoProfesor = emailValidate(state, pageContent, teachersEmails);
          horarioAtencion = validateOpeningHours(state, pageContent);
          fotografia = validarFotografia(state, pageContent, photoValidationTexts);
        } else {
          nombreProfesor = STATUS.notExist;
          correoProfesor = STATUS.notExist;
          horarioAtencion = STATUS.notExist;
          fotografia = STATUS.notExist;
          state.fails += 4;
        }

        const foroConsulta = await validateForum(connection, state, course.course_id);
        const unidades = await getUnitsValidation(connection, state, course.course_id);

        const efc1Items = await getGradeItems(connection, course.course_id, CATEGORY_IDS[0].current, CATEGORY_IDS[0].old, CATEGORY_IDS[0].alt);
        const efc2Items = await getGradeItems(connection, course.course_id, CATEGORY_IDS[1].current, CATEGORY_IDS[1].old, CATEGORY_IDS[1].alt);
        const efc3Items = await getGradeItems(connection, course.course_id, CATEGORY_IDS[2].current, CATEGORY_IDS[2].old, CATEGORY_IDS[2].alt);

        let efc01Actividades: Status;
        let efc01Ponderaciones: Status;
        if (validarActividadesCategoria(state, efc1Items)) {
          efc01Actividades = STATUS.success;
          const weighingValue = await getWeighing(connection, course.course_id, CATEGORY_IDS[0].current, CATEGORY_IDS[0].old, CATEGORY_IDS[0].alt);
          efc01Ponderaciones = validarPonderacionCategoria(state, weighingValue, CATEGORY_IDS[0].type);
        } else {
          efc01Actividades = STATUS.fails;
          efc01Ponderaciones = STATUS.fails;
        }

        let efc02Actividades: Status;
        let efc02Ponderaciones: Status;
        if (validarActividadesCategoria(state, efc2Items)) {
          efc02Actividades = STATUS.success;
          const weighingValue = await getWeighing(connection, course.course_id, CATEGORY_IDS[1].current, CATEGORY_IDS[1].old, CATEGORY_IDS[1].alt);
          efc02Ponderaciones = validarPonderacionCategoria(state, weighingValue, CATEGORY_IDS[1].type);
        } else {
          efc02Actividades = STATUS.fails;
          efc02Ponderaciones = STATUS.fails;
        }

        let efc03Actividades: Status;
        let efc03Ponderaciones: Status;
        if (validarActividadesCategoria(state, efc3Items)) {
          efc03Actividades = STATUS.success;
          const weighingValue = await getWeighing(connection, course.course_id, CATEGORY_IDS[2].current, CATEGORY_IDS[2].old, CATEGORY_IDS[2].alt);
          efc03Ponderaciones = validarPonderacionCategoria(state, weighingValue, CATEGORY_IDS[2].type);
        } else {
          efc03Actividades = STATUS.fails;
          efc03Ponderaciones = STATUS.fails;
        }

        const total = state.fails + state.success;
        const porcentaje = total > 0 ? Math.round((100 / total) * state.success) : 0;

        const group = (course.course_name.split("*").pop() ?? "").trim();

        results.push({
          date: currentDate,
          userIds: teachersUsersIds,
          userDoc: teachersUserDoc,
          teacherNames: teachersNames,
          teacherEmails: teachersEmails,
          program: programNameById.get(semester.parent) ?? "",
          semester: semester.name,
          group,
          courseId: course.course_id,
          courseName: course.course_name,
          courseCode: course.course_code,
          nombreProfesor,
          correoProfesor,
          horarioAtencion,
          fotografia,
          foroConsulta,
          unidades,
          efc01Actividades,
          efc01Ponderaciones,
          efc02Actividades,
          efc02Ponderaciones,
          efc03Actividades,
          efc03Ponderaciones,
          porcentaje,
        });
      }
    }

    const uniqueCourseIds = new Set(results.map((item) => item.courseId));
    const repeatedCourses = results.length - uniqueCourseIds.size;

    const summary = {
      high: results.filter((item) => item.porcentaje >= 80 && item.porcentaje <= 100).length,
      medium: results.filter((item) => item.porcentaje >= 51 && item.porcentaje <= 79).length,
      low: results.filter((item) => item.porcentaje >= 1 && item.porcentaje <= 50).length,
      noActivity: results.filter((item) => item.porcentaje === 0).length,
      totalCourses: results.length,
      repeatedCourses,
    };

    const programNames = Array.from(new Set(programCategories.map((program) => program.name))).sort((a, b) =>
      a.localeCompare(b, "es"),
    );
    const semesterNames = Array.from(new Set(semesters.map((semester) => semester.name))).sort((a, b) =>
      a.localeCompare(b, "es"),
    );

    return NextResponse.json({
      categoryId,
      totalCourses: results.length,
      hierarchy: {
        programs: programCategories.length,
        semesters: semesters.length,
        programNames,
        semesterNames,
      },
      summary,
      results,
    });
  } catch {
    return NextResponse.json(
      {
        message:
          "No fue posible consultar alistamiento. Verifica conexión, credenciales y categoría.",
      },
      { status: 500 },
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
