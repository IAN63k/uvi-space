import { NextResponse } from "next/server";

import { getEnrolledUsersByRole } from "@/lib/moodle/moodle.service";

type RequestBody = {
  moodleUrl: string;
  token: string;
  courseId: number;
  /** Rol por el que filtrar (3/4 = docentes, 5 = estudiantes). Omitido = todos */
  roleId?: number;
};

export async function POST(request: Request) {
  let body: Partial<RequestBody>;

  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch {
    return NextResponse.json({ message: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { moodleUrl, token, courseId, roleId } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  if (!courseId || typeof courseId !== "number" || !Number.isInteger(courseId) || courseId <= 0) {
    return NextResponse.json({ message: "Falta el ID del curso o no es válido" }, { status: 400 });
  }

  const filterRole = typeof roleId === "number" && roleId > 0 ? roleId : undefined;

  try {
    const users = await getEnrolledUsersByRole(moodleUrl.trim(), token.trim(), courseId, filterRole);
    const items = users.map((u) => ({
      id: u.id,
      username: u.username,
      firstname: u.firstname,
      lastname: u.lastname,
      fullname: u.fullname,
      email: u.email,
      idnumber: u.idnumber ?? "",
    }));
    return NextResponse.json({ users: items });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error inesperado al consultar los matriculados";
    return NextResponse.json({ message }, { status: 500 });
  }
}
