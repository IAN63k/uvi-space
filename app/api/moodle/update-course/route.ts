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

    // Normalizar valores antes de enviarlos a Moodle: convertir fechas YYYY-MM-DD -> timestamp (segundos)
    // y asegurar que campos numéricos se envíen como enteros.
    const processedUpdates: Record<string, string | number> = {};
    const numericFields = new Set([
      "enddate",
      "startdate",
      "maxbytes",
      "newsitems",
      "groupmode",
      "summaryformat",
      "showgrades",
      "showreports",
      "enablecompletion",
      "visible",
      "groupmodeforce",
      "completionnotify",
    ]);

    for (const [field, value] of Object.entries(updates)) {
      let out: string | number = value as string | number;

      try {
        // Detectar formato YYYY-MM-DD (usado por inputs de tipo date)
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
          const [y, m, d] = value.split("-").map(Number);
          out = Math.floor(new Date(y, m - 1, d, 12, 0, 0).getTime() / 1000);
        } else if (numericFields.has(field) || (typeof value === "string" && /^\d+$/.test(value))) {
          out = Number(value);
        }
      } catch (e) {
        out = value as string | number;
      }

      processedUpdates[field] = out;
      params.append(`courses[0][${field}]`, String(out));
    }

    // Si se intenta establecer enddate y no se envió startdate, obtener el startdate actual del curso
    // y enviarlo explícitamente (algunas instalaciones de Moodle requieren que se incluya).
    if (processedUpdates["enddate"] && processedUpdates["startdate"] === undefined) {
      try {
        const lookupParams = new URLSearchParams();
        lookupParams.append("wstoken", token.trim());
        lookupParams.append("wsfunction", "core_course_get_courses_by_field");
        lookupParams.append("moodlewsrestformat", "json");
        lookupParams.append("field", "id");
        lookupParams.append("value", String(courseId));

        const lookupUrl = `${moodleUrl.trim().replace(/\/+$/, "")}/webservice/rest/server.php`;
        const lookupRes = await fetch(lookupUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: lookupParams.toString(),
        });
        if (lookupRes.ok) {
          const lookupData = await lookupRes.json();
          // core_course_get_courses_by_field normalmente devuelve { courses: [...] }
          const foundCourse = (lookupData && (lookupData.courses ? lookupData.courses[0] : lookupData[0])) as any;
          const existingStart = foundCourse?.startdate ?? foundCourse?.start ?? 0;
          if (existingStart && Number(existingStart) > 0) {
            const startVal = Number(existingStart);
            // Añadir al params y processedUpdates
            processedUpdates["startdate"] = startVal;
            params.append(`courses[0][startdate]`, String(startVal));
          }
        }
      } catch (e) {
        // No bloquear la operación por fallos en la consulta de lookup; seguiremos con la petición original.
      }
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

    return NextResponse.json({ success: true, warnings: data.warnings ?? [], sentUpdates: processedUpdates });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error inesperado al contactar la API de Moodle";
    return NextResponse.json({ message }, { status: 500 });
  }
}
