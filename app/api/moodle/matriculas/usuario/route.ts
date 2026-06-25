import { NextResponse } from "next/server";

import { getUserByField, getUserCourses, searchUsersByFullname } from "@/lib/moodle/moodle.service";
import type { UserSearchField, UserSearchResponse } from "@/lib/moodle/types";

type RequestBody = {
  moodleUrl: string;
  token: string;
  field: UserSearchField;
  value: string;
};

const VALID_FIELDS: UserSearchField[] = ["idnumber", "username", "email", "fullname"];

export async function POST(request: Request) {
  let body: Partial<RequestBody>;

  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch {
    return NextResponse.json({ message: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { moodleUrl, token, field, value } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  if (!field || !VALID_FIELDS.includes(field)) {
    return NextResponse.json({ message: "Campo de búsqueda inválido" }, { status: 400 });
  }

  if (!value || typeof value !== "string" || !value.trim()) {
    return NextResponse.json({ message: "Falta el valor a buscar" }, { status: 400 });
  }

  try {
    const users =
      field === "fullname"
        ? await searchUsersByFullname(moodleUrl.trim(), token.trim(), value.trim())
        : await getUserByField(moodleUrl.trim(), token.trim(), field, value.trim());
    const user = users[0];

    if (!user) {
      const response: UserSearchResponse = { found: false, field, value: value.trim() };
      return NextResponse.json(response);
    }

    const courses = await getUserCourses(moodleUrl.trim(), token.trim(), user.id);

    const response: UserSearchResponse = {
      found: true,
      user,
      enrolledCount: courses.length,
      field,
      value: value.trim(),
    };
    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error inesperado al consultar el usuario";
    return NextResponse.json({ message }, { status: 500 });
  }
}
