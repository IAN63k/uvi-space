"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Trash2,
  Zap,
  BookOpen,
  FolderOpen,
  Search,
  Loader2,
  ScanSearch,
  AlertTriangle,
} from "lucide-react";

import { ReportTableControls } from "@/components/report-table-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { loadMoodleConfig } from "@/lib/encrypted-local-storage";

// ── Types ──────────────────────────────────────────────────────────────────────

type Status = "CUMPLE" | "NO CUMPLE" | "NO APLICA" | "NO EXISTE";
type PageMode = "category" | "individual";

type AlistamientoResult = {
  date: string;
  userIds: string;
  userDoc: string;
  teacherNames: string;
  teacherEmails: string;
  program: string;
  semester: string;
  group: string;
  courseId: number;
  courseName: string;
  courseCode: string;
  courseFormat: string;
  nombreProfesor: Status;
  correoProfesor: Status;
  horarioAtencion: Status;
  fotografia: Status;
  foroConsulta: Status;
  unidades: Status[];
  efc01Actividades: Status;
  efc01Ponderaciones: Status;
  efc02Actividades: Status;
  efc02Ponderaciones: Status;
  efc03Actividades: Status;
  efc03Ponderaciones: Status;
  porcentaje: number;
};

type ApiResponse = {
  mode?: "category" | "individual";
  categoryId?: number;
  courseId?: number;
  totalCourses: number;
  hierarchy: {
    programs: number;
    semesters: number;
    programNames: string[];
    semesterNames: string[];
  };
  summary: {
    high: number;
    medium: number;
    low: number;
    noActivity: number;
    totalCourses: number;
    repeatedCourses: number;
  };
  results: AlistamientoResult[];
  message?: string;
};

type Category = { id: number; name: string; courseCount?: number };

type ColumnKey =
  | "fecha" | "idUsuario" | "documento" | "programa" | "semestre"
  | "idCurso" | "curso" | "codigo" | "docentes" | "nombreProfesor"
  | "correo" | "horario" | "fotografia" | "foroConsulta"
  | "unidad1" | "unidad2" | "unidad3" | "unidad4"
  | "unidad5" | "unidad6" | "unidad7" | "unidad8"
  | "efc01Act" | "efc01Pond" | "efc02Act" | "efc02Pond"
  | "efc03Act" | "efc03Pond" | "porcentaje";

const columnLabels: Record<ColumnKey, string> = {
  fecha: "Fecha", idUsuario: "ID Usuario", documento: "Documento",
  programa: "Programa", semestre: "Semestre", idCurso: "ID Curso",
  curso: "Curso", codigo: "Código", docentes: "Docentes",
  nombreProfesor: "Nombre profesor", correo: "Correo", horario: "Horario",
  fotografia: "Foto", foroConsulta: "Foro consulta",
  unidad1: "Unidad 1", unidad2: "Unidad 2", unidad3: "Unidad 3", unidad4: "Unidad 4",
  unidad5: "Unidad 5", unidad6: "Unidad 6", unidad7: "Unidad 7", unidad8: "Unidad 8",
  efc01Act: "EFC01 Act.", efc01Pond: "EFC01 Pond.",
  efc02Act: "EFC02 Act.", efc02Pond: "EFC02 Pond.",
  efc03Act: "EFC03 Act.", efc03Pond: "EFC03 Pond.",
  porcentaje: "%",
};

const allColumns: ColumnKey[] = [
  "fecha", "idUsuario", "documento", "programa", "semestre", "idCurso", "curso", "codigo",
  "docentes", "nombreProfesor", "correo", "horario", "fotografia", "foroConsulta",
  "unidad1", "unidad2", "unidad3", "unidad4", "unidad5", "unidad6", "unidad7", "unidad8",
  "efc01Act", "efc01Pond", "efc02Act", "efc02Pond", "efc03Act", "efc03Pond", "porcentaje",
];

const defaultVisibility: Record<ColumnKey, boolean> = {
  fecha: false, idUsuario: false, documento: false,
  programa: true, semestre: true, idCurso: true, curso: true, codigo: true,
  docentes: true, nombreProfesor: true, correo: true, horario: true,
  fotografia: true, foroConsulta: true,
  unidad1: true, unidad2: true, unidad3: true, unidad4: true,
  unidad5: true, unidad6: true, unidad7: true, unidad8: true,
  efc01Act: true, efc01Pond: true, efc02Act: true, efc02Pond: true,
  efc03Act: true, efc03Pond: true, porcentaje: true,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const getStatusClass = (status: Status) => {
  if (status === "CUMPLE")    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (status === "NO APLICA") return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  if (status === "NO EXISTE") return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300";
};

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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AlistamientoApiPage() {
  // ── Shared state ────────────────────────────────────────────────────────────
  const [mode, setMode]                     = useState<PageMode>("category");
  const [payload, setPayload]               = useState<ApiResponse | null>(null);
  const [moodleConfigLoaded, setMoodleConfigLoaded] = useState<boolean | null>(null);
  const [settingsOpen, setSettingsOpen]     = useState(false);
  const [photoValidationTexts, setPhotoValidationTexts] = useState<string[]>([
    "https://www.uniajc.edu.co/wp-content/uploads/2023/07/foto-de-profesor230-x-939.gif",
  ]);
  const [searchText, setSearchText]         = useState("");
  const [statusFilter, setStatusFilter]     = useState<"all" | Status>("all");
  const [percentFilter, setPercentFilter]   = useState<"all" | "high" | "medium" | "low" | "noActivity">("all");
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(defaultVisibility);

  // ── Category mode state ──────────────────────────────────────────────────────
  const [mainCategoryId, setMainCategoryId]   = useState("");
  const [subcategoryId, setSubcategoryId]     = useState("");
  const [categories, setCategories]           = useState<Category[]>([]);
  const [subcategories, setSubcategories]     = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading]     = useState(false);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [loadingCategory, setLoadingCategory] = useState(false);
  const [errorCategory, setErrorCategory]     = useState<string | null>(null);

  // ── Individual mode state ────────────────────────────────────────────────────
  const [courseIdInput, setCourseIdInput]     = useState("");
  const [loadingIndividual, setLoadingIndividual] = useState(false);
  const [errorIndividual, setErrorIndividual] = useState<string | null>(null);

  // ── Load main categories on mount ────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const cfg = await loadMoodleConfig();
      setMoodleConfigLoaded(cfg !== null);
      if (!cfg) return;

      setCategoriesLoading(true);
      setCategoriesError(null);
      try {
        const res = await fetch("/api/moodle/categorias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moodleUrl: cfg.moodleUrl, token: cfg.token, parentId: 0 }),
        });
        const data = (await res.json()) as { categories?: Array<{ id: number; name: string; coursecount?: number }>; message?: string };
        if (!res.ok) throw new Error(data.message ?? "Error cargando categorías");
        setCategories(
          data.categories?.map((c) => ({ id: c.id, name: c.name, courseCount: c.coursecount })) ?? [],
        );
      } catch (err) {
        setCategoriesError(err instanceof Error ? err.message : "Error inesperado");
      } finally {
        setCategoriesLoading(false);
      }
    }
    void init();
  }, []);

  // ── Load subcategories when main category changes ────────────────────────────
  useEffect(() => {
    if (!mainCategoryId) {
      setSubcategories([]);
      setSubcategoryId("");
      return;
    }

    async function loadSubs() {
      const cfg = await loadMoodleConfig();
      if (!cfg) return;
      setSubcategoriesLoading(true);
      try {
        const res = await fetch("/api/moodle/categorias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moodleUrl: cfg.moodleUrl, token: cfg.token, parentId: Number(mainCategoryId) }),
        });
        const data = (await res.json()) as { categories?: Array<{ id: number; name: string; coursecount?: number }> };
        setSubcategories(
          data.categories?.map((c) => ({ id: c.id, name: c.name, courseCount: c.coursecount })) ?? [],
        );
      } catch {
        setSubcategories([]);
      } finally {
        setSubcategoriesLoading(false);
      }
    }
    void loadSubs();
    setSubcategoryId("");
  }, [mainCategoryId]);

  // ── Mode change ──────────────────────────────────────────────────────────────
  const handleModeChange = (m: PageMode) => {
    setMode(m);
    setPayload(null);
    setErrorCategory(null);
    setErrorIndividual(null);
  };

  // ── Category submit ──────────────────────────────────────────────────────────
  const onSubmitCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveCategoryId = subcategoryId || mainCategoryId;
    if (!effectiveCategoryId) return;

    setLoadingCategory(true);
    setErrorCategory(null);
    setPayload(null);

    try {
      const cfg = await loadMoodleConfig();
      if (!cfg?.moodleUrl || !cfg?.token) {
        setErrorCategory("No hay configuración de Moodle. Configura el token en Revisión de Cursos.");
        return;
      }
      const cleanTexts = photoValidationTexts.map((t) => t.trim()).filter(Boolean);
      const res = await fetch("/api/moodle/reportes/alistamiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: Number(effectiveCategoryId),
          moodleConfig: { moodleUrl: cfg.moodleUrl, token: cfg.token },
          photoValidationTexts: cleanTexts,
        }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(data.message ?? "Error consultando alistamiento");
      setPayload(data);
    } catch (err) {
      setErrorCategory(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoadingCategory(false);
    }
  };

  // ── Individual submit ────────────────────────────────────────────────────────
  const onSubmitIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    const cid = parseInt(courseIdInput.trim(), 10);
    if (!courseIdInput.trim() || isNaN(cid) || cid <= 0) {
      setErrorIndividual("Ingresa un ID de curso válido (número entero positivo).");
      return;
    }

    setLoadingIndividual(true);
    setErrorIndividual(null);
    setPayload(null);

    try {
      const cfg = await loadMoodleConfig();
      if (!cfg?.moodleUrl || !cfg?.token) {
        setErrorIndividual("No hay configuración de Moodle. Configura el token en Revisión de Cursos.");
        return;
      }
      const cleanTexts = photoValidationTexts.map((t) => t.trim()).filter(Boolean);
      const res = await fetch("/api/moodle/reportes/alistamiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: cid,
          moodleConfig: { moodleUrl: cfg.moodleUrl, token: cfg.token },
          photoValidationTexts: cleanTexts,
        }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(data.message ?? "Error consultando el curso");
      setPayload(data);
    } catch (err) {
      setErrorIndividual(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoadingIndividual(false);
    }
  };

  // ── Photo validation text handlers ──────────────────────────────────────────
  const updatePhotoText  = (i: number, v: string) =>
    setPhotoValidationTexts((p) => p.map((item, idx) => (idx === i ? v : item)));
  const addPhotoText     = () => setPhotoValidationTexts((p) => [...p, ""]);
  const removePhotoText  = (i: number) =>
    setPhotoValidationTexts((p) => p.filter((_, idx) => idx !== i));

  // ── Filtered results ─────────────────────────────────────────────────────────
  const hasResults = useMemo(() => (payload?.results.length ?? 0) > 0, [payload]);

  const filteredResults = useMemo(() => {
    const results = payload?.results ?? [];
    const query   = searchText.trim().toLowerCase();
    return results.filter((row) => {
      if (query) {
        const haystack = [
          row.date, row.userIds, row.userDoc, row.program, row.semester,
          row.courseName, row.courseCode, row.teacherNames, row.teacherEmails,
          String(row.courseId), String(row.porcentaje),
        ].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (statusFilter !== "all") {
        const cells: Status[] = [
          row.nombreProfesor, row.correoProfesor, row.horarioAtencion,
          row.fotografia, row.foroConsulta,
          row.efc01Actividades, row.efc01Ponderaciones,
          row.efc02Actividades, row.efc02Ponderaciones,
          row.efc03Actividades, row.efc03Ponderaciones,
          ...row.unidades,
        ];
        if (!cells.includes(statusFilter)) return false;
      }
      if (percentFilter === "high"       && !(row.porcentaje >= 80)) return false;
      if (percentFilter === "medium"     && !(row.porcentaje >= 51 && row.porcentaje <= 79)) return false;
      if (percentFilter === "low"        && !(row.porcentaje >= 1 && row.porcentaje <= 50)) return false;
      if (percentFilter === "noActivity" && row.porcentaje !== 0) return false;
      return true;
    });
  }, [payload?.results, searchText, statusFilter, percentFilter]);

  const visibleColumnCount = useMemo(
    () => Object.values(visibleColumns).filter(Boolean).length,
    [visibleColumns],
  );

  const toggleColumn = (col: ColumnKey) =>
    setVisibleColumns((p) => ({ ...p, [col]: !p[col] }));
  const resetFilters = () => { setSearchText(""); setStatusFilter("all"); setPercentFilter("all"); };

  // ── CSV export ───────────────────────────────────────────────────────────────
  const downloadCsv = () => {
    if (filteredResults.length === 0) return;
    const active = allColumns.filter((c) => visibleColumns[c]);
    if (active.length === 0) return;

    const esc = (v: string | number) => `"${String(v ?? "").replaceAll('"', '""')}"`;

    const toCell = (row: AlistamientoResult, col: ColumnKey): string | number => {
      switch (col) {
        case "fecha":          return row.date;
        case "idUsuario":      return row.userIds;
        case "documento":      return row.userDoc;
        case "programa":       return row.program;
        case "semestre":       return row.semester;
        case "idCurso":        return row.courseId;
        case "curso":          return row.courseName;
        case "codigo":         return row.courseCode;
        case "docentes":       return row.teacherNames;
        case "nombreProfesor": return row.nombreProfesor;
        case "correo":         return row.correoProfesor;
        case "horario":        return row.horarioAtencion;
        case "fotografia":     return row.fotografia;
        case "foroConsulta":   return row.foroConsulta;
        case "unidad1":        return row.unidades[0] ?? "NO APLICA";
        case "unidad2":        return row.unidades[1] ?? "NO APLICA";
        case "unidad3":        return row.unidades[2] ?? "NO APLICA";
        case "unidad4":        return row.unidades[3] ?? "NO APLICA";
        case "unidad5":        return row.unidades[4] ?? "NO APLICA";
        case "unidad6":        return row.unidades[5] ?? "NO APLICA";
        case "unidad7":        return row.unidades[6] ?? "NO APLICA";
        case "unidad8":        return row.unidades[7] ?? "NO APLICA";
        case "efc01Act":       return row.efc01Actividades;
        case "efc01Pond":      return row.efc01Ponderaciones;
        case "efc02Act":       return row.efc02Actividades;
        case "efc02Pond":      return row.efc02Ponderaciones;
        case "efc03Act":       return row.efc03Actividades;
        case "efc03Pond":      return row.efc03Ponderaciones;
        case "porcentaje":     return `${row.porcentaje}%`;
      }
    };

    const header = active.map((c) => esc(columnLabels[c])).join(",");
    const lines  = filteredResults.map((row) => active.map((c) => esc(toCell(row, c))).join(","));
    const csv    = [header, ...lines].join("\n");
    const blob   = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url    = URL.createObjectURL(blob);
    const link   = document.createElement("a");
    const label  = mode === "individual"
      ? `curso-${courseIdInput}`
      : (categories.find((c) => c.id === payload?.categoryId)?.name ?? "categoria")
          .toLowerCase().replaceAll(/[^a-z0-9]+/gi, "-");
    link.href     = url;
    link.download = `alistamiento-api-${label}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isLoading = mode === "category" ? loadingCategory : loadingIndividual;
  const activeError = mode === "category" ? errorCategory : errorIndividual;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 md:px-8">

      {/* ── Header ── */}
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-1.5">
            <Zap className="h-3 w-3" />
            API Moodle
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Alistamiento API</h1>
          <Button type="button" variant="outline" onClick={() => setSettingsOpen(true)}>
            Ajustes
          </Button>
        </div>
        <p className="text-muted-foreground">
          Idéntico al alistamiento estándar, pero consumiendo los web services de Moodle en
          lugar de consulta directa a la base de datos.
        </p>
      </header>

      {/* ── No Moodle config warning ── */}
      {moodleConfigLoaded === false && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-800 dark:text-amber-300">
              Token de Moodle no configurado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Este reporte requiere un token de acceso a la API de Moodle. Configúralo en{" "}
              <Link href="/reportes/revision-cursos" className="font-medium underline underline-offset-2">
                Revisión de Cursos
              </Link>{" "}
              y vuelve a esta página.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Mode toggle ── */}
      <div
        role="tablist"
        className="inline-flex items-center rounded-xl border bg-muted/20 p-1 shadow-xs"
      >
        {([
          { key: "category"   as PageMode, label: "Por categoría",   Icon: FolderOpen },
          { key: "individual" as PageMode, label: "Curso individual", Icon: BookOpen },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => handleModeChange(key)}
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

      {/* ══════════════════════════════ CATEGORY MODE */}
      {mode === "category" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Seleccionar categoría</CardTitle>
              <CardDescription>
                Las categorías se cargan desde la API de Moodle usando el token configurado en{" "}
                <Link href="/reportes/revision-cursos" className="underline underline-offset-2">
                  Revisión de Cursos
                </Link>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmitCategory(e)}>
                {/* Row 1: Main category */}
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-full space-y-1.5 sm:max-w-80">
                    <Label htmlFor="mainCategoryId">Categoría principal</Label>
                    {/* eslint-disable-next-line jsx-a11y/no-onchange */}
                    <select
                      id="mainCategoryId"
                      value={mainCategoryId}
                      onChange={(e) => setMainCategoryId(e.target.value)}
                      required
                      disabled={loadingCategory || categoriesLoading || moodleConfigLoaded === false}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">
                        {categoriesLoading
                          ? "Cargando categorías..."
                          : moodleConfigLoaded === false
                            ? "Sin conexión — configura el token en Revisión de Cursos"
                            : categories.length === 0
                              ? "Sin categorías disponibles"
                              : "Selecciona una categoría"}
                      </option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={String(cat.id)}>
                          {cat.name}{cat.courseCount ? ` (${cat.courseCount})` : ""}
                        </option>
                      ))}
                    </select>
                    {categoriesError && (
                      <p className="text-xs text-destructive">{categoriesError}</p>
                    )}
                  </div>
                </div>

                {/* Row 2: Subcategory (shown when available or loading) */}
                {(subcategories.length > 0 || subcategoriesLoading) && (
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="w-full space-y-1.5 sm:max-w-80">
                      <Label htmlFor="subcategoryId">
                        Subcategoría{" "}
                        <span className="font-normal text-muted-foreground">(opcional)</span>
                      </Label>
                      {/* eslint-disable-next-line jsx-a11y/no-onchange */}
                      <select
                        id="subcategoryId"
                        value={subcategoryId}
                        onChange={(e) => setSubcategoryId(e.target.value)}
                        disabled={loadingCategory || subcategoriesLoading}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">
                          {subcategoriesLoading
                            ? "Cargando subcategorías..."
                            : "Todas las subcategorías"}
                        </option>
                        {subcategories.map((cat) => (
                          <option key={cat.id} value={String(cat.id)}>
                            {cat.name}{cat.courseCount ? ` (${cat.courseCount})` : ""}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-muted-foreground/70">
                        Selecciona una subcategoría o deja en blanco para consultar toda la categoría
                        principal.
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <Button
                    type="submit"
                    disabled={loadingCategory || !mainCategoryId || moodleConfigLoaded === false}
                    className="gap-2"
                  >
                    {loadingCategory ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />Consultando...</>
                    ) : (
                      <><Search className="h-3.5 w-3.5" />Consultar alistamiento</>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {errorCategory && <ErrorBanner message={errorCategory} />}

          {!loadingCategory && !payload && !errorCategory && (
            <EmptyState
              message="Selecciona una categoría para comenzar"
              description="Se validarán todos los cursos de la categoría seleccionada."
            />
          )}
        </>
      )}

      {/* ══════════════════════════════ INDIVIDUAL MODE */}
      {mode === "individual" && (
        <>
          <form onSubmit={(e) => void onSubmitIndividual(e)}>
            <div className="rounded-2xl border bg-muted/10 p-5 shadow-xs">
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-50 flex-1 space-y-1.5">
                  <Label
                    htmlFor="courseIdInput"
                    className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    ID del curso
                  </Label>
                  <Input
                    id="courseIdInput"
                    type="number"
                    min={1}
                    placeholder="Ej: 1234"
                    value={courseIdInput}
                    onChange={(e) => setCourseIdInput(e.target.value)}
                    className="font-mono"
                    disabled={loadingIndividual || moodleConfigLoaded === false}
                    required
                  />
                  <p className="text-[10px] text-muted-foreground/70">
                    El formato del curso se detecta automáticamente desde la API de Moodle.
                  </p>
                </div>
                <Button
                  type="submit"
                  disabled={loadingIndividual || !courseIdInput.trim() || moodleConfigLoaded === false}
                  className="h-9 gap-2 px-5"
                >
                  {loadingIndividual ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />Validando…</>
                  ) : (
                    <><Search className="h-3.5 w-3.5" />Consultar curso</>
                  )}
                </Button>
              </div>
            </div>
          </form>

          {errorIndividual && <ErrorBanner message={errorIndividual} />}

          {!loadingIndividual && !payload && !errorIndividual && (
            <EmptyState
              message="Ingresa un ID de curso para comenzar"
              description="Se ejecutarán todas las validaciones de alistamiento para ese curso."
            />
          )}
        </>
      )}

      {/* ── Settings drawer ── */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${settingsOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setSettingsOpen(false)}
      />
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md border-l bg-background p-6 shadow-xl transition-transform duration-300 ${settingsOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ajustes del informe</h2>
          <Button type="button" variant="ghost" onClick={() => setSettingsOpen(false)}>
            Cerrar
          </Button>
        </div>
        <div className="mt-6 space-y-3">
          <div>
            <h3 className="text-sm font-medium">Foto</h3>
            <p className="text-xs text-muted-foreground">
              Si el texto ingresado aparece en la página de presentación, la validación de foto
              queda en NO CUMPLE.
            </p>
          </div>
          <div className="space-y-2">
            {photoValidationTexts.map((value, index) => (
              <div key={`photo-${index}`} className="flex items-center gap-2">
                <input
                  value={value}
                  onChange={(e) => updatePhotoText(index, e.target.value)}
                  placeholder="Texto de validación"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {index > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePhotoText(index)}
                    aria-label={`Eliminar campo ${index + 1}`}
                  >
                    <Trash2 />
                  </Button>
                )}
                {index === photoValidationTexts.length - 1 && (
                  <Button type="button" variant="outline" onClick={addPhotoText}>+</Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Results ── */}
      {payload && !isLoading && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Jerarquía encontrada</CardDescription>
                <CardTitle className="text-base">
                  {payload.hierarchy.programs} programas · {payload.hierarchy.semesters} semestres
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Programas</p>
                  <div className="flex max-h-20 flex-wrap gap-1 overflow-auto pr-1">
                    {payload.hierarchy.programNames.length > 0 ? (
                      payload.hierarchy.programNames.map((name) => (
                        <span key={`prog-${name}`} className="rounded-md border px-2 py-0.5 text-[11px]">{name}</span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin programas detectados</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Semestres</p>
                  <div className="flex max-h-20 flex-wrap gap-1 overflow-auto pr-1">
                    {payload.hierarchy.semesterNames.length > 0 ? (
                      payload.hierarchy.semesterNames.map((name) => (
                        <span key={`sem-${name}`} className="rounded-md border px-2 py-0.5 text-[11px]">{name}</span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin semestres detectados</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total de cursos</CardDescription>
                <CardTitle className="text-base">
                  {payload.summary.totalCourses}
                  {payload.summary.repeatedCourses > 0 ? ` (${payload.summary.repeatedCourses} repetidos)` : ""}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Distribución de porcentaje</CardDescription>
                <CardTitle className="text-base">Rendimiento por rango</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  {payload.summary.totalCourses > 0 && (
                    <div className="flex h-full w-full">
                      <div className="h-full bg-green-500"  style={{ width: `${(payload.summary.high / payload.summary.totalCourses) * 100}%` }} />
                      <div className="h-full bg-yellow-400" style={{ width: `${(payload.summary.medium / payload.summary.totalCourses) * 100}%` }} />
                      <div className="h-full bg-red-500"    style={{ width: `${(payload.summary.low / payload.summary.totalCourses) * 100}%` }} />
                      <div className="h-full bg-black dark:bg-white/20" style={{ width: `${(payload.summary.noActivity / payload.summary.totalCourses) * 100}%` }} />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {([
                    { label: "80-100", color: "bg-green-500",  count: payload.summary.high },
                    { label: "51-79",  color: "bg-yellow-400", count: payload.summary.medium },
                    { label: "1-50",   color: "bg-red-500",    count: payload.summary.low },
                    { label: "0",      color: "bg-black dark:bg-white/40", count: payload.summary.noActivity },
                  ] as const).map(({ label, color, count }) => (
                    <div key={label} className="rounded-md border bg-card p-2">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${color}`} />
                        <span className="text-muted-foreground">{label}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold">{count} cursos</p>
                      <p className="text-muted-foreground">
                        {payload.summary.totalCourses > 0
                          ? Math.round((count / payload.summary.totalCourses) * 100)
                          : 0}%
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results table */}
          <Card>
            <CardHeader>
              <CardTitle>Resultado</CardTitle>
              <CardDescription>
                {payload.mode === "individual"
                  ? `Curso #${payload.results[0]?.courseId ?? payload.courseId}`
                  : `Categoría ${
                      categories.find((c) => c.id === payload.categoryId)?.name ?? payload.categoryId
                    } · ${payload.totalCourses} cursos`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasResults ? (
                <p className="text-sm text-muted-foreground">
                  No se encontraron cursos para la consulta realizada.
                </p>
              ) : (
                <>
                  <ReportTableControls
                    filters={
                      <div className="grid gap-3 lg:grid-cols-4">
                        <div className="space-y-1 lg:col-span-2">
                          <Label htmlFor="searchTable">Buscar</Label>
                          <input
                            id="searchTable"
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Curso, programa, docente, código..."
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="statusFilter">Estado</Label>
                          {/* eslint-disable-next-line jsx-a11y/no-onchange */}
                          <select
                            id="statusFilter"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as "all" | Status)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <option value="all">Todos</option>
                            <option value="CUMPLE">CUMPLE</option>
                            <option value="NO CUMPLE">NO CUMPLE</option>
                            <option value="NO APLICA">NO APLICA</option>
                            <option value="NO EXISTE">NO EXISTE</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="percentFilter">Porcentaje</Label>
                          {/* eslint-disable-next-line jsx-a11y/no-onchange */}
                          <select
                            id="percentFilter"
                            value={percentFilter}
                            onChange={(e) =>
                              setPercentFilter(e.target.value as "all" | "high" | "medium" | "low" | "noActivity")
                            }
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <option value="all">Todos</option>
                            <option value="high">80-100</option>
                            <option value="medium">51-79</option>
                            <option value="low">1-50</option>
                            <option value="noActivity">0</option>
                          </select>
                        </div>
                      </div>
                    }
                    columns={
                      <>
                        {allColumns.map((col) => (
                          <label key={col} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                            <input type="checkbox" checked={visibleColumns[col]} onChange={() => toggleColumn(col)} />
                            <span>{columnLabels[col]}</span>
                          </label>
                        ))}
                      </>
                    }
                    filteredCount={filteredResults.length}
                    totalCount={payload.results.length}
                    visibleCount={visibleColumnCount}
                    onResetFilters={resetFilters}
                    onDownloadCsv={downloadCsv}
                    disableDownload={filteredResults.length === 0 || visibleColumnCount === 0}
                    columnsPanelClassName="w-64"
                  />

                  <div className="overflow-x-auto rounded-lg border">
                    <table className="min-w-475 text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          {visibleColumns.fecha          && <th className="px-3 py-2 text-left font-medium">Fecha</th>}
                          {visibleColumns.idUsuario      && <th className="px-3 py-2 text-left font-medium">ID Usuario</th>}
                          {visibleColumns.documento      && <th className="px-3 py-2 text-left font-medium">Documento</th>}
                          {visibleColumns.programa       && <th className="px-3 py-2 text-left font-medium">Programa</th>}
                          {visibleColumns.semestre       && <th className="px-3 py-2 text-left font-medium">Semestre</th>}
                          {visibleColumns.idCurso        && <th className="px-3 py-2 text-left font-medium">ID Curso</th>}
                          {visibleColumns.curso          && <th className="px-3 py-2 text-left font-medium">Curso</th>}
                          {visibleColumns.codigo         && <th className="px-3 py-2 text-left font-medium">Código</th>}
                          {visibleColumns.docentes       && <th className="px-3 py-2 text-left font-medium">Docentes</th>}
                          {visibleColumns.nombreProfesor && <th className="px-3 py-2 text-left font-medium">Nombre profesor</th>}
                          {visibleColumns.correo         && <th className="px-3 py-2 text-left font-medium">Correo</th>}
                          {visibleColumns.horario        && <th className="px-3 py-2 text-left font-medium">Horario</th>}
                          {visibleColumns.fotografia     && <th className="px-3 py-2 text-left font-medium">Foto</th>}
                          {visibleColumns.foroConsulta   && <th className="px-3 py-2 text-left font-medium">Foro consulta</th>}
                          {visibleColumns.unidad1  && <th className="px-3 py-2 text-left font-medium">Unidad 1</th>}
                          {visibleColumns.unidad2  && <th className="px-3 py-2 text-left font-medium">Unidad 2</th>}
                          {visibleColumns.unidad3  && <th className="px-3 py-2 text-left font-medium">Unidad 3</th>}
                          {visibleColumns.unidad4  && <th className="px-3 py-2 text-left font-medium">Unidad 4</th>}
                          {visibleColumns.unidad5  && <th className="px-3 py-2 text-left font-medium">Unidad 5</th>}
                          {visibleColumns.unidad6  && <th className="px-3 py-2 text-left font-medium">Unidad 6</th>}
                          {visibleColumns.unidad7  && <th className="px-3 py-2 text-left font-medium">Unidad 7</th>}
                          {visibleColumns.unidad8  && <th className="px-3 py-2 text-left font-medium">Unidad 8</th>}
                          {visibleColumns.efc01Act  && <th className="px-3 py-2 text-left font-medium">EFC01 Act.</th>}
                          {visibleColumns.efc01Pond && <th className="px-3 py-2 text-left font-medium">EFC01 Pond.</th>}
                          {visibleColumns.efc02Act  && <th className="px-3 py-2 text-left font-medium">EFC02 Act.</th>}
                          {visibleColumns.efc02Pond && <th className="px-3 py-2 text-left font-medium">EFC02 Pond.</th>}
                          {visibleColumns.efc03Act  && <th className="px-3 py-2 text-left font-medium">EFC03 Act.</th>}
                          {visibleColumns.efc03Pond && <th className="px-3 py-2 text-left font-medium">EFC03 Pond.</th>}
                          {visibleColumns.porcentaje && <th className="px-3 py-2 text-left font-medium">%</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredResults.map((item) => (
                          <tr key={`${item.courseId}-${item.semester}`} className="border-t align-top">
                            {visibleColumns.fecha     && <td className="px-3 py-2 text-xs text-muted-foreground">{item.date}</td>}
                            {visibleColumns.idUsuario && <td className="px-3 py-2">{item.userIds}</td>}
                            {visibleColumns.documento && <td className="px-3 py-2">{item.userDoc}</td>}
                            {visibleColumns.programa  && <td className="px-3 py-2 max-w-[160px] truncate">{item.program}</td>}
                            {visibleColumns.semestre  && <td className="px-3 py-2">{item.semester}</td>}
                            {visibleColumns.idCurso   && <td className="px-3 py-2 tabular-nums">{item.courseId}</td>}
                            {visibleColumns.curso     && <td className="px-3 py-2 max-w-[200px]">{item.courseName}</td>}
                            {visibleColumns.codigo    && <td className="px-3 py-2 font-mono text-xs">{item.courseCode}</td>}
                            {visibleColumns.docentes  && (
                              <td className="px-3 py-2 whitespace-pre-line">
                                <span className="font-medium">{item.teacherNames || "Sin docentes"}</span>
                                {item.teacherEmails && (
                                  <span className="block text-xs text-muted-foreground">{item.teacherEmails}</span>
                                )}
                              </td>
                            )}
                            {([
                              ["nombreProfesor", item.nombreProfesor],
                              ["correo",         item.correoProfesor],
                              ["horario",        item.horarioAtencion],
                              ["fotografia",     item.fotografia],
                              ["foroConsulta",   item.foroConsulta],
                            ] as [ColumnKey, Status][]).map(([col, val]) =>
                              visibleColumns[col] ? (
                                <td key={col} className="px-3 py-2">
                                  <span className={`rounded px-2 py-1 text-xs font-medium ${getStatusClass(val)}`}>{val}</span>
                                </td>
                              ) : null,
                            )}
                            {([
                              ["unidad1", 0], ["unidad2", 1], ["unidad3", 2], ["unidad4", 3],
                              ["unidad5", 4], ["unidad6", 5], ["unidad7", 6], ["unidad8", 7],
                            ] as [ColumnKey, number][]).map(([col, idx]) =>
                              visibleColumns[col] ? (
                                <td key={col} className="px-3 py-2">
                                  <span className={`rounded px-2 py-1 text-xs font-medium ${getStatusClass(item.unidades[idx] ?? "NO APLICA")}`}>
                                    {item.unidades[idx] ?? "NO APLICA"}
                                  </span>
                                </td>
                              ) : null,
                            )}
                            {([
                              ["efc01Act",  item.efc01Actividades],
                              ["efc01Pond", item.efc01Ponderaciones],
                              ["efc02Act",  item.efc02Actividades],
                              ["efc02Pond", item.efc02Ponderaciones],
                              ["efc03Act",  item.efc03Actividades],
                              ["efc03Pond", item.efc03Ponderaciones],
                            ] as [ColumnKey, Status][]).map(([col, val]) =>
                              visibleColumns[col] ? (
                                <td key={col} className="px-3 py-2">
                                  <span className={`rounded px-2 py-1 text-xs font-medium ${getStatusClass(val)}`}>{val}</span>
                                </td>
                              ) : null,
                            )}
                            {visibleColumns.porcentaje && (
                              <td className="px-3 py-2 font-semibold tabular-nums">{item.porcentaje}%</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
