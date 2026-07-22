"use client";

import { useRef, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Users, Upload, Copy, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { resolveUsers, toBulkUser, type BulkUser } from "@/lib/matriculas/api";
import type { MoodleConfig } from "@/lib/encrypted-local-storage";
import type { BulkUserField, UserResolution } from "@/lib/moodle/types";

const FIELDS: { value: BulkUserField; label: string }[] = [
  { value: "idnumber", label: "Número de documento" },
  { value: "username", label: "Username" },
  { value: "email", label: "Email" },
];

interface BulkUserInputProps {
  config: MoodleConfig | null;
  onAdd: (users: BulkUser[]) => void;
}

/** Datos del archivo cargado, a la espera de que se elija la columna */
interface CsvPreview {
  name: string;
  rows: string[][];
  columns: number;
}

/** Separa la lista pegada en identificadores, sin duplicados y respetando el orden. */
function parseIdentifiers(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/[,;\n\r\t]+/)) {
    const value = part.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/** Elige el separador más probable contando ocurrencias en la primera fila. */
function pickDelimiter(line: string): string {
  let best = ",";
  let bestCount = 0;
  for (const candidate of [";", ",", "\t", "|"]) {
    const count = line.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/** Parseo simple de CSV/TXT: suficiente para listas de identificadores.
 *  No interpreta comas dentro de comillas, sólo las quita de los extremos. */
function parseDelimited(text: string): string[][] {
  // ﻿ = BOM que Excel antepone al guardar como CSV UTF-8
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];
  const delimiter = pickDelimiter(lines[0]);
  return lines.map((line) =>
    line.split(delimiter).map((cell) => cell.trim().replace(/^"(.*)"$/, "$1").trim()),
  );
}

export function BulkUserInput({ config, onAdd }: BulkUserInputProps) {
  const [field, setField] = useState<BulkUserField>("idnumber");
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<UserResolution[] | null>(null);
  const [chosen, setChosen] = useState<Record<string, number>>({});

  const [csv, setCsv] = useState<CsvPreview | null>(null);
  const [csvColumn, setCsvColumn] = useState(0);
  const [csvSkipFirst, setCsvSkipFirst] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onerror = () => setError("No se pudo leer el archivo.");
    reader.onload = () => {
      const rows = parseDelimited(String(reader.result ?? ""));
      if (rows.length === 0) {
        setError("El archivo está vacío.");
        setCsv(null);
        return;
      }
      const columns = Math.max(...rows.map((r) => r.length));
      setCsv({ name: file.name, rows, columns });
      setCsvColumn(0);
      // Si el primer valor no parece un identificador suelto, suele ser encabezado
      setCsvSkipFirst(/^[a-záéíóúñ\s]+$/i.test(rows[0]?.[0] ?? "") && rows.length > 1);
    };
    reader.readAsText(file, "utf-8");
  };

  const applyCsvColumn = () => {
    if (!csv) return;
    const rows = csvSkipFirst ? csv.rows.slice(1) : csv.rows;
    const values = rows.map((r) => r[csvColumn] ?? "").filter(Boolean);
    if (values.length === 0) {
      setError("Esa columna no tiene valores.");
      return;
    }
    setRaw(values.join(", "));
    setCsv(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleResolve = async () => {
    if (!config) {
      setError("Configura el Token y la URL de Moodle en Ajustes antes de buscar.");
      return;
    }
    const values = parseIdentifiers(raw);
    if (values.length === 0) {
      setError("Ingresa al menos un identificador.");
      return;
    }

    setLoading(true);
    setError(null);
    setWarning(null);
    setChosen({});
    try {
      const { resolutions: res, warning: apiWarning } = await resolveUsers(config, field, values);
      setResolutions(res);
      setWarning(apiWarning ?? null);
      // Las coincidencias únicas se añaden solas; las ambiguas requieren elegir.
      const direct = res
        .flatMap((r) => (r.found && !r.ambiguous && r.user ? [r.user] : []))
        .map(toBulkUser);
      if (direct.length > 0) onAdd(direct);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado al buscar los usuarios");
    } finally {
      setLoading(false);
    }
  };

  const notFound = resolutions?.filter((r) => !r.found) ?? [];
  const ambiguous = resolutions?.filter((r) => r.ambiguous) ?? [];
  const resolved = resolutions?.filter((r) => r.found && !r.ambiguous) ?? [];

  const addChosen = () => {
    const users = ambiguous
      .map((r) => r.matches?.find((m) => m.id === chosen[r.value]))
      .filter((u): u is NonNullable<typeof u> => !!u)
      .map(toBulkUser);
    if (users.length > 0) onAdd(users);
  };

  const copyNotFound = () => {
    void navigator.clipboard.writeText(notFound.map((r) => r.value).join(", "));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="bulk-field" className="text-xs text-muted-foreground">Buscar por</Label>
        <select
          id="bulk-field"
          value={field}
          onChange={(e) => setField(e.target.value as BulkUserField)}
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {FIELDS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="bulk-values" className="text-xs text-muted-foreground">
          Lista (separada por comas o saltos de línea)
        </Label>
        <textarea
          id="bulk-values"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={4}
          placeholder="Ej: 1094123456, 1094123457, 1094123458"
          className="w-full rounded-lg border border-input bg-background px-2.5 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => void handleResolve()} disabled={loading || !raw.trim()}>
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Users className="mr-1.5 h-4 w-4" />}
          {loading ? "Buscando…" : "Buscar y añadir"}
        </Button>

        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" />
          Cargar CSV
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {csv && (
        <div className="space-y-2 rounded-lg border bg-muted/10 px-3 py-3 text-sm">
          <p className="font-medium">
            {csv.name}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {csv.rows.length} fila{csv.rows.length !== 1 ? "s" : ""} · {csv.columns} columna{csv.columns !== 1 ? "s" : ""}
            </span>
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="csv-column" className="text-xs text-muted-foreground">Columna con el identificador</Label>
              <select
                id="csv-column"
                value={csvColumn}
                onChange={(e) => setCsvColumn(Number(e.target.value))}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Array.from({ length: csv.columns }, (_, i) => (
                  <option key={i} value={i}>
                    Columna {i + 1} — {csv.rows[0]?.[i] || "(vacía)"}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex h-8 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={csvSkipFirst}
                onChange={(e) => setCsvSkipFirst(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-input accent-primary"
              />
              La primera fila es encabezado
            </label>

            <Button type="button" size="sm" onClick={applyCsvColumn}>Usar esta columna</Button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </div>
      )}

      {warning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {warning}
        </div>
      )}

      {resolutions && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3" /> {resolved.length} encontrado{resolved.length !== 1 ? "s" : ""}
            </span>
            {ambiguous.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3" /> {ambiguous.length} ambiguo{ambiguous.length !== 1 ? "s" : ""}
              </span>
            )}
            {notFound.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 font-semibold text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                <XCircle className="h-3 w-3" /> {notFound.length} sin coincidencia
              </span>
            )}
          </div>

          {ambiguous.length > 0 && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-3 dark:border-amber-800/40 dark:bg-amber-950/15">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Estos valores coinciden con más de un usuario. Elige cuál corresponde:
              </p>
              {ambiguous.map((r) => (
                <div key={r.value} className="space-y-1">
                  <p className="font-mono text-xs">{r.value}</p>
                  {r.matches?.map((m) => (
                    <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent">
                      <input
                        type="radio"
                        name={`ambiguous-${r.value}`}
                        checked={chosen[r.value] === m.id}
                        onChange={() => setChosen((prev) => ({ ...prev, [r.value]: m.id }))}
                        className="h-3.5 w-3.5 border-input accent-primary"
                      />
                      <span className="flex-1 truncate">{m.fullname}</span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{m.email} · {m.id}</span>
                    </label>
                  ))}
                </div>
              ))}
              <Button type="button" size="sm" onClick={addChosen} disabled={Object.keys(chosen).length === 0}>
                Añadir seleccionados
              </Button>
            </div>
          )}

          {notFound.length > 0 && (
            <div className="space-y-1.5 rounded-lg border border-rose-200 bg-rose-50/50 px-3 py-2 dark:border-rose-900/40 dark:bg-rose-950/15">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-rose-700 dark:text-rose-400">Sin coincidencia en Moodle</p>
                <Button type="button" variant="ghost" size="sm" onClick={copyNotFound}>
                  <Copy className="mr-1 h-3 w-3" /> Copiar
                </Button>
              </div>
              <p className="break-words font-mono text-xs text-rose-700 dark:text-rose-400">
                {notFound.map((r) => r.value).join(", ")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
