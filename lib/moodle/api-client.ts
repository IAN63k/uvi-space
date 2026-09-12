import type { MoodleConfig } from "@/lib/encrypted-local-storage";

/** Llama a una API Route propia adjuntando la conexión de Moodle en el cuerpo.
 *
 *  El token viaja siempre en el body del POST: nunca en la URL ni en cabeceras,
 *  para que no quede en logs de servidor ni en el historial del navegador. */
export async function postMoodleJson<T>(
  url: string,
  config: MoodleConfig,
  payload: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moodleUrl: config.moodleUrl, token: config.token, ...payload }),
  });

  let data: (T & { message?: string }) | null = null;
  try {
    data = (await res.json()) as T & { message?: string };
  } catch {
    throw new Error(`La API respondió ${res.status} sin un cuerpo JSON válido`);
  }

  if (!res.ok) {
    throw new Error(data?.message ?? "Error inesperado al contactar la API");
  }
  return data;
}
