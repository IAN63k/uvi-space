import { NextResponse } from "next/server";

import { runEnrolmentBatch } from "@/lib/moodle/enrolment-batch";
import { unenrolUsers } from "@/lib/moodle/moodle.service";
import type { UserOutcome } from "@/lib/moodle/types";

type RequestBody = {
  moodleUrl: string;
  token: string;
  /** Curso del que se desmatricula: uno solo para toda la operación */
  courseId: number;
  /** IDs de usuario de esta llamada (el cliente envía en lotes) */
  userIds: number[];
};

export async function POST(request: Request) {
  let body: Partial<RequestBody>;

  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch {
    return NextResponse.json({ message: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { moodleUrl, token, courseId, userIds } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  if (!courseId || typeof courseId !== "number" || !Number.isInteger(courseId) || courseId <= 0) {
    return NextResponse.json({ message: "Falta el ID del curso o no es válido" }, { status: 400 });
  }

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ message: "No se recibieron usuarios para desmatricular" }, { status: 400 });
  }

  const validIds = userIds.filter((id) => Number.isInteger(id) && id > 0);

  if (validIds.length === 0) {
    return NextResponse.json({ message: "Ningún ID de usuario recibido es válido" }, { status: 400 });
  }

  const url = moodleUrl.trim();
  const tkn = token.trim();

  const outcomes = await runEnrolmentBatch<number, number>({
    items: validIds,
    keyOf: (id) => id,
    run: (batch) =>
      unenrolUsers(
        url,
        tkn,
        batch.map((userId) => ({ userid: userId, courseid: courseId })),
      ),
    errorMessage: "Error al desmatricular",
  });

  const results: UserOutcome[] = outcomes.map((o) => ({
    userId: o.key,
    success: o.success,
    error: o.error,
  }));

  return NextResponse.json({ results });
}
