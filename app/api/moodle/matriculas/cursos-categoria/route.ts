import { NextResponse } from "next/server";

import { getCoursesByCategory } from "@/lib/moodle/moodle.service";

type RequestBody = {
  moodleUrl: string;
  token: string;
  categoryId: number;
};

export async function POST(request: Request) {
  let body: Partial<RequestBody>;

  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch {
    return NextResponse.json({ message: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { moodleUrl, token, categoryId } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  if (!categoryId || typeof categoryId !== "number") {
    return NextResponse.json({ message: "Falta el ID de la categoría o no es válido" }, { status: 400 });
  }

  try {
    const courses = await getCoursesByCategory(moodleUrl.trim(), token.trim(), categoryId);
    // Solo los campos necesarios para la selección
    const items = courses.map((c) => ({
      id: c.id,
      shortname: c.shortname,
      fullname: c.fullname,
      idnumber: c.idnumber ?? "",
    }));
    return NextResponse.json({ courses: items });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error inesperado al consultar los cursos";
    return NextResponse.json({ message }, { status: 500 });
  }
}
