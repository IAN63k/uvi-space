import { NextResponse } from "next/server";

import { sinToken } from "@/lib/moodle/sanitize";
import { consultarCursos } from "@/lib/numero-id/consultar-cursos";

type RequestBody = {
  moodleUrl: string;
  token: string;
  categoryId: number;
  incluirSubcategorias: boolean;
};

export async function POST(request: Request) {
  let body: Partial<RequestBody>;

  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch {
    return NextResponse.json({ message: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { moodleUrl, token, categoryId, incluirSubcategorias } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  if (!Number.isInteger(categoryId) || (categoryId as number) <= 0) {
    return NextResponse.json({ message: "Falta el ID de la categoría o no es válido" }, { status: 400 });
  }

  const tkn = token.trim();

  try {
    const respuesta = await consultarCursos({
      moodleUrl: moodleUrl.trim(),
      token: tkn,
      categoryId: categoryId as number,
      incluirSubcategorias: incluirSubcategorias === true,
    });
    return NextResponse.json(respuesta);
  } catch (err) {
    const detalle = err instanceof Error ? err.message : "Error inesperado al consultar los cursos";
    return NextResponse.json({ message: sinToken(detalle, tkn) }, { status: 500 });
  }
}
