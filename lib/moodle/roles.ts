/** Catálogo de roles de Moodle que maneja la herramienta.
 *
 *  Punto único de verdad. Para habilitar un rol nuevo basta añadirlo aquí con
 *  `asignable: true`: el selector, la validación del servidor y las etiquetas
 *  de la tabla salen todos de esta lista.
 *
 *  La identidad de un rol es su `roleid`. El `shortname` y el `nombre` son solo
 *  etiquetas: en Moodle un rol se puede renombrar por curso, así que nada de la
 *  lógica compara nombres. */
export interface RolMoodle {
  id: number;
  shortname: string;
  nombre: string;
  /** true = la herramienta puede asignarlo y retirarlo.
   *  false = solo se usa para mostrar el estado actual del participante. */
  asignable: boolean;
}

export const ROLES_MOODLE: readonly RolMoodle[] = [
  { id: 16, shortname: "profesordeingles", nombre: "Profesor de Inglés", asignable: true },
  { id: 19, shortname: "rolmatricula", nombre: "Rol Matrícula", asignable: true },
  { id: 3, shortname: "editingteacher", nombre: "Profesor con edición", asignable: false },
  { id: 4, shortname: "teacher", nombre: "Profesor sin edición", asignable: false },
  { id: 5, shortname: "student", nombre: "Estudiante", asignable: false },
] as const;

/** Roles que esta herramienta puede asignar como destino. */
export const ROLES_ASIGNABLES: readonly RolMoodle[] = ROLES_MOODLE.filter((rol) => rol.asignable);

export function rolPorId(roleId: number): RolMoodle | undefined {
  return ROLES_MOODLE.find((rol) => rol.id === roleId);
}

export function esRolAsignable(roleId: number): boolean {
  return ROLES_ASIGNABLES.some((rol) => rol.id === roleId);
}

/** Está en el catálogo, sea asignable o informativo. */
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
