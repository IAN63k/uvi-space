import { NextResponse } from "next/server";

import { getUsersByFieldMany, normalizeUserKey } from "@/lib/moodle/moodle.service";
import type { BulkUserField, UserResolution } from "@/lib/moodle/types";

type RequestBody = {
  moodleUrl: string;
  token: string;
  field: BulkUserField;
  /** Identificadores tal como los ingresó el usuario (pegados o desde CSV) */
  values: string[];
};

const VALID_FIELDS: BulkUserField[] = ["idnumber", "username", "email"];

/** Tope de identificadores por solicitud, para acotar el trabajo del servidor */
const MAX_VALUES = 1000;

export async function POST(request: Request) {
  let body: Partial<RequestBody>;

  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch {
    return NextResponse.json({ message: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { moodleUrl, token, field, values } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  if (!field || !VALID_FIELDS.includes(field)) {
    return NextResponse.json(
      { message: "Campo de búsqueda inválido. Usa documento, username o email." },
      { status: 400 },
    );
  }

  if (!Array.isArray(values) || values.length === 0) {
    return NextResponse.json({ message: "No se recibieron identificadores" }, { status: 400 });
  }

  // Se eliminan vacíos y duplicados conservando el orden y el texto original,
  // para que la tabla de resultados se lea igual que la lista ingresada.
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value) continue;
    const key = normalizeUserKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
  }

  if (unique.length === 0) {
    return NextResponse.json({ message: "No se recibieron identificadores válidos" }, { status: 400 });
  }

  if (unique.length > MAX_VALUES) {
    return NextResponse.json(
      { message: `Demasiados identificadores (${unique.length}). El máximo por lote es ${MAX_VALUES}.` },
      { status: 400 },
    );
  }

  try {
    const { byKey, unindexed } = await getUsersByFieldMany(
      moodleUrl.trim(),
      token.trim(),
      field,
      unique,
    );

    const resolutions: UserResolution[] = unique.map((value) => {
      const matches = byKey.get(normalizeUserKey(value)) ?? [];

      if (matches.length === 0) return { value, found: false };
      if (matches.length === 1) return { value, found: true, user: matches[0] };
      // Más de una coincidencia (p. ej. documentos duplicados en Moodle):
      // se devuelven todas para que la interfaz pida desambiguar.
      return { value, found: true, ambiguous: true, matches };
    });

    // Si Moodle devolvió usuarios sin el campo consultado, no se pueden
    // emparejar y aparecerían como "no encontrados" sin explicación.
    const warning =
      unindexed > 0
        ? `Moodle devolvió ${unindexed} usuario(s) sin el campo "${field}". Es probable que el token no tenga permiso para verlo; prueba a buscar por email o username.`
        : undefined;

    return NextResponse.json({ resolutions, warning });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error inesperado al consultar los usuarios";
    return NextResponse.json({ message }, { status: 500 });
  }
}
