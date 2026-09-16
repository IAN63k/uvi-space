import { NextResponse } from "next/server";

import { mapConConcurrencia } from "@/lib/moodle/concurrency";
import { getCoursesByIdnumber } from "@/lib/moodle/moodle.service";
import { sinToken } from "@/lib/moodle/sanitize";
import { MAX_VALORES_POR_COMPROBACION, type ResultadoComprobacion } from "@/lib/numero-id/types";
import { excedeLongitud, normalizarIdnumber } from "@/lib/numero-id/valor";

type RequestBody = {
  moodleUrl: string;
  token: string;
  valores: string[];
};

const CONCURRENCIA = 3;

/** Devuelve el error del primer valor inválido, o null.
 *  Un valor que no llega como cadena se rechaza: no se convierte. */
function errorDeValores(valores: unknown[]): string | null {
  for (const [indice, valor] of valores.entries()) {
    if (typeof valor !== "string") return `Valor ${indice + 1}: el Número ID debe enviarse como texto`;
    if (valor === "" || valor !== normalizarIdnumber(valor)) {
      return `Valor ${indice + 1}: vacío o con espacios al inicio o al final`;
    }
    if (excedeLongitud(valor)) return `Valor ${indice + 1}: supera los 100 caracteres`;
  }
  return null;
}

export async function POST(request: Request) {
  let body: Partial<RequestBody>;

  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch {
    return NextResponse.json({ message: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { moodleUrl, token, valores } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  if (!Array.isArray(valores) || valores.length === 0) {
    return NextResponse.json({ message: "No se recibieron valores para comprobar" }, { status: 400 });
  }

  if (valores.length > MAX_VALORES_POR_COMPROBACION) {
    return NextResponse.json(
      { message: `Demasiados valores en una petición: máximo ${MAX_VALORES_POR_COMPROBACION}` },
      { status: 400 },
    );
  }

  const error = errorDeValores(valores);
  if (error) return NextResponse.json({ message: error }, { status: 400 });

  const url = moodleUrl.trim();
  const tkn = token.trim();

  // Un valor cuya consulta falla se reporta; no tumba la comprobación entera.
  const resultados = await mapConConcurrencia(
    [...new Set(valores)],
    CONCURRENCIA,
    async (valor): Promise<ResultadoComprobacion> => {
      try {
        const cursos = await getCoursesByIdnumber(url, tkn, valor);
        return {
          valor,
          ocupantes: cursos.map((curso) => ({
            id: curso.id,
            shortname: curso.shortname,
            fullname: curso.fullname,
            idnumber: curso.idnumber ?? "",
          })),
        };
      } catch (err) {
        const detalle = err instanceof Error ? err.message : "Error al consultar Moodle";
        return { valor, ocupantes: [], error: sinToken(detalle, tkn) };
      }
    },
  );

  return NextResponse.json({ resultados });
}
