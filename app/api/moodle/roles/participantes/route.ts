import { NextResponse } from "next/server";

import { mapConConcurrencia } from "@/lib/moodle/concurrency";
import { getEnrolledUsers } from "@/lib/moodle/moodle.service";
import { sinToken } from "@/lib/moodle/sanitize";
import { consolidarParticipantes, type ParticipantesDeCurso } from "@/lib/roles/consolidar";
import type { CursoConsultado } from "@/lib/roles/types";

type RequestBody = {
  moodleUrl: string;
  token: string;
  courseIds: number[];
};

const CONCURRENCIA = 3;
const MAX_CURSOS = 100;

export async function POST(request: Request) {
  let body: Partial<RequestBody>;

  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch {
    return NextResponse.json({ message: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { moodleUrl, token, courseIds } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  if (!Array.isArray(courseIds) || courseIds.length === 0) {
    return NextResponse.json({ message: "No se recibieron cursos para consultar" }, { status: 400 });
  }

  const idsValidos = [...new Set(courseIds.filter((id) => Number.isInteger(id) && id > 0))];

  if (idsValidos.length === 0) {
    return NextResponse.json({ message: "Ningún ID de curso es un entero positivo" }, { status: 400 });
  }

  if (idsValidos.length > MAX_CURSOS) {
    return NextResponse.json(
      { message: `Demasiados cursos en una consulta: máximo ${MAX_CURSOS}` },
      { status: 400 },
    );
  }

  const url = moodleUrl.trim();
  const tkn = token.trim();

  // Un curso que falla se reporta, no tumba la consulta completa.
  const consultas = await mapConConcurrencia(idsValidos, CONCURRENCIA, async (courseId) => {
    try {
      const usuarios = await getEnrolledUsers(url, tkn, courseId);
      return {
        curso: { courseId, ok: true, totalParticipantes: usuarios.length } satisfies CursoConsultado,
        participantes: { courseId, usuarios } satisfies ParticipantesDeCurso,
      };
    } catch (err) {
      const detalle = err instanceof Error ? err.message : "Error al consultar el curso";
      return {
        curso: {
          courseId,
          ok: false,
          totalParticipantes: 0,
          error: sinToken(detalle, tkn),
        } satisfies CursoConsultado,
        participantes: null,
      };
    }
  });

  const participantes = consolidarParticipantes(
    consultas.map((c) => c.participantes).filter((p): p is ParticipantesDeCurso => p !== null),
  );

  return NextResponse.json({
    participantes,
    cursos: consultas.map((c) => c.curso),
  });
}
