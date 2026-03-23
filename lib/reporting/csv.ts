export function escapeCsvValue(value: string | number | null | undefined) {
  const raw = String(value ?? "");
  const escaped = raw.replaceAll('"', '""');
  return `"${escaped}"`;
}

export function buildCsv(headerLabels: string[], rows: Array<Array<string | number | null | undefined>>) {
  const header = headerLabels.map((label) => escapeCsvValue(label)).join(",");
  const body = rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(","));
  return [header, ...body].join("\n");
}

export function downloadCsvFile(fileName: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
