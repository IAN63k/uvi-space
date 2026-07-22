"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, UserPlus, UserMinus, AlertTriangle, RotateCcw, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  enrolUsersChunk,
  unenrolUsersChunk,
  roleLabel,
  type BulkUserRow,
  type SelectedCourse,
} from "@/lib/matriculas/api";
import { chunk, dateToTimestamp, downloadCsv, friendlyEnrolError } from "@/lib/matriculas/helpers";
import type { EnrolmentMode } from "@/components/matriculas/enrolment-config-panel";
import type { MoodleConfig } from "@/lib/encrypted-local-storage";

const CHUNK_SIZE = 25;

interface BulkExecutionPanelProps {
  config: MoodleConfig | null;
  mode: EnrolmentMode;
  course: SelectedCourse;
  rows: BulkUserRow[];
  /** Fechas en formato YYYY-MM-DD (solo para matricular); vacío = sin valor */
  timestart: string;
  timeend: string;
  onReset: () => void;
}

interface BulkResult {
  userId: number;
  userName: string;
  identifier: string;
  roleId: number;
  success: boolean;
  error?: string;
}

type Phase = "idle" | "confirm" | "running" | "done";

export function BulkExecutionPanel({
  config,
  mode,
  course,
  rows,
  timestart,
  timeend,
  onReset,
}: BulkExecutionPanelProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [processed, setProcessed] = useState(0);
  const [results, setResults] = useState<BulkResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const total = rows.length;
  const isEnrol = mode === "enrol";
  const courseName = course.fullname || `Curso ${course.id}`;
  const rowById = new Map(rows.map((r) => [r.user.id, r]));

  const execute = async () => {
    if (!config) {
      setError("Configura el Token y la URL de Moodle en Ajustes antes de ejecutar.");
      setPhase("idle");
      return;
    }

    setPhase("running");
    setProcessed(0);
    setResults([]);
    setError(null);

    const batches = chunk(rows, CHUNK_SIZE);
    const accumulated: BulkResult[] = [];

    try {
      for (const batch of batches) {
        const outcomes = isEnrol
          ? await enrolUsersChunk(config, {
              courseId: course.id,
              users: batch.map((r) => ({ userId: r.user.id, roleId: r.roleId })),
              timestart: dateToTimestamp(timestart),
              timeend: dateToTimestamp(timeend),
            })
          : await unenrolUsersChunk(config, {
              courseId: course.id,
              userIds: batch.map((r) => r.user.id),
            });

        for (const outcome of outcomes) {
          const row = rowById.get(outcome.userId);
          accumulated.push({
            userId: outcome.userId,
            userName: row?.user.fullname ?? `Usuario ${outcome.userId}`,
            identifier: row?.user.idnumber || row?.user.username || "",
            roleId: row?.roleId ?? 0,
            success: outcome.success,
            error: outcome.success ? undefined : friendlyEnrolError(outcome.error, courseName),
          });
        }
        setProcessed((p) => p + batch.length);
        setResults([...accumulated]);
      }
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado durante la ejecución");
      setPhase("done");
    }
  };

  const reset = () => {
    setPhase("idle");
    setProcessed(0);
    setResults([]);
    setError(null);
    onReset();
  };

  const exportCsv = () => {
    const header = ["Usuario", "Identificador", "ID Moodle", "Rol", "Estado", "Detalle"];
    const body = results.map((r) => [
      r.userName,
      r.identifier,
      r.userId,
      isEnrol ? roleLabel(r.roleId) : "",
      r.success ? "Exitoso" : "Error",
      r.error ?? "",
    ]);
    const action = isEnrol ? "matricula" : "desmatricula";
    downloadCsv(`${action}-curso-${course.id}.csv`, [header, ...body]);
  };

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  const progressPct = total > 0 ? Math.round((processed / total) * 100) : 0;

  // ── Estado terminado: resultados ──
  if (phase === "done") {
    return (
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" /> {successCount} exitoso{successCount !== 1 ? "s" : ""}
          </span>
          {failCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 font-semibold text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
              <XCircle className="h-3.5 w-3.5" /> {failCount} con error
            </span>
          )}
          {results.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar CSV
            </Button>
          )}
        </div>

        <div className="max-h-[28rem] overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Usuario</th>
                {isEnrol && <th className="px-3 py-2 text-left font-semibold">Rol</th>}
                <th className="px-3 py-2 text-left font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.map((r) => (
                <tr key={r.userId} className="align-top">
                  <td className="px-3 py-2">
                    <span className="block truncate" title={r.userName}>{r.userName}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {r.identifier ? `${r.identifier} · ` : ""}ID {r.userId}
                    </span>
                  </td>
                  {isEnrol && (
                    <td className="px-3 py-2 text-xs text-muted-foreground">{roleLabel(r.roleId)}</td>
                  )}
                  <td className="px-3 py-2">
                    {r.success ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Exitoso
                      </span>
                    ) : (
                      <span className="inline-flex items-start gap-1 text-rose-700 dark:text-rose-400">
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{r.error}</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button type="button" variant="outline" onClick={reset}>
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Nueva operación
        </Button>
      </div>
    );
  }

  // ── Estado en ejecución: barra de progreso ──
  if (phase === "running") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Procesando {Math.min(processed + 1, total)} de {total} usuarios…
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
      </div>
    );
  }

  // ── Estado inicial / confirmación ──
  return (
    <div className="space-y-3">
      <Button type="button" onClick={() => setPhase("confirm")} variant={isEnrol ? "default" : "destructive"}>
        {isEnrol ? <UserPlus className="mr-1.5 h-4 w-4" /> : <UserMinus className="mr-1.5 h-4 w-4" />}
        {isEnrol
          ? `Matricular ${total} usuario${total !== 1 ? "s" : ""}`
          : `Desmatricular ${total} usuario${total !== 1 ? "s" : ""}`}
      </Button>

      {phase === "confirm" && (
        <ConfirmModal
          mode={mode}
          courseName={courseName}
          rows={rows}
          onCancel={() => setPhase("idle")}
          onConfirm={() => void execute()}
        />
      )}
    </div>
  );
}

function ConfirmModal({
  mode,
  courseName,
  rows,
  onCancel,
  onConfirm,
}: {
  mode: EnrolmentMode;
  courseName: string;
  rows: BulkUserRow[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isEnrol = mode === "enrol";
  const alreadyEnrolled = rows.filter((r) => r.alreadyEnrolled).length;

  const byRole = new Map<number, number>();
  for (const row of rows) byRole.set(row.roleId, (byRole.get(row.roleId) ?? 0) + 1);

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed left-1/2 top-1/2 z-[70] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border bg-background shadow-2xl">
        <div className="flex items-center gap-2.5 border-b bg-muted/30 px-5 py-4">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isEnrol ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
            {isEnrol ? <UserPlus className="h-4 w-4" /> : <UserMinus className="h-4 w-4" />}
          </div>
          <h2 className="text-sm font-semibold">Confirmar {isEnrol ? "matrícula" : "desmatrícula"}</h2>
        </div>

        <div className="space-y-3 px-5 py-5 text-sm">
          <p>
            ¿Confirmas {isEnrol ? "matricular" : "desmatricular"}{" "}
            <span className="font-semibold">{rows.length}</span> usuario{rows.length !== 1 ? "s" : ""}{" "}
            {isEnrol ? "en" : "de"} <span className="font-semibold">{courseName}</span>?
          </p>

          {isEnrol && (
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {Array.from(byRole.entries()).map(([roleId, count]) => (
                <li key={roleId}>
                  {count} × {roleLabel(roleId)}
                </li>
              ))}
            </ul>
          )}

          {isEnrol && alreadyEnrolled > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {alreadyEnrolled} ya {alreadyEnrolled !== 1 ? "están matriculados" : "está matriculado"} en el curso.
                Moodle <strong>añade</strong> el rol indicado, no reemplaza el que ya tienen.
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t bg-muted/20 px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
          <Button type="button" size="sm" variant={isEnrol ? "default" : "destructive"} onClick={onConfirm}>
            Confirmar
          </Button>
        </div>
      </div>
    </>
  );
}
