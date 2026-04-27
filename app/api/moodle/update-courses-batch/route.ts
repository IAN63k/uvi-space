import { NextResponse } from "next/server";

type CourseUpdate = {
  courseId: number;
  updates: Record<string, string | number>;
};

type RequestBody = {
  moodleUrl: string;
  token: string;
  courses: CourseUpdate[];
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

type CourseResult = {
  courseId: number;
  success: boolean;
  error?: string;
  warnings?: MoodleWarning[];
};

const NUMERIC_FIELDS = new Set([
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

/** Moodle's core_course_update_courses accepts multiple courses in a single call. */
export async function POST(request: Request) {
  let body: Partial<RequestBody>;

  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch {
    return NextResponse.json({ message: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { moodleUrl, token, courses } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  if (!Array.isArray(courses) || courses.length === 0) {
    return NextResponse.json({ message: "No se enviaron cursos para actualizar" }, { status: 400 });
  }

  if (courses.length > 50) {
    return NextResponse.json(
      { message: "Máximo 50 cursos por solicitud para evitar timeouts" },
      { status: 400 },
    );
  }

  const url = `${moodleUrl.trim().replace(/\/+$/, "")}/webservice/rest/server.php`;

  // Process in chunks to avoid Moodle timeouts — each chunk is a single WS call
  const CHUNK_SIZE = 10;
  const results: CourseResult[] = [];

  for (let chunkStart = 0; chunkStart < courses.length; chunkStart += CHUNK_SIZE) {
    const chunk = courses.slice(chunkStart, chunkStart + CHUNK_SIZE);

    const params = new URLSearchParams();
    params.append("wstoken", token.trim());
    params.append("wsfunction", "core_course_update_courses");
    params.append("moodlewsrestformat", "json");

    // Detect courses that update enddate without sending startdate — Moodle
    // requires startdate to be present whenever enddate is set, even if the
    // course already has one.  We look up their current startdates in bulk.
    const needsStartdateLookup = chunk.filter(
      (c) => c.updates["enddate"] !== undefined && c.updates["startdate"] === undefined,
    );

    const startdateMap = new Map<number, number>();

    if (needsStartdateLookup.length > 0) {
      try {
        const lookupParams = new URLSearchParams();
        lookupParams.append("wstoken", token.trim());
        lookupParams.append("wsfunction", "core_course_get_courses");
        lookupParams.append("moodlewsrestformat", "json");
        needsStartdateLookup.forEach((c, i) => {
          lookupParams.append(`options[ids][${i}]`, String(c.courseId));
        });

        const lookupRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: lookupParams.toString(),
        });

        if (lookupRes.ok) {
          const lookupData = (await lookupRes.json()) as Array<{ id: number; startdate?: number }>;
          if (Array.isArray(lookupData)) {
            for (const course of lookupData) {
              if (course.startdate && course.startdate > 0) {
                startdateMap.set(course.id, course.startdate);
              }
            }
          }
        }
      } catch {
        // Non-blocking — if lookup fails we still try the update
      }
    }

    chunk.forEach((course, idx) => {
      params.append(`courses[${idx}][id]`, String(course.courseId));
      for (const [field, value] of Object.entries(course.updates)) {
        let out: string | number = value;
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
          const [y, m, d] = value.split("-").map(Number);
          out = Math.floor(new Date(y, m - 1, d, 12, 0, 0).getTime() / 1000);
        } else if (NUMERIC_FIELDS.has(field) || (typeof value === "string" && /^\d+$/.test(value))) {
          out = Number(value);
        }
        params.append(`courses[${idx}][${field}]`, String(out));
      }

      // Inject existing startdate when updating enddate without explicit startdate
      if (course.updates["enddate"] !== undefined && course.updates["startdate"] === undefined) {
        const existingStart = startdateMap.get(course.courseId);
        if (existingStart) {
          params.append(`courses[${idx}][startdate]`, String(existingStart));
        }
      }
    });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!res.ok) {
        chunk.forEach((c) =>
          results.push({ courseId: c.courseId, success: false, error: `HTTP ${res.status}` }),
        );
        continue;
      }

      const data = (await res.json()) as MoodleResponse;

      if (data.exception) {
        chunk.forEach((c) =>
          results.push({
            courseId: c.courseId,
            success: false,
            error: data.message ?? "Error en la API de Moodle",
          }),
        );
        continue;
      }

      // Map warnings to specific courses
      const warningsByCourse = new Map<number, MoodleWarning[]>();
      if (data.warnings) {
        for (const w of data.warnings) {
          if (w.itemid !== undefined) {
            const existing = warningsByCourse.get(w.itemid) ?? [];
            existing.push(w);
            warningsByCourse.set(w.itemid, existing);
          }
        }
      }

      chunk.forEach((c) => {
        const courseWarnings = warningsByCourse.get(c.courseId);
        if (courseWarnings && courseWarnings.length > 0) {
          results.push({
            courseId: c.courseId,
            success: false,
            error: courseWarnings.map((w) => w.message).join("; "),
            warnings: courseWarnings,
          });
        } else {
          results.push({ courseId: c.courseId, success: true });
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error de red";
      chunk.forEach((c) => results.push({ courseId: c.courseId, success: false, error: message }));
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return NextResponse.json({
    total: results.length,
    success: successCount,
    failed: failCount,
    results,
  });
}
