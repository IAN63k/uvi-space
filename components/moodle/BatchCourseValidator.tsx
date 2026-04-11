"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Download,
  Layers,
  LayoutTemplate,
  BookOpen,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourseContentValidator } from "@/components/moodle/CourseContentValidator";
import type { BatchValidationResult, CourseContentValidationResult } from "@/lib/moodle/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterMode = "all" | "pass" | "fail";

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportCsv(results: CourseContentValidationResult[], categoryName: string) {
  const headers = [
    "ID",
    "Nombre",
    "Formato",
    "Secciones",
    "Sección presentación",
    "Estado",
    // DP01
    "DP01 Encontrado",
    "DP01 Visible",
    "DP01 Visible en página",
    "DP01 Tiene nombre",
    "DP01 Número ID",
    "DP01 Tiene contenido",
    // FC01
    "FC01 Encontrado",
    "FC01 Visible",
    "FC01 Visible en página",
    "FC01 Número ID",
    "FC01 Tipo de foro",
    // MS Meeting
    "Reunión encontrada",
    "Reunión visible",
    "Reunión visible usuario",
    "Reunión visible en página",
    "Reunión tipo",
    // Attendance
    "Asistencia encontrada",
    "Asistencia visible",
    "Asistencia visible usuario",
    "Asistencia visible en página",
    // Gradebook — árbol
    "EFC1 nombre existe",
    "EFC1 sin ítems",
    "EFC2 nombre existe",
    "EFC2 sin ítems",
    "EFC3 nombre existe",
    "EFC3 sin ítems",
    // Gradebook — idnumbers
    "Libro EFC01",
    "Libro EFC02",
    "Libro EFC03",
    "Libro categorías sin ID",
    // Section dates
    "Secciones activas",
    "Secciones con fechas OK",
    "Secciones con fechas faltantes",
    // Blocks
    "Bloque badges",
    "Bloque completion_progress",
    "Bloque dedication",
    "Bloque online_users",
    "Bloque completionstatus",
    // Microcurriculum
    "Microcurrículo encontrado",
    "Microcurrículo visible",
    "Microcurrículo visible usuario",
    "Microcurrículo visible en página",
    "Microcurrículo tiene documento",
    "Microcurrículo URL",
  ];

  const escape = (v: string | number | boolean | null | undefined) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const rows = results.map((r) => {
    const p  = r.professorPage.checks;
    const f  = r.consultationForum.checks;
    const m  = r.meeting.checks;
    const at = r.attendance.checks;
    const mc = r.microcurriculum.checks;
    return [
      r.courseId,
      r.courseName,
      r.courseFormat,
      r.totalSections,
      r.presentationSection,
      r.passed ? "Cumple" : "No cumple",
      // DP01
      r.professorPage.found ? "Sí" : "No",
      p.visible.passed ? "OK" : String(p.visible.actual),
      p.visibleOnCoursePage.passed ? "OK" : String(p.visibleOnCoursePage.actual),
      p.hasName.passed ? "OK" : String(p.hasName.actual),
      p.idnumber.passed ? "OK" : String(p.idnumber.actual),
      p.hasContent.passed ? "OK" : String(p.hasContent.actual),
      // FC01
      r.consultationForum.found ? "Sí" : "No",
      f.visible.passed ? "OK" : String(f.visible.actual),
      f.visibleOnCoursePage.passed ? "OK" : String(f.visibleOnCoursePage.actual),
      f.idnumber.passed ? "OK" : String(f.idnumber.actual),
      f.forumType.passed ? "OK" : String(f.forumType.actual),
      // MS Meeting
      r.meeting.found ? "Sí" : "No",
      m.visible.passed ? "OK" : String(m.visible.actual),
      m.userVisible.passed ? "OK" : String(m.userVisible.actual),
      m.visibleOnCoursePage.passed ? "OK" : String(m.visibleOnCoursePage.actual),
      m.modplural.passed ? "OK" : String(m.modplural.actual),
      // Gradebook — árbol
      r.gradebook.categories[0]?.exists.passed        ? "OK" : "Ausente",
      r.gradebook.categories[0]?.emptyChildren.passed ? "OK" : String(r.gradebook.categories[0]?.emptyChildren.actual ?? "—"),
      r.gradebook.categories[1]?.exists.passed        ? "OK" : "Ausente",
      r.gradebook.categories[1]?.emptyChildren.passed ? "OK" : String(r.gradebook.categories[1]?.emptyChildren.actual ?? "—"),
      r.gradebook.categories[2]?.exists.passed        ? "OK" : "Ausente",
      r.gradebook.categories[2]?.emptyChildren.passed ? "OK" : String(r.gradebook.categories[2]?.emptyChildren.actual ?? "—"),
      // Gradebook — idnumbers
      r.gradebook.efcChecks["EFC01"]?.passed ? "OK" : "Ausente",
      r.gradebook.efcChecks["EFC02"]?.passed ? "OK" : "Ausente",
      r.gradebook.efcChecks["EFC03"]?.passed ? "OK" : "Ausente",
      r.gradebook.categoryItems.filter(i => !i.hasIdnumber.passed).length || "—",
      // Section dates
      r.sectionDates.sections.length,
      r.sectionDates.sections.filter((s) => s.passed).length,
      r.sectionDates.sections.filter((s) => !s.passed).map((s) => `§${s.sectionNumber}`).join("; ") || "—",
      // Blocks
      r.blocks.checks["badges"]?.passed ? "OK" : "Ausente",
      r.blocks.checks["completion_progress"]?.passed ? "OK" : "Ausente",
      r.blocks.checks["dedication"]?.passed ? "OK" : "Ausente",
      r.blocks.checks["online_users"]?.passed ? "OK" : "Ausente",
      r.blocks.checks["completionstatus"]?.passed ? "OK" : "Ausente",
      // Attendance
      r.attendance.found ? "Sí" : "No",
      at.visible.passed ? "OK" : String(at.visible.actual),
      at.userVisible.passed ? "OK" : String(at.userVisible.actual),
      at.visibleOnCoursePage.passed ? "OK" : String(at.visibleOnCoursePage.actual),
      // Microcurriculum
      r.microcurriculum.found ? "Sí" : "No",
      mc.visible.passed ? "OK" : String(mc.visible.actual),
      mc.userVisible.passed ? "OK" : String(mc.userVisible.actual),
      mc.visibleOnCoursePage.passed ? "OK" : String(mc.visibleOnCoursePage.actual),
      mc.hasDocument.passed ? "OK" : String(mc.hasDocument.actual),
      r.microcurriculum.fileUrl ?? "",
    ].map(escape).join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `batch-contenido-${categoryName.toLowerCase().replace(/\s+/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Summary Stat Card ─────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color?: "emerald" | "rose" | "default";
}) {
  const colorMap = {
    emerald: "border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/30",
    rose:    "border-rose-200 bg-rose-50 dark:border-rose-800/60 dark:bg-rose-950/30",
    default: "border-border bg-muted/20",
  };
  const iconColorMap = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    rose:    "text-rose-600 dark:text-rose-400",
    default: "text-muted-foreground",
  };
  const valueColorMap = {
    emerald: "text-emerald-700 dark:text-emerald-300",
    rose:    "text-rose-700 dark:text-rose-300",
    default: "text-foreground",
  };
  const c = color ?? "default";

  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-xs ${colorMap[c]}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-background/60 shadow-sm">
        <Icon className={`h-4 w-4 ${iconColorMap[c]}`} />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className={`mt-0.5 text-2xl font-bold tabular-nums leading-none tracking-tight ${valueColorMap[c]}`}>{value}</p>
      </div>
    </div>
  );
}

// ── Table Row ─────────────────────────────────────────────────────────────────

function CourseRow({
  result,
  expanded,
  onToggle,
}: {
  result: CourseContentValidationResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const passedChecks = Object.values(result.professorPage.checks).filter((c) => c.passed).length;
  const totalChecks  = Object.values(result.professorPage.checks).length;

  return (
    <>
      {/* Main row */}
      <tr
        className={`group border-b transition-colors last:border-b-0 hover:bg-muted/30 ${
          expanded ? "bg-muted/20" : ""
        }`}
      >
        {/* Status indicator */}
        <td className="w-1 p-0">
          <div className={`h-full w-1 rounded-l-sm ${result.passed ? "bg-emerald-500" : "bg-rose-500"}`} />
        </td>

        {/* ID */}
        <td className="px-4 py-3">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            #{result.courseId}
          </code>
        </td>

        {/* Name */}
        <td className="px-3 py-3">
          <span className="line-clamp-1 text-sm font-medium">{result.courseName}</span>
        </td>

        {/* Format */}
        <td className="px-3 py-3">
          <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
            <LayoutTemplate className="h-3 w-3 shrink-0" />
            {result.courseFormat}
          </span>
        </td>

        {/* Sections */}
        <td className="px-3 py-3 text-center">
          <span className="flex items-center justify-center gap-1 text-xs tabular-nums text-muted-foreground">
            <Layers className="h-3 w-3" />
            {result.totalSections}
          </span>
        </td>

        {/* Checks mini-bar */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {Object.values(result.professorPage.checks).map((check, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${check.passed ? "bg-emerald-500" : "bg-rose-500"}`}
                  title={check.label}
                />
              ))}
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {passedChecks}/{totalChecks}
            </span>
          </div>
        </td>

        {/* Status badge */}
        <td className="px-3 py-3">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            result.passed
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
          }`}>
            {result.passed
              ? <CheckCircle2 className="h-3 w-3" />
              : <XCircle className="h-3 w-3" />
            }
            {result.passed ? "Cumple" : "No cumple"}
          </span>
        </td>

        {/* Expand button */}
        <td className="px-3 py-3">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-medium shadow-xs transition-all hover:border-primary/40 hover:bg-accent active:scale-95"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {expanded ? "Ocultar" : "Detalle"}
          </button>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="border-b bg-muted/10">
          <td colSpan={8} className="px-6 py-5">
            <div className="rounded-xl border bg-background p-4 shadow-xs">
              <CourseContentValidator result={result} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export interface BatchCourseValidatorProps {
  result: BatchValidationResult;
}

export function BatchCourseValidator({ result }: BatchCourseValidatorProps) {
  const [filter, setFilter]           = useState<FilterMode>("all");
  const [expandedId, setExpandedId]   = useState<number | null>(null);

  const pct = result.totalCourses > 0
    ? Math.round((result.passed / result.totalCourses) * 100)
    : 0;

  const filteredResults = result.results.filter((r) => {
    if (filter === "pass") return r.passed;
    if (filter === "fail") return !r.passed;
    return true;
  });

  const toggleRow = (id: number) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const filterOptions: { key: FilterMode; label: string; count: number }[] = [
    { key: "all",  label: "Todos",     count: result.totalCourses },
    { key: "pass", label: "Cumple",    count: result.passed },
    { key: "fail", label: "No cumple", count: result.failed },
  ];

  return (
    <div className="space-y-5">
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard icon={BookOpen}   label="Total cursos"     value={result.totalCourses} />
        <SummaryCard icon={CheckCircle2} label="Cumplen"        value={result.passed}  color="emerald" />
        <SummaryCard icon={XCircle}    label="No cumplen"       value={result.failed}  color="rose" />
        <SummaryCard icon={BarChart3}  label="Cumplimiento"     value={`${pct}%`}      color={pct >= 80 ? "emerald" : pct >= 50 ? "default" : "rose"} />
      </div>

      {/* ── Table header: filters + export ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filter pills */}
        <div className="flex items-center gap-1 rounded-xl border bg-muted/20 p-1">
          {filterOptions.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                filter === key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                filter === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Execution time */}
          <span className="text-[11px] text-muted-foreground">
            {(result.executionTimeMs / 1000).toFixed(1)}s
          </span>
          {/* CSV export */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-2 text-xs"
            onClick={() => exportCsv(result.results, result.categoryName)}
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* ── Results table ── */}
      <div className="overflow-hidden rounded-2xl border shadow-sm">
        {filteredResults.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            <p className="text-sm text-muted-foreground">
              No hay cursos que coincidan con el filtro seleccionado.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="w-1 p-0" />
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">ID</th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Nombre</th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Formato</th>
                  <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Secciones</th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Checks</th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Estado</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r) => (
                  <CourseRow
                    key={r.courseId}
                    result={r}
                    expanded={expandedId === r.courseId}
                    onToggle={() => toggleRow(r.courseId)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Mostrando <span className="font-semibold tabular-nums text-foreground">{filteredResults.length}</span> de{" "}
          <span className="font-semibold tabular-nums text-foreground">{result.totalCourses}</span> cursos
        </span>
        <span className="font-mono">
          Categoría: <span className="text-foreground">{result.categoryName}</span>
        </span>
      </div>
    </div>
  );
}
