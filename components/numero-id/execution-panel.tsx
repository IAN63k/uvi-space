"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Download,
  KeyRound,
  Loader2,
  MinusCircle,
  RotateCcw,
  TriangleAlert,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MoodleConfig } from "@/lib/encrypted-local-storage";
import { descargarResultado } from "@/lib/numero-id/csv";
import { ejecutarLote, falloTotalPorPermisos } from "@/lib/numero-id/ejecutar-lote";
import { esEjecutable, type Lote } from "@/lib/numero-id/plan";
import type { ResultadoCurso } from "@/lib/numero-id/types";
import { cn } from "@/lib/utils";

interface ExecutionPanelProps {
  config: MoodleConfig;
  lote: Lote;
  onCancelar: () => void;
  onFinalizado: () => void;
  onVolverALaTabla: () => void;
}

type Fase = "confirmar" | "ejecutando" | "resultado";

const plural = (n: number, singular: string, varios: string) => (n === 1 ? singular : varios);

export function ExecutionPanel({ config, lote: loteActual, onCancelar, onFinalizado, onVolverALaTabla }: ExecutionPanelProps) {
  // Se congela el lote confirmado: nada de lo que cambie en la página durante la
  // ejecución puede alterar lo que se está escribiendo.
  const [lote] = useState(loteActual);
  const [fase, setFase] = useState<Fase>("confirmar");
  const [resultados, setResultados] = useState<ResultadoCurso[]>([]);

  const ejecutar = async () => {
    setFase("ejecutando");
    await ejecutarLote(config, lote, setResultados);
    setFase("resultado");
    onFinalizado();
  };

  if (fase === "confirmar") {
    return <Confirmacion lote={lote} onCancelar={onCancelar} onConfirmar={() => void ejecutar()} />;
  }

  if (fase === "ejecutando") {
    const procesados = resultados.filter((r) => r.estado !== "omitido" || r.motivo === "dependencia").length;
    const porcentaje = lote.cambios > 0 ? Math.round((procesados / lote.cambios) * 100) : 0;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span aria-live="polite">
            Escribiendo y verificando: {procesados} de {lote.cambios} {plural(lote.cambios, "curso", "cursos")}
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Progreso del cambio de Número ID"
          aria-valuemin={0}
          aria-valuemax={lote.cambios}
          aria-valuenow={procesados}
        >
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${porcentaje}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">
          No cierres esta página. Los cambios que ya se aplicaron no se revierten.
        </p>
      </div>
    );
  }

  return <Resultado resultados={resultados} onVolverALaTabla={onVolverALaTabla} />;
}

function Confirmacion({
  lote,
  onCancelar,
  onConfirmar,
}: {
  lote: Lote;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const conDuenoExterno = lote.filas.filter((fila) => esEjecutable(fila) && fila.posibleDuenoExterno).length;
  const destructivo = lote.vaciados > 0 || conDuenoExterno > 0;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onCancelar} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-confirmar-idnumber"
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancelar();
        }}
        className="fixed left-1/2 top-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border bg-background shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b bg-muted/30 px-5 py-4">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              destructivo ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
            )}
          >
            <TriangleAlert className="h-4 w-4" />
          </div>
          <h2 id="titulo-confirmar-idnumber" className="text-sm font-semibold">
            Confirmar cambio de Número ID
          </h2>
        </div>

        <div className="space-y-3 px-5 py-5 text-sm">
          <p>
            Se va a escribir el Número ID de <span className="font-semibold">{lote.cambios}</span>{" "}
            {plural(lote.cambios, "curso", "cursos")}. No se toca ningún otro campo.
          </p>

          {destructivo && (
            <ul className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
              {lote.vaciados > 0 && (
                <li>
                  Se vacía el Número ID de {lote.vaciados} {plural(lote.vaciados, "curso", "cursos")}.
                </li>
              )}
              {conDuenoExterno > 0 && (
                <li>
                  {conDuenoExterno} {plural(conDuenoExterno, "curso pierde", "cursos pierden")} un Número ID distinto
                  de su nombre corto, que puede usar una integración externa.
                </li>
              )}
            </ul>
          )}

          <p className="text-xs text-muted-foreground">
            Después de escribir, cada curso se vuelve a leer: solo se marca como aplicado lo que Moodle confirma.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t bg-muted/20 px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onCancelar} autoFocus>
            Cancelar
          </Button>
          <Button type="button" size="sm" variant={destructivo ? "destructive" : "default"} onClick={onConfirmar}>
            Aplicar {lote.cambios} {plural(lote.cambios, "cambio", "cambios")}
          </Button>
        </div>
      </div>
    </>
  );
}

function Resultado({
  resultados,
  onVolverALaTabla,
}: {
  resultados: ResultadoCurso[];
  onVolverALaTabla: () => void;
}) {
  const aplicados = resultados.filter((r) => r.estado === "aplicado").length;
  const omitidos = resultados.filter((r) => r.estado === "omitido").length;
  const errores = resultados.filter((r) => r.estado === "error").length;
  const sinPermiso = falloTotalPorPermisos(resultados);
  const primerError = resultados.find((r) => r.estado === "error");

  return (
    <div className="space-y-4">
      {sinPermiso && (
        <div role="alert" className="space-y-2 rounded-lg border-2 border-destructive bg-destructive/5 px-4 py-3 text-destructive">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 shrink-0" />
            El token no tiene permiso para cambiar el Número ID: no se aplicó ningún cambio
          </p>
          <p className="text-xs">
            {errores === 1 ? "El curso falló" : `Los ${errores} cursos fallaron`} por este motivo. El usuario del
            token necesita la capacidad{" "}
            <code className="font-mono">moodle/course:changeidnumber</code> (además de{" "}
            <code className="font-mono">moodle/course:update</code>) en estos cursos, y el servicio web debe incluir{" "}
            <code className="font-mono">core_course_update_courses</code>.
          </p>
          {primerError?.detalle && (
            <p className="rounded border border-destructive/30 bg-background px-2 py-1 font-mono text-[11px]">
              Moodle: {primerError.detalle}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        <Resumen icono={CheckCircle2} texto={`${aplicados} ${plural(aplicados, "aplicado", "aplicados")} y verificados`} clase="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" />
        {omitidos > 0 && (
          <Resumen icono={MinusCircle} texto={`${omitidos} ${plural(omitidos, "omitido", "omitidos")}`} clase="bg-muted text-muted-foreground" />
        )}
        {errores > 0 && (
          <Resumen icono={XCircle} texto={`${errores} con error`} clase="bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" />
        )}
        {resultados.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => descargarResultado(resultados)}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        )}
      </div>

      <div className="max-h-[28rem] overflow-auto rounded-lg border">
        <Table className="min-w-[44rem]">
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow>
              <TableHead>Curso</TableHead>
              <TableHead>Anterior → propuesto</TableHead>
              <TableHead>En Moodle</TableHead>
              <TableHead className="w-72">Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resultados.map((resultado) => (
              <TableRow key={resultado.courseId}>
                <TableCell className="align-top">
                  <span className="block font-mono text-xs">{resultado.shortname}</span>
                  <span className="block text-[11px] text-muted-foreground">{resultado.courseId}</span>
                </TableCell>
                <TableCell className="align-top font-mono text-xs">
                  {resultado.anterior || <span className="font-sans text-muted-foreground/70">vacío</span>} →{" "}
                  {resultado.esperado || <span className="font-sans text-muted-foreground/70">vacío</span>}
                </TableCell>
                <TableCell className="align-top font-mono text-xs">
                  {resultado.verificado === null ? (
                    <span className="font-sans text-muted-foreground/70">—</span>
                  ) : (
                    resultado.verificado || <span className="font-sans text-muted-foreground/70">vacío</span>
                  )}
                </TableCell>
                <TableCell className="align-top text-xs">
                  <EstadoResultado resultado={resultado} resumirPermisos={sinPermiso} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button type="button" variant="outline" onClick={onVolverALaTabla}>
        <RotateCcw className="mr-1.5 h-4 w-4" />
        Volver a la tabla
      </Button>
    </div>
  );
}

function EstadoResultado({ resultado, resumirPermisos }: { resultado: ResultadoCurso; resumirPermisos: boolean }) {
  if (resultado.estado === "aplicado") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Aplicado y verificado
      </span>
    );
  }

  if (resultado.estado === "omitido") {
    return (
      <span className="inline-flex items-start gap-1 text-muted-foreground">
        <MinusCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{resultado.detalle ?? "Omitido"}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-start gap-1 text-rose-700 dark:text-rose-400">
      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="break-words">
        {resumirPermisos ? "Sin permiso (ver el aviso de arriba)" : (resultado.detalle ?? "Error desconocido")}
      </span>
    </span>
  );
}

function Resumen({ icono: Icono, texto, clase }: { icono: typeof CheckCircle2; texto: string; clase: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", clase)}>
      <Icono className="h-3.5 w-3.5" />
      {texto}
    </span>
  );
}
