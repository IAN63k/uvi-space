import { NextResponse } from "next/server";

import { getCourseById } from "@/lib/moodle/moodle.service";
import type { CourseVerificationResult } from "@/lib/moodle/types";

type RequestBody = {
  moodleUrl: string;
  token: string;
  courseIds: number[];
};

export async function POST(request: Request) {
  let body: Partial<RequestBody>;

  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch {
    return NextResponse.json({ message: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { moodleUrl, token, courseIds } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  if (!Array.isArray(courseIds) || courseIds.length === 0) {
    return NextResponse.json({ message: "No se recibieron IDs de cursos para verificar" }, { status: 400 });
  }

  // Eliminar duplicados y valores no numéricos antes de consultar
  const uniqueIds = Array.from(new Set(courseIds.filter((id) => Number.isInteger(id) && id > 0)));

  try {
    const results = await Promise.all(
      uniqueIds.map(async (courseId): Promise<CourseVerificationResult> => {
        try {
          const course = await getCourseById(moodleUrl.trim(), token.trim(), courseId);
          return {
            courseId,
            found: true,
            fullname: course.fullname,
            shortname: course.shortname,
          };
        } catch (err) {
          return {
            courseId,
            found: false,
            error: err instanceof Error ? err.message : "Curso no encontrado",
          };
        }
      }),
    );

    return NextResponse.json({ results });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error inesperado al verificar los cursos";
    return NextResponse.json({ message }, { status: 500 });
  }
}
