/** Convierte YYYY-MM-DD a timestamp unix, o undefined si está vacío.
 *
 *  El extremo importa: Moodle marca la matrícula como "No activo" fuera de la
 *  ventana [timestart, timeend]. Por eso el inicio va al primer segundo del día
 *  y el fin al último, de modo que ambas fechas queden incluidas completas. */
export function dateToTimestamp(value: string, boundary: "start" | "end"): number | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const date =
    boundary === "start"
      ? new Date(y, m - 1, d, 0, 0, 0)
      : new Date(y, m - 1, d, 23, 59, 59);
  return Math.floor(date.getTime() / 1000);
}

/** Advertencia sobre las fechas elegidas, o null si no hay nada que advertir.
 *  Evita la sorpresa de matricular y encontrar a todos como "No activo". */
export function enrolmentDateWarning(timestart: string, timeend: string): string | null {
  const start = dateToTimestamp(timestart, "start");
  const end = dateToTimestamp(timeend, "end");
  const now = Math.floor(Date.now() / 1000);

  if (start && end && end < start) {
    return "La fecha de fin es anterior a la de inicio.";
  }
  if (end && end < now) {
    return "La fecha de fin ya pasó: los usuarios quedarán como «No activo» en Moodle de inmediato.";
  }
  if (start && start > now) {
    const formatted = new Date(start * 1000).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return `Los usuarios quedarán como «No activo» en Moodle hasta el ${formatted}. Deja la fecha vacía si quieres que la matrícula sea efectiva de inmediato.`;
  }
  return null;
}

/** Divide un arreglo en lotes de tamaño fijo */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Mensaje amigable cuando la matrícula manual no está habilitada en el curso */
export function friendlyEnrolError(raw: string | undefined, courseName: string): string {
  if (raw && /manual|enrol(ment)? (is )?not enabled|plugin/i.test(raw)) {
    return `El curso "${courseName}" no tiene matrícula manual habilitada`;
  }
  return raw ?? "Error desconocido";
}

/** Descarga un CSV en el navegador. El BOM hace que Excel respete los acentos. */
export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const content = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  const blob = new Blob([`﻿${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
