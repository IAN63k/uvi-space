import { NextResponse } from "next/server";
import { getCourseById } from "@/lib/moodle/moodle.service";
import { validateCourseContent } from "@/lib/moodle/validators/course-content.validator";

type RequestBody = {
  moodleUrl: string;
  token: string;
  courseId: number;
};

export async function POST(request: Request) {
  let body: Partial<RequestBody>;

  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch {
    return NextResponse.json({ message: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { moodleUrl, token, courseId } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  if (!courseId || typeof courseId !== "number") {
    return NextResponse.json({ message: "Falta el ID del curso (courseId)" }, { status: 400 });
  }

  try {
    // Detect format automatically — no need for the client to supply it
    const course = await getCourseById(moodleUrl.trim(), token.trim(), courseId);

    const result = await validateCourseContent(
      moodleUrl.trim(),
      token.trim(),
      courseId,
      course.format,
      course.fullname,
    );

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error inesperado al consultar la API de Moodle";
    return NextResponse.json({ message }, { status: 500 });
  }
}
