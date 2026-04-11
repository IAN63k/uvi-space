import { NextResponse } from "next/server";

type RequestBody = {
  moodleUrl: string;
  token: string;
  courseId: number;
  updates: Record<string, string | number>;
};

type MoodleWarning = {
  item?: string;
  itemid?: number;
  warningcode: string;
  message: string;
};

type MoodleResponse = {
  warnings?: MoodleWarning[];
  exception?: string;
  message?: string;
  debuginfo?: string;
};

export async function POST(request: Request) {
  let body: Partial<RequestBody>;

  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch {
    return NextResponse.json({ message: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { moodleUrl, token, courseId, updates } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  if (!courseId || typeof courseId !== "number") {
    return NextResponse.json({ message: "Falta el ID del curso o no es válido" }, { status: 400 });
  }

  if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "No hay campos para actualizar" }, { status: 400 });
  }

  try {
    const params = new URLSearchParams();
    params.append("wstoken", token.trim());
    params.append("wsfunction", "core_course_update_courses");
    params.append("moodlewsrestformat", "json");
    params.append("courses[0][id]", String(courseId));

    for (const [field, value] of Object.entries(updates)) {
      params.append(`courses[0][${field}]`, String(value));
    }

    const url = `${moodleUrl.trim().replace(/\/+$/, "")}/webservice/rest/server.php`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      return NextResponse.json(
        { message: `Error HTTP ${res.status} desde Moodle` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as MoodleResponse;

    if (data.exception) {
      return NextResponse.json(
        { message: data.message ?? "Error en la API de Moodle" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, warnings: data.warnings ?? [] });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error inesperado al contactar la API de Moodle";
    return NextResponse.json({ message }, { status: 500 });
  }
}
