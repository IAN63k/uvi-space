/** Catálogo de roles de Moodle que maneja la herramienta.
 *
 *  Punto único de verdad. Para habilitar un rol nuevo basta añadirlo aquí con
 *  `asignable: true`: el selector, la validación del servidor, las etiquetas de
 *  la tabla y los roles de matrícula salen todos de esta lista.
 *
 *  Lo que no está aquí no se puede asignar ni retirar. `manager` (roleid 1) y
 *  los demás roles de sistema quedan fuera a propósito.
 *
 *  La identidad de un rol es su `roleid`. El `shortname` y el `nombre` son solo
 *  etiquetas: en Moodle un rol se puede renombrar por curso, así que nada de la
 *  lógica compara nombres. */
export interface RolMoodle {
  id: number;
  shortname: string;
  nombre: string;
  /** core = rol estándar de Moodle. institucional = creado por la UNIAJC. */
  tipo: "core" | "institucional";
  /** true = la herramienta puede asignarlo y retirarlo. */
  asignable: boolean;
}

/** Profesor con edición. Un curso sin nadie con este rol se queda sin quien
 *  pueda editarlo, así que la previsualización avisa antes de dejarlo así. */
export const ROL_EDITINGTEACHER = 3;

export const ROLES_MOODLE: readonly RolMoodle[] = [
  { id: 3, shortname: "editingteacher", nombre: "Profesor con edición", tipo: "core", asignable: true },
  { id: 4, shortname: "teacher", nombre: "Profesor sin edición", tipo: "core", asignable: true },
  { id: 5, shortname: "student", nombre: "Estudiante", tipo: "core", asignable: true },
  { id: 16, shortname: "profesordeingles", nombre: "Profesor de Inglés", tipo: "institucional", asignable: true },
  { id: 19, shortname: "rolmatricula", nombre: "Rol Matrícula", tipo: "institucional", asignable: true },
] as const;

/** Roles que esta herramienta puede asignar como destino. */
export const ROLES_ASIGNABLES: readonly RolMoodle[] = ROLES_MOODLE.filter((rol) => rol.asignable);

export const ROLES_ASIGNABLES_CORE: readonly RolMoodle[] = ROLES_ASIGNABLES.filter(
  (rol) => rol.tipo === "core",
);

export const ROLES_ASIGNABLES_INSTITUCIONALES: readonly RolMoodle[] = ROLES_ASIGNABLES.filter(
  (rol) => rol.tipo === "institucional",
);

export function rolPorId(roleId: number): RolMoodle | undefined {
  return ROLES_MOODLE.find((rol) => rol.id === roleId);
}

export function esRolAsignable(roleId: number): boolean {
  return ROLES_ASIGNABLES.some((rol) => rol.id === roleId);
}

/** Está en el catálogo, sea core o institucional. */
export function esRolConocido(roleId: number): boolean {
  return ROLES_MOODLE.some((rol) => rol.id === roleId);
}

/** Nombre para mostrar. Prefiere el catálogo; si el rol no está, usa el nombre
 *  que devolvió Moodle para ese curso y, en último caso, el id. */
export function nombreRol(roleId: number, nombreEnMoodle?: string): string {
  const rol = rolPorId(roleId);
  if (rol) return rol.nombre;
  return nombreEnMoodle?.trim() || `Rol ${roleId}`;
}
