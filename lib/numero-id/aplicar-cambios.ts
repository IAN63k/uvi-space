import { mapConConcurrencia } from "@/lib/moodle/concurrency";
import { MoodleApiError, getCoursesByIds, updateCourseIdnumber } from "@/lib/moodle/moodle.service";
import { sinToken } from "@/lib/moodle/sanitize";
import type { MoodleWarning } from "@/lib/moodle/types";

import type { CambioIdnumber, MotivoFallo, ResultadoAplicacion } from "./types";

/** Moodle es un servidor compartido: nunca más de 3 llamadas en vuelo. */
const CONCURRENCIA = 3;

/** errorcode de Moodle que significan «el token no puede hacer esto». No se
 *  clasifica por el mensaje: está traducido al idioma de la instancia. */
const CODIGOS_DE_PERMISO = new Set(["nopermissions", "accessexception"]);
const CODIGO_OCUPADO = "courseidnumbertaken";

interface AplicarParams {
  moodleUrl: string;
  token: string;
  cambios: CambioIdnumber[];
}

interface Escritura {
  cambio: CambioIdnumber;
  /** null: Moodle respondió sin `warnings` reconocibles. */
  warnings: MoodleWarning[] | null;
  excepcion?: { mensaje: string; errorcode?: string };
}

type Lectura = { ok: true; valores: Map<number, string> } | { ok: false; error: string };

function motivoPorCodigo(codigo: string | undefined): MotivoFallo {
  if (codigo && CODIGOS_DE_PERMISO.has(codigo)) return "permisos";
  return codigo === CODIGO_OCUPADO ? "ocupado" : "moodle";
}

async function escribir({ moodleUrl, token }: AplicarParams, cambio: CambioIdnumber): Promise<Escritura> {
  try {
    const warnings = await updateCourseIdnumber(moodleUrl, token, cambio.courseId, cambio.idnumber);
    return { cambio, warnings };
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido de Moodle";
    const errorcode = err instanceof MoodleApiError ? err.errorcode : undefined;
    return { cambio, warnings: null, excepcion: { mensaje: sinToken(mensaje, token), errorcode } };
  }
}

/** Relee los cursos tras escribir. El valor leído es la única prueba de éxito. */
async function releer({ moodleUrl, token }: AplicarParams, courseIds: number[]): Promise<Lectura> {
  try {
    const cursos = await getCoursesByIds(moodleUrl, token, courseIds);
    return { ok: true, valores: new Map(cursos.map((curso) => [curso.id, curso.idnumber ?? ""])) };
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido de Moodle";
    return { ok: false, error: sinToken(mensaje, token) };
  }
}

/** Decide el estado de un curso. Orden de las reglas:
 *  1. Excepción → error.
 *  2. Cualquier warning → error, aunque la relectura muestre el valor esperado.
 *  3. Sin rechazo, solo es «aplicado» si la relectura confirma el valor exacto
 *     (comparación de cadenas). Si no se pudo releer, no se da por aplicado. */
function clasificar({ cambio, warnings, excepcion }: Escritura, lectura: Lectura): ResultadoAplicacion {
  const verificado = lectura.ok ? (lectura.valores.get(cambio.courseId) ?? null) : null;
  const base = { courseId: cambio.courseId, esperado: cambio.idnumber, verificado };

  if (excepcion) {
    return { ...base, estado: "error", motivo: motivoPorCodigo(excepcion.errorcode), detalle: excepcion.mensaje };
  }

  if (warnings && warnings.length > 0) {
    return {
      ...base,
      estado: "error",
      motivo: motivoPorCodigo(warnings[0]?.warningcode),
      detalle: warnings.map((w) => `${w.message} [${w.warningcode}]`).join(" | "),
    };
  }

  if (!lectura.ok) {
    return {
      ...base,
      estado: "error",
      motivo: "no-verificado",
      detalle: `Moodle no reportó error, pero no se pudo releer el curso para confirmarlo: ${lectura.error}`,
    };
  }

  if (verificado === null) {
    return {
      ...base,
      estado: "error",
      motivo: "no-verificado",
      detalle: "Moodle no reportó error, pero el curso no apareció al releerlo.",
    };
  }

  if (verificado !== cambio.idnumber) {
    const enMoodle = verificado === "" ? "está vacío" : `es «${verificado}»`;
    const esperado = cambio.idnumber === "" ? "vacío" : `«${cambio.idnumber}»`;
    return {
      ...base,
      estado: "error",
      motivo: "no-verificado",
      detalle: `Moodle no reportó error, pero al releer el curso su Número ID ${enMoodle}; se esperaba ${esperado}.`,
    };
  }

  return { ...base, estado: "aplicado" };
}

/** Escribe un grupo de cambios independientes entre sí y verifica cada uno.
 *
 *  Un curso por llamada: así cada warning pertenece sin ambigüedad a su curso.
 *  Un error no detiene a los demás. El cliente envía los grupos en orden de
 *  dependencia, de modo que dentro de un grupo el orden no importa. */
export async function aplicarCambios(params: AplicarParams): Promise<ResultadoAplicacion[]> {
  const escrituras = await mapConConcurrencia(params.cambios, CONCURRENCIA, (cambio) => escribir(params, cambio));
  const lectura = await releer(params, params.cambios.map((cambio) => cambio.courseId));
  return escrituras.map((escritura) => clasificar(escritura, lectura));
}
