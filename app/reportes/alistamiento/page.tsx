"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { loadEncryptedDbConfig } from "@/lib/encrypted-local-storage";

type Status = "CUMPLE" | "NO CUMPLE" | "NO APLICA" | "NO EXISTE";

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
  categoryId: number;
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

type Category = {
  id: number;
  name: string;
  courseCount: number;
};

type ColumnKey =
  | "fecha"
  | "idUsuario"
  | "documento"
  | "programa"
  | "semestre"
  | "idCurso"
  | "curso"
  | "codigo"
  | "docentes"
  | "nombreProfesor"
  | "correo"
  | "horario"
  | "fotografia"
  | "foroConsulta"
  | "unidades"
  | "efc01Act"
  | "efc01Pond"
  | "efc02Act"
  | "efc02Pond"
  | "efc03Act"
  | "efc03Pond"
  | "porcentaje";

const columnLabels: Record<ColumnKey, string> = {
  fecha: "Fecha",
  idUsuario: "ID Usuario",
  documento: "Documento",
  programa: "Programa",
  semestre: "Semestre",
  idCurso: "ID Curso",
  curso: "Curso",
  codigo: "Código",
  docentes: "Docentes",
  nombreProfesor: "Nombre profesor",
  correo: "Correo",
  horario: "Horario",
  fotografia: "Foto",
  foroConsulta: "Foro consulta",
  unidades: "Unidades (1-8)",
  efc01Act: "EFC01 Act.",
  efc01Pond: "EFC01 Pond.",
  efc02Act: "EFC02 Act.",
  efc02Pond: "EFC02 Pond.",
  efc03Act: "EFC03 Act.",
  efc03Pond: "EFC03 Pond.",
  porcentaje: "%",
};

const allColumns: ColumnKey[] = [
  "fecha",
  "idUsuario",
  "documento",
  "programa",
  "semestre",
  "idCurso",
  "curso",
  "codigo",
  "docentes",
  "nombreProfesor",
  "correo",
  "horario",
  "fotografia",
  "foroConsulta",
  "unidades",
  "efc01Act",
  "efc01Pond",
  "efc02Act",
  "efc02Pond",
  "efc03Act",
  "efc03Pond",
  "porcentaje",
];

export default function AlistamientoPage() {
  const [categoryId, setCategoryId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [photoValidationTexts, setPhotoValidationTexts] = useState<string[]>([
    "https://www.uniajc.edu.co/wp-content/uploads/2023/07/foto-de-profesor230-x-939.gif",
  ]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);  
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ApiResponse | null>(null);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [percentFilter, setPercentFilter] = useState<"all" | "high" | "medium" | "low" | "noActivity">("all");
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    fecha: false,
    idUsuario: false,
    documento: false,
    programa: true,
    semestre: true,
    idCurso: true,
    curso: true,
    codigo: true,
    docentes: true,
    nombreProfesor: true,
    correo: true,
    horario: true,
    fotografia: true,
    foroConsulta: true,
    unidades: true,
    efc01Act: true,
    efc01Pond: true,
    efc02Act: true,
    efc02Pond: true,
    efc03Act: true,
    efc03Pond: true,
    porcentaje: true,
  });

  const updatePhotoValidationText = (index: number, value: string) => {
    setPhotoValidationTexts((prev) => prev.map((item, itemIndex) => (itemIndex === index ? value : item)));
  };

  const addPhotoValidationText = () => {
    setPhotoValidationTexts((prev) => [...prev, ""]);
  };

  const removePhotoValidationText = (index: number) => {
    setPhotoValidationTexts((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const hasResults = useMemo(() => (payload?.results.length ?? 0) > 0, [payload]);

  const filteredResults = useMemo(() => {
    const results = payload?.results ?? [];
    const query = searchText.trim().toLowerCase();

    return results.filter((row) => {
      if (query) {
        const haystack = [
          row.date,
          row.userIds,
          row.userDoc,
          row.program,
          row.semester,
          row.courseName,
          row.courseCode,
          row.teacherNames,
          row.teacherEmails,
          String(row.courseId),
          String(row.porcentaje),
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) {
          return false;
        }
      }

      if (statusFilter !== "all") {
        const statusCells: Status[] = [
          row.nombreProfesor,
          row.correoProfesor,
          row.horarioAtencion,
          row.fotografia,
          row.foroConsulta,
          row.efc01Actividades,
          row.efc01Ponderaciones,
          row.efc02Actividades,
          row.efc02Ponderaciones,
          row.efc03Actividades,
          row.efc03Ponderaciones,
          ...row.unidades,
        ];

        if (!statusCells.includes(statusFilter)) {
          return false;
        }
      }

      if (percentFilter !== "all") {
        if (percentFilter === "high" && !(row.porcentaje >= 80 && row.porcentaje <= 100)) {
          return false;
        }
        if (percentFilter === "medium" && !(row.porcentaje >= 51 && row.porcentaje <= 79)) {
          return false;
        }
        if (percentFilter === "low" && !(row.porcentaje >= 1 && row.porcentaje <= 50)) {
          return false;
        }
        if (percentFilter === "noActivity" && row.porcentaje !== 0) {
          return false;
        }
      }

      return true;
    });
  }, [payload?.results, searchText, statusFilter, percentFilter]);

  const visibleColumnCount = useMemo(
    () => Object.values(visibleColumns).filter(Boolean).length,
    [visibleColumns],
  );

  const getStatusClass = (status: Status) => {
    if (status === "CUMPLE") {
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
    }
    if (status === "NO APLICA") {
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    }
    if (status === "NO EXISTE") {
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    }
    return "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300";
  };

  const toggleColumn = (column: ColumnKey) => {
    setVisibleColumns((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  const resetFilters = () => {
    setSearchText("");
    setStatusFilter("all");
    setPercentFilter("all");
  };

  const downloadCsv = () => {
    if (filteredResults.length === 0) {
      return;
    }

    const activeColumns = allColumns.filter((column) => visibleColumns[column]);
    if (activeColumns.length === 0) {
      return;
    }

    const escapeCsv = (value: string | number) => {
      const str = String(value ?? "");
      const escaped = str.replaceAll('"', '""');
      return `"${escaped}"`;
    };

    const toCell = (row: AlistamientoResult, column: ColumnKey) => {
      switch (column) {
        case "fecha":
          return row.date;
        case "idUsuario":
          return row.userIds;
        case "documento":
          return row.userDoc;
        case "programa":
          return row.program;
        case "semestre":
          return row.semester;
        case "idCurso":
          return row.courseId;
        case "curso":
          return row.courseName;
        case "codigo":
          return row.courseCode;
        case "docentes":
          return `${row.teacherNames}${row.teacherEmails ? ` | ${row.teacherEmails}` : ""}`;
        case "nombreProfesor":
          return row.nombreProfesor;
        case "correo":
          return row.correoProfesor;
        case "horario":
          return row.horarioAtencion;
        case "fotografia":
          return row.fotografia;
        case "foroConsulta":
          return row.foroConsulta;
        case "unidades":
          return row.unidades.map((status, index) => `U${index + 1}:${status}`).join(" | ");
        case "efc01Act":
          return row.efc01Actividades;
        case "efc01Pond":
          return row.efc01Ponderaciones;
        case "efc02Act":
          return row.efc02Actividades;
        case "efc02Pond":
          return row.efc02Ponderaciones;
        case "efc03Act":
          return row.efc03Actividades;
        case "efc03Pond":
          return row.efc03Ponderaciones;
        case "porcentaje":
          return `${row.porcentaje}%`;
      }
    };

    const header = activeColumns.map((column) => escapeCsv(columnLabels[column])).join(",");
    const lines = filteredResults.map((row) =>
      activeColumns.map((column) => escapeCsv(toCell(row, column))).join(","),
    );
    const csv = [header, ...lines].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const categoryName = categories.find((c) => c.id === payload?.categoryId)?.name ?? "categoria";
    const safeCategoryName = categoryName.toLowerCase().replaceAll(/[^a-z0-9]+/gi, "-");
    link.href = url;
    link.download = `alistamiento-${safeCategoryName}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Load categories on mount if DB config is available
  useEffect(() => {
    async function loadCategories() {
      const dbConfig = await loadEncryptedDbConfig();
      if (!dbConfig) return;

      setCategoriesLoading(true);
      setCategoriesError(null);
      try {
        const res = await fetch("/api/categorias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dbConfig }),
        });
        const data = (await res.json()) as { categories?: Category[]; message?: string };
        if (!res.ok) throw new Error(data.message ?? "Error cargando categorías");
        setCategories(data.categories ?? []);
      } catch (err) {
        setCategoriesError(err instanceof Error ? err.message : "Error inesperado");
      } finally {
        setCategoriesLoading(false);
      }
    }
    void loadCategories();
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const dbConfig = await loadEncryptedDbConfig();

      if (!dbConfig) {
        setError(
          "No hay configuración BD guardada. Ve a Configuración > Base de datos y guarda las credenciales.",
        );
        setPayload(null);
        return;
      }

      const cleanPhotoValidationTexts = photoValidationTexts
        .map((item) => item.trim())
        .filter(Boolean);

      const response = await fetch("/api/reportes/alistamiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: Number(categoryId),
          roleId: 3,
          photoValidationTexts: cleanPhotoValidationTexts,
          dbConfig,
        }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(data.message ?? "Error consultando alistamiento");
      }

      setPayload(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 md:px-8">
      <header className="space-y-2">
        <Badge variant="secondary">Reporte conectado</Badge>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Alistamiento</h1>
          <Button type="button" variant="outline" onClick={() => setSettingsOpen(true)}>
            Ajustes
          </Button>
        </div>
        <p className="text-muted-foreground">
          Categoría principal → programas → semestres → validación completa por curso.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Seleccionar categoría</CardTitle>
          <CardDescription>
            Las categorías se cargan directamente desde <code>mdl_course_categories</code>.
            Si no aparecen, revisa la{" "}
            <Link href="/configuracion/bd" className="underline underline-offset-2">
              configuración de BD
            </Link>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
            <div className="w-full space-y-2 sm:max-w-80">
              <Label htmlFor="categoryId">Categoría Moodle</Label>
              {/* eslint-disable-next-line jsx-a11y/no-onchange */}
              <select
                id="categoryId"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                disabled={loading || categoriesLoading}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">
                  {categoriesLoading
                    ? "Cargando categorías..."
                    : categories.length === 0
                      ? "Sin conexión — configura la BD"
                      : "Selecciona una categoría"}
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>
                    {cat.name}{cat.courseCount > 0 ? ` (${cat.courseCount} cursos)` : ""}
                  </option>
                ))}
              </select>
              {categoriesError ? (
                <p className="text-xs text-destructive">{categoriesError}</p>
              ) : null}
            </div>
            <Button type="submit" disabled={loading || !categoryId}>
              {loading ? "Consultando..." : "Consultar alistamiento"}
            </Button>
          </form>
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

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
              Si el texto ingresado aparece en la página de presentación, la validación de foto queda en NO CUMPLE.
            </p>
          </div>

          <div className="space-y-2">
            {photoValidationTexts.map((value, index) => (
              <div key={`photo-validation-${index}`} className="flex items-center gap-2">
                <input
                  value={value}
                  onChange={(event) => updatePhotoValidationText(index, event.target.value)}
                  placeholder="Texto de validación"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {index > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePhotoValidationText(index)}
                    aria-label={`Eliminar campo ${index + 1}`}
                    title="Eliminar"
                  >
                    <Trash2 />
                  </Button>
                ) : null}
                {index === photoValidationTexts.length - 1 ? (
                  <Button type="button" variant="outline" onClick={addPhotoValidationText}>
                    +
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </aside>

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
                    <p className="text-muted-foreground">
                      {payload.summary.totalCourses > 0
                        ? Math.round((payload.summary.high / payload.summary.totalCourses) * 100)
                        : 0}%
                    </p>
                  </div>

                  <div className="rounded-md border bg-card p-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-yellow-400" />
                      <span className="text-muted-foreground">51-79</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold">{payload.summary.medium} cursos</p>
                    <p className="text-muted-foreground">
                      {payload.summary.totalCourses > 0
                        ? Math.round((payload.summary.medium / payload.summary.totalCourses) * 100)
                        : 0}%
                    </p>
                  </div>

                  <div className="rounded-md border bg-card p-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      <span className="text-muted-foreground">1-50</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold">{payload.summary.low} cursos</p>
                    <p className="text-muted-foreground">
                      {payload.summary.totalCourses > 0
                        ? Math.round((payload.summary.low / payload.summary.totalCourses) * 100)
                        : 0}%
                    </p>
                  </div>

                  <div className="rounded-md border bg-card p-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-black" />
                      <span className="text-muted-foreground">0</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold">{payload.summary.noActivity} cursos</p>
                    <p className="text-muted-foreground">
                      {payload.summary.totalCourses > 0
                        ? Math.round((payload.summary.noActivity / payload.summary.totalCourses) * 100)
                        : 0}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resultado</CardTitle>
              <CardDescription>
                Categoría {categories.find((c) => c.id === payload.categoryId)?.name ?? payload.categoryId} · {payload.totalCourses} cursos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasResults ? (
                <p className="text-sm text-muted-foreground">
                  No se encontraron cursos para la categoría consultada.
                </p>
              ) : (
                <>
                  <div className="rounded-lg border p-3">
                    <div className="grid gap-3 lg:grid-cols-4">
                      <div className="space-y-1 lg:col-span-2">
                        <Label htmlFor="searchTable">Buscar</Label>
                        <input
                          id="searchTable"
                          type="text"
                          value={searchText}
                          onChange={(event) => setSearchText(event.target.value)}
                          placeholder="Curso, programa, docente, código..."
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="statusFilter">Filtro por estado</Label>
                        {/* eslint-disable-next-line jsx-a11y/no-onchange */}
                        <select
                          id="statusFilter"
                          value={statusFilter}
                          onChange={(event) => setStatusFilter(event.target.value as "all" | Status)}
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
                        <Label htmlFor="percentFilter">Filtro porcentaje</Label>
                        {/* eslint-disable-next-line jsx-a11y/no-onchange */}
                        <select
                          id="percentFilter"
                          value={percentFilter}
                          onChange={(event) => setPercentFilter(event.target.value as "all" | "high" | "medium" | "low" | "noActivity")}
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

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        Mostrando {filteredResults.length} de {payload.results.length} cursos · {visibleColumnCount} columnas visibles
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <details className="relative">
                          <summary className="cursor-pointer rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground">
                            Ocultar/mostrar columnas
                          </summary>
                          <div className="absolute right-0 z-20 mt-2 max-h-80 w-64 overflow-auto rounded-md border bg-popover p-2 shadow-lg">
                            {allColumns.map((column) => (
                              <label key={column} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                                <input
                                  type="checkbox"
                                  checked={visibleColumns[column]}
                                  onChange={() => toggleColumn(column)}
                                />
                                <span>{columnLabels[column]}</span>
                              </label>
                            ))}
                          </div>
                        </details>

                        <Button type="button" variant="outline" onClick={resetFilters}>
                          Limpiar filtros
                        </Button>
                        <Button type="button" onClick={downloadCsv} disabled={filteredResults.length === 0 || visibleColumnCount === 0}>
                          Descargar CSV
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border">
                    <table className="min-w-475 text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        {visibleColumns.fecha ? <th className="px-3 py-2 text-left font-medium">Fecha</th> : null}
                        {visibleColumns.idUsuario ? <th className="px-3 py-2 text-left font-medium">ID Usuario</th> : null}
                        {visibleColumns.documento ? <th className="px-3 py-2 text-left font-medium">Documento</th> : null}
                        {visibleColumns.programa ? <th className="px-3 py-2 text-left font-medium">Programa</th> : null}
                        {visibleColumns.semestre ? <th className="px-3 py-2 text-left font-medium">Semestre</th> : null}
                        {visibleColumns.idCurso ? <th className="px-3 py-2 text-left font-medium">ID Curso</th> : null}
                        {visibleColumns.curso ? <th className="px-3 py-2 text-left font-medium">Curso</th> : null}
                        {visibleColumns.codigo ? <th className="px-3 py-2 text-left font-medium">Código</th> : null}
                        {visibleColumns.docentes ? <th className="px-3 py-2 text-left font-medium">Docentes</th> : null}
                        {visibleColumns.nombreProfesor ? <th className="px-3 py-2 text-left font-medium">Nombre profesor</th> : null}
                        {visibleColumns.correo ? <th className="px-3 py-2 text-left font-medium">Correo</th> : null}
                        {visibleColumns.horario ? <th className="px-3 py-2 text-left font-medium">Horario</th> : null}
                        {visibleColumns.fotografia ? <th className="px-3 py-2 text-left font-medium">Foto</th> : null}
                        {visibleColumns.foroConsulta ? <th className="px-3 py-2 text-left font-medium">Foro consulta</th> : null}
                        {visibleColumns.unidades ? <th className="px-3 py-2 text-left font-medium">Unidades (1-8)</th> : null}
                        {visibleColumns.efc01Act ? <th className="px-3 py-2 text-left font-medium">EFC01 Act.</th> : null}
                        {visibleColumns.efc01Pond ? <th className="px-3 py-2 text-left font-medium">EFC01 Pond.</th> : null}
                        {visibleColumns.efc02Act ? <th className="px-3 py-2 text-left font-medium">EFC02 Act.</th> : null}
                        {visibleColumns.efc02Pond ? <th className="px-3 py-2 text-left font-medium">EFC02 Pond.</th> : null}
                        {visibleColumns.efc03Act ? <th className="px-3 py-2 text-left font-medium">EFC03 Act.</th> : null}
                        {visibleColumns.efc03Pond ? <th className="px-3 py-2 text-left font-medium">EFC03 Pond.</th> : null}
                        {visibleColumns.porcentaje ? <th className="px-3 py-2 text-left font-medium">%</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map((item) => (
                        <tr key={`${item.courseId}-${item.semester}`} className="border-t align-top">
                          {visibleColumns.fecha ? <td className="px-3 py-2">{item.date}</td> : null}
                          {visibleColumns.idUsuario ? <td className="px-3 py-2">{item.userIds}</td> : null}
                          {visibleColumns.documento ? <td className="px-3 py-2">{item.userDoc}</td> : null}
                          {visibleColumns.programa ? <td className="px-3 py-2">{item.program}</td> : null}
                          {visibleColumns.semestre ? <td className="px-3 py-2">{item.semester}</td> : null}
                          {visibleColumns.idCurso ? <td className="px-3 py-2">{item.courseId}</td> : null}
                          {visibleColumns.curso ? <td className="px-3 py-2">{item.courseName}</td> : null}
                          {visibleColumns.codigo ? <td className="px-3 py-2">{item.courseCode}</td> : null}
                          {visibleColumns.docentes ? (
                            <td className="px-3 py-2 whitespace-pre-line">
                              <span className="font-medium">{item.teacherNames || "Sin docentes"}</span>
                              {item.teacherEmails ? (
                                <span className="block text-xs text-muted-foreground">{item.teacherEmails}</span>
                              ) : null}
                            </td>
                          ) : null}
                          {visibleColumns.nombreProfesor ? <td className="px-3 py-2"><span className={`rounded px-2 py-1 text-xs font-medium ${getStatusClass(item.nombreProfesor)}`}>{item.nombreProfesor}</span></td> : null}
                          {visibleColumns.correo ? <td className="px-3 py-2"><span className={`rounded px-2 py-1 text-xs font-medium ${getStatusClass(item.correoProfesor)}`}>{item.correoProfesor}</span></td> : null}
                          {visibleColumns.horario ? <td className="px-3 py-2"><span className={`rounded px-2 py-1 text-xs font-medium ${getStatusClass(item.horarioAtencion)}`}>{item.horarioAtencion}</span></td> : null}
                          {visibleColumns.fotografia ? <td className="px-3 py-2"><span className={`rounded px-2 py-1 text-xs font-medium ${getStatusClass(item.fotografia)}`}>{item.fotografia}</span></td> : null}
                          {visibleColumns.foroConsulta ? <td className="px-3 py-2"><span className={`rounded px-2 py-1 text-xs font-medium ${getStatusClass(item.foroConsulta)}`}>{item.foroConsulta}</span></td> : null}
                          {visibleColumns.unidades ? (
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                {item.unidades.map((status, index) => (
                                  <span key={`${item.courseId}-u-${index + 1}`} className={`rounded px-2 py-0.5 text-[11px] font-medium ${getStatusClass(status)}`}>
                                    U{index + 1}
                                  </span>
                                ))}
                              </div>
                            </td>
                          ) : null}
                          {visibleColumns.efc01Act ? <td className="px-3 py-2"><span className={`rounded px-2 py-1 text-xs font-medium ${getStatusClass(item.efc01Actividades)}`}>{item.efc01Actividades}</span></td> : null}
                          {visibleColumns.efc01Pond ? <td className="px-3 py-2"><span className={`rounded px-2 py-1 text-xs font-medium ${getStatusClass(item.efc01Ponderaciones)}`}>{item.efc01Ponderaciones}</span></td> : null}
                          {visibleColumns.efc02Act ? <td className="px-3 py-2"><span className={`rounded px-2 py-1 text-xs font-medium ${getStatusClass(item.efc02Actividades)}`}>{item.efc02Actividades}</span></td> : null}
                          {visibleColumns.efc02Pond ? <td className="px-3 py-2"><span className={`rounded px-2 py-1 text-xs font-medium ${getStatusClass(item.efc02Ponderaciones)}`}>{item.efc02Ponderaciones}</span></td> : null}
                          {visibleColumns.efc03Act ? <td className="px-3 py-2"><span className={`rounded px-2 py-1 text-xs font-medium ${getStatusClass(item.efc03Actividades)}`}>{item.efc03Actividades}</span></td> : null}
                          {visibleColumns.efc03Pond ? <td className="px-3 py-2"><span className={`rounded px-2 py-1 text-xs font-medium ${getStatusClass(item.efc03Ponderaciones)}`}>{item.efc03Ponderaciones}</span></td> : null}
                          {visibleColumns.porcentaje ? <td className="px-3 py-2 font-semibold">{item.porcentaje}%</td> : null}
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
      ) : null}

    </main>
  );
}