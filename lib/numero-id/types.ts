// Todo `idnumber` de este módulo es `string`. Ver lib/numero-id/valor.ts.

/** Límites por petición, compartidos por las rutas y el cliente que las trocea. */
export const MAX_VALORES_POR_COMPROBACION = 50;
export const MAX_CAMBIOS_POR_APLICACION = 25;

// ── Consulta de cursos ───────────────────────────────────────────────────────

export interface CursoIdnumber {
  id: number;
  fullname: string;
  shortname: string;
  idnumber: string;
  categoryId: number;
  categoryName: string;
}

/** Resultado de consultar una categoría: una caída no invalida las demás. */
export interface CategoriaConsultada {
  id: number;
  nombre: string;
  ok: boolean;
  totalCursos: number;
  error?: string;
}

export interface CursosResponse {
  cursos: CursoIdnumber[];
  categorias: CategoriaConsultada[];
}

// ── Comprobación de valores ocupados ─────────────────────────────────────────

export interface CursoOcupante {
  id: number;
  shortname: string;
  fullname: string;
  idnumber: string;
}

export interface ResultadoComprobacion {
  valor: string;
  ocupantes: CursoOcupante[];
  error?: string;
}

export interface ComprobarResponse {
  resultados: ResultadoComprobacion[];
}

// ── Aplicación ───────────────────────────────────────────────────────────────

export interface CambioIdnumber {
  courseId: number;
  idnumber: string;
}

/** Por qué no se aplicó un cambio.
 *  - permisos: al token le falta capacidad o la función no está en el servicio.
 *  - ocupado: Moodle rechazó el valor porque ya lo tiene otro curso.
 *  - moodle: cualquier otro rechazo de Moodle, con su mensaje crudo.
 *  - no-verificado: no hubo rechazo, pero la relectura no confirmó el valor.
 *  - bloqueado: la previsualización lo excluyó por un conflicto.
 *  - dependencia: su valor lo sigue teniendo un curso que no se pudo cambiar. */
export type MotivoFallo =
  | "permisos"
  | "ocupado"
  | "moodle"
  | "no-verificado"
  | "bloqueado"
  | "dependencia";

/** Lo que devuelve el servidor por cada curso escrito. */
export interface ResultadoAplicacion {
  courseId: number;
  esperado: string;
  /** Valor releído de Moodle tras escribir; null si no se pudo releer. */
  verificado: string | null;
  estado: "aplicado" | "error";
  motivo?: MotivoFallo;
  /** Mensaje crudo de Moodle o explicación de la verificación. */
  detalle?: string;
}

export interface AplicarResponse {
  resultados: ResultadoAplicacion[];
}

/** Una línea del resultado de la ejecución y del CSV. */
export interface ResultadoCurso {
  courseId: number;
  shortname: string;
  fullname: string;
  anterior: string;
  esperado: string;
  verificado: string | null;
  estado: "aplicado" | "omitido" | "error";
  motivo?: MotivoFallo;
  detalle?: string;
}
