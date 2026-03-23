"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";

import { ReportTableControls } from "@/components/report-table-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import { loadEncryptedDbConfig } from "@/lib/encrypted-local-storage";
import { buildCsv, downloadCsvFile } from "@/lib/reporting/csv";
import type { EfcApiResponse, EfcDefinition, EfcLevel } from "@/lib/reporting/efc";
import { getStatusClass, REPORT_STATUS } from "@/lib/reporting/status";
import type { ReportStatus } from "@/lib/reporting/status";

type Category = {
  id: number;
  name: string;
  courseCount: number;
};

type BaseColumnKey =
  | "fecha"
  | "idUsuario"
  | "documento"
  | "programa"
  | "semestre"
  | "grupo"
  | "idCurso"
  | "curso"
  | "codigo"
  | "docentes"
  | "porcentaje";

const baseColumnLabels: Record<BaseColumnKey, string> = {
  fecha: "Fecha",
  idUsuario: "ID usuario",
  documento: "Documento",
  programa: "Programa",
  semestre: "Semestre",
  grupo: "Grupo",
  idCurso: "ID curso",
  curso: "Curso",
  codigo: "Código",
  docentes: "Docentes",
  porcentaje: "%",
};

const baseColumns: BaseColumnKey[] = [
  "fecha",
  "idUsuario",
  "documento",
  "programa",
  "semestre",
  "grupo",
  "idCurso",
  "curso",
  "codigo",
  "docentes",
  "porcentaje",
];

type PercentFilter = "all" | "high" | "medium" | "low" | "noActivity" | "mismatch";

const getPercentTag = (value: number) => {
  if (value === -2) return "No coincide categoría";
  if (value === -1) return "Sin actividades";
  return `${value}%`;
};

const getPercentPillClass = (value: number) => {
  if (value === -2) {
    return "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300";
  }

  if (value === -1) {
    return "bg-black text-white dark:bg-zinc-800 dark:text-zinc-100";
  }

  if (value >= 80 && value <= 100) {
    return "bg-green-500/15 text-green-700 dark:text-green-300";
  }

  if (value >= 51 && value <= 79) {
    return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300";
  }

  return "bg-red-500/15 text-red-700 dark:text-red-300";
};

type EfcReportClientProps = {
  level: EfcLevel;
  definition: EfcDefinition;
};

export function EfcReportClient({ level, definition }: EfcReportClientProps) {
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<EfcApiResponse | null>(null);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ReportStatus>("all");
  const [percentFilter, setPercentFilter] = useState<PercentFilter>("all");

  const [visibleBaseColumns, setVisibleBaseColumns] = useState<Record<BaseColumnKey, boolean>>({
    fecha: false,
    idUsuario: false,
    documento: false,
    programa: true,
    semestre: true,
    grupo: true,
    idCurso: true,
    curso: true,
    codigo: true,
    docentes: true,
    porcentaje: true,
  });

  const [visibleActivities, setVisibleActivities] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadCategories() {
      const dbConfig = await loadEncryptedDbConfig();
      if (!dbConfig) return;

      setCategoriesLoading(true);
      setCategoriesError(null);

      try {
        const response = await fetch("/api/categorias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dbConfig }),
        });

        const data = (await response.json()) as { categories?: Category[]; message?: string };
        if (!response.ok) {
          throw new Error(data.message ?? "Error cargando categorías");
        }

        setCategories(data.categories ?? []);
      } catch (err) {
        setCategoriesError(err instanceof Error ? err.message : "Error inesperado");
      } finally {
        setCategoriesLoading(false);
      }
    }

    void loadCategories();
  }, []);

  useEffect(() => {
    const maxActivities = payload?.maxActivities ?? 0;

    if (maxActivities === 0) {
      setVisibleActivities({});
      return;
    }

    const next: Record<string, boolean> = {};
    for (let index = 1; index <= maxActivities; index += 1) {
      next[`a${index}-nombre`] = true;
      next[`a${index}-calificacion`] = true;
      next[`a${index}-retro`] = true;
    }

    setVisibleActivities(next);
  }, [payload?.maxActivities]);

  const filteredResults = useMemo(() => {
    const rows = payload?.results ?? [];
    const query = searchText.trim().toLowerCase();

    return rows.filter((row) => {
      if (query) {
        const activitiesText = row.actividades
          .map((activity) => `${activity.name} ${activity.score} ${activity.feedback}`)
          .join(" ")
          .toLowerCase();

        const haystack = [
          row.date,
          row.userIds,
          row.userDoc,
          row.program,
          row.semester,
          row.group,
          String(row.courseId),
          row.courseName,
          row.courseCode,
          row.teacherNames,
          row.teacherEmails,
          getPercentTag(row.porcentaje),
          activitiesText,
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) {
          return false;
        }
      }

      if (statusFilter !== "all") {
        const statuses = row.actividades.flatMap((activity) => [activity.score, activity.feedback]);
        if (!statuses.includes(statusFilter)) {
          return false;
        }
      }

      if (percentFilter !== "all") {
        if (percentFilter === "high" && !(row.porcentaje >= 80 && row.porcentaje <= 100)) return false;
        if (percentFilter === "medium" && !(row.porcentaje >= 51 && row.porcentaje <= 79)) return false;
        if (percentFilter === "low" && !(row.porcentaje >= 0 && row.porcentaje <= 50)) return false;
        if (percentFilter === "noActivity" && row.porcentaje !== -1) return false;
        if (percentFilter === "mismatch" && row.porcentaje !== -2) return false;
      }

      return true;
    });
  }, [payload?.results, searchText, statusFilter, percentFilter]);

  const visibleCount = useMemo(() => {
    const base = Object.values(visibleBaseColumns).filter(Boolean).length;
    const activities = Object.values(visibleActivities).filter(Boolean).length;
    return base + activities;
  }, [visibleActivities, visibleBaseColumns]);

  const toggleBaseColumn = (column: BaseColumnKey) => {
    setVisibleBaseColumns((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  const toggleActivityColumn = (key: string) => {
    setVisibleActivities((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resetFilters = () => {
    setSearchText("");
    setStatusFilter("all");
    setPercentFilter("all");
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const dbConfig = await loadEncryptedDbConfig();
      if (!dbConfig) {
        setPayload(null);
        setError("No hay configuración BD guardada. Configura las credenciales antes de consultar.");
        return;
      }

      const response = await fetch(`/api/reportes/efc/${level}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: Number(categoryId),
          roleId: 3,
          dbConfig,
        }),
      });

      const data = (await response.json()) as EfcApiResponse;
      if (!response.ok) {
        throw new Error(data.message ?? "No fue posible generar el reporte EFC");
      }

      setPayload(data);
    } catch (err) {
      setPayload(null);
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = () => {
    if (!payload || filteredResults.length === 0) return;

    const headerLabels: string[] = [];
    const rows: Array<Array<string | number | null | undefined>> = [];

    const activeBaseColumns = baseColumns.filter((column) => visibleBaseColumns[column]);

    for (const column of activeBaseColumns) {
      headerLabels.push(baseColumnLabels[column]);
    }

    for (let index = 1; index <= payload.maxActivities; index += 1) {
      if (visibleActivities[`a${index}-nombre`]) {
        headerLabels.push(`Nombre actividad ${index}`);
      }
      if (visibleActivities[`a${index}-calificacion`]) {
        headerLabels.push(`Calificación ${index}`);
      }
      if (visibleActivities[`a${index}-retro`]) {
        headerLabels.push(`Retroalimentación ${index}`);
      }
    }

    if (headerLabels.length === 0) return;

    for (const row of filteredResults) {
      const csvRow: Array<string | number | null | undefined> = [];

      for (const column of activeBaseColumns) {
        if (column === "fecha") csvRow.push(row.date);
        if (column === "idUsuario") csvRow.push(row.userIds);
        if (column === "documento") csvRow.push(row.userDoc);
        if (column === "programa") csvRow.push(row.program);
        if (column === "semestre") csvRow.push(row.semester);
        if (column === "grupo") csvRow.push(row.group);
        if (column === "idCurso") csvRow.push(row.courseId);
        if (column === "curso") csvRow.push(row.courseName);
        if (column === "codigo") csvRow.push(row.courseCode);
        if (column === "docentes") csvRow.push(row.teacherNames);
        if (column === "porcentaje") csvRow.push(getPercentTag(row.porcentaje));
      }

      for (let index = 1; index <= payload.maxActivities; index += 1) {
        const activity = row.actividades[index - 1];

        if (visibleActivities[`a${index}-nombre`]) {
          if (!activity) {
            if (row.porcentaje === -2) csvRow.push("No coincide la categoría");
            else if (row.porcentaje === -1) csvRow.push("Sin actividades");
            else csvRow.push("");
          } else {
            csvRow.push(activity.name);
          }
        }

        if (visibleActivities[`a${index}-calificacion`]) {
          csvRow.push(activity?.score ?? "");
        }

        if (visibleActivities[`a${index}-retro`]) {
          csvRow.push(activity?.feedback ?? "");
        }
      }

      rows.push(csvRow);
    }

    const csv = buildCsv(headerLabels, rows);
    const selectedCategory = categories.find((item) => item.id === payload.categoryId)?.name ?? "categoria";
    const slug = selectedCategory
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replaceAll(/[^a-z0-9]+/gi, "-")
      .replaceAll(/(^-|-$)/g, "");

    downloadCsvFile(
      `${definition.code.toLowerCase()}-${slug}-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
    );
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 md:px-8">
      <header className="space-y-2">
        <Badge variant="secondary">Reporte conectado</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">{definition.title}</h1>
        <p className="text-muted-foreground">
          Migración de <code>report/avances.php</code> para {definition.code} con filtros, columnas dinámicas y CSV.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Seleccionar categoría</CardTitle>
          <CardDescription>
            Las categorías se cargan desde Moodle. Si no aparecen, revisa la{" "}
            <Link href="/configuracion/bd" className="underline underline-offset-2">
              configuración de BD
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
            <div className="w-full space-y-2 sm:max-w-96">
              <Label htmlFor="categoryId">Categoría Moodle</Label>
              <select
                id="categoryId"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required
                disabled={categoriesLoading || loading}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">
                  {categoriesLoading
                    ? "Cargando categorías..."
                    : categories.length === 0
                      ? "Sin conexión — configura la BD"
                      : "Selecciona una categoría"}
                </option>
                {categories.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name}
                    {item.courseCount > 0 ? ` (${item.courseCount} cursos)` : ""}
                  </option>
                ))}
              </select>
              {categoriesError ? <p className="text-xs text-destructive">{categoriesError}</p> : null}
            </div>

            <Button type="submit" disabled={loading || !categoryId}>
              {loading ? "Consultando..." : `Consultar ${definition.code}`}
            </Button>
          </form>
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      {payload ? (
        <>
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
                        <span key={`program-${name}`} className="rounded-md border px-2 py-0.5 text-[11px]">
                          {name}
                        </span>
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
                        <span key={`semester-${name}`} className="rounded-md border px-2 py-0.5 text-[11px]">
                          {name}
                        </span>
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
                  {payload.summary.totalCourses} ({payload.summary.repeatedCourses} repetidos)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  Sin actividades: {payload.summary.noActivity} · No coincide categoría: {payload.summary.categoryMismatch}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Distribución de porcentaje</CardDescription>
                <CardTitle className="text-base">Rendimiento por rango</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  {payload.summary.totalCourses > 0 ? (
                    <div className="flex h-full w-full">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${(payload.summary.high / payload.summary.totalCourses) * 100}%` }}
                      />
                      <div
                        className="h-full bg-yellow-400"
                        style={{ width: `${(payload.summary.medium / payload.summary.totalCourses) * 100}%` }}
                      />
                      <div
                        className="h-full bg-red-500"
                        style={{ width: `${(payload.summary.low / payload.summary.totalCourses) * 100}%` }}
                      />
                      <div
                        className="h-full bg-black"
                        style={{ width: `${(payload.summary.noActivity / payload.summary.totalCourses) * 100}%` }}
                      />
                      <div
                        className="h-full bg-rose-700"
                        style={{ width: `${(payload.summary.categoryMismatch / payload.summary.totalCourses) * 100}%` }}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border bg-card p-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-muted-foreground">80-100</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold">{payload.summary.high} cursos</p>
                  </div>
                  <div className="rounded-md border bg-card p-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-yellow-400" />
                      <span className="text-muted-foreground">51-79</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold">{payload.summary.medium} cursos</p>
                  </div>
                  <div className="rounded-md border bg-card p-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      <span className="text-muted-foreground">0-50</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold">{payload.summary.low} cursos</p>
                  </div>
                  <div className="rounded-md border bg-card p-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-black" />
                      <span className="text-muted-foreground">Sin actividades</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold">{payload.summary.noActivity} cursos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resultado</CardTitle>
              <CardDescription>
                {definition.code} · {categories.find((item) => item.id === payload.categoryId)?.name ?? payload.categoryId}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ReportTableControls
                filters={(
                  <div className="grid gap-3 lg:grid-cols-4">
                    <div className="space-y-1 lg:col-span-2">
                      <Label htmlFor="searchTable">Buscar</Label>
                      <input
                        id="searchTable"
                        type="text"
                        value={searchText}
                        onChange={(event) => setSearchText(event.target.value)}
                        placeholder="Curso, docente, actividad, porcentaje..."
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="statusFilter">Filtro por estado</Label>
                      <select
                        id="statusFilter"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value as "all" | ReportStatus)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="all">Todos</option>
                        <option value={REPORT_STATUS.success}>{REPORT_STATUS.success}</option>
                        <option value={REPORT_STATUS.fails}>{REPORT_STATUS.fails}</option>
                        <option value={REPORT_STATUS.notApply}>{REPORT_STATUS.notApply}</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="percentFilter">Filtro porcentaje</Label>
                      <select
                        id="percentFilter"
                        value={percentFilter}
                        onChange={(event) => setPercentFilter(event.target.value as PercentFilter)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="all">Todos</option>
                        <option value="high">80-100</option>
                        <option value="medium">51-79</option>
                        <option value="low">0-50</option>
                        <option value="noActivity">Sin actividades</option>
                        <option value="mismatch">No coincide categoría</option>
                      </select>
                    </div>
                  </div>
                )}
                columns={
                  <>
                    <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Base</p>
                    {baseColumns.map((column) => (
                      <label key={column} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                        <input
                          type="checkbox"
                          checked={visibleBaseColumns[column]}
                          onChange={() => toggleBaseColumn(column)}
                        />
                        <span>{baseColumnLabels[column]}</span>
                      </label>
                    ))}

                    {payload.maxActivities > 0 ? (
                      <>
                        <p className="mt-2 px-2 py-1 text-xs font-medium text-muted-foreground">Actividades</p>
                        {Array.from({ length: payload.maxActivities }, (_, index) => index + 1).map((activityIndex) => (
                          <div key={`toggle-activity-${activityIndex}`} className="rounded-md border p-2">
                            <p className="mb-1 text-xs font-medium">Actividad {activityIndex}</p>
                            <label className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-accent">
                              <input
                                type="checkbox"
                                checked={visibleActivities[`a${activityIndex}-nombre`] ?? false}
                                onChange={() => toggleActivityColumn(`a${activityIndex}-nombre`)}
                              />
                              Nombre
                            </label>
                            <label className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-accent">
                              <input
                                type="checkbox"
                                checked={visibleActivities[`a${activityIndex}-calificacion`] ?? false}
                                onChange={() => toggleActivityColumn(`a${activityIndex}-calificacion`)}
                              />
                              Calificación
                            </label>
                            <label className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-accent">
                              <input
                                type="checkbox"
                                checked={visibleActivities[`a${activityIndex}-retro`] ?? false}
                                onChange={() => toggleActivityColumn(`a${activityIndex}-retro`)}
                              />
                              Retroalimentación
                            </label>
                          </div>
                        ))}
                      </>
                    ) : null}
                  </>
                }
                filteredCount={filteredResults.length}
                totalCount={payload.results.length}
                visibleCount={visibleCount}
                onResetFilters={resetFilters}
                onDownloadCsv={downloadCsv}
                disableDownload={filteredResults.length === 0 || visibleCount === 0}
              />

              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-475 text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      {visibleBaseColumns.fecha ? <th className="px-3 py-2 text-left font-medium">Fecha</th> : null}
                      {visibleBaseColumns.idUsuario ? <th className="px-3 py-2 text-left font-medium">ID usuario</th> : null}
                      {visibleBaseColumns.documento ? <th className="px-3 py-2 text-left font-medium">Documento</th> : null}
                      {visibleBaseColumns.programa ? <th className="px-3 py-2 text-left font-medium">Programa</th> : null}
                      {visibleBaseColumns.semestre ? <th className="px-3 py-2 text-left font-medium">Semestre</th> : null}
                      {visibleBaseColumns.grupo ? <th className="px-3 py-2 text-left font-medium">Grupo</th> : null}
                      {visibleBaseColumns.idCurso ? <th className="px-3 py-2 text-left font-medium">ID curso</th> : null}
                      {visibleBaseColumns.curso ? <th className="px-3 py-2 text-left font-medium">Curso</th> : null}
                      {visibleBaseColumns.codigo ? <th className="px-3 py-2 text-left font-medium">Código</th> : null}
                      {visibleBaseColumns.docentes ? <th className="px-3 py-2 text-left font-medium">Docentes</th> : null}

                      {Array.from({ length: payload.maxActivities }, (_, index) => index + 1).map((activityIndex) => (
                        <Fragment key={`h-group-${activityIndex}`}>
                          {visibleActivities[`a${activityIndex}-nombre`] ? (
                            <th key={`h-${activityIndex}-nombre`} className="px-3 py-2 text-left font-medium">
                              Nombre actividad {activityIndex}
                            </th>
                          ) : null}
                          {visibleActivities[`a${activityIndex}-calificacion`] ? (
                            <th key={`h-${activityIndex}-calificacion`} className="px-3 py-2 text-left font-medium">
                              Calificación {activityIndex}
                            </th>
                          ) : null}
                          {visibleActivities[`a${activityIndex}-retro`] ? (
                            <th key={`h-${activityIndex}-retro`} className="px-3 py-2 text-left font-medium">
                              Retroalimentación {activityIndex}
                            </th>
                          ) : null}
                        </Fragment>
                      ))}

                      {visibleBaseColumns.porcentaje ? <th className="px-3 py-2 text-left font-medium">%</th> : null}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredResults.length > 0 ? (
                      filteredResults.map((row) => (
                        <tr key={`${row.courseId}-${row.semester}`} className="border-t align-top">
                          {visibleBaseColumns.fecha ? <td className="px-3 py-2">{row.date}</td> : null}
                          {visibleBaseColumns.idUsuario ? <td className="px-3 py-2">{row.userIds || "-"}</td> : null}
                          {visibleBaseColumns.documento ? <td className="px-3 py-2">{row.userDoc || "-"}</td> : null}
                          {visibleBaseColumns.programa ? <td className="px-3 py-2">{row.program || "-"}</td> : null}
                          {visibleBaseColumns.semestre ? <td className="px-3 py-2">{row.semester || "-"}</td> : null}
                          {visibleBaseColumns.grupo ? <td className="px-3 py-2">{row.group || "-"}</td> : null}
                          {visibleBaseColumns.idCurso ? <td className="px-3 py-2">{row.courseId}</td> : null}
                          {visibleBaseColumns.curso ? <td className="px-3 py-2">{row.courseName}</td> : null}
                          {visibleBaseColumns.codigo ? <td className="px-3 py-2">{row.courseCode}</td> : null}
                          {visibleBaseColumns.docentes ? (
                            <td className="px-3 py-2 whitespace-pre-line">
                              <span className="font-medium">{row.teacherNames || "Sin docentes"}</span>
                              {row.teacherEmails ? (
                                <span className="block text-xs text-muted-foreground">{row.teacherEmails}</span>
                              ) : null}
                            </td>
                          ) : null}

                          {Array.from({ length: payload.maxActivities }, (_, index) => index + 1).map((activityIndex) => {
                            const activity = row.actividades[activityIndex - 1];

                            return (
                              <Fragment key={`r-group-${row.courseId}-${row.semester}-${activityIndex}`}>
                                {visibleActivities[`a${activityIndex}-nombre`] ? (
                                  <td key={`r-${row.courseId}-${activityIndex}-nombre`} className="px-3 py-2">
                                    {activity
                                      ? activity.name
                                      : row.porcentaje === -2
                                        ? "No coincide la categoría"
                                        : row.porcentaje === -1
                                          ? "Sin actividades"
                                          : ""}
                                  </td>
                                ) : null}

                                {visibleActivities[`a${activityIndex}-calificacion`] ? (
                                  <td key={`r-${row.courseId}-${activityIndex}-calificacion`} className="px-3 py-2">
                                    {activity ? (
                                      <span className={`rounded px-2 py-1 text-xs font-medium ${getStatusClass(activity.score)}`}>
                                        {activity.score}
                                      </span>
                                    ) : (
                                      ""
                                    )}
                                  </td>
                                ) : null}

                                {visibleActivities[`a${activityIndex}-retro`] ? (
                                  <td key={`r-${row.courseId}-${activityIndex}-retro`} className="px-3 py-2">
                                    {activity ? (
                                      <span className={`rounded px-2 py-1 text-xs font-medium ${getStatusClass(activity.feedback)}`}>
                                        {activity.feedback}
                                      </span>
                                    ) : (
                                      ""
                                    )}
                                  </td>
                                ) : null}
                              </Fragment>
                            );
                          })}

                          {visibleBaseColumns.porcentaje ? (
                            <td className="px-3 py-2">
                              <span className={`rounded px-2 py-1 text-xs font-semibold ${getPercentPillClass(row.porcentaje)}`}>
                                {getPercentTag(row.porcentaje)}
                              </span>
                            </td>
                          ) : null}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={Math.max(visibleCount, 1)} className="px-3 py-6 text-center text-sm text-muted-foreground">
                          No hay resultados para los filtros actuales.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </main>
  );
}
