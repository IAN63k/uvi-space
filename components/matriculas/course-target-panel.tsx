"use client";

import { useState } from "react";
import { FolderTree, Keyboard, Loader2, ListChecks, BookOpen, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryTreeSelector } from "@/components/matriculas/category-tree-selector";
import { verifyCourses, type SelectedCourse } from "@/lib/matriculas/api";
import type { MoodleConfig } from "@/lib/encrypted-local-storage";

type SelectionMode = "tree" | "manual";

interface CourseTargetPanelProps {
  config: MoodleConfig | null;
  course: SelectedCourse | null;
  onChange: (course: SelectedCourse | null) => void;
}

/** Selección de UN curso destino: por árbol de categorías o por ID. */
export function CourseTargetPanel({ config, course, onChange }: CourseTargetPanelProps) {
  const [mode, setMode] = useState<SelectionMode>("tree");

  const selectedIds = new Set(course ? [course.id] : []);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
          <ModeButton active={mode === "tree"} onClick={() => setMode("tree")} icon={<FolderTree className="h-3.5 w-3.5" />}>
            Árbol de categorías
          </ModeButton>
          <ModeButton active={mode === "manual"} onClick={() => setMode("manual")} icon={<Keyboard className="h-3.5 w-3.5" />}>
            Ingreso por ID
          </ModeButton>
        </div>

        {mode === "tree" ? (
          <CategoryTreeSelector
            config={config}
            selection="single"
            selectedIds={selectedIds}
            onToggle={(c, checked) => onChange(checked ? c : null)}
            onToggleMany={() => {}}
          />
        ) : (
          <ManualCourseId config={config} onChange={onChange} />
        )}
      </div>

      <div className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          Curso destino
        </h3>

        {course ? (
          <div className="relative rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 pr-9 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/15">
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label="Quitar curso destino"
              className="absolute right-2 top-2 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="font-medium leading-snug">{course.fullname || `Curso ${course.id}`}</p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {course.shortname ? `${course.shortname} · ` : ""}ID {course.id}
            </p>
          </div>
        ) : (
          <p className="rounded-lg border bg-muted/10 px-2 py-6 text-center text-sm text-muted-foreground">
            Aún no has elegido el curso destino.
          </p>
        )}
      </div>
    </div>
  );
}

function ManualCourseId({
  config,
  onChange,
}: {
  config: MoodleConfig | null;
  onChange: (course: SelectedCourse | null) => void;
}) {
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!config) {
      setError("Configura el Token y la URL de Moodle en Ajustes antes de verificar.");
      return;
    }
    const id = Number(raw.trim());
    if (!Number.isInteger(id) || id <= 0) {
      setError("Ingresa un ID de curso válido.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [result] = await verifyCourses(config, [id]);
      if (!result?.found) {
        setError(`El curso ${id} no existe o no es accesible con este token.`);
        onChange(null);
        return;
      }
      onChange({ id, fullname: result.fullname ?? "", shortname: result.shortname ?? "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado al verificar el curso");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleVerify();
      }}
      className="space-y-3"
    >
      <div className="space-y-1">
        <Label htmlFor="target-course-id" className="text-xs text-muted-foreground">
          ID del curso
        </Label>
        <Input
          id="target-course-id"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Ej: 31961"
          inputMode="numeric"
          className="font-mono"
        />
      </div>

      <Button type="submit" disabled={loading || !raw.trim()}>
        {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ListChecks className="mr-1.5 h-4 w-4" />}
        {loading ? "Verificando…" : "Verificar curso"}
      </Button>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </div>
      )}
    </form>
  );
}

function ModeButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
