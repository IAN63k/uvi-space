import { postMoodleJson } from "@/lib/moodle/api-client";
import type { MoodleConfig } from "@/lib/encrypted-local-storage";

import type { CambiarRolesResponse, OperacionRol, ParticipantesResponse } from "./types";

export function consultarParticipantes(
  config: MoodleConfig,
  courseIds: number[],
): Promise<ParticipantesResponse> {
  return postMoodleJson<ParticipantesResponse>(
    "/api/moodle/roles/participantes",
    config,
    { courseIds },
  );
}

/** Aplica los cambios de un curso. El cliente envía un curso por petición para
 *  poder mostrar el progreso y para que un curso caído no arrastre al resto. */
export function cambiarRolesDeCurso(
  config: MoodleConfig,
  courseId: number,
  operaciones: OperacionRol[],
): Promise<CambiarRolesResponse> {
  return postMoodleJson<CambiarRolesResponse>(
    "/api/moodle/roles/cambiar",
    config,
    { courseId, operaciones },
  );
}
