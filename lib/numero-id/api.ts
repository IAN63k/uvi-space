import type { MoodleConfig } from "@/lib/encrypted-local-storage";
import { chunk } from "@/lib/matriculas/helpers";
import { postMoodleJson } from "@/lib/moodle/api-client";

import {
  MAX_VALORES_POR_COMPROBACION,
  type AplicarResponse,
  type CambioIdnumber,
  type ComprobarResponse,
  type CursosResponse,
  type ResultadoComprobacion,
} from "./types";

export function consultarCursos(
  config: MoodleConfig,
  categoryId: number,
  incluirSubcategorias: boolean,
): Promise<CursosResponse> {
  return postMoodleJson<CursosResponse>("/api/moodle/numero-id/cursos", config, {
    categoryId,
    incluirSubcategorias,
  });
}

/** Comprueba en tandas para mostrar progreso y no agotar el tiempo de una sola
 *  petición. Si una tanda falla entera, sus valores vuelven con el error: la
 *  fila queda «sin comprobar», nunca libre por omisión. */
export async function comprobarValores(
  config: MoodleConfig,
  valores: string[],
  alAvanzar: (procesados: number) => void,
): Promise<ResultadoComprobacion[]> {
  const resultados: ResultadoComprobacion[] = [];

  for (const tanda of chunk(valores, MAX_VALORES_POR_COMPROBACION)) {
    try {
      const respuesta = await postMoodleJson<ComprobarResponse>(
        "/api/moodle/numero-id/comprobar",
        config,
        { valores: tanda },
      );
      resultados.push(...respuesta.resultados);
    } catch (err) {
      const error = err instanceof Error ? err.message : "Error inesperado al comprobar";
      resultados.push(...tanda.map((valor) => ({ valor, ocupantes: [], error })));
    }
    alAvanzar(resultados.length);
  }

  return resultados;
}

export function aplicarTanda(config: MoodleConfig, cambios: CambioIdnumber[]): Promise<AplicarResponse> {
  return postMoodleJson<AplicarResponse>("/api/moodle/numero-id/aplicar", config, { cambios });
}
