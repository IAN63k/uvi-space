"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, XCircle, ChevronRight, ChevronDown, Folder, BookOpen,
  X, Settings2, ExternalLink, AlertTriangle,
} from "lucide-react";

import { ReportTableControls } from "@/components/report-table-controls";
import { SettingsSidebar } from "@/components/settings-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { loadEncryptedJson, loadMoodleConfig } from "@/lib/encrypted-local-storage";
import {
  API_FUNCTIONS,
  buildDefaultRulesConfig,
  buildValidationRules,
  getFieldLabelFromRules,
  localStorageKey,
  type RulesConfig,
} from "@/lib/moodle/rules";
import type { CategoryNode, CourseValidationResult, CourseSummary, RevisionCursosResponse } from "@/lib/moodle/types";

// ── Column types ─────────────────────────────────────────────────────────────

type ColumnKey = "id" | "shortname" | "fullname" | "idnumber" | "categoria" | "estado" | "errores" | "formato" | "visible" | "completitud" | "maxbytes" | "idioma";

const columnLabels: Record<ColumnKey, string> = {
  id: "ID",
  shortname: "Código",
  fullname: "Nombre completo",
  idnumber: "ID Number",
  categoria: "Categoría",
  estado: "Estado",
  errores: "Errores",
  formato: "Formato",
  visible: "Visible",
  completitud: "Completitud",
  maxbytes: "Max. bytes",
  idioma: "Idioma",
};

const allColumns: ColumnKey[] = ["id", "shortname", "fullname", "idnumber", "categoria", "estado", "errores", "formato", "visible", "completitud", "maxbytes", "idioma"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return "—";
  return new Date(timestamp * 1000).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

function formatSummaryFormat(v: number): string {
  const map: Record<number, string> = { 0: "Moodle", 1: "HTML", 2: "Texto plano", 4: "Markdown" };
  return map[v] ?? String(v);
}

function formatGroupMode(v: number): string {
  const map: Record<number, string> = { 0: "Sin grupos", 1: "Grupos separados", 2: "Grupos visibles" };
  return map[v] ?? String(v);
}

/** Devuelve el label español de un campo (prioriza el registro de reglas) */
function getFieldLabel(field: string): string {
  return getFieldLabelFromRules(field);
}

function formatValue(field: string, value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") return '""';

  // Normalizar boolean a número para campos que Moodle devuelve indistintamente como bool/int
  const normalized = value === true ? 1 : value === false ? 0 : value;

  // Campos de existencia: tanto esperado (boolean true/false) como actual (valor vacío/número)
  if (field === "shortname_exists" || field === "idnumber_exists" || field === "startdate_exists" || field === "enddate_exists") {
    return normalized ? "Requerido" : "No requerido";
  }

  if (field === "maxbytes" && typeof normalized === "number") return formatBytes(normalized);
  if (field === "visible" || field === "enablecompletion" || field === "groupmodeforce" || field === "completionnotify") {
    return normalized === 1 ? "Activado" : "Desactivado";
  }
  if (field === "showgrades" || field === "showreports" || field === "showactivitydates" || field === "showcompletionconditions") {
    return normalized === 1 ? "Sí" : "No";
  }
  if ((field === "startdate" || field === "enddate" || field === "startdate_min" || field === "enddate_max") && typeof normalized === "number") {
    return formatDate(normalized);
  }
  if (field === "groupmode" && typeof normalized === "number") return formatGroupMode(normalized);
  if (field === "summaryformat" && typeof normalized === "number") return formatSummaryFormat(normalized);
  if (field === "fullname_contains") return `contiene "${normalized}"`;
  return String(normalized);
}

// ── SVG Pie Chart ─────────────────────────────────────────────────────────────

function PieChart({ ok, fallos, total }: { ok: number; fallos: number; total: number }) {
  if (total === 0) return null;

  const okPct = ok / total;
  const r = 40;
  const cx = 56;
  const cy = 56;
  const circumference = 2 * Math.PI * r;
  const okDash = okPct * circumference;
  const failDash = (1 - okPct) * circumference;

  return (
    <div className="flex items-center gap-6">
      <svg width="112" height="112" viewBox="0 0 112 112">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="18" className="text-muted/30" />
        {fallos > 0 && (
          <circle
            cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="18"
            className="text-rose-500"
            strokeDasharray={`${failDash} ${circumference}`}
            strokeDashoffset={0}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )}
        {ok > 0 && (
          <circle
            cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="18"
            className="text-emerald-500"
            strokeDasharray={`${okDash} ${circumference}`}
            strokeDashoffset={-(failDash)}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )}
        <text x={cx} y={cy - 5} textAnchor="middle" className="fill-foreground text-[13px] font-bold" fontSize="13" fontWeight="700">
          {total}
        </text>
        <text x={cx} y={cy + 9} textAnchor="middle" className="fill-muted-foreground text-[9px]" fontSize="9">
          cursos
        </text>
      </svg>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="font-medium text-emerald-700 dark:text-emerald-400">{ok} OK</span>
          <span className="text-muted-foreground">({total > 0 ? Math.round((ok / total) * 100) : 0}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
          <span className="font-medium text-rose-700 dark:text-rose-400">{fallos} con errores</span>
          <span className="text-muted-foreground">({total > 0 ? Math.round((fallos / total) * 100) : 0}%)</span>
        </div>
      </div>
    </div>
  );
}

// ── Improved Bar Chart ────────────────────────────────────────────────────────

function BarChart({ errorsByField, total }: { errorsByField: Record<string, number>; total: number }) {
  const entries = Object.entries(errorsByField).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        <p className="text-sm text-emerald-800 dark:text-emerald-300">Sin errores por campo detectados.</p>
      </div>
    );
  }

  const max = Math.max(...entries.map(([, v]) => v));

  // Color scale: from amber (few errors) to rose (many errors)
  const getBarColor = (count: number) => {
    const ratio = max > 0 ? count / max : 0;
    if (ratio >= 0.75) return "bg-rose-500";
    if (ratio >= 0.5) return "bg-orange-500";
    if (ratio >= 0.25) return "bg-amber-500";
    return "bg-yellow-500";
  };

  const getBgColor = (count: number) => {
    const ratio = max > 0 ? count / max : 0;
    if (ratio >= 0.75) return "bg-rose-500/10";
    if (ratio >= 0.5) return "bg-orange-500/10";
    if (ratio >= 0.25) return "bg-amber-500/10";
    return "bg-yellow-500/10";
  };

  return (
    <div className="space-y-2.5">
      {entries.map(([field, count]) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const barWidth = max > 0 ? (count / max) * 100 : 0;
        return (
          <div key={field} className={`rounded-lg px-3 py-2 ${getBgColor(count)}`}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-xs font-medium leading-snug">{getFieldLabel(field)}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">{pct}% de cursos</span>
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white ${getBarColor(count)}`}>
                  {count}
                </span>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-700 ${getBarColor(count)}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">{field}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Category Tree ─────────────────────────────────────────────────────────────

function CourseRow({ course, onSelect }: { course: CourseSummary; onSelect: (id: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(course.id)}
      className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm transition-colors hover:bg-accent"
    >
      <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{course.fullname}</span>
      {course.idnumber && (
        <span className="shrink-0 rounded border px-1 py-0.5 font-mono text-[10px] text-muted-foreground">{course.idnumber}</span>
      )}
      {course.status === "OK" ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
      ) : (
        <span className="flex shrink-0 items-center gap-0.5">
          <XCircle className="h-3.5 w-3.5 text-rose-500" />
          <span className="text-[10px] text-rose-600 dark:text-rose-400">{course.errorCount}</span>
        </span>
      )}
    </button>
  );
}

function CategoryTreeNode({ node, depth = 0, onCourseSelect }: { node: CategoryNode; depth?: number; onCourseSelect: (id: number) => void }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0 || node.courses.length > 0;
  const failCount = node.courses.filter((c) => c.status === "FAIL").length;

  return (
    <div className={depth > 0 ? "ml-4 border-l border-border/50 pl-3" : ""}>
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-sm font-medium transition-colors hover:bg-accent"
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <span className="h-3.5 w-3.5" />
        )}
        <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span className="flex-1 truncate">{node.name}</span>
        {node.idnumber && (
          <span className="shrink-0 rounded border px-1 py-0.5 font-mono text-[10px] text-muted-foreground">{node.idnumber}</span>
        )}
        {failCount > 0 && (
          <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
            {failCount} error{failCount !== 1 ? "es" : ""}
          </span>
        )}
        {node.courses.length > 0 && (
          <span className="text-[11px] text-muted-foreground">{node.courses.length} cursos</span>
        )}
      </button>

      {expanded && (
        <div className="mt-0.5 space-y-0.5">
          {node.courses.map((course) => (
            <CourseRow key={`course-${course.id}`} course={course} onSelect={onCourseSelect} />
          ))}
          {node.children.map((child) => (
            <CategoryTreeNode key={`cat-${child.id}`} node={child} depth={depth + 1} onCourseSelect={onCourseSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Course Image Thumbnail ────────────────────────────────────────────────────

function CourseImageThumbnail({ url, status }: { url: string; status: "OK" | "FAIL" }) {
  const [imgFailed, setImgFailed] = useState(false);

  const borderClass =
    status === "OK"
      ? "border-emerald-200 dark:border-emerald-800/60"
      : "border-rose-200 dark:border-rose-800/60";

  if (imgFailed) {
    return (
      <div
        className={`flex h-14 w-20 shrink-0 items-center justify-center rounded-md border bg-muted/40 ${borderClass}`}
        aria-hidden="true"
      >
        <BookOpen className="h-5 w-5 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="Imagen del curso"
      onError={() => setImgFailed(true)}
      className={`h-14 w-20 shrink-0 rounded-md border object-cover transition-opacity duration-200 ${borderClass}`}
    />
  );
}

// ── Metadata field helper ─────────────────────────────────────────────────────

function MetaField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="overflow-hidden">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</dt>
      <dd className={`mt-0.5 truncate text-xs ${mono ? "font-mono" : ""}`} title={value}>{value || "—"}</dd>
    </div>
  );
}

function MetaSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-lg border bg-muted/20 px-3 py-2.5">
        {children}
      </dl>
    </section>
  );
}

// ── Course Detail Sidebar ─────────────────────────────────────────────────────

function CourseDetailSidebar({
  course,
  onClose,
}: {
  course: CourseValidationResult | null;
  onClose: () => void;
}) {
  const open = course !== null;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l bg-background shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {course && (
          <>
            {/* Header */}
            <div className={`border-b px-5 py-4 ${course.status === "OK" ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-rose-50 dark:bg-rose-950/20"}`}>
              <div className="mb-3 flex items-start gap-3">
                {/* Text */}
                <div className="min-w-0 flex-1">
                  {course.idnumber && (
                    <span className="mb-1.5 inline-block rounded border border-current px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {course.idnumber}
                    </span>
                  )}
                  <h2 className="text-base font-semibold leading-snug">{course.fullname}</h2>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <p className="font-mono text-xs text-muted-foreground">{course.shortname}</p>
                    {course.courseUrl && (
                      <a
                        href={course.courseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir curso en Moodle"
                        className="text-muted-foreground/40 transition-all hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Image + close */}
                <div className="flex shrink-0 items-start gap-2">
                  {course.overviewImageUrl && (
                    <CourseImageThumbnail url={course.overviewImageUrl} status={course.status} />
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Cerrar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {course.status === "OK" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Cumple todas las reglas
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                    <XCircle className="h-3.5 w-3.5" />
                    {course.errors.length} error{course.errors.length !== 1 ? "es" : ""} detectado{course.errors.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

              {/* ── Identificación ── */}
              <MetaSection title="Identificación">
                <MetaField label="ID Moodle" value={String(course.id)} mono />
                <MetaField label="Categoría" value={course.categoryName} />
                <MetaField label="Nombre corto" value={course.shortname} mono />
                <MetaField label="Número ID" value={course.idnumber || "(sin definir)"} mono />
              </MetaSection>

              {/* ── Configuración general ── */}
              <MetaSection title="Configuración general">
                <MetaField label="Formato" value={course.format || "—"} mono />
                <MetaField label="Visible" value={course.visible === 1 ? "Sí (publicado)" : "No (oculto)"} />
                <MetaField label="Idioma forzado" value={course.lang || "(predeterminado)"} mono />
                <MetaField label="Tema forzado" value={course.forcetheme || "(predeterminado)"} mono />
                <MetaField label="Tamaño máx. archivos" value={formatBytes(course.maxbytes)} mono />
                <MetaField label="Formato del resumen" value={formatSummaryFormat(course.summaryformat)} />
              </MetaSection>

              {/* ── Fechas ── */}
              <MetaSection title="Fechas">
                <MetaField label="Fecha de inicio" value={formatDate(course.startdate)} />
                <MetaField label="Fecha de finalización" value={formatDate(course.enddate)} />
              </MetaSection>

              {/* ── Finalización de actividades ── */}
              <MetaSection title="Finalización y seguimiento">
                <MetaField label="Seguimiento de finalización" value={course.enablecompletion === 1 ? "Activado" : "Desactivado"} />
                <MetaField label="Mostrar condiciones" value={course.showcompletionconditions === 1 ? "Sí" : "No"} />
                <MetaField label="Notificar al completar" value={course.completionnotify === 1 ? "Sí" : "No"} />
                <MetaField label="Mostrar fechas de actividad" value={course.showactivitydates === 1 ? "Sí" : "No"} />
              </MetaSection>

              {/* ── Visibilidad para estudiantes ── */}
              <MetaSection title="Visibilidad para estudiantes">
                <MetaField label="Mostrar calificaciones" value={course.showgrades === 1 ? "Sí" : "No"} />
                <MetaField label="Mostrar informes de actividad" value={course.showreports === 1 ? "Sí" : "No"} />
                <MetaField label="Noticias recientes" value={String(course.newsitems)} mono />
              </MetaSection>

              {/* ── Grupos ── */}
              <MetaSection title="Configuración de grupos">
                <MetaField label="Modo de grupos" value={formatGroupMode(course.groupmode)} />
                <MetaField label="Forzar modo de grupos" value={course.groupmodeforce === 1 ? "Sí" : "No"} />
                <MetaField label="Agrupación por defecto" value={course.defaultgroupingid === 0 ? "Ninguna" : String(course.defaultgroupingid)} mono />
              </MetaSection>

              <div className="h-px bg-border" />

              {/* ── Validación de reglas ── */}
              <section>
                <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Validación de reglas</h3>
                {course.errors.length === 0 ? (
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <p className="text-sm text-emerald-800 dark:text-emerald-300">
                      Este curso cumple con todas las reglas configuradas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {course.errors.map((err) => (
                      <div key={err.field} className="overflow-hidden rounded-lg border border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/10">
                        {/* Error header */}
                        <div className="flex items-center gap-2 border-b border-rose-200/60 bg-rose-100/50 px-3 py-1.5 dark:border-rose-900/30 dark:bg-rose-950/20">
                          <AlertTriangle className="h-3 w-3 shrink-0 text-rose-600" />
                          <p className="text-xs font-semibold text-rose-900 dark:text-rose-300">{getFieldLabel(err.field)}</p>
                          <span className="ml-auto font-mono text-[10px] text-rose-600/70 dark:text-rose-400/70">{err.field}</span>
                        </div>
                        {/* Expected vs actual */}
                        <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-muted-foreground">Esperado</span>
                            <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 font-mono text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {formatValue(err.field, err.expected)}
                            </span>
                          </div>
                          <span className="text-muted-foreground">→</span>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-muted-foreground">Actual</span>
                            <span className="rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 font-mono text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              {formatValue(err.field, err.actual)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const COURSE_FN = API_FUNCTIONS.find((f) => f.wsfunction === "core_course_get_courses")!;

export default function RevisionCursosPage() {
  const [moodleConfigLoaded, setMoodleConfigLoaded] = useState(false);
  const [rulesConfig, setRulesConfig] = useState<RulesConfig | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<RevisionCursosResponse | null>(null);

  const [rulesOpen, setRulesOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"tree" | "table">("tree");
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "OK" | "FAIL">("all");
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    id: false,
    shortname: true,
    fullname: true,
    idnumber: false,
    categoria: true,
    estado: true,
    errores: true,
    formato: false,
    visible: false,
    completitud: false,
    maxbytes: false,
    idioma: false,
  });

  const loadSettings = useCallback(async () => {
    const [config, savedRules] = await Promise.all([
      loadMoodleConfig(),
      loadEncryptedJson<RulesConfig>(localStorageKey(COURSE_FN.storageKey)),
    ]);
    setMoodleConfigLoaded(!!(config?.token && config.moodleUrl));
    setRulesConfig(savedRules ?? buildDefaultRulesConfig(COURSE_FN));
  }, []);

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  const selectedCourse = useMemo(
    () => (selectedCourseId !== null ? payload?.results.find((r) => r.id === selectedCourseId) ?? null : null),
    [selectedCourseId, payload],
  );

  const filteredResults = useMemo(() => {
    const results = payload?.results ?? [];
    const query = searchText.trim().toLowerCase();
    return results.filter((row) => {
      if (query) {
        const haystack = [row.fullname, row.shortname, row.idnumber, row.categoryName, String(row.id)].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      return true;
    });
  }, [payload?.results, searchText, statusFilter]);

  const visibleColumnCount = useMemo(() => Object.values(visibleColumns).filter(Boolean).length, [visibleColumns]);

  const resetFilters = () => {
    setSearchText("");
    setStatusFilter("all");
  };

  const downloadCsv = () => {
    if (filteredResults.length === 0) return;
    const activeColumns = allColumns.filter((c) => visibleColumns[c]);
    if (activeColumns.length === 0) return;

    const escape = (v: string | number) => `"${String(v ?? "").replaceAll('"', '""')}"`;

    const toCell = (row: CourseValidationResult, col: ColumnKey): string | number => {
      switch (col) {
        case "id": return row.id;
        case "shortname": return row.shortname;
        case "fullname": return row.fullname;
        case "idnumber": return row.idnumber;
        case "categoria": return row.categoryName;
        case "estado": return row.status;
        case "errores": return row.errors.map((e) => `${e.field}: esperado ${String(e.expected)}, actual ${String(e.actual)}`).join("; ");
        case "formato": return row.format;
        case "visible": return row.visible;
        case "completitud": return row.enablecompletion;
        case "maxbytes": return row.maxbytes;
        case "idioma": return row.lang;
      }
    };

    const header = activeColumns.map((c) => escape(columnLabels[c])).join(",");
    const lines = filteredResults.map((row) => activeColumns.map((c) => escape(toCell(row, c))).join(","));
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `revision-cursos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPayload(null);

    const config = await loadMoodleConfig();
    if (!config?.token || !config.moodleUrl) {
      setError("Configura el Token y la URL de Moodle en Ajustes antes de ejecutar.");
      setLoading(false);
      return;
    }

    const activeRules = buildValidationRules(rulesConfig ?? buildDefaultRulesConfig(COURSE_FN));

    try {
      const res = await fetch("/api/moodle/revision-cursos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moodleUrl: config.moodleUrl,
          token: config.token,
          categoryId: categoryId ? Number(categoryId) : undefined,
          rules: activeRules,
        }),
      });

      const data = (await res.json()) as RevisionCursosResponse;
      if (!res.ok) throw new Error(data.message ?? "Error consultando la API de Moodle");
      setPayload(data);
      setActiveTab("tree");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const statusClass = (status: "OK" | "FAIL") =>
    status === "OK"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
      : "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 md:px-8">
      {/* ── Header ── */}
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">API REST Moodle</Badge>
          {moodleConfigLoaded && (
            <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-400">
              Token configurado
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Revisión de cursos</h1>
          <Button type="button" variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="mr-1.5 h-4 w-4" />
            Ajustes
          </Button>
        </div>
        <p className="text-muted-foreground">
          Valida la configuración de cursos Moodle vía API REST: formato, visibilidad, completitud y más.
        </p>
      </header>

      {/* ── Rules Card (accordion) ── */}
      <Card>
        <div className="flex w-full items-center gap-3 px-6 py-4">
          <button
            type="button"
            className="flex flex-1 items-center gap-2 text-left"
            onClick={() => setRulesOpen((o) => !o)}
            aria-expanded={rulesOpen}
          >
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                rulesOpen ? "rotate-180" : ""
              }`}
            />
            <div>
              <p className="text-base font-semibold leading-none tracking-tight">Reglas de validación activas</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {rulesConfig
                  ? `${Object.values(rulesConfig).filter((r) => r.active).length} reglas configuradas`
                  : "Cargando reglas..."}
              </p>
            </div>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            Modificar
          </Button>
        </div>
        {rulesOpen && (
          <CardContent className="border-t pt-4">
            {rulesConfig ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(rulesConfig)
                  .filter(([, r]) => r.active)
                  .map(([field, r]) => (
                    <span key={field} className="rounded border bg-muted/50 px-2 py-0.5 text-[11px]">
                      <span className="text-muted-foreground">{getFieldLabel(field)}:</span>{" "}
                      <span className="font-semibold font-mono">{formatValue(field, r.expected)}</span>
                    </span>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Cargando reglas...</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── Query Form ── */}
      <Card>
        <CardHeader>
          <CardTitle>Ejecutar validación</CardTitle>
          <CardDescription>
            Filtra por ID de categoría o deja vacío para validar todos los cursos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => void onSubmit(e)}>
            <div className="w-full space-y-1.5 sm:max-w-64">
              <Label htmlFor="categoryId">ID de categoría <span className="text-muted-foreground">(opcional)</span></Label>
              <input
                id="categoryId"
                type="number"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                placeholder="Ej: 42 — vacío para todos"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 font-mono text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button type="submit" disabled={loading || !moodleConfigLoaded}>
              {loading ? "Consultando API..." : "Ejecutar validación"}
            </Button>
            {!moodleConfigLoaded && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Configura el token en Ajustes antes de continuar.
              </p>
            )}
          </form>
          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* ── Results ── */}
      {payload && (
        <>
          {/* Summary + Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Distribución de resultados</CardDescription>
                <CardTitle className="text-base">
                  {payload.total} cursos · {payload.ok} OK · {payload.fallos} con errores
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <PieChart ok={payload.ok} fallos={payload.fallos} total={payload.total} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Errores por campo</CardDescription>
                <CardTitle className="text-base">
                  {Object.keys(payload.errorsByField).length} campo{Object.keys(payload.errorsByField).length !== 1 ? "s" : ""} con incumplimientos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <BarChart errorsByField={payload.errorsByField} total={payload.total} />
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <div>
            <div className="flex gap-1 border-b">
              {(["tree", "table"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === tab
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "tree" ? "Vista de árbol" : "Tabla detallada"}
                </button>
              ))}
            </div>

            {/* Tree View */}
            {activeTab === "tree" && (
              <Card className="mt-4 rounded-tl-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Categorías y cursos</CardTitle>
                  <CardDescription>
                    Haz clic en un curso para ver todos sus detalles y errores.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {payload.categoryTree.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No se encontraron categorías. Los cursos aparecen directamente:
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {payload.categoryTree.map((node) => (
                        <CategoryTreeNode
                          key={node.id}
                          node={node}
                          onCourseSelect={(id) => setSelectedCourseId(id)}
                        />
                      ))}
                    </div>
                  )}
                  {payload.categoryTree.length === 0 && payload.results.length > 0 && (
                    <div className="space-y-0.5">
                      {payload.results.map((r) => (
                        <CourseRow
                          key={r.id}
                          course={{ id: r.id, shortname: r.shortname, fullname: r.fullname, idnumber: r.idnumber, status: r.status, errorCount: r.errors.length }}
                          onSelect={(id) => setSelectedCourseId(id)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Table View */}
            {activeTab === "table" && (
              <Card className="mt-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Resultados detallados</CardTitle>
                  <CardDescription>{payload.total} cursos validados</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ReportTableControls
                    filters={
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1 sm:col-span-2 lg:col-span-2">
                          <Label htmlFor="searchTable">Buscar</Label>
                          <input
                            id="searchTable"
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Nombre, código, ID number, categoría..."
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="statusFilter">Estado</Label>
                          {/* eslint-disable-next-line jsx-a11y/no-onchange */}
                          <select
                            id="statusFilter"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as "all" | "OK" | "FAIL")}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <option value="all">Todos</option>
                            <option value="OK">OK</option>
                            <option value="FAIL">Con errores</option>
                          </select>
                        </div>
                      </div>
                    }
                    columns={
                      <>
                        {allColumns.map((col) => (
                          <label key={col} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                            <input
                              type="checkbox"
                              checked={visibleColumns[col]}
                              onChange={() => setVisibleColumns((p) => ({ ...p, [col]: !p[col] }))}
                            />
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
                    itemLabel="cursos"
                  />

                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          {visibleColumns.id && <th className="px-3 py-2 text-left font-medium">ID</th>}
                          {visibleColumns.shortname && <th className="px-3 py-2 text-left font-medium">Código</th>}
                          {visibleColumns.fullname && <th className="px-3 py-2 text-left font-medium">Nombre completo</th>}
                          {visibleColumns.idnumber && <th className="px-3 py-2 text-left font-medium">ID Number</th>}
                          {visibleColumns.categoria && <th className="px-3 py-2 text-left font-medium">Categoría</th>}
                          {visibleColumns.estado && <th className="px-3 py-2 text-left font-medium">Estado</th>}
                          {visibleColumns.errores && <th className="px-3 py-2 text-left font-medium">Errores</th>}
                          {visibleColumns.formato && <th className="px-3 py-2 text-left font-medium">Formato</th>}
                          {visibleColumns.visible && <th className="px-3 py-2 text-left font-medium">Visible</th>}
                          {visibleColumns.completitud && <th className="px-3 py-2 text-left font-medium">Completitud</th>}
                          {visibleColumns.maxbytes && <th className="px-3 py-2 text-left font-medium">Max. bytes</th>}
                          {visibleColumns.idioma && <th className="px-3 py-2 text-left font-medium">Idioma</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredResults.map((row) => (
                          <tr
                            key={row.id}
                            className="cursor-pointer border-t align-top transition-colors hover:bg-muted/30"
                            onClick={() => setSelectedCourseId(row.id)}
                          >
                            {visibleColumns.id && <td className="px-3 py-2 font-mono text-xs">{row.id}</td>}
                            {visibleColumns.shortname && <td className="px-3 py-2 font-mono text-xs">{row.shortname}</td>}
                            {visibleColumns.fullname && <td className="max-w-64 px-3 py-2">{row.fullname}</td>}
                            {visibleColumns.idnumber && <td className="px-3 py-2 font-mono text-xs">{row.idnumber || "—"}</td>}
                            {visibleColumns.categoria && <td className="px-3 py-2 text-xs">{row.categoryName}</td>}
                            {visibleColumns.estado && (
                              <td className="px-3 py-2">
                                <span className={`rounded px-2 py-1 text-xs font-medium ${statusClass(row.status)}`}>{row.status}</span>
                              </td>
                            )}
                            {visibleColumns.errores && (
                              <td className="px-3 py-2">
                                {row.errors.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {row.errors.map((e) => (
                                      <span key={e.field} className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                        {getFieldLabel(e.field)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                            )}
                            {visibleColumns.formato && <td className="px-3 py-2 font-mono text-xs">{row.format}</td>}
                            {visibleColumns.visible && <td className="px-3 py-2 text-xs">{row.visible}</td>}
                            {visibleColumns.completitud && <td className="px-3 py-2 text-xs">{row.enablecompletion}</td>}
                            {visibleColumns.maxbytes && <td className="px-3 py-2 font-mono text-xs">{formatBytes(row.maxbytes)}</td>}
                            {visibleColumns.idioma && <td className="px-3 py-2 font-mono text-xs">{row.lang || '""'}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {/* ── Course Detail Sidebar ── */}
      <CourseDetailSidebar course={selectedCourse ?? null} onClose={() => setSelectedCourseId(null)} />

      {/* ── Settings Sidebar ── */}
      <SettingsSidebar
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onRulesChange={() => void loadSettings()}
      />
    </main>
  );
}
