import { NextResponse } from "next/server";

import { aplicarCambios } from "@/lib/numero-id/aplicar-cambios";
import { MAX_CAMBIOS_POR_APLICACION, type CambioIdnumber } from "@/lib/numero-id/types";
import { claveDeUnicidad, excedeLongitud, normalizarIdnumber } from "@/lib/numero-id/valor";

type RequestBody = {
  moodleUrl: string;
  token: string;
  cambios: CambioIdnumber[];
};

/** Valida un cambio recibido del cliente. Devuelve el error o null.
 *
 *  El servidor no corrige nada: un idnumber que no llega como cadena o con
 *  espacios sobrantes es un error del cliente y se rechaza, en vez de
 *  convertirlo o recortarlo en silencio. */
function errorDeCambio(cambio: unknown, indice: number): string | null {
  const donde = `Cambio ${indice + 1}`;

  if (typeof cambio !== "object" || cambio === null) return `${donde}: formato inválido`;

  const { courseId, idnumber } = cambio as Partial<CambioIdnumber>;

  if (!Number.isInteger(courseId) || (courseId as number) <= 0) {
    return `${donde}: el ID de curso no es válido`;
  }
  if (typeof idnumber !== "string") {
    return `${donde}: el Número ID debe enviarse como texto`;
  }
  if (idnumber !== normalizarIdnumber(idnumber)) {
    return `${donde}: el Número ID tiene espacios al inicio o al final`;
  }
  if (excedeLongitud(idnumber)) {
    return `${donde}: el Número ID supera los 100 caracteres`;
  }
  return null;
}

/** Dos cursos del mismo lote con el mismo valor no vacío: el segundo fallaría
 *  siempre. Mismo criterio de comparación que la previsualización. */
function hayDuplicados(cambios: CambioIdnumber[]): boolean {
  const claves = cambios.filter((c) => c.idnumber !== "").map((c) => claveDeUnicidad(c.idnumber));
  return new Set(claves).size !== claves.length;
}

export async function POST(request: Request) {
  let body: Partial<RequestBody>;

  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch {
    return NextResponse.json({ message: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { moodleUrl, token, cambios } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  if (!Array.isArray(cambios) || cambios.length === 0) {
    return NextResponse.json({ message: "No se recibieron cambios" }, { status: 400 });
  }

  if (cambios.length > MAX_CAMBIOS_POR_APLICACION) {
    return NextResponse.json(
      { message: `Demasiados cambios en una petición: máximo ${MAX_CAMBIOS_POR_APLICACION}` },
      { status: 400 },
    );
  }

  for (const [indice, cambio] of cambios.entries()) {
    const error = errorDeCambio(cambio, indice);
    if (error) return NextResponse.json({ message: error }, { status: 400 });
  }

  if (new Set(cambios.map((c) => c.courseId)).size !== cambios.length) {
    return NextResponse.json({ message: "Hay cambios repetidos para el mismo curso" }, { status: 400 });
  }

  if (hayDuplicados(cambios)) {
    return NextResponse.json(
      { message: "Hay dos cursos con el mismo Número ID en la petición; no se aplicó ningún cambio" },
      { status: 400 },
    );
  }

  // Solo viajan id e idnumber: se reconstruye cada cambio para que ningún campo
  // extra que llegue en el cuerpo pueda alcanzar a Moodle.
  const resultados = await aplicarCambios({
    moodleUrl: moodleUrl.trim(),
    token: token.trim(),
    cambios: cambios.map(({ courseId, idnumber }) => ({ courseId, idnumber })),
  });

  return NextResponse.json({ resultados });
}
