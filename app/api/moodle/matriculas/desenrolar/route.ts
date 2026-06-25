import { NextResponse } from "next/server";

import { unenrolUsers } from "@/lib/moodle/moodle.service";

type RequestBody = {
  moodleUrl: string;
  token: string;
  userId: number;
  /** IDs de los cursos a desmatricular en esta llamada (el cliente envía en lotes de 10) */
  courseIds: number[];
};

type CourseOutcome = {
  courseId: number;
  success: boolean;
  error?: string;
};

export async function POST(request: Request) {
  let body: Partial<RequestBody>;

  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch {
    return NextResponse.json({ message: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { moodleUrl, token, userId, courseIds } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  if (!userId || typeof userId !== "number") {
    return NextResponse.json({ message: "Falta el ID del usuario o no es válido" }, { status: 400 });
  }

  if (!Array.isArray(courseIds) || courseIds.length === 0) {
    return NextResponse.json({ message: "No se recibieron cursos para desmatricular" }, { status: 400 });
  }

  const url = moodleUrl.trim();
  const tkn = token.trim();
  const validIds = courseIds.filter((id) => Number.isInteger(id) && id > 0);

  try {
    await unenrolUsers(
      url,
      tkn,
      validIds.map((courseId) => ({ userid: userId, courseid: courseId })),
    );
    const results: CourseOutcome[] = validIds.map((courseId) => ({ courseId, success: true }));
    return NextResponse.json({ results });
  } catch {
    const results = await Promise.all(
      validIds.map(async (courseId): Promise<CourseOutcome> => {
        try {
          await unenrolUsers(url, tkn, [{ userid: userId, courseid: courseId }]);
          return { courseId, success: true };
        } catch (err) {
          return {
            courseId,
            success: false,
            error: err instanceof Error ? err.message : "Error al desmatricular",
          };
        }
      }),
    );
    return NextResponse.json({ results });
  }
}
