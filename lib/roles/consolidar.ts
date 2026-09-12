import type { MoodleEnrolledUser } from "@/lib/moodle/types";

import type { ParticipanteConsolidado } from "./types";

export interface ParticipantesDeCurso {
  courseId: number;
  usuarios: MoodleEnrolledUser[];
}

/** Agrupa los participantes de varios cursos por usuario: quien está en tres
 *  cursos aparece una vez, con sus tres cursos y el rol que tiene en cada uno. */
export function consolidarParticipantes(
  cursos: ParticipantesDeCurso[],
): ParticipanteConsolidado[] {
  const porUsuario = new Map<number, ParticipanteConsolidado>();

  for (const { courseId, usuarios } of cursos) {
    for (const usuario of usuarios) {
      const existente = porUsuario.get(usuario.id);
      const participante = existente ?? {
        userId: usuario.id,
        fullname: usuario.fullname,
        email: usuario.email,
        username: usuario.username,
        idnumber: usuario.idnumber ?? "",
        cursos: [],
      };

      participante.cursos.push({
        courseId,
        roles: (usuario.roles ?? []).map((rol) => ({
          roleId: rol.roleid,
          nombreEnMoodle: rol.name?.trim() || rol.shortname,
        })),
      });

      if (!existente) porUsuario.set(usuario.id, participante);
    }
  }

  for (const participante of porUsuario.values()) {
    participante.cursos.sort((a, b) => a.courseId - b.courseId);
  }

  return [...porUsuario.values()].sort((a, b) => a.fullname.localeCompare(b.fullname, "es"));
}
