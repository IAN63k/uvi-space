import { NextResponse } from "next/server";

import { enrolUsers } from "@/lib/moodle/moodle.service";
import type { EnrolmentData } from "@/lib/moodle/types";

type RequestBody = {
  moodleUrl: string;
  token: string;
  userId: number;
  /** IDs de los cursos a matricular en esta llamada (el cliente envía en lotes de 10) */
  courseIds: number[];
  roleId: number;
  /** timestamp unix; 0 u omitido = inmediato */
  timestart?: number;
  /** timestamp unix; 0 u omitido = sin límite */
  timeend?: number;
};

/** Resultado por curso devuelto al cliente (sin nombre; el cliente lo resuelve) */
type CourseOutcome = {
  courseId: number;
  success: boolean;
  error?: string;
};

function buildEnrolment(
  userId: number,
  courseId: number,
  roleId: number,
  timestart?: number,
  timeend?: number,
): EnrolmentData {
  const enrolment: EnrolmentData = { roleid: roleId, userid: userId, courseid: courseId };
  if (timestart && timestart > 0) enrolment.timestart = timestart;
  if (timeend && timeend > 0) enrolment.timeend = timeend;
  return enrolment;
}

export async function POST(request: Request) {
  let body: Partial<RequestBody>;

  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch {
    return NextResponse.json({ message: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { moodleUrl, token, userId, courseIds, roleId, timestart, timeend } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  if (!userId || typeof userId !== "number") {
    return NextResponse.json({ message: "Falta el ID del usuario o no es válido" }, { status: 400 });
  }

  if (!roleId || typeof roleId !== "number") {
    return NextResponse.json({ message: "Falta el rol o no es válido" }, { status: 400 });
  }

  if (!Array.isArray(courseIds) || courseIds.length === 0) {
    return NextResponse.json({ message: "No se recibieron cursos para matricular" }, { status: 400 });
  }

  const url = moodleUrl.trim();
  const tkn = token.trim();
  const validIds = courseIds.filter((id) => Number.isInteger(id) && id > 0);

  try {
    // Camino feliz: un único lote para todos los cursos de esta llamada.
    await enrolUsers(
      url,
      tkn,
      validIds.map((courseId) => buildEnrolment(userId, courseId, roleId, timestart, timeend)),
    );
    const results: CourseOutcome[] = validIds.map((courseId) => ({ courseId, success: true }));
    return NextResponse.json({ results });
  } catch {
    // El lote es atómico: si falla, reintentamos curso por curso para
    // identificar exactamente cuáles fallan sin detener al resto.
    const results = await Promise.all(
      validIds.map(async (courseId): Promise<CourseOutcome> => {
        try {
          await enrolUsers(url, tkn, [buildEnrolment(userId, courseId, roleId, timestart, timeend)]);
          return { courseId, success: true };
        } catch (err) {
          return {
            courseId,
            success: false,
            error: err instanceof Error ? err.message : "Error al matricular",
          };
        }
      }),
    );
    return NextResponse.json({ results });
  }
}
