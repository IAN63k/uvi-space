import type { MoodleConfig } from "@/lib/encrypted-local-storage";
import { postMoodleJson } from "@/lib/moodle/api-client";
import { ROLES_ASIGNABLES, nombreRol, type RolMoodle } from "@/lib/moodle/roles";
import type {
  MoodleCategory,
  MoodleEnrolledUser,
  MoodleUser,
  UserSearchField,
  UserSearchResponse,
  CourseVerificationResult,
  BulkUserField,
  UserResolution,
  UserOutcome,
} from "@/lib/moodle/types";

// ── Tipos compartidos del cliente ─────────────────────────────────────────────

/** Curso seleccionado para (des)matricular, con la info mínima para mostrarlo */
export interface SelectedCourse {
  id: number;
  fullname: string;
  shortname: string;
}

/** Resultado por curso devuelto por las rutas de enrolar/desenrolar */
export interface CourseOutcome {
  courseId: number;
  success: boolean;
  error?: string;
}

/** Categoría simplificada usada por el árbol */
export interface CategoryItem {
  id: number;
  name: string;
  idnumber: string;
  coursecount: number;
}

// ── Operaciones ───────────────────────────────────────────────────────────────

export function searchUser(
  config: MoodleConfig,
  field: UserSearchField,
  value: string,
): Promise<UserSearchResponse> {
  return postMoodleJson<UserSearchResponse>("/api/moodle/matriculas/usuario", config, { field, value });
}

export async function verifyCourses(
  config: MoodleConfig,
  courseIds: number[],
): Promise<CourseVerificationResult[]> {
  const data = await postMoodleJson<{ results: CourseVerificationResult[] }>(
    "/api/moodle/matriculas/verificar-cursos",
    config,
    { courseIds },
  );
  return data.results;
}

export async function fetchCategories(
  config: MoodleConfig,
  parentId: number,
): Promise<CategoryItem[]> {
  const data = await postMoodleJson<{ categories: MoodleCategory[] }>(
    "/api/moodle/categorias",
    config,
    { parentId },
  );
  return data.categories.map((c) => ({
    id: c.id,
    name: c.name,
    idnumber: c.idnumber,
    coursecount: c.coursecount,
  }));
}

export async function fetchCategoryCourses(
  config: MoodleConfig,
  categoryId: number,
): Promise<SelectedCourse[]> {
  const data = await postMoodleJson<{ courses: Array<SelectedCourse & { idnumber: string }> }>(
    "/api/moodle/matriculas/cursos-categoria",
    config,
    { categoryId },
  );
  return data.courses.map((c) => ({ id: c.id, fullname: c.fullname, shortname: c.shortname }));
}

export async function enrolChunk(
  config: MoodleConfig,
  payload: { userId: number; courseIds: number[]; roleId: number; timestart?: number; timeend?: number },
): Promise<CourseOutcome[]> {
  const data = await postMoodleJson<{ results: CourseOutcome[] }>(
    "/api/moodle/matriculas/enrolar",
    config,
    payload,
  );
  return data.results;
}

export async function unenrolChunk(
  config: MoodleConfig,
  payload: { userId: number; courseIds: number[] },
): Promise<CourseOutcome[]> {
  const data = await postMoodleJson<{ results: CourseOutcome[] }>(
    "/api/moodle/matriculas/desenrolar",
    config,
    payload,
  );
  return data.results;
}

// ── Matrícula masiva: varios usuarios en un mismo curso ───────────────────────

/** Forma mínima de usuario que maneja la lista de matrícula masiva.
 *  Unifica lo que devuelven la búsqueda, el lote y los matriculados de un curso. */
export interface BulkUser {
  id: number;
  fullname: string;
  username: string;
  email: string;
  idnumber: string;
  profileimageurl?: string;
}

/** De dónde salió el usuario, para poder mostrarlo y depurar la lista */
export type BulkUserSource = "paste" | "search" | "course";

/** Una fila de la lista de usuarios a matricular, con su rol individual */
export interface BulkUserRow {
  user: BulkUser;
  roleId: number;
  source: BulkUserSource;
  /** true si ya está matriculado en el curso destino */
  alreadyEnrolled?: boolean;
}

export function toBulkUser(user: MoodleUser | MoodleEnrolledUser): BulkUser {
  return {
    id: user.id,
    fullname: user.fullname,
    username: user.username,
    email: user.email,
    idnumber: user.idnumber ?? "",
    profileimageurl: "profileimageurl" in user ? user.profileimageurl : undefined,
  };
}

export function resolveUsers(
  config: MoodleConfig,
  field: BulkUserField,
  values: string[],
): Promise<{ resolutions: UserResolution[]; warning?: string }> {
  return postMoodleJson<{ resolutions: UserResolution[]; warning?: string }>(
    "/api/moodle/matriculas/usuarios-lote",
    config,
    { field, values },
  );
}

export async function fetchCourseUsers(
  config: MoodleConfig,
  courseId: number,
  roleId?: number,
): Promise<BulkUser[]> {
  const data = await postMoodleJson<{ users: MoodleEnrolledUser[] }>(
    "/api/moodle/matriculas/usuarios-curso",
    config,
    { courseId, roleId },
  );
  return data.users.map(toBulkUser);
}

export async function enrolUsersChunk(
  config: MoodleConfig,
  payload: {
    courseId: number;
    users: Array<{ userId: number; roleId: number }>;
    timestart?: number;
    timeend?: number;
  },
): Promise<UserOutcome[]> {
  const data = await postMoodleJson<{ results: UserOutcome[] }>(
    "/api/moodle/matriculas/matricular-usuarios",
    config,
    payload,
  );
  return data.results;
}

export async function unenrolUsersChunk(
  config: MoodleConfig,
  payload: { courseId: number; userIds: number[] },
): Promise<UserOutcome[]> {
  const data = await postMoodleJson<{ results: UserOutcome[] }>(
    "/api/moodle/matriculas/desmatricular-usuarios",
    config,
    payload,
  );
  return data.results;
}

/** Roles con los que se puede matricular, derivados del catálogo único de
 *  lib/moodle/roles.ts para que no se desincronicen con el resto de la app. */
export const ENROLMENT_ROLES: ReadonlyArray<{ id: number; label: string; tipo: RolMoodle["tipo"] }> =
  ROLES_ASIGNABLES.map((rol) => ({ id: rol.id, label: rol.nombre, tipo: rol.tipo }));

export function roleLabel(roleId: number): string {
  return nombreRol(roleId);
}
