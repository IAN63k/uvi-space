"use client";

import { useEffect, useState } from "react";
import {
  Settings2,
  Search,
  AlertTriangle,
  Loader2,
  ScanSearch,
  FolderOpen,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CourseContentValidator } from "@/components/moodle/CourseContentValidator";
import { BatchCourseValidator } from "@/components/moodle/BatchCourseValidator";
import { SettingsSidebar } from "@/components/settings-sidebar";
import { loadMoodleConfig } from "@/lib/encrypted-local-storage";
import type {
  CourseContentValidationResult,
  BatchValidationResult,
} from "@/lib/moodle/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type PageMode = "individual" | "batch";

// ── Mode Toggle ───────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: PageMode; onChange: (m: PageMode) => void }) {
  return (
    <div
      role="tablist"
      className="inline-flex items-center rounded-xl border bg-muted/20 p-1 shadow-xs"
    >
      {(
        [
          { key: "individual" as PageMode, label: "Curso individual", Icon: BookOpen },
          { key: "batch"      as PageMode, label: "Por categoría",    Icon: FolderOpen },
        ] as const
      ).map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={mode === key}
          onClick={() => onChange(key)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            mode === key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}


// ── Loading Skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton({ batch }: { batch?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        {Array.from({ length: batch ? 4 : 3 }).map((_, i) => (
          <div key={i} className="h-18 flex-1 animate-pulse rounded-2xl border bg-muted/40" />
        ))}
      </div>
      {batch ? (
        <div className="h-72 animate-pulse rounded-2xl border bg-muted/20" />
      ) : (
        <div className="h-52 animate-pulse rounded-2xl border bg-muted/20" />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RevisionCursosContenidoPage() {
  const [sidebarOpen,        setSidebarOpen]        = useState(false);
  const [moodleConfigLoaded, setMoodleConfigLoaded] = useState(false);
  const [mode,               setMode]               = useState<PageMode>("individual");

  // Individual mode state
  const [courseIdInput,     setCourseIdInput]    = useState("");
  const [loadingIndividual, setLoadingIndividual] = useState(false);
  const [errorIndividual,   setErrorIndividual]   = useState<string | null>(null);
  const [individualResult,  setIndividualResult]  = useState<CourseContentValidationResult | null>(null);

  // Batch mode state
  const [categoryIdInput,      setCategoryIdInput] = useState("");
  const [includeSubcategories, setIncludeSub]      = useState(false);
  const [loadingBatch,         setLoadingBatch]    = useState(false);
  const [errorBatch,           setErrorBatch]      = useState<string | null>(null);
  const [batchResult,          setBatchResult]     = useState<BatchValidationResult | null>(null);
  const [batchProgress,        setBatchProgress]   = useState<string | null>(null);

  // Load Moodle config on mount
  const refreshConfig = () => {
    void loadMoodleConfig().then((cfg) => setMoodleConfigLoaded(cfg !== null));
  };
  useEffect(() => { refreshConfig(); }, []);

  // ── Individual validation ──
  const handleValidateIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    const courseId = parseInt(courseIdInput.trim(), 10);
    if (!courseIdInput.trim() || isNaN(courseId) || courseId <= 0) {
      setErrorIndividual("Ingresa un ID de curso válido (número entero positivo).");
      return;
    }
    const config = await loadMoodleConfig();
    if (!config) { setErrorIndividual("Configura la URL y el token de Moodle."); return; }

    setLoadingIndividual(true);
    setErrorIndividual(null);
    setIndividualResult(null);
    try {
      const res = await fetch("/api/moodle/revision-cursos/contenido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moodleUrl: config.moodleUrl, token: config.token, courseId }),
      });
      const data = (await res.json()) as CourseContentValidationResult & { message?: string };
      if (!res.ok) { setErrorIndividual(data.message ?? "Error al validar el curso."); return; }
      setIndividualResult(data);
    } catch {
      setErrorIndividual("No se pudo conectar con el servidor.");
    } finally {
      setLoadingIndividual(false);
    }
  };

  // ── Batch validation ──
  const handleValidateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const categoryId = parseInt(categoryIdInput.trim(), 10);
    if (!categoryIdInput.trim() || isNaN(categoryId) || categoryId <= 0) {
      setErrorBatch("Ingresa un ID de categoría válido (número entero positivo).");
      return;
    }
    const config = await loadMoodleConfig();
    if (!config) { setErrorBatch("Configura la URL y el token de Moodle."); return; }

    setLoadingBatch(true);
    setErrorBatch(null);
    setBatchResult(null);
    setBatchProgress("Obteniendo cursos de la categoría…");
    try {
      const res = await fetch("/api/moodle/revision-cursos/contenido/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moodleUrl:  config.moodleUrl,
          token:      config.token,
          categoryId,
          includeSubcategories,
        }),
      });
      setBatchProgress("Validando cursos…");
      const data = (await res.json()) as BatchValidationResult & { message?: string };
      if (!res.ok) { setErrorBatch(data.message ?? "Error al validar la categoría."); return; }
      setBatchResult(data);
    } catch {
      setErrorBatch("No se pudo conectar con el servidor.");
    } finally {
      setLoadingBatch(false);
      setBatchProgress(null);
    }
  };

  const handleModeChange = (m: PageMode) => {
    setMode(m);
    setErrorIndividual(null);
    setErrorBatch(null);
  };

  return (
    <>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-8">

        {/* ── Header ── */}
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Revisión de cursos</p>
            <h1 className="text-3xl font-semibold tracking-tight">Contenido del curso</h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Verifica la estructura interna de cursos Moodle: secciones, módulo de presentación
              del profesor y cumplimiento de configuraciones requeridas. El formato del curso se
              detecta automáticamente desde la API.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium shadow-xs transition-all hover:border-primary/40 hover:bg-accent active:scale-95 ${
              moodleConfigLoaded
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                : "border-border bg-background text-foreground"
            }`}
          >
            <Settings2 className="h-3.5 w-3.5" />
            {moodleConfigLoaded ? "Configurado" : "Configurar API"}
          </button>
        </header>

        {/* ── Mode toggle ── */}
        <ModeToggle mode={mode} onChange={handleModeChange} />

        {/* ══════════════════════════════════════════════ INDIVIDUAL MODE */}
        {mode === "individual" && (
          <>
            <form onSubmit={(e) => void handleValidateIndividual(e)}>
              <div className="rounded-2xl border bg-muted/10 p-5 shadow-xs">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="min-w-50 flex-1 space-y-1.5">
                    <Label
                      htmlFor="courseId"
                      className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                    >
                      ID del curso
                    </Label>
                    <Input
                      id="courseId"
                      type="number"
                      min={1}
                      placeholder="Ej: 1234"
                      value={courseIdInput}
                      onChange={(e) => setCourseIdInput(e.target.value)}
                      className="font-mono"
                      required
                    />
                    <p className="text-[10px] text-muted-foreground/70">
                      El formato del curso se detecta automáticamente desde la API de Moodle.
                    </p>
                  </div>
                  <Button
                    type="submit"
                    disabled={loadingIndividual || !courseIdInput.trim()}
                    className="h-9 gap-2 px-5"
                  >
                    {loadingIndividual ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />Validando…</>
                    ) : (
                      <><Search className="h-3.5 w-3.5" />Validar curso</>
                    )}
                  </Button>
                </div>
              </div>
            </form>

            {errorIndividual && <ErrorBanner message={errorIndividual} />}
            {loadingIndividual && <LoadingSkeleton />}
            {individualResult && !loadingIndividual && (
              <section>
                <div className="mb-4 flex items-center gap-3">
                  <ScanSearch className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">
                    Resultado —{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">
                      #{individualResult.courseId}
                    </code>
                  </h2>
                </div>
                <CourseContentValidator result={individualResult} />
              </section>
            )}
            {!loadingIndividual && !individualResult && !errorIndividual && (
              <EmptyState
                message="Ingresa un ID de curso para comenzar"
                description="Se verificará la estructura de secciones y el módulo de presentación del profesor."
              />
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════ BATCH MODE */}
        {mode === "batch" && (
          <>
            <form onSubmit={(e) => void handleValidateBatch(e)}>
              <div className="rounded-2xl border bg-muted/10 p-5 shadow-xs">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-50 flex-1 space-y-1.5">
                    <Label
                      htmlFor="categoryId"
                      className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                    >
                      ID de la categoría
                    </Label>
                    <Input
                      id="categoryId"
                      type="number"
                      min={1}
                      placeholder="Ej: 42"
                      value={categoryIdInput}
                      onChange={(e) => setCategoryIdInput(e.target.value)}
                      className="font-mono"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2 pb-0.5">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={includeSubcategories}
                        onChange={(e) => setIncludeSub(e.target.checked)}
                        className="h-3.5 w-3.5 rounded accent-primary"
                      />
                      Incluir subcategorías
                    </label>
                    <Button
                      type="submit"
                      disabled={loadingBatch || !categoryIdInput.trim()}
                      className="h-9 gap-2 px-5"
                    >
                      {loadingBatch ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" />Procesando…</>
                      ) : (
                        <><Search className="h-3.5 w-3.5" />Validar categoría</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </form>

            {errorBatch && <ErrorBanner message={errorBatch} />}

            {loadingBatch && (
              <div className="space-y-4">
                {batchProgress && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {batchProgress}
                  </div>
                )}
                <LoadingSkeleton batch />
              </div>
            )}

            {batchResult && !loadingBatch && (
              <section>
                <div className="mb-4 flex items-center gap-3">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">
                    Resultados —{" "}
                    <span className="text-foreground">{batchResult.categoryName}</span>
                  </h2>
                </div>
                <BatchCourseValidator result={batchResult} />
              </section>
            )}

            {!loadingBatch && !batchResult && !errorBatch && (
              <EmptyState
                message="Ingresa un ID de categoría para comenzar"
                description="Se validarán todos los cursos de la categoría y sus subcategorías."
              />
            )}
          </>
        )}
      </main>

      <SettingsSidebar
        open={sidebarOpen}
        onClose={() => { setSidebarOpen(false); refreshConfig(); }}
        onRulesChange={refreshConfig}
      />
    </>
  );
}

// ── Shared micro-components ───────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 dark:border-amber-800/60 dark:bg-amber-950/30">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="text-sm text-amber-800 dark:text-amber-300">{message}</p>
    </div>
  );
}

function EmptyState({ message, description }: { message: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-muted/30">
        <ScanSearch className="h-5 w-5 text-muted-foreground/60" />
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{message}</p>
        <p className="mt-0.5 text-xs text-muted-foreground/70">{description}</p>
      </div>
    </div>
  );
}
