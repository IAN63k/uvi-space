import { ROL_EDITINGTEACHER, esRolConocido } from "@/lib/moodle/roles";

import type {
  ModoCambio,
  OperacionRol,
  ParticipanteConsolidado,
  RolEnCurso,
} from "./types";

/** Una línea del plan: un usuario en un curso. */
export interface FilaPlan {
  userId: number;
  fullname: string;
  email: string;
  courseId: number;
  rolesActuales: RolEnCurso[];
  roleDestinoId: number;
  yaTieneDestino: boolean;
  rolesARetirar: number[];
}

export interface Plan {
  filas: FilaPlan[];
  /** Asignaciones que realmente se van a crear. */
  asignaciones: number;
  /** Usuarios que ya tienen el rol destino en ese curso. */
  sinCambios: number;
  retiros: number;
  cursos: number;
  usuarios: number;
}

export interface OpcionesPlan {
  /** Solo los participantes seleccionados. */
  participantes: ParticipanteConsolidado[];
  roleDestinoId: number;
  modo: ModoCambio;
  cursoExcluido: (userId: number, courseId: number) => boolean;
  retiroDesmarcado: (userId: number, courseId: number, roleId: number) => boolean;
}

/** Roles de un curso que la herramienta puede retirar: el destino nunca, y los
 *  que no están en el catálogo tampoco (el servidor los rechaza). */
export function rolesRetirables(roles: RolEnCurso[], roleDestinoId: number): RolEnCurso[] {
  return roles.filter((rol) => rol.roleId !== roleDestinoId && esRolConocido(rol.roleId));
}

export function construirPlan({
  participantes,
  roleDestinoId,
  modo,
  cursoExcluido,
  retiroDesmarcado,
}: OpcionesPlan): Plan {
  const filas: FilaPlan[] = [];

  for (const participante of participantes) {
    for (const curso of participante.cursos) {
      if (cursoExcluido(participante.userId, curso.courseId)) continue;

      const rolesARetirar =
        modo === "intercambiar"
          ? rolesRetirables(curso.roles, roleDestinoId)
              .filter((rol) => !retiroDesmarcado(participante.userId, curso.courseId, rol.roleId))
              .map((rol) => rol.roleId)
          : [];

      filas.push({
        userId: participante.userId,
        fullname: participante.fullname,
        email: participante.email,
        courseId: curso.courseId,
        rolesActuales: curso.roles,
        roleDestinoId,
        yaTieneDestino: curso.roles.some((rol) => rol.roleId === roleDestinoId),
        rolesARetirar,
      });
    }
  }

  return {
    filas,
    asignaciones: filas.filter((fila) => !fila.yaTieneDestino).length,
    sinCambios: filas.filter((fila) => fila.yaTieneDestino).length,
    retiros: filas.reduce((total, fila) => total + fila.rolesARetirar.length, 0),
    cursos: new Set(filas.map((fila) => fila.courseId)).size,
    usuarios: new Set(filas.map((fila) => fila.userId)).size,
  };
}

/** Un curso que se quedaría sin nadie con rol de profesor con edición. */
export interface CursoSinDocente {
  courseId: number;
  docentesAntes: number;
}

/** Cursos del plan que, después de aplicarlo, no tendrían ningún usuario con
 *  rol editingteacher.
 *
 *  Se calcula sobre los participantes ya consultados, sin llamadas nuevas: hay
 *  que pasar la lista completa del curso, no solo los usuarios seleccionados,
 *  porque un docente no seleccionado también cuenta para no dejarlo vacío.
 *
 *  Solo se reportan los cursos que sí tenían docente antes: si ya estaba vacío,
 *  no es este cambio el que lo deja así. */
export function cursosQueQuedanSinDocente(
  plan: Plan,
  todosLosParticipantes: ParticipanteConsolidado[],
): CursoSinDocente[] {
  const docentesAntes = new Map<number, Set<number>>();

  for (const participante of todosLosParticipantes) {
    for (const curso of participante.cursos) {
      if (!curso.roles.some((rol) => rol.roleId === ROL_EDITINGTEACHER)) continue;
      const docentes = docentesAntes.get(curso.courseId) ?? new Set<number>();
      docentes.add(participante.userId);
      docentesAntes.set(curso.courseId, docentes);
    }
  }

  const docentesDespues = new Map<number, Set<number>>();
  for (const fila of plan.filas) {
    if (!docentesDespues.has(fila.courseId)) {
      docentesDespues.set(fila.courseId, new Set(docentesAntes.get(fila.courseId) ?? []));
    }
  }

  for (const fila of plan.filas) {
    const docentes = docentesDespues.get(fila.courseId);
    if (!docentes) continue;

    // El plan nunca retira el rol destino, así que ambas ramas no se solapan.
    if (fila.rolesARetirar.includes(ROL_EDITINGTEACHER)) docentes.delete(fila.userId);
    if (fila.roleDestinoId === ROL_EDITINGTEACHER) docentes.add(fila.userId);
  }

  const enRiesgo: CursoSinDocente[] = [];
  for (const [courseId, docentes] of docentesDespues) {
    const antes = docentesAntes.get(courseId)?.size ?? 0;
    if (docentes.size === 0 && antes > 0) enRiesgo.push({ courseId, docentesAntes: antes });
  }

  return enRiesgo.sort((a, b) => a.courseId - b.courseId);
}

/** Agrupa el plan por curso: cada grupo es una petición al servidor. */
export function operacionesPorCurso(plan: Plan): Map<number, OperacionRol[]> {
  const porCurso = new Map<number, OperacionRol[]>();

  for (const fila of plan.filas) {
    const operaciones = porCurso.get(fila.courseId) ?? [];
    operaciones.push({
      userId: fila.userId,
      roleDestinoId: fila.roleDestinoId,
      rolesARetirar: fila.rolesARetirar,
    });
    porCurso.set(fila.courseId, operaciones);
  }

  return porCurso;
}
