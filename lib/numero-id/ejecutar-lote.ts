import type { MoodleConfig } from "@/lib/encrypted-local-storage";
import { chunk } from "@/lib/matriculas/helpers";

import { aplicarTanda } from "./api";
import { esEjecutable, type EstadoFila, type FilaEvaluada, type Lote } from "./plan";
import { MAX_CAMBIOS_POR_APLICACION, type ResultadoAplicacion, type ResultadoCurso } from "./types";

const MOTIVO_DE_BLOQUEO: Partial<Record<EstadoFila, string>> = {
  duplicado: "duplicado en el lote",
  circular: "intercambio circular",
  ocupado: "el valor ya lo tiene otro curso",
  "sin-comprobar": "no se pudo comprobar si el valor está libre",
  "demasiado-largo": "supera los 100 caracteres",
};

function resultadoBase(fila: FilaEvaluada) {
  const { curso } = fila;
  return {
    courseId: curso.id,
    shortname: curso.shortname,
    fullname: curso.fullname,
    anterior: curso.idnumber,
    esperado: fila.propuesto,
  };
}

/** Filas seleccionadas que no se escriben: sin cambios o bloqueadas. Entran al
 *  resultado y al CSV para que el informe cubra toda la selección. */
function omitidas(lote: Lote): ResultadoCurso[] {
  return lote.filas
    .filter((fila) => fila.seleccionada && !esEjecutable(fila))
    .map((fila) =>
      fila.cambia
        ? {
            ...resultadoBase(fila),
            verificado: null,
            estado: "omitido" as const,
            motivo: "bloqueado" as const,
            detalle: `Bloqueado: ${MOTIVO_DE_BLOQUEO[fila.estado] ?? fila.estado}.`,
          }
        : {
            ...resultadoBase(fila),
            verificado: null,
            estado: "omitido" as const,
            detalle: "Sin cambios: el Número ID ya tenía ese valor.",
          },
    );
}

function omitidaPorDependencia(fila: FilaEvaluada, lote: Lote): ResultadoCurso {
  const bloqueante = lote.porId.get(fila.dependeDe[0] ?? -1)?.curso;
  return {
    ...resultadoBase(fila),
    verificado: null,
    estado: "omitido",
    motivo: "dependencia",
    detalle: `No se intentó: «${fila.propuesto}» sigue en el curso ${bloqueante?.id} (${bloqueante?.shortname}), que no se pudo cambiar.`,
  };
}

async function escribirTanda(config: MoodleConfig, filas: FilaEvaluada[]): Promise<ResultadoCurso[]> {
  const porId = new Map(filas.map((fila) => [fila.curso.id, fila]));
  let respuestas: ResultadoAplicacion[];

  try {
    const cambios = filas.map((fila) => ({ courseId: fila.curso.id, idnumber: fila.propuesto }));
    respuestas = (await aplicarTanda(config, cambios)).resultados;
  } catch (err) {
    // La petición pudo aplicarse a medias antes de fallar: no se sabe, así que
    // no se da nada por aplicado. La tabla se refresca con el estado real.
    const mensaje = err instanceof Error ? err.message : "Error inesperado al contactar la API";
    respuestas = filas.map((fila) => ({
      courseId: fila.curso.id,
      esperado: fila.propuesto,
      verificado: null,
      estado: "error",
      motivo: "no-verificado",
      detalle: `La petición falló y no se pudo confirmar el resultado: ${mensaje}`,
    }));
  }

  return respuestas.map((respuesta) => {
    const fila = porId.get(respuesta.courseId);
    return { ...(fila ? resultadoBase(fila) : { shortname: "", fullname: "", anterior: "" }), ...respuesta };
  });
}

/** Ejecuta el lote nivel a nivel. Una fila cuya dependencia no quedó aplicada
 *  no se intenta: Moodle la rechazaría porque el valor sigue ocupado. Los errores
 *  no detienen el lote. */
export async function ejecutarLote(
  config: MoodleConfig,
  lote: Lote,
  alAvanzar: (resultados: ResultadoCurso[]) => void,
): Promise<ResultadoCurso[]> {
  const resultados = omitidas(lote);
  const aplicados = new Set<number>();
  alAvanzar([...resultados]);

  for (const nivel of lote.niveles) {
    const listas = nivel.filter((fila) => fila.dependeDe.every((id) => aplicados.has(id)));
    const bloqueadas = nivel.filter((fila) => !listas.includes(fila));
    resultados.push(...bloqueadas.map((fila) => omitidaPorDependencia(fila, lote)));

    for (const tanda of chunk(listas, MAX_CAMBIOS_POR_APLICACION)) {
      const escritos = await escribirTanda(config, tanda);
      escritos.filter((r) => r.estado === "aplicado").forEach((r) => aplicados.add(r.courseId));
      resultados.push(...escritos);
      alAvanzar([...resultados]);
    }
  }

  return resultados;
}

/** Todas las escrituras intentadas fallaron por permisos: se explica una vez. */
export function falloTotalPorPermisos(resultados: ResultadoCurso[]): boolean {
  const intentados = resultados.filter((r) => r.estado !== "omitido");
  return intentados.length > 0 && intentados.every((r) => r.motivo === "permisos");
}
