"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Settings2, UserPlus, UserMinus, Search, ListChecks, SlidersHorizontal, Play } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsSidebar } from "@/components/settings-sidebar";
import { UserSearchPanel, type FoundUser } from "@/components/matriculas/user-search-panel";
import { CourseSelectionPanel } from "@/components/matriculas/course-selection-panel";
import { EnrolmentConfigPanel, type EnrolmentMode } from "@/components/matriculas/enrolment-config-panel";
import { ExecutionPanel } from "@/components/matriculas/execution-panel";
import { loadMoodleConfig, type MoodleConfig } from "@/lib/encrypted-local-storage";
import type { SelectedCourse } from "@/lib/matriculas/api";

export default function MatriculasPage() {
  const [moodleConfig, setMoodleConfig] = useState<MoodleConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [mode, setMode] = useState<EnrolmentMode>("enrol");
  const [found, setFound] = useState<FoundUser | null>(null);
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([]);
  const [roleId, setRoleId] = useState(5); // Estudiante por defecto
  const [timestart, setTimestart] = useState("");
  const [timeend, setTimeend] = useState("");

  const loadConfig = useCallback(async () => {
    const config = await loadMoodleConfig();
    const hasConfig = !!(config?.token && config.moodleUrl);
    setMoodleConfig(hasConfig ? config : null);
    setConfigLoaded(hasConfig);
  }, []);

  useEffect(() => { void loadConfig(); }, [loadConfig]);

  const selectedIds = useMemo(() => new Set(selectedCourses.map((c) => c.id)), [selectedCourses]);

  const toggleCourse = useCallback((course: SelectedCourse, checked: boolean) => {
    setSelectedCourses((prev) => {
      if (checked) {
        if (prev.some((c) => c.id === course.id)) return prev;
        return [...prev, course];
      }
      return prev.filter((c) => c.id !== course.id);
    });
  }, []);

  const toggleMany = useCallback((courses: SelectedCourse[], checked: boolean) => {
    setSelectedCourses((prev) => {
      if (checked) {
        const map = new Map(prev.map((c) => [c.id, c]));
        for (const c of courses) map.set(c.id, c);
        return Array.from(map.values());
      }
      const removing = new Set(courses.map((c) => c.id));
      return prev.filter((c) => !removing.has(c.id));
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedCourses([]), []);

  const resetAll = useCallback(() => {
    setFound(null);
    setSelectedCourses([]);
    setTimestart("");
    setTimeend("");
  }, []);

  const canConfigure = found !== null && selectedCourses.length > 0;

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
          <h1 className="text-3xl font-semibold tracking-tight">Gestión de matrículas</h1>
          <Button type="button" variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="mr-1.5 h-4 w-4" />
            Ajustes
          </Button>
        </div>
        <p className="text-muted-foreground">
          Matricula o desmatricula usuarios en cursos de Moodle vía API REST.
        </p>
      </header>

      {!configLoaded && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
          Configura el Token y la URL de Moodle en <button type="button" onClick={() => setSettingsOpen(true)} className="font-semibold underline underline-offset-2">Ajustes</button> para comenzar.
        </div>
      )}

      {/* ── Modo: matricular / desmatricular ── */}
      <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
        <ModeTab active={mode === "enrol"} onClick={() => setMode("enrol")} icon={<UserPlus className="h-4 w-4" />}>
          Matricular usuario
        </ModeTab>
        <ModeTab active={mode === "unenrol"} onClick={() => setMode("unenrol")} icon={<UserMinus className="h-4 w-4" />}>
          Desmatricular usuario
        </ModeTab>
      </div>

      {/* ── Sección 1: Búsqueda de usuario ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4 text-muted-foreground" /> 1. Buscar usuario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UserSearchPanel config={moodleConfig} found={found} onUserFound={setFound} />
        </CardContent>
      </Card>

      {/* ── Sección 2: Selección de cursos ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-muted-foreground" /> 2. Seleccionar cursos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CourseSelectionPanel
            config={moodleConfig}
            selectedCourses={selectedCourses}
            selectedIds={selectedIds}
            onToggle={toggleCourse}
            onToggleMany={toggleMany}
            onClearAll={clearSelection}
          />
        </CardContent>
      </Card>

      {/* ── Sección 3: Configuración ── */}
      {canConfigure && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" /> 3. Configuración
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EnrolmentConfigPanel
              mode={mode}
              roleId={roleId}
              onRoleChange={setRoleId}
              timestart={timestart}
              timeend={timeend}
              onTimestartChange={setTimestart}
              onTimeendChange={setTimeend}
              userName={found.user.fullname}
              courseCount={selectedCourses.length}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Sección 4: Ejecución ── */}
      {canConfigure && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Play className="h-4 w-4 text-muted-foreground" /> 4. Ejecución
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExecutionPanel
              config={moodleConfig}
              mode={mode}
              userId={found.user.id}
              userName={found.user.fullname}
              selectedCourses={selectedCourses}
              roleId={roleId}
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
