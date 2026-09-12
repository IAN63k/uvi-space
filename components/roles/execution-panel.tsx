"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Download,
  Loader2,
  MinusCircle,
  RotateCcw,
  TriangleAlert,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MoodleConfig } from "@/lib/encrypted-local-storage";
import { nombreRol } from "@/lib/moodle/roles";
import { cambiarRolesDeCurso } from "@/lib/roles/api";
import { descargarLog } from "@/lib/roles/csv";
import { operacionesPorCurso, type Plan } from "@/lib/roles/plan";
import type { ParticipanteConsolidado, ResultadoOperacion } from "@/lib/roles/types";

interface ExecutionPanelProps {
  config: MoodleConfig;
  plan: Plan;
  participantes: ParticipanteConsolidado[];
  onCancelar: () => void;
  onFinalizado: () => void;
  onNuevaOperacion: () => void;
}

type Fase = "confirmar" | "ejecutando" | "resultado";

export function ExecutionPanel({
  config,
  plan,
  participantes,
  onCancelar,
  onFinalizado,
  onNuevaOperacion,
}: ExecutionPanelProps) {
  const [fase, setFase] = useState<Fase>("confirmar");
  const [cursosProcesados, setCursosProcesados] = useState(0);
  const [resultados, setResultados] = useState<ResultadoOperacion[]>([]);

  const grupos = [...operacionesPorCurso(plan).entries()];
  const totalCursos = grupos.length;

  const ejecutar = async () => {
    setFase("ejecutando");
    setCursosProcesados(0);
    setResultados([]);

    const acumulados: ResultadoOperacion[] = [];

    // Un curso que falle no detiene al resto del lote.
    for (const [courseId, operaciones] of grupos) {
      try {
        const respuesta = await cambiarRolesDeCurso(config, courseId, operaciones);
        acumulados.push(...respuesta.resultados);
      } catch (err) {
        const detalle = err instanceof Error ? err.message : "Error inesperado al contactar la API";
        for (const operacion of operaciones) {
          acumulados.push({
            userId: operacion.userId,
            courseId,
            roleId: operacion.roleDestinoId,
            accion: "asignar",
            estado: "error",
            detalle,
          });
        }
      }

      setCursosProcesados((procesados) => procesados + 1);
      setResultados([...acumulados]);
    }

    setFase("resultado");
    onFinalizado();
  };

  if (fase === "confirmar") {
    return (
      <ConfirmacionEjecucion
        plan={plan}
        onCancelar={onCancelar}
        onConfirmar={() => void ejecutar()}
      />
    );
  }

  if (fase === "ejecutando") {
    const porcentaje = totalCursos > 0 ? Math.round((cursosProcesados / totalCursos) * 100) : 0;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span aria-live="polite">
            Procesando curso {Math.min(cursosProcesados + 1, totalCursos)} de {totalCursos}…
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalCursos}
          aria-valuenow={cursosProcesados}
          aria-label="Progreso del cambio de roles"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${porcentaje}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          No cierres esta página: los cambios ya aplicados no se revierten.
        </p>
      </div>
    );
  }

  return (
    <ResultadoEjecucion
      resultados={resultados}
      participantes={participantes}
      onNuevaOperacion={onNuevaOperacion}
    />
  );
}

function ConfirmacionEjecucion({
  plan,
  onCancelar,
  onConfirmar,
}: {
  plan: Plan;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const hayRetiros = plan.retiros > 0;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onCancelar} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-confirmacion"
        className="fixed left-1/2 top-1/2 z-[70] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border bg-background shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b bg-muted/30 px-5 py-4">
          <div
            className={
              "flex h-8 w-8 items-center justify-center rounded-lg " +
              (hayRetiros ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")
            }
          >
            <TriangleAlert className="h-4 w-4" />
          </div>
          <h2 id="titulo-confirmacion" className="text-sm font-semibold">
            Confirmar cambio de roles
          </h2>
        </div>

        <div className="space-y-3 px-5 py-5 text-sm">
          <p>
            Se van a agregar <span className="font-semibold">{plan.asignaciones}</span> asignacion
            {plan.asignaciones !== 1 ? "es" : ""} de rol en{" "}
            <span className="font-semibold">{plan.cursos}</span> curso
            {plan.cursos !== 1 ? "s" : ""}, sobre{" "}
            <span className="font-semibold">{plan.usuarios}</span> usuario
            {plan.usuarios !== 1 ? "s" : ""}.
          </p>

          {hayRetiros && (
            <div className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
              <p className="font-semibold">
                Se retirarán {plan.retiros} asignacion{plan.retiros !== 1 ? "es" : ""} de rol.
              </p>
              <p>
                Cada retiro se ejecuta solo después de comprobar que el rol destino quedó asignado
                en ese curso. Esta acción no se puede deshacer desde la herramienta.
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            No se matricula ni se desmatricula a nadie: solo cambian las asignaciones de rol.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t bg-muted/20 px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            variant={hayRetiros ? "destructive" : "default"}
            onClick={onConfirmar}
          >
            {hayRetiros ? "Aplicar y retirar" : "Aplicar cambios"}
          </Button>
        </div>
      </div>
    </>
  );
}

function ResultadoEjecucion({
  resultados,
  participantes,
  onNuevaOperacion,
}: {
  resultados: ResultadoOperacion[];
  participantes: ParticipanteConsolidado[];
  onNuevaOperacion: () => void;
}) {
  const porId = new Map(participantes.map((p) => [p.userId, p]));
  const aplicados = resultados.filter((r) => r.estado === "ok").length;
  const omitidos = resultados.filter((r) => r.estado === "omitido").length;
  const errores = resultados.filter((r) => r.estado === "error").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        <Resumen
          icono={<CheckCircle2 className="h-3.5 w-3.5" />}
          texto={`${aplicados} aplicada${aplicados !== 1 ? "s" : ""}`}
          clase="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
        />
        {omitidos > 0 && (
          <Resumen
            icono={<MinusCircle className="h-3.5 w-3.5" />}
            texto={`${omitidos} omitida${omitidos !== 1 ? "s" : ""}`}
            clase="bg-muted text-muted-foreground"
          />
        )}
        {errores > 0 && (
          <Resumen
            icono={<XCircle className="h-3.5 w-3.5" />}
            texto={`${errores} con error`}
            clase="bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
          />
        )}

        {resultados.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => descargarLog(resultados, participantes)}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        )}
      </div>

      <div className="max-h-[28rem] overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead className="w-20">Curso</TableHead>
              <TableHead>Operación</TableHead>
              <TableHead>Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resultados.map((resultado, indice) => (
              <TableRow key={`${resultado.userId}-${resultado.courseId}-${resultado.accion}-${resultado.roleId}-${indice}`}>
                <TableCell className="align-top text-sm">
                  {porId.get(resultado.userId)?.fullname ?? `Usuario ${resultado.userId}`}
                </TableCell>
                <TableCell className="align-top font-mono text-xs">{resultado.courseId}</TableCell>
                <TableCell className="align-top text-xs">
                  <span
                    className={
                      resultado.accion === "retirar" ? "text-destructive" : "text-foreground"
                    }
                  >
                    {resultado.accion === "asignar" ? "Asignar" : "Retirar"}
                  </span>{" "}
                  {nombreRol(resultado.roleId)}
                </TableCell>
                <TableCell className="align-top text-xs">
                  <EstadoResultado resultado={resultado} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button type="button" variant="outline" onClick={onNuevaOperacion}>
        <RotateCcw className="mr-1.5 h-4 w-4" />
        Nueva operación
      </Button>
    </div>
  );
}

function EstadoResultado({ resultado }: { resultado: ResultadoOperacion }) {
  if (resultado.estado === "ok") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Aplicada
      </span>
    );
  }

  if (resultado.estado === "omitido") {
    return (
      <span className="inline-flex items-start gap-1 text-muted-foreground">
        <MinusCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{resultado.detalle ?? "Sin cambios"}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-start gap-1 text-rose-700 dark:text-rose-400">
      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="break-words">{resultado.detalle ?? "Error desconocido"}</span>
    </span>
  );
}

function Resumen({
  icono,
  texto,
  clase,
}: {
  icono: React.ReactNode;
  texto: string;
  clase: string;
}) {
  return (
    <span
      className={"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold " + clase}
    >
      {icono}
      {texto}
    </span>
  );
}
