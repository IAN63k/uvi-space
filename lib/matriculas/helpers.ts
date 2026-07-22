/** Convierte YYYY-MM-DD a timestamp unix (mediodía local) o undefined si está vacío */
export function dateToTimestamp(value: string): number | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return Math.floor(new Date(y, m - 1, d, 12, 0, 0).getTime() / 1000);
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
