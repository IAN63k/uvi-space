"use client";

import { useState } from "react";
import { FolderTree, Keyboard, X, BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CategoryTreeSelector } from "@/components/matriculas/category-tree-selector";
import { ManualCourseInput } from "@/components/matriculas/manual-course-input";
import type { SelectedCourse } from "@/lib/matriculas/api";
import type { MoodleConfig } from "@/lib/encrypted-local-storage";

type SelectionMode = "tree" | "manual";

interface CourseSelectionPanelProps {
  config: MoodleConfig | null;
  selectedCourses: SelectedCourse[];
  selectedIds: Set<number>;
  onToggle: (course: SelectedCourse, checked: boolean) => void;
  onToggleMany: (courses: SelectedCourse[], checked: boolean) => void;
  onClearAll: () => void;
}

export function CourseSelectionPanel({
  config,
  selectedCourses,
  selectedIds,
  onToggle,
  onToggleMany,
  onClearAll,
}: CourseSelectionPanelProps) {
  const [mode, setMode] = useState<SelectionMode>("tree");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Selección */}
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
            selectedIds={selectedIds}
            onToggle={onToggle}
            onToggleMany={onToggleMany}
          />
        ) : (
          <ManualCourseInput
            config={config}
            selectedIds={selectedIds}
            onToggle={onToggle}
            onToggleMany={onToggleMany}
          />
        )}
      </div>

      {/* Cursos seleccionados */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            Cursos seleccionados
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {selectedCourses.length}
            </span>
          </h3>
          {selectedCourses.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={onClearAll}>
              Limpiar
            </Button>
          )}
        </div>

        <div className="max-h-[22rem] space-y-1 overflow-y-auto rounded-lg border bg-muted/10 p-2">
          {selectedCourses.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Aún no has seleccionado cursos.
            </p>
          ) : (
            selectedCourses.map((course) => (
              <div
                key={course.id}
                className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm"
              >
                <span className="flex-1 truncate" title={course.fullname}>{course.fullname || `Curso ${course.id}`}</span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{course.shortname || course.id}</span>
                <button
                  type="button"
                  onClick={() => onToggle(course, false)}
                  aria-label="Quitar curso"
                  className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
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
