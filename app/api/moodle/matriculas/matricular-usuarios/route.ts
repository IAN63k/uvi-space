import { NextResponse } from "next/server";

import { runEnrolmentBatch } from "@/lib/moodle/enrolment-batch";
import { enrolUsers } from "@/lib/moodle/moodle.service";
import type { EnrolmentData, UserOutcome } from "@/lib/moodle/types";

/** Un usuario a matricular con su rol (permite mezclar estudiantes y docentes) */
type UserRole = {
  userId: number;
  roleId: number;
};

type RequestBody = {
  moodleUrl: string;
  token: string;
  /** Curso destino: uno solo para toda la operación */
  courseId: number;
  /** Usuarios de esta llamada (el cliente envía en lotes) */
  users: UserRole[];
  /** timestamp unix; 0 u omitido = inmediato */
  timestart?: number;
  /** timestamp unix; 0 u omitido = sin límite */
  timeend?: number;
};

function buildEnrolment(
  user: UserRole,
  courseId: number,
  timestart?: number,
  timeend?: number,
): EnrolmentData {
  const enrolment: EnrolmentData = { roleid: user.roleId, userid: user.userId, courseid: courseId };
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

  const { moodleUrl, token, courseId, users, timestart, timeend } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  if (!courseId || typeof courseId !== "number" || !Number.isInteger(courseId) || courseId <= 0) {
    return NextResponse.json({ message: "Falta el ID del curso o no es válido" }, { status: 400 });
  }

  if (!Array.isArray(users) || users.length === 0) {
    return NextResponse.json({ message: "No se recibieron usuarios para matricular" }, { status: 400 });
  }

  const validUsers = users.filter(
    (u): u is UserRole =>
      !!u &&
      Number.isInteger(u.userId) &&
      u.userId > 0 &&
      Number.isInteger(u.roleId) &&
      u.roleId > 0,
  );

  if (validUsers.length === 0) {
    return NextResponse.json(
      { message: "Ningún usuario recibido tiene un ID y un rol válidos" },
      { status: 400 },
    );
  }

  const url = moodleUrl.trim();
  const tkn = token.trim();

  const outcomes = await runEnrolmentBatch<UserRole, number>({
    items: validUsers,
    keyOf: (u) => u.userId,
    run: (batch) =>
      enrolUsers(
        url,
        tkn,
        batch.map((u) => buildEnrolment(u, courseId, timestart, timeend)),
      ),
    errorMessage: "Error al matricular",
  });

  const results: UserOutcome[] = outcomes.map((o) => ({
    userId: o.key,
    success: o.success,
    error: o.error,
  }));

  return NextResponse.json({ results });
}
