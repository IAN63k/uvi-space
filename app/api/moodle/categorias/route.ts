import { NextResponse } from "next/server";
import { getCategoriesByParent } from "@/lib/moodle/moodle.service";

type RequestBody = {
  moodleUrl: string;
  token: string;
  parentId?: number;
};

export async function POST(request: Request) {
  let body: Partial<RequestBody>;

  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch {
    return NextResponse.json({ message: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { moodleUrl, token, parentId = 0 } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  try {
    const categories = await getCategoriesByParent(
      moodleUrl.trim(),
      token.trim(),
      parentId,
    );
    return NextResponse.json({ categories });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error inesperado al consultar las categorías";
    return NextResponse.json({ message }, { status: 500 });
  }
}
