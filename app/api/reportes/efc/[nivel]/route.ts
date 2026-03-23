import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2";

import { sanitizeDbConfig } from "@/lib/reporting/db-config";
import { getEfcDefinition } from "@/lib/reporting/efc";
import type { EfcActivityResult, EfcApiResponse, EfcCourseResult, EfcLevel } from "@/lib/reporting/efc";
import { REPORT_STATUS } from "@/lib/reporting/status";
import type { ReportStatus } from "@/lib/reporting/status";

import type { DatabaseConfig } from "@/lib/database-config";

type EfcRequest = {
  categoryId: number;
  roleId?: number;
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
type GradeCategoryRow = RowDataPacket & { id: number; grade_category_id: number };
type GradeItemRow = RowDataPacket & {
  id: number;
  courseid: number;
  iteminstance: number;
  name: string | null;
  itemmodule: string | null;
};
type ScoreRow = RowDataPacket & { score: number | null };
type ForumDiscussionRow = RowDataPacket & { id: number };
type ForumFeedbackRow = RowDataPacket & { message: string | null };
type ActivityFeedbackRow = RowDataPacket & { feedback_count: number; file_count: number };

type CounterState = { cumple: number; noCumple: number };

const normalizeName = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");

const getPrograms = async (connection: mysql.Connection, mainCategoryId: number) => {
  const [rows] = await connection.execute<CategoryRow[]>(
    `SELECT id, name, parent
     FROM mdl_course_categories
     WHERE parent = ?
     ORDER BY name ASC`,
    [mainCategoryId],
  );

  return rows;
};

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
};

const getCoursesByCategory = async (connection: mysql.Connection, categoryId: number) => {
  const [rows] = await connection.execute<CourseRow[]>(
    `SELECT id as course_id, fullname as course_name, shortname as course_code
     FROM mdl_course
     WHERE category = ?
     ORDER BY fullname ASC`,
    [categoryId],
  );

  return rows;
};

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
};

const getGradeCategory = async (
  connection: mysql.Connection,
  courseId: number,
  teacherUserId: number,
  acceptedCodes: readonly string[],
) => {
  const placeholders = acceptedCodes.map(() => "?").join(",");

  const [rows] = await connection.execute<GradeCategoryRow[]>(
    `SELECT DISTINCT
      mdl_course.id as id,
      mdl_grade_categories.id AS grade_category_id
    FROM mdl_course
    INNER JOIN mdl_enrol ON mdl_enrol.courseid = mdl_course.id
    INNER JOIN mdl_user_enrolments ON mdl_user_enrolments.enrolid = mdl_enrol.id
    INNER JOIN mdl_grade_categories ON mdl_grade_categories.courseid = mdl_course.id
    INNER JOIN mdl_grade_items ON mdl_grade_items.iteminstance = mdl_grade_categories.id
    WHERE mdl_course.id = ?
      AND mdl_user_enrolments.userid = ?
      AND mdl_grade_items.itemtype = 'category'
      AND mdl_grade_items.idnumber IN (${placeholders})
    LIMIT 1`,
    [courseId, teacherUserId, ...acceptedCodes],
  );

  return rows[0] ?? null;
};

const getGradeItems = async (
  connection: mysql.Connection,
  courseId: number,
  acceptedCodes: readonly string[],
) => {
  const placeholders = acceptedCodes.map(() => "?").join(",");

  const [rows] = await connection.execute<GradeItemRow[]>(
    `SELECT
      gi.id,
      gi.courseid,
      gi.iteminstance as iteminstance,
      gi.itemname as name,
      gi.itemmodule
     FROM mdl_grade_items gi
     WHERE gi.courseid = ?
      AND gi.categoryid = (
        SELECT inner_gi.iteminstance
        FROM mdl_grade_items inner_gi
        WHERE inner_gi.courseid = ?
          AND inner_gi.itemtype = 'category'
          AND inner_gi.idnumber IN (${placeholders})
        LIMIT 1
      )`,
    [courseId, courseId, ...acceptedCodes],
  );

  return rows;
};

const scoreItem = async (connection: mysql.Connection, itemId: number): Promise<ReportStatus> => {
  const [rows] = await connection.execute<ScoreRow[]>(
    `SELECT SUM(gg.finalgrade) as score
     FROM mdl_grade_grades gg
     WHERE gg.itemid = ?`,
    [itemId],
  );

  return Number(rows[0]?.score ?? 0) > 0 ? REPORT_STATUS.success : REPORT_STATUS.fails;
};

const feedbackForum = async (
  connection: mysql.Connection,
  courseId: number,
  forumInstance: number,
  teacherUserId: number,
): Promise<ReportStatus> => {
  const [discussions] = await connection.execute<ForumDiscussionRow[]>(
    `SELECT id
     FROM mdl_forum_discussions
     WHERE course = ?
      AND forum = ?
     ORDER BY id ASC
     LIMIT 1`,
    [courseId, forumInstance],
  );

  if (discussions.length === 0) {
    return REPORT_STATUS.fails;
  }

  const [feedbackRows] = await connection.execute<ForumFeedbackRow[]>(
    `SELECT MAX(message) as message
     FROM mdl_forum_posts
     WHERE discussion = ?
      AND userid = ?
      AND LOWER(subject) LIKE 're:%'`,
    [discussions[0].id, teacherUserId],
  );

  const message = String(feedbackRows[0]?.message ?? "").trim();
  const wordCount = message.split(/\s+/).filter(Boolean).length;
  return wordCount > 2 ? REPORT_STATUS.success : REPORT_STATUS.fails;
};

const feedbackActivity = async (connection: mysql.Connection, assignmentId: number): Promise<ReportStatus> => {
  const [rows] = await connection.execute<ActivityFeedbackRow[]>(
    `SELECT
      COUNT(afc.id) AS feedback_count,
      COUNT(afi.id) AS file_count
     FROM mdl_assignfeedback_comments afc
     LEFT JOIN mdl_assignfeedback_file afi ON afi.assignment = afc.assignment
     WHERE afc.assignment = ?`,
    [assignmentId],
  );

  const feedbackCount = Number(rows[0]?.feedback_count ?? 0);
  const fileCount = Number(rows[0]?.file_count ?? 0);

  return feedbackCount > 0 || fileCount > 0 ? REPORT_STATUS.success : REPORT_STATUS.fails;
};

const toModule = (moduleName: string | null): EfcActivityResult["module"] => {
  if (moduleName === "forum" || moduleName === "assign" || moduleName === "quiz") {
    return moduleName;
  }

  return "other";
};

const computeScoreAndFeedback = async (
  connection: mysql.Connection,
  counter: CounterState,
  courseId: number,
  teacherUserId: number,
  item: GradeItemRow,
): Promise<EfcActivityResult> => {
  const module = toModule(item.itemmodule);
  const name = (item.name ?? "Sin nombre").trim() || "Sin nombre";

  if (module === "forum") {
    const score = await scoreItem(connection, item.id);
    const feedback = await feedbackForum(connection, courseId, item.iteminstance, teacherUserId);

    if (score === REPORT_STATUS.success) counter.cumple += 1;
    else counter.noCumple += 1;

    if (feedback === REPORT_STATUS.success) counter.cumple += 1;
    else counter.noCumple += 1;

    return { name, module, score, feedback };
  }

  if (module === "assign") {
    const score = await scoreItem(connection, item.id);
    const feedback = await feedbackActivity(connection, item.iteminstance);

    if (score === REPORT_STATUS.success) counter.cumple += 1;
    else counter.noCumple += 1;

    if (feedback === REPORT_STATUS.success) counter.cumple += 1;
    else counter.noCumple += 1;

    return { name, module, score, feedback };
  }

  if (module === "quiz") {
    counter.cumple += 1;
    return {
      name,
      module,
      score: REPORT_STATUS.success,
      feedback: REPORT_STATUS.notApply,
    };
  }

  return {
    name,
    module,
    score: REPORT_STATUS.notApply,
    feedback: REPORT_STATUS.notApply,
  };
};

export const POST = async (
  request: NextRequest,
  context: { params: Promise<{ nivel: string }> },
) => {
  let connection: mysql.Connection | null = null;

  try {
    const { nivel } = await context.params;
    const definition = getEfcDefinition(nivel);

    if (!definition) {
      return NextResponse.json({ message: "Nivel EFC inválido." }, { status: 404 });
    }

    const body = (await request.json()) as Partial<EfcRequest>;
    const categoryId = Number(body.categoryId);
    const roleId = Number(body.roleId ?? 3);
    const dbConfig = sanitizeDbConfig(body.dbConfig ?? {});

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return NextResponse.json(
        { message: "El campo categoryId debe ser un número entero positivo." },
        { status: 400 },
      );
    }

    if (!dbConfig) {
      return NextResponse.json({ message: "Configuración de base de datos inválida." }, { status: 400 });
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

    const programs = await getPrograms(connection, categoryId);

    let semesters = await getSemestersByProgramIds(
      connection,
      programs.map((program) => program.id),
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

    const programNameById = new Map<number, string>(programs.map((program) => [program.id, program.name]));

    const results: EfcCourseResult[] = [];
    const acceptedCodes = [definition.code, ...definition.legacyCodes] as const;

    for (const semester of semesters) {
      const courses = await getCoursesByCategory(connection, semester.id);

      for (const course of courses) {
        const teachers = await getTeachersByCourse(connection, course.course_id, roleId);

        const teacherNamesArray = teachers.map((teacher) =>
          normalizeName(`${teacher.firstname} ${teacher.lastname}`),
        );
        const teacherEmailsArray = teachers.map((teacher) => teacher.email.toLowerCase());
        const teacherIdsArray = teachers.map((teacher) => String(teacher.user_id));
        const teacherDocArray = teachers.map((teacher) => teacher.user_doc ?? "").filter(Boolean);

        const teacherUserId = teachers[0]?.user_id ?? 0;

        const group = (course.course_name.split("*").pop() ?? "").trim();

        if (!teacherUserId) {
          results.push({
            date: currentDate,
            userIds: teacherIdsArray.join(" | "),
            userDoc: teacherDocArray.join(" | "),
            teacherNames: teacherNamesArray.join(" | "),
            teacherEmails: teacherEmailsArray.join(" | "),
            program: programNameById.get(semester.parent) ?? "",
            semester: semester.name,
            group,
            courseId: course.course_id,
            courseName: course.course_name,
            courseCode: course.course_code,
            porcentaje: -2,
            actividades: [],
          });
          continue;
        }

        const gradeCategory = await getGradeCategory(connection, course.course_id, teacherUserId, acceptedCodes);

        if (!gradeCategory) {
          results.push({
            date: currentDate,
            userIds: teacherIdsArray.join(" | "),
            userDoc: teacherDocArray.join(" | "),
            teacherNames: teacherNamesArray.join(" | "),
            teacherEmails: teacherEmailsArray.join(" | "),
            program: programNameById.get(semester.parent) ?? "",
            semester: semester.name,
            group,
            courseId: course.course_id,
            courseName: course.course_name,
            courseCode: course.course_code,
            porcentaje: -2,
            actividades: [],
          });
          continue;
        }

        const gradeItems = await getGradeItems(connection, course.course_id, acceptedCodes);
        const counter: CounterState = { cumple: 0, noCumple: 0 };
        const actividades: EfcActivityResult[] = [];

        for (const item of gradeItems) {
          const result = await computeScoreAndFeedback(
            connection,
            counter,
            gradeCategory.id,
            teacherUserId,
            item,
          );
          actividades.push(result);
        }

        const totalChecks = counter.cumple + counter.noCumple;
        const porcentaje = totalChecks === 0 ? -1 : Math.round((100 / totalChecks) * counter.cumple);

        results.push({
          date: currentDate,
          userIds: teacherIdsArray.join(" | "),
          userDoc: teacherDocArray.join(" | "),
          teacherNames: teacherNamesArray.join(" | "),
          teacherEmails: teacherEmailsArray.join(" | "),
          program: programNameById.get(semester.parent) ?? "",
          semester: semester.name,
          group,
          courseId: course.course_id,
          courseName: course.course_name,
          courseCode: course.course_code,
          porcentaje,
          actividades,
        });
      }
    }

    const uniqueCourseIds = new Set(results.map((item) => item.courseId));
    const repeatedCourses = results.length - uniqueCourseIds.size;

    const summary: EfcApiResponse["summary"] = {
      high: results.filter((item) => item.porcentaje >= 80 && item.porcentaje <= 100).length,
      medium: results.filter((item) => item.porcentaje >= 51 && item.porcentaje <= 79).length,
      low: results.filter((item) => item.porcentaje >= 0 && item.porcentaje <= 50).length,
      noActivity: results.filter((item) => item.porcentaje === -1).length,
      categoryMismatch: results.filter((item) => item.porcentaje === -2).length,
      totalCourses: results.length,
      repeatedCourses,
    };

    const programNames = Array.from(new Set(programs.map((program) => program.name))).sort((a, b) =>
      a.localeCompare(b, "es"),
    );
    const semesterNames = Array.from(new Set(semesters.map((semester) => semester.name))).sort((a, b) =>
      a.localeCompare(b, "es"),
    );

    const maxActivities = results.reduce((max, row) => Math.max(max, row.actividades.length), 0);

    return NextResponse.json({
      level: definition.level as EfcLevel,
      code: definition.code,
      title: definition.title,
      categoryId,
      hierarchy: {
        programs: programs.length,
        semesters: semesters.length,
        programNames,
        semesterNames,
      },
      summary,
      maxActivities,
      results,
    } satisfies EfcApiResponse);
  } catch {
    return NextResponse.json(
      {
        message: "No fue posible consultar el avance formativo. Verifica conexión, credenciales y categoría.",
      },
      { status: 500 },
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};
