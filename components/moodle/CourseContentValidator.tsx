"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Eye,
  Layers,
  FileCode2,
  X,
  Target,
  ChevronDown,
  Hash,
  LayoutTemplate,
  MessageSquare,
  BookOpen,
  Video,
  ClipboardList,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CourseContentValidationResult, ValidationCheck } from "@/lib/moodle/types";

// ── Check Row ─────────────────────────────────────────────────────────────────

function CheckRow({ check, index }: { check: ValidationCheck; index: number }) {
  const passed = check.passed;
  return (
    <div
      className="group flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors hover:bg-muted/40"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <span className="shrink-0">
        {passed ? (
          <CheckCircle2 className="h-[17px] w-[17px] text-emerald-500 drop-shadow-[0_0_4px_rgb(16_185_129_/_0.4)]" />
        ) : (
          <XCircle className="h-[17px] w-[17px] text-rose-500 drop-shadow-[0_0_4px_rgb(244_63_94_/_0.4)]" />
        )}
      </span>
      <span className="flex-1 text-sm font-medium leading-none">{check.label}</span>
      {!passed ? (
        <span className="flex items-center gap-1.5">
          <span className="hidden text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60 group-hover:inline">
            actual
          </span>
          <code className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300">
            {check.actual !== null ? String(check.actual) : "—"}
          </code>
          <ChevronDown className="h-3 w-3 -rotate-90 text-rose-400/50" />
          <code className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            {String(check.expected)}
          </code>
        </span>
      ) : (
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
          OK
        </span>
      )}
    </div>
  );
}

// ── Content Preview Modal ─────────────────────────────────────────────────────

function ContentPreviewModal({ html, onClose }: { html: string; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[60] flex w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border bg-background shadow-sm">
              <FileCode2 className="h-3.5 w-3.5 text-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-none">Vista previa del contenido</h2>
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">mod_page · content HTML</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista previa"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          <div className="sticky top-0 flex items-center gap-2 border-b bg-muted/50 px-4 py-2 backdrop-blur-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-2 font-mono text-[10px] text-muted-foreground">presentacion_profesor.html</span>
          </div>
          <div
            className="prose prose-sm dark:prose-invert max-w-none px-8 py-6 [&_img]:max-w-full [&_table]:w-full"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
        <div className="shrink-0 border-t bg-muted/20 px-6 py-3">
          <Button type="button" size="sm" variant="outline" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </>
  );
}

// ── Accordion Item ─────────────────────────────────────────────────────────────

interface AccordionItemProps {
  id: string;
  icon: React.ElementType;
  title: string;
  idnumber: string;
  found: boolean;
  passed: boolean;
  passedCount: number;
  totalCount: number;
  cmid: number | null;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  notFoundLabel?: string;
}

function AccordionItem({
  icon: Icon,
  title,
  idnumber,
  found,
  passed,
  passedCount,
  totalCount,
  cmid,
  isOpen,
  onToggle,
  children,
  notFoundLabel,
}: AccordionItemProps) {
  const statusColor = passed
    ? "border-emerald-200 dark:border-emerald-800/60"
    : "border-rose-200 dark:border-rose-800/60";

  const iconBg = passed
    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
    : "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30";

  const iconColor = passed
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-600 dark:text-rose-400";

  return (
    <div className={`overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors ${statusColor}`}>
      {/* Header — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/20"
        aria-expanded={isOpen}
      >
        {/* Icon */}
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border shadow-sm ${iconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        </div>

        {/* Title + cmid */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold leading-none">{title}</span>
            <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
              {idnumber}
            </span>
            {cmid !== null && (
              <span className="flex items-center gap-0.5 font-mono text-[10px] text-muted-foreground/60">
                <Hash className="h-2.5 w-2.5" />cmid: {cmid}
              </span>
            )}
          </div>
        </div>

        {/* Check count + status badge */}
        <div className="flex shrink-0 items-center gap-2.5">
          {found && (
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">{passedCount}</span>/{totalCount}
            </span>
          )}
          <Badge className={`text-[10px] font-semibold ${
            passed ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-rose-600 text-white hover:bg-rose-700"
          }`}>
            {passed ? "Correcto" : found ? "Con errores" : "No encontrado"}
          </Badge>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Body — animated expand/collapse using grid trick */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="border-t">
            {!found ? (
              <div className="flex flex-col items-center gap-4 px-5 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/20">
                  <BookOpen className="h-5 w-5 text-rose-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                    {notFoundLabel ?? "Módulo no encontrado"}
                  </p>
                </div>
              </div>
            ) : (
              children
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-muted/20 px-5 py-3.5 shadow-xs">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-background shadow-sm">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums leading-none tracking-tight">{value}</p>
      </div>
    </div>
  );
}

// ── Checks Body ───────────────────────────────────────────────────────────────

function ChecksBody({
  checks,
  footer,
}: {
  checks: ValidationCheck[];
  footer?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-center gap-3 px-5 pt-3.5 pb-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Verificaciones</span>
        <div className="h-px flex-1 bg-border/50" />
      </div>
      <div className="space-y-0.5 px-2 pb-2 pt-1">
        {checks.map((check, idx) => (
          <CheckRow key={idx} check={check} index={idx} />
        ))}
      </div>
      {footer && (
        <div className="border-t bg-muted/10 px-5 py-3.5">
          {footer}
        </div>
      )}
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export interface CourseContentValidatorProps {
  result: CourseContentValidationResult;
}

export function CourseContentValidator({ result }: CourseContentValidatorProps) {
  const [previewOpen,    setPreviewOpen]    = useState(false);
  const [openAccordion,  setOpenAccordion]  = useState<"page" | "forum" | "meeting" | "attendance" | "microcurriculum" | null>("page");

  const { professorPage, consultationForum, meeting, attendance, microcurriculum } = result;

  const pageChecks            = Object.values(professorPage.checks) as ValidationCheck[];
  const forumChecks           = Object.values(consultationForum.checks) as ValidationCheck[];
  const meetingChecks         = Object.values(meeting.checks) as ValidationCheck[];
  const attendanceChecks      = Object.values(attendance.checks) as ValidationCheck[];
  const microcurriculumChecks = Object.values(microcurriculum.checks) as ValidationCheck[];
  const pagePassedCnt            = pageChecks.filter((c) => c.passed).length;
  const forumPassedCnt           = forumChecks.filter((c) => c.passed).length;
  const meetingPassedCnt         = meetingChecks.filter((c) => c.passed).length;
  const attendancePassedCnt      = attendanceChecks.filter((c) => c.passed).length;
  const microcurriculumPassedCnt = microcurriculumChecks.filter((c) => c.passed).length;

  const toggle = (key: "page" | "forum" | "meeting" | "attendance" | "microcurriculum") =>
    setOpenAccordion((prev) => (prev === key ? null : key));

  return (
    <>
      <div className="space-y-4">
        {/* ── Course name + format badge ── */}
        {result.courseName && (
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold leading-tight">{result.courseName}</h3>
            <span className="flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
              <LayoutTemplate className="h-2.5 w-2.5" />
              {result.courseFormat}
            </span>
          </div>
        )}

        {/* ── Top stats row ── */}
        <div className="flex flex-wrap items-stretch gap-3">
          <StatCard icon={Layers} label="Secciones del curso"   value={result.totalSections} />
          <StatCard icon={Target} label="Sección presentación"  value={`#${result.presentationSection}`} />
          <div className="ml-auto flex items-center">
            <div className={`flex items-center gap-2.5 rounded-2xl border px-5 py-3.5 shadow-xs ${
              result.passed
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/30"
                : "border-rose-200 bg-rose-50 dark:border-rose-800/60 dark:bg-rose-950/30"
            }`}>
              {result.passed ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              )}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Estado general</p>
                <p className={`text-lg font-bold leading-none ${
                  result.passed ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
                }`}>
                  {result.passed ? "Cumple" : "No cumple"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Accordion: Professor page ── */}
        <AccordionItem
          id="page"
          icon={FileCode2}
          title="Página de presentación del profesor"
          idnumber="DP01"
          found={professorPage.found}
          passed={professorPage.passed}
          passedCount={pagePassedCnt}
          totalCount={pageChecks.length}
          cmid={professorPage.cmid}
          isOpen={openAccordion === "page"}
          onToggle={() => toggle("page")}
          notFoundLabel="No se encontró un módulo de tipo page en la sección de presentación"
        >
          <ChecksBody
            checks={pageChecks}
            footer={professorPage.contentHtml ? (
              <Button
                type="button" variant="outline" size="sm"
                className="h-8 gap-2 text-xs font-medium shadow-xs"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="h-3.5 w-3.5" />Ver contenido HTML
              </Button>
            ) : undefined}
          />
        </AccordionItem>

        {/* ── Accordion: Consultation forum ── */}
        <AccordionItem
          id="forum"
          icon={MessageSquare}
          title="Foro de consulta"
          idnumber="FC01"
          found={consultationForum.found}
          passed={consultationForum.passed}
          passedCount={forumPassedCnt}
          totalCount={forumChecks.length}
          cmid={consultationForum.cmid}
          isOpen={openAccordion === "forum"}
          onToggle={() => toggle("forum")}
          notFoundLabel="No se encontró un foro con número ID FC01 en la sección de presentación"
        >
          <ChecksBody checks={forumChecks} />
        </AccordionItem>

        {/* ── Accordion: MS Meeting ── */}
        <AccordionItem
          id="meeting"
          icon={Video}
          title="Reunión MS Teams"
          idnumber="msmeeting"
          found={meeting.found}
          passed={meeting.passed}
          passedCount={meetingPassedCnt}
          totalCount={meetingChecks.length}
          cmid={meeting.cmid}
          isOpen={openAccordion === "meeting"}
          onToggle={() => toggle("meeting")}
          notFoundLabel="No se encontró un módulo msmeeting en la sección de presentación"
        >
          <ChecksBody checks={meetingChecks} />
        </AccordionItem>

        {/* ── Accordion: Attendance ── */}
        <AccordionItem
          id="attendance"
          icon={ClipboardList}
          title="Control de asistencia"
          idnumber="attendance"
          found={attendance.found}
          passed={attendance.passed}
          passedCount={attendancePassedCnt}
          totalCount={attendanceChecks.length}
          cmid={attendance.cmid}
          isOpen={openAccordion === "attendance"}
          onToggle={() => toggle("attendance")}
          notFoundLabel="No se encontró un módulo attendance en la sección de presentación"
        >
          <ChecksBody checks={attendanceChecks} />
        </AccordionItem>

        {/* ── Accordion: Microcurriculum ── */}
        <AccordionItem
          id="microcurriculum"
          icon={FileText}
          title="Microcurrículo"
          idnumber="resource"
          found={microcurriculum.found}
          passed={microcurriculum.passed}
          passedCount={microcurriculumPassedCnt}
          totalCount={microcurriculumChecks.length}
          cmid={microcurriculum.cmid}
          isOpen={openAccordion === "microcurriculum"}
          onToggle={() => toggle("microcurriculum")}
          notFoundLabel='No se encontró un recurso con nombre "microcurriculo" en la sección de presentación'
        >
          <ChecksBody
            checks={microcurriculumChecks}
            footer={microcurriculum.fileUrl ? (
              <a
                href={microcurriculum.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium shadow-xs transition-all hover:border-primary/40 hover:bg-accent"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="max-w-[420px] truncate font-mono text-[11px] text-muted-foreground">
                  {microcurriculum.fileUrl}
                </span>
              </a>
            ) : undefined}
          />
        </AccordionItem>
      </div>

      {previewOpen && professorPage.contentHtml && (
        <ContentPreviewModal html={professorPage.contentHtml} onClose={() => setPreviewOpen(false)} />
      )}
    </>
  );
}
