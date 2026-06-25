"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, UserPlus, UserMinus, AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { enrolChunk, unenrolChunk, type SelectedCourse, type CourseOutcome } from "@/lib/matriculas/api";
import type { EnrolmentMode } from "@/components/matriculas/enrolment-config-panel";
import type { MoodleConfig } from "@/lib/encrypted-local-storage";
import type { EnrolmentResult } from "@/lib/moodle/types";

const CHUNK_SIZE = 10;

interface ExecutionPanelProps {
  config: MoodleConfig | null;
  mode: EnrolmentMode;
  userId: number;
  userName: string;
  selectedCourses: SelectedCourse[];
  roleId: number;
  /** Fechas en formato YYYY-MM-DD (solo para matricular); vacío = sin valor */
  timestart: string;
  timeend: string;
  onReset: () => void;
}

type Phase = "idle" | "confirm" | "running" | "done";

/** Convierte YYYY-MM-DD a timestamp unix (mediodía local) o undefined si vacío */
function dateToTimestamp(value: string): number | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return Math.floor(new Date(y, m - 1, d, 12, 0, 0).getTime() / 1000);
}

/** Divide un arreglo en lotes de tamaño fijo */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Mensaje de error amigable cuando la matrícula manual no está habilitada */
function friendlyError(raw: string | undefined, courseName: string): string {
  if (raw && /manual|enrol(ment)? (is )?not enabled|plugin/i.test(raw)) {
    return `El curso "${courseName}" no tiene matrícula manual habilitada`;
  }
  return raw ?? "Error desconocido";
}

export function ExecutionPanel({
  config,
  mode,
  userId,
  userName,
  selectedCourses,
  roleId,
  timestart,
  timeend,
  onReset,
}: ExecutionPanelProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [processed, setProcessed] = useState(0);
  const [results, setResults] = useState<EnrolmentResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const total = selectedCourses.length;
  const isEnrol = mode === "enrol";
  const nameById = new Map(selectedCourses.map((c) => [c.id, c.fullname || `Curso ${c.id}`]));

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

    const courseIds = selectedCourses.map((c) => c.id);
    const batches = chunk(courseIds, CHUNK_SIZE);
    const accumulated: EnrolmentResult[] = [];

    try {
      for (const batch of batches) {
        const outcomes: CourseOutcome[] = isEnrol
          ? await enrolChunk(config, {
              userId,
              courseIds: batch,
              roleId,
              timestart: dateToTimestamp(timestart),
              timeend: dateToTimestamp(timeend),
            })
          : await unenrolChunk(config, { userId, courseIds: batch });

        for (const o of outcomes) {
          const courseName = nameById.get(o.courseId) ?? `Curso ${o.courseId}`;
          accumulated.push({
            courseId: o.courseId,
            courseName,
            success: o.success,
            error: o.success ? undefined : friendlyError(o.error, courseName),
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
        </div>

        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Curso</th>
                <th className="px-3 py-2 text-left font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.map((r) => (
                <tr key={r.courseId} className="align-top">
                  <td className="px-3 py-2">
                    <span className="block truncate" title={r.courseName}>{r.courseName}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">ID {r.courseId}</span>
                  </td>
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
          Nueva matrícula
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
          Procesando {Math.min(processed + 1, total)} de {total} cursos…
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
        {isEnrol ? `Matricular en ${total} curso${total !== 1 ? "s" : ""}` : `Desmatricular de ${total} curso${total !== 1 ? "s" : ""}`}
      </Button>

      {phase === "confirm" && (
        <ConfirmModal
          mode={mode}
          userName={userName}
          total={total}
          onCancel={() => setPhase("idle")}
          onConfirm={() => void execute()}
        />
      )}
    </div>
  );
}

function ConfirmModal({
  mode,
  userName,
  total,
  onCancel,
  onConfirm,
}: {
  mode: EnrolmentMode;
  userName: string;
  total: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isEnrol = mode === "enrol";
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
        <div className="px-5 py-5 text-sm">
          ¿Confirmas {isEnrol ? "matricular" : "desmatricular"} a{" "}
          <span className="font-semibold">{userName}</span> en{" "}
          <span className="font-semibold">{total}</span> curso{total !== 1 ? "s" : ""}?
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
