import type { MoodleConfig } from "@/lib/encrypted-local-storage";
import type {
  MoodleCategory,
  UserSearchField,
  UserSearchResponse,
  CourseVerificationResult,
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

// ── Helper genérico ───────────────────────────────────────────────────────────

async function postJson<T>(
  url: string,
  config: MoodleConfig,
  payload: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moodleUrl: config.moodleUrl, token: config.token, ...payload }),
  });

  const data = (await res.json()) as T & { message?: string };
  if (!res.ok) {
    throw new Error(data?.message ?? "Error inesperado al contactar la API");
  }
  return data;
}

// ── Operaciones ───────────────────────────────────────────────────────────────

export function searchUser(
  config: MoodleConfig,
  field: UserSearchField,
  value: string,
): Promise<UserSearchResponse> {
  return postJson<UserSearchResponse>("/api/moodle/matriculas/usuario", config, { field, value });
}

export async function verifyCourses(
  config: MoodleConfig,
  courseIds: number[],
): Promise<CourseVerificationResult[]> {
  const data = await postJson<{ results: CourseVerificationResult[] }>(
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
  const data = await postJson<{ categories: MoodleCategory[] }>(
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
  const data = await postJson<{ courses: Array<SelectedCourse & { idnumber: string }> }>(
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
  const data = await postJson<{ results: CourseOutcome[] }>(
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
  const data = await postJson<{ results: CourseOutcome[] }>(
    "/api/moodle/matriculas/desenrolar",
    config,
    payload,
  );
  return data.results;
}

/** Roles de matrícula soportados por el módulo */
export const ENROLMENT_ROLES = [
  { id: 3, label: "Profesor con edición" },
  { id: 4, label: "Profesor sin edición" },
  { id: 5, label: "Estudiante" },
] as const;

export function roleLabel(roleId: number): string {
  return ENROLMENT_ROLES.find((r) => r.id === roleId)?.label ?? `Rol ${roleId}`;
}
