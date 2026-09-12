// ── Consulta de participantes ────────────────────────────────────────────────

/** Un rol que el usuario tiene en un curso concreto. */
export interface RolEnCurso {
  roleId: number;
  /** Nombre tal como lo devolvió Moodle para ese curso. Solo para mostrar. */
  nombreEnMoodle: string;
}

export interface ParticipacionCurso {
  courseId: number;
  roles: RolEnCurso[];
}

/** Un usuario visto una sola vez, con todos los cursos en los que aparece. */
export interface ParticipanteConsolidado {
  userId: number;
  fullname: string;
  email: string;
  username: string;
  idnumber: string;
  cursos: ParticipacionCurso[];
}

/** Resultado de consultar un curso: uno caído no invalida la consulta entera. */
export interface CursoConsultado {
  courseId: number;
  ok: boolean;
  totalParticipantes: number;
  error?: string;
}

export interface ParticipantesResponse {
  participantes: ParticipanteConsolidado[];
  cursos: CursoConsultado[];
}

// ── Cambio de roles ──────────────────────────────────────────────────────────

/** Intercambiar = agregar el destino y retirar los actuales elegidos.
 *  Agregar = acumular el destino sin tocar los roles actuales. */
export type ModoCambio = "intercambiar" | "agregar";

/** Lo que se pide para un usuario en un curso. */
export interface OperacionRol {
  userId: number;
  roleDestinoId: number;
  /** roleids a retirar tras verificar el destino. Vacío = solo agregar. */
  rolesARetirar: number[];
}

export type AccionRol = "asignar" | "retirar";
export type EstadoResultado = "ok" | "omitido" | "error";

/** Una línea del log de ejecución: un usuario, un curso, un rol, una acción.
 *  Es también la fila del CSV exportado. */
export interface ResultadoOperacion {
  userId: number;
  courseId: number;
  roleId: number;
  accion: AccionRol;
  estado: EstadoResultado;
  /** Motivo de la omisión o mensaje crudo de Moodle en caso de error. */
  detalle?: string;
}

export interface CambiarRolesResponse {
  resultados: ResultadoOperacion[];
}
