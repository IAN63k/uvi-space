import { NextResponse } from "next/server";

import { esRolAsignable, esRolConocido } from "@/lib/moodle/roles";
import { sinToken } from "@/lib/moodle/sanitize";
import { cambiarRolesEnCurso } from "@/lib/roles/cambiar-roles";
import type { OperacionRol } from "@/lib/roles/types";

type RequestBody = {
  moodleUrl: string;
  token: string;
  courseId: number;
  operaciones: OperacionRol[];
};

const MAX_OPERACIONES = 200;

/** Valida una operación recibida del cliente. Devuelve el error o null.
 *
 *  El rol destino se comprueba contra el catálogo de roles asignables: el token
 *  de Moodle puede asignar cualquier rol, así que la lista blanca del servidor
 *  es lo que impide que una petición manipulada asigne, por ejemplo, manager. */
function errorDeOperacion(operacion: unknown, indice: number): string | null {
  const donde = `Operación ${indice + 1}`;

  if (typeof operacion !== "object" || operacion === null) {
    return `${donde}: formato inválido`;
  }

  const { userId, roleDestinoId, rolesARetirar } = operacion as Partial<OperacionRol>;

  if (!Number.isInteger(userId) || (userId as number) <= 0) {
    return `${donde}: el ID de usuario no es válido`;
  }

  if (!Number.isInteger(roleDestinoId)) {
    return `${donde}: falta el rol destino`;
  }

  if (!esRolAsignable(roleDestinoId as number)) {
    return `${donde}: el rol ${roleDestinoId} no es asignable por esta herramienta`;
  }

  if (!Array.isArray(rolesARetirar)) {
    return `${donde}: rolesARetirar debe ser una lista`;
  }

  for (const roleId of rolesARetirar) {
    if (!Number.isInteger(roleId)) {
      return `${donde}: hay un rol a retirar que no es un entero`;
    }
    if (!esRolConocido(roleId)) {
      return `${donde}: el rol ${roleId} no está en el catálogo y no se puede retirar`;
    }
  }

  return null;
}

export async function POST(request: Request) {
  let body: Partial<RequestBody>;

  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch {
    return NextResponse.json({ message: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { moodleUrl, token, courseId, operaciones } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  if (!Number.isInteger(courseId) || (courseId as number) <= 0) {
    return NextResponse.json({ message: "Falta el ID del curso o no es válido" }, { status: 400 });
  }

  if (!Array.isArray(operaciones) || operaciones.length === 0) {
    return NextResponse.json({ message: "No se recibieron operaciones" }, { status: 400 });
  }

  if (operaciones.length > MAX_OPERACIONES) {
    return NextResponse.json(
      { message: `Demasiadas operaciones en un lote: máximo ${MAX_OPERACIONES}` },
      { status: 400 },
    );
  }

  for (const [indice, operacion] of operaciones.entries()) {
    const error = errorDeOperacion(operacion, indice);
    if (error) return NextResponse.json({ message: error }, { status: 400 });
  }

  // Un mismo usuario dos veces en el mismo curso haría que las fases se pisen.
  const usuarios = new Set(operaciones.map((operacion) => operacion.userId));
  if (usuarios.size !== operaciones.length) {
    return NextResponse.json(
      { message: "Hay operaciones repetidas para el mismo usuario en este curso" },
      { status: 400 },
    );
  }

  const tkn = token.trim();

  try {
    const resultados = await cambiarRolesEnCurso({
      moodleUrl: moodleUrl.trim(),
      token: tkn,
      courseId: courseId as number,
      operaciones: operaciones.map((operacion) => ({
        userId: operacion.userId,
        roleDestinoId: operacion.roleDestinoId,
        rolesARetirar: [...new Set(operacion.rolesARetirar)],
      })),
    });

    return NextResponse.json({ resultados });
  } catch (err) {
    // Solo llega aquí si falla la lectura inicial del curso: sin ella no se
    // puede garantizar la idempotencia ni la verificación, así que no se
    // escribe nada.
    const detalle = err instanceof Error ? err.message : "Error inesperado al cambiar los roles";
    return NextResponse.json(
      { message: `No se pudo leer el curso ${courseId}, no se aplicó ningún cambio: ${sinToken(detalle, tkn)}` },
      { status: 500 },
    );
  }
}
