"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { verifyCourses, type SelectedCourse } from "@/lib/matriculas/api";
import type { MoodleConfig } from "@/lib/encrypted-local-storage";
import type { CourseVerificationResult } from "@/lib/moodle/types";

interface ManualCourseInputProps {
  config: MoodleConfig | null;
  selectedIds: Set<number>;
  onToggle: (course: SelectedCourse, checked: boolean) => void;
  onToggleMany: (courses: SelectedCourse[], checked: boolean) => void;
}

function parseIds(raw: string): number[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
}

export function ManualCourseInput({ config, selectedIds, onToggle, onToggleMany }: ManualCourseInputProps) {
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CourseVerificationResult[] | null>(null);

  const handleVerify = async () => {
    if (!config) {
      setError("Configura el Token y la URL de Moodle en Ajustes antes de verificar.");
      return;
    }
    const ids = parseIds(raw);
    if (ids.length === 0) {
      setError("Ingresa al menos un ID de curso válido.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await verifyCourses(config, ids);
      setResults(res);
      // Añadir automáticamente a la selección solo los cursos encontrados
      const foundCourses: SelectedCourse[] = res
        .filter((r) => r.found)
        .map((r) => ({ id: r.courseId, fullname: r.fullname ?? "", shortname: r.shortname ?? "" }));
      if (foundCourses.length > 0) onToggleMany(foundCourses, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado al verificar los cursos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="manual-ids" className="text-xs text-muted-foreground">
          IDs de cursos (separados por comas)
        </Label>
        <textarea
          id="manual-ids"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={3}
          placeholder="Ej: 31961, 31962, 31963"
          className="w-full rounded-lg border border-input bg-background px-2.5 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <Button type="button" onClick={() => void handleVerify()} disabled={loading || !raw.trim()}>
        {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ListChecks className="mr-1.5 h-4 w-4" />}
        {loading ? "Verificando…" : "Verificar cursos"}
      </Button>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </div>
      )}

      {results && (
        <div className="space-y-1">
          {results.map((r) => (
            <div
              key={r.courseId}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                r.found
                  ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/15"
                  : "border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/15"
              }`}
            >
              {r.found ? (
                <>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(r.courseId)}
                    onChange={(e) =>
                      onToggle(
                        { id: r.courseId, fullname: r.fullname ?? "", shortname: r.shortname ?? "" },
                        e.target.checked,
                      )
                    }
                    className="h-3.5 w-3.5 rounded border-input accent-primary"
                  />
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="flex-1 truncate" title={r.fullname}>{r.fullname}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{r.shortname} · {r.courseId}</span>
                </>
              ) : (
                <>
                  <span className="h-3.5 w-3.5 shrink-0" />
                  <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span className="flex-1 text-rose-700 dark:text-rose-400">ID {r.courseId}: no encontrado o inválido</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
