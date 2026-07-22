"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronRight, ChevronDown, Folder, BookOpen, Loader2 } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  fetchCategories,
  fetchCategoryCourses,
  type CategoryItem,
  type SelectedCourse,
} from "@/lib/matriculas/api";
import type { MoodleConfig } from "@/lib/encrypted-local-storage";

/** "multi" = casillas y "seleccionar todos"; "single" = radios, un solo curso */
export type TreeSelectionMode = "multi" | "single";

interface CategoryTreeSelectorProps {
  config: MoodleConfig | null;
  selectedIds: Set<number>;
  onToggle: (course: SelectedCourse, checked: boolean) => void;
  onToggleMany: (courses: SelectedCourse[], checked: boolean) => void;
  selection?: TreeSelectionMode;
}

export function CategoryTreeSelector({ config, selectedIds, onToggle, onToggleMany, selection = "multi" }: CategoryTreeSelectorProps) {
  const [roots, setRoots] = useState<CategoryItem[]>([]);
  const [rootId, setRootId] = useState<string>("");
  const [loadingRoots, setLoadingRoots] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;
    setLoadingRoots(true);
    setError(null);
    fetchCategories(config, 0)
      .then(setRoots)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Error al cargar categorías"))
      .finally(() => setLoadingRoots(false));
  }, [config]);

  const selectedRoot = roots.find((r) => String(r.id) === rootId) ?? null;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="root-category" className="text-xs text-muted-foreground">Categoría raíz</Label>
        <div className="flex items-center gap-2">
          <select
            id="root-category"
            value={rootId}
            onChange={(e) => setRootId(e.target.value)}
            disabled={loadingRoots || roots.length === 0}
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="">{loadingRoots ? "Cargando…" : "Selecciona una categoría"}</option>
            {roots.map((r) => (
              <option key={r.id} value={r.id}>{r.name} ({r.coursecount})</option>
            ))}
          </select>
          {loadingRoots && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </div>
      )}

      {config && selectedRoot && (
        <div className="rounded-lg border bg-muted/10 p-2">
          <TreeNode
            config={config}
            category={selectedRoot}
            depth={0}
            defaultExpanded
            selectedIds={selectedIds}
            onToggle={onToggle}
            onToggleMany={onToggleMany}
            selection={selection}
          />
        </div>
      )}
    </div>
  );
}

interface TreeNodeProps {
  config: MoodleConfig;
  category: CategoryItem;
  depth: number;
  defaultExpanded?: boolean;
  selectedIds: Set<number>;
  onToggle: (course: SelectedCourse, checked: boolean) => void;
  onToggleMany: (courses: SelectedCourse[], checked: boolean) => void;
  selection: TreeSelectionMode;
}

/** Agrupa los radios de todo el árbol cuando la selección es única */
const SINGLE_SELECT_GROUP = "matriculas-curso-destino";

function TreeNode({ config, category, depth, defaultExpanded, selectedIds, onToggle, onToggleMany, selection }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(!!defaultExpanded);
  const [subcategories, setSubcategories] = useState<CategoryItem[] | null>(null);
  const [courses, setCourses] = useState<SelectedCourse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const subs = await fetchCategories(config, category.id);
      setSubcategories(subs);
      // Categoría hoja (sin subcategorías): cargar sus cursos
      if (subs.length === 0) {
        const leafCourses = await fetchCategoryCourses(config, category.id);
        setCourses(leafCourses);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar la categoría");
    } finally {
      setLoading(false);
    }
  }, [config, category.id]);

  // Carga perezosa: solo al expandir por primera vez
  useEffect(() => {
    if (expanded && subcategories === null && !loading) void load();
  }, [expanded, subcategories, loading, load]);

  const selectableCourses = courses ?? [];
  const isSingle = selection === "single";
  const allSelected = selectableCourses.length > 0 && selectableCourses.every((c) => selectedIds.has(c.id));

  return (
    <div className={depth > 0 ? "ml-3 border-l border-border/50 pl-2" : ""}>
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 text-left text-sm font-medium transition-colors hover:bg-accent"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span className="flex-1 truncate">{category.name}</span>
        {category.coursecount > 0 && (
          <span className="shrink-0 text-[11px] text-muted-foreground">{category.coursecount} cursos</span>
        )}
        {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="mt-0.5 space-y-0.5">
          {error && (
            <p className="px-2 py-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>
          )}

          {/* Subcategorías */}
          {subcategories?.map((sub) => (
            <TreeNode
              key={sub.id}
              config={config}
              category={sub}
              depth={depth + 1}
              selectedIds={selectedIds}
              onToggle={onToggle}
              onToggleMany={onToggleMany}
              selection={selection}
            />
          ))}

          {/* Cursos de categoría hoja */}
          {subcategories?.length === 0 && (
            <div className="ml-3 space-y-0.5 border-l border-border/50 pl-2">
              {selectableCourses.length === 0 ? (
                !loading && <p className="px-2 py-1 text-xs text-muted-foreground">Sin cursos en esta categoría.</p>
              ) : (
                <>
                  {!isSingle && (
                    <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => onToggleMany(selectableCourses, e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-input accent-primary"
                      />
                      Seleccionar todos ({selectableCourses.length})
                    </label>
                  )}
                  {selectableCourses.map((course) => (
                    <label
                      key={course.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
                    >
                      <input
                        type={isSingle ? "radio" : "checkbox"}
                        name={isSingle ? SINGLE_SELECT_GROUP : undefined}
                        checked={selectedIds.has(course.id)}
                        onChange={(e) => onToggle(course, e.target.checked)}
                        className={`h-3.5 w-3.5 border-input accent-primary ${isSingle ? "" : "rounded"}`}
                      />
                      <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate" title={course.fullname}>{course.fullname}</span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{course.shortname} · {course.id}</span>
                    </label>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
