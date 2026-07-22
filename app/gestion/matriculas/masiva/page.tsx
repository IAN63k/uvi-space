"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Settings2, UserPlus, UserMinus, ListChecks, Users, SlidersHorizontal, Play, CalendarRange } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SettingsSidebar } from "@/components/settings-sidebar";
import { CourseTargetPanel } from "@/components/matriculas/course-target-panel";
import { UserListPanel } from "@/components/matriculas/user-list-panel";
import { BulkExecutionPanel } from "@/components/matriculas/bulk-execution-panel";
import type { EnrolmentMode } from "@/components/matriculas/enrolment-config-panel";
import { loadMoodleConfig, type MoodleConfig } from "@/lib/encrypted-local-storage";
import {
  fetchCourseUsers,
  roleLabel,
  type BulkUser,
  type BulkUserRow,
  type BulkUserSource,
  type SelectedCourse,
} from "@/lib/matriculas/api";

export default function MatriculaMasivaPage() {
  const [moodleConfig, setMoodleConfig] = useState<MoodleConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [mode, setMode] = useState<EnrolmentMode>("enrol");
  const [course, setCourse] = useState<SelectedCourse | null>(null);
  const [rows, setRows] = useState<BulkUserRow[]>([]);
  const [addRoleId, setAddRoleId] = useState(5); // Estudiante por defecto
  const [timestart, setTimestart] = useState("");
  const [timeend, setTimeend] = useState("");
  /** Matriculados del curso destino, atados al curso que los produjo */
  const [enrolled, setEnrolled] = useState<{ courseId: number; ids: Set<number> } | null>(null);

  const loadConfig = useCallback(async () => {
    const config = await loadMoodleConfig();
    const hasConfig = !!(config?.token && config.moodleUrl);
    setMoodleConfig(hasConfig ? config : null);
    setConfigLoaded(hasConfig);
  }, []);

  useEffect(() => { void loadConfig(); }, [loadConfig]);

  const courseId = course?.id ?? null;

  // Matriculados actuales del curso destino, para marcar quién ya está.
  // Si el token no puede consultarlos, simplemente no se muestra la marca.
  useEffect(() => {
    if (!moodleConfig || !courseId) return;
    let cancelled = false;
    fetchCourseUsers(moodleConfig, courseId)
      .then((users) => {
        if (!cancelled) setEnrolled({ courseId, ids: new Set(users.map((u) => u.id)) });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [moodleConfig, courseId]);

  const rowsWithStatus = useMemo(() => {
    // Sólo se usa el resultado si corresponde al curso seleccionado ahora mismo
    const ids = enrolled && enrolled.courseId === courseId ? enrolled.ids : null;
    return rows.map((row) => ({ ...row, alreadyEnrolled: ids?.has(row.user.id) ?? false }));
  }, [rows, enrolled, courseId]);

  const addUsers = useCallback((users: BulkUser[], source: BulkUserSource) => {
    setRows((prev) => {
      const existing = new Set(prev.map((r) => r.user.id));
      const additions = users
        .filter((u) => !existing.has(u.id))
        .map((user) => ({ user, roleId: addRoleId, source }));
      return additions.length > 0 ? [...prev, ...additions] : prev;
    });
  }, [addRoleId]);

  const removeUser = useCallback((userId: number) => {
    setRows((prev) => prev.filter((r) => r.user.id !== userId));
  }, []);

  const changeRowRole = useCallback((userId: number, roleId: number) => {
    setRows((prev) => prev.map((r) => (r.user.id === userId ? { ...r, roleId } : r)));
  }, []);

  const clearUsers = useCallback(() => setRows([]), []);

  const resetAll = useCallback(() => {
    setRows([]);
    setTimestart("");
    setTimeend("");
  }, []);

  const isEnrol = mode === "enrol";
  const canExecute = course !== null && rows.length > 0;

  const roleBreakdown = useMemo(() => {
    const byRole = new Map<number, number>();
    for (const row of rows) byRole.set(row.roleId, (byRole.get(row.roleId) ?? 0) + 1);
    return Array.from(byRole.entries());
  }, [rows]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 md:px-8">
      {/* ── Header ── */}
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">API REST Moodle</Badge>
          {configLoaded && (
            <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-400">
              Token configurado
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Matrícula masiva por curso</h1>
          <Button type="button" variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="mr-1.5 h-4 w-4" />
            Ajustes
          </Button>
        </div>
        <p className="text-muted-foreground">
          Matricula o desmatricula varios usuarios —estudiantes y docentes— en un mismo curso.
        </p>
      </header>

      {!configLoaded && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
          Configura el Token y la URL de Moodle en <button type="button" onClick={() => setSettingsOpen(true)} className="font-semibold underline underline-offset-2">Ajustes</button> para comenzar.
        </div>
      )}

      {/* ── Modo: matricular / desmatricular ── */}
      <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
        <ModeTab active={isEnrol} onClick={() => setMode("enrol")} icon={<UserPlus className="h-4 w-4" />}>
          Matricular usuarios
        </ModeTab>
        <ModeTab active={!isEnrol} onClick={() => setMode("unenrol")} icon={<UserMinus className="h-4 w-4" />}>
          Desmatricular usuarios
        </ModeTab>
      </div>

      {/* ── Sección 1: Curso destino ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-muted-foreground" /> 1. Curso destino
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CourseTargetPanel config={moodleConfig} course={course} onChange={setCourse} />
        </CardContent>
      </Card>

      {/* ── Sección 2: Usuarios ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-muted-foreground" /> 2. Usuarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UserListPanel
            config={moodleConfig}
            rows={rowsWithStatus}
            addRoleId={addRoleId}
            onAddRoleChange={setAddRoleId}
            onAdd={addUsers}
            onRemove={removeUser}
            onRowRoleChange={changeRowRole}
            onClearAll={clearUsers}
            showRoles={isEnrol}
          />
        </CardContent>
      </Card>

      {/* ── Sección 3: Configuración ── */}
      {canExecute && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" /> 3. Configuración
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEnrol && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="timestart" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarRange className="h-3.5 w-3.5" /> Fecha de inicio (opcional)
                  </Label>
                  <input
                    id="timestart"
                    type="date"
                    value={timestart}
                    onChange={(e) => setTimestart(e.target.value)}
                    className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <p className="text-[10px] text-muted-foreground/70">Vacío = inmediato</p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="timeend" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarRange className="h-3.5 w-3.5" /> Fecha de fin (opcional)
                  </Label>
                  <input
                    id="timeend"
                    type="date"
                    value={timeend}
                    onChange={(e) => setTimeend(e.target.value)}
                    className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <p className="text-[10px] text-muted-foreground/70">Vacío = sin límite</p>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              Se va a <span className="font-semibold">{isEnrol ? "matricular" : "desmatricular"}</span>{" "}
              <span className="font-semibold">{rows.length}</span> usuario{rows.length !== 1 ? "s" : ""}{" "}
              {isEnrol ? "en" : "de"}{" "}
              <span className="font-semibold">{course.fullname || `Curso ${course.id}`}</span>.
              {isEnrol && roleBreakdown.length > 0 && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {roleBreakdown.map(([roleId, count]) => `${count} × ${roleLabel(roleId)}`).join(" · ")}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Sección 4: Ejecución ── */}
      {canExecute && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Play className="h-4 w-4 text-muted-foreground" /> 4. Ejecución
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BulkExecutionPanel
              config={moodleConfig}
              mode={mode}
              course={course}
              rows={rowsWithStatus}
              timestart={timestart}
              timeend={timeend}
              onReset={resetAll}
            />
          </CardContent>
        </Card>
      )}

      <SettingsSidebar open={settingsOpen} onClose={() => { setSettingsOpen(false); void loadConfig(); }} />
    </main>
  );
}

function ModeTab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
