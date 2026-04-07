import { NextResponse } from "next/server";
import type { ValidationRules } from "@/lib/moodle/types";
import { runRevision } from "@/lib/moodle/moodle.service";

type RequestBody = {
  moodleUrl: string;
  token: string;
  categoryId?: number;
  rules: ValidationRules;
};

export async function POST(request: Request) {
  let body: Partial<RequestBody>;

  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch {
    return NextResponse.json({ message: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { moodleUrl, token, categoryId, rules } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  if (!rules || typeof rules !== "object") {
    return NextResponse.json({ message: "Faltan las reglas de validación" }, { status: 400 });
  }

  try {
    const { results, categoryTree, errorsByField } = await runRevision(
      moodleUrl.trim(),
      token.trim(),
      rules,
      categoryId ? Number(categoryId) : undefined,
    );

    const ok = results.filter((r) => r.status === "OK").length;
    const fallos = results.filter((r) => r.status === "FAIL").length;

    return NextResponse.json({
      total: results.length,
      ok,
      fallos,
      errorsByField,
      results,
      categoryTree,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado al consultar la API de Moodle";
    return NextResponse.json({ message }, { status: 500 });
  }
}
