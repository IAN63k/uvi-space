"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  Loader2,
  ListChecks,
  Play,
  Settings2,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import { ChangePreview } from "@/components/roles/change-preview";
import { CourseIdsInput } from "@/components/roles/course-ids-input";
import { ExecutionPanel } from "@/components/roles/execution-panel";
import { ParticipantsTable } from "@/components/roles/participants-table";
import { RoleChangePanel } from "@/components/roles/role-change-panel";
import { SettingsSidebar } from "@/components/settings-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMoodleConfig } from "@/hooks/use-moodle-config";
import { ROLES_ASIGNABLES_INSTITUCIONALES } from "@/lib/moodle/roles";
import { consultarParticipantes } from "@/lib/roles/api";
import { construirPlan } from "@/lib/roles/plan";
import type { ModoCambio, ParticipantesResponse } from "@/lib/roles/types";

type Fase = "seleccion" | "previsualizar" | "ejecutar";

const claveCurso = (userId: number, courseId: number) => `${userId}:${courseId}`;
const claveRetiro = (userId: number, courseId: number, roleId: number) =>
  `${userId}:${courseId}:${roleId}`;

export default function CambioDeRolesPage() {
  const { config, estaConfigurado, recargar } = useMoodleConfig();
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);

  const [courseIds, setCourseIds] = useState<number[]>([]);
  const [consulta, setConsulta] = useState<ParticipantesResponse | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState<string | null>(null);

  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [fase, setFase] = useState<Fase>("seleccion");

  const [roleDestinoId, setRoleDestinoId] = useState<number>(
    ROLES_ASIGNABLES_INSTITUCIONALES[0].id,
  );
  const [modo, setModo] = useState<ModoCambio>("agregar");
  // Se guardan las desviaciones del valor por defecto, no el estado completo:
  // así cambiar el rol destino recalcula los defaults sin estado obsoleto.
  const [cursosExcluidos, setCursosExcluidos] = useState<Set<string>>(new Set());
  const [retirosDesmarcados, setRetirosDesmarcados] = useState<Set<string>>(new Set());

  const participantes = useMemo(() => consulta?.participantes ?? [], [consulta]);

  const seleccionados = useMemo(
    () => participantes.filter((participante) => seleccion.has(participante.userId)),
    [participantes, seleccion],
  );

  const esCursoExcluido = useCallback(
    (userId: number, courseId: number) => cursosExcluidos.has(claveCurso(userId, courseId)),
    [cursosExcluidos],
  );

  const esRetiroDesmarcado = useCallback(
    (userId: number, courseId: number, roleId: number) =>
      retirosDesmarcados.has(claveRetiro(userId, courseId, roleId)),
    [retirosDesmarcados],
  );

  const plan = useMemo(
    () =>
      construirPlan({
        participantes: seleccionados,
        roleDestinoId,
        modo,
        cursoExcluido: esCursoExcluido,
        retiroDesmarcado: esRetiroDesmarcado,
      }),
    [seleccionados, roleDestinoId, modo, esCursoExcluido, esRetiroDesmarcado],
  );

  const consultar = useCallback(async () => {
    if (!config) return;

    setConsultando(true);
    setErrorConsulta(null);

    try {
      const respuesta = await consultarParticipantes(config, courseIds);
      setConsulta(respuesta);
      setSeleccion(new Set());
      setFase("seleccion");
    } catch (err) {
      setConsulta(null);
      setErrorConsulta(
        err instanceof Error ? err.message : "Error inesperado al consultar los participantes",
      );
    } finally {
      setConsultando(false);
    }
  }, [config, courseIds]);

  /** Tras ejecutar, la tabla debe mostrar el estado real, no el esperado. */
  const refrescar = useCallback(async () => {
    if (!config || courseIds.length === 0) return;
    try {
      setConsulta(await consultarParticipantes(config, courseIds));
    } catch {
      // El log del lote ya está en pantalla; no poder refrescar no lo invalida.
    }
  }, [config, courseIds]);

  const alternarCurso = useCallback((userId: number, courseId: number, incluido: boolean) => {
    setCursosExcluidos((previo) => {
      const siguiente = new Set(previo);
      if (incluido) siguiente.delete(claveCurso(userId, courseId));
      else siguiente.add(claveCurso(userId, courseId));
      return siguiente;
    });
  }, []);

  const alternarRetiro = useCallback(
    (userId: number, courseId: number, roleId: number, retirar: boolean) => {
      setRetirosDesmarcados((previo) => {
        const siguiente = new Set(previo);
        if (retirar) siguiente.delete(claveRetiro(userId, courseId, roleId));
        else siguiente.add(claveRetiro(userId, courseId, roleId));
        return siguiente;
      });
    },
    [],
  );

  const nuevaOperacion = useCallback(() => {
    setSeleccion(new Set());
    setCursosExcluidos(new Set());
    setRetirosDesmarcados(new Set());
    setModo("agregar");
    setFase("seleccion");
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 md:px-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">API REST Moodle</Badge>
          {estaConfigurado && (
            <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-400">
              Token configurado
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Cambio de roles en cursos</h1>
          <Button type="button" variant="outline" onClick={() => setAjustesAbiertos(true)}>
            <Settings2 className="mr-1.5 h-4 w-4" />
            Ajustes
          </Button>
        </div>
        <p className="text-muted-foreground">
          Asigna y retira roles de participantes dentro de uno o varios cursos. No matricula ni
          desmatricula: los usuarios siguen inscritos, solo cambia su rol.
        </p>
      </header>

      {!estaConfigurado && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
          Configura el Token y la URL de Moodle en{" "}
          <button
            type="button"
            onClick={() => setAjustesAbiertos(true)}
            className="rounded font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ajustes
          </button>{" "}
          para comenzar.
        </div>
      )}

      {/* ── 1. Cursos ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-muted-foreground" /> 1. Cursos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CourseIdsInput
            ids={courseIds}
            onChange={setCourseIds}
            onConsultar={() => void consultar()}
            cargando={consultando}
            deshabilitado={!estaConfigurado}
          />
        </CardContent>
      </Card>

      {/* ── 2. Participantes ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-muted-foreground" /> 2. Participantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {consultando && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Consultando {courseIds.length} curso{courseIds.length !== 1 ? "s" : ""} en Moodle…
            </div>
          )}

          {!consultando && errorConsulta && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorConsulta}</span>
            </div>
          )}

          {!consultando && !errorConsulta && !consulta && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
              <Users className="h-6 w-6 text-muted-foreground/60" />
              <p className="text-sm font-medium">Aún no hay participantes</p>
              <p className="text-sm text-muted-foreground">
                Agrega los IDs de curso arriba y consulta para ver a los usuarios y sus roles.
              </p>
            </div>
          )}

          {!consultando && !errorConsulta && consulta && (
            <ParticipantsTable
              participantes={participantes}
              cursos={consulta.cursos}
              seleccion={seleccion}
              onSeleccionChange={setSeleccion}
            />
          )}
        </CardContent>
      </Card>

      {/* ── 3. Configuración del cambio ── */}
      {seleccion.size > 0 && fase === "seleccion" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" /> 3. Cambio a aplicar
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => setPanelAbierto(true)}>
              <SlidersHorizontal className="mr-1.5 h-4 w-4" />
              Configurar cambio para {seleccion.size} usuario{seleccion.size !== 1 ? "s" : ""}
            </Button>
            <span className="text-sm text-muted-foreground">
              Se abrirá un panel para elegir el rol destino y los cursos.
            </span>
          </CardContent>
        </Card>
      )}

      {/* ── 4. Previsualización ── */}
      {fase === "previsualizar" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-muted-foreground" /> 4. Previsualización
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePreview
              plan={plan}
              todosLosParticipantes={participantes}
              onVolver={() => {
                setFase("seleccion");
                setPanelAbierto(true);
              }}
              onEjecutar={() => setFase("ejecutar")}
            />
          </CardContent>
        </Card>
      )}

      {/* ── 5. Ejecución ── */}
      {fase === "ejecutar" && config && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Play className="h-4 w-4 text-muted-foreground" /> 5. Ejecución
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExecutionPanel
              config={config}
              plan={plan}
              participantes={participantes}
              onCancelar={() => setFase("previsualizar")}
              onFinalizado={() => void refrescar()}
              onNuevaOperacion={nuevaOperacion}
            />
          </CardContent>
        </Card>
      )}

      <RoleChangePanel
        abierto={panelAbierto}
        onAbiertoChange={setPanelAbierto}
        seleccionados={seleccionados}
        roleDestinoId={roleDestinoId}
        onRoleDestinoChange={setRoleDestinoId}
        modo={modo}
        onModoChange={setModo}
        esCursoExcluido={esCursoExcluido}
        onAlternarCurso={alternarCurso}
        esRetiroDesmarcado={esRetiroDesmarcado}
        onAlternarRetiro={alternarRetiro}
        cursosIncluidos={plan.filas.length}
        onPrevisualizar={() => {
          setPanelAbierto(false);
          setFase("previsualizar");
        }}
      />

      <SettingsSidebar
        open={ajustesAbiertos}
        onClose={() => {
          setAjustesAbiertos(false);
          void recargar();
        }}
      />
    </main>
  );
}
