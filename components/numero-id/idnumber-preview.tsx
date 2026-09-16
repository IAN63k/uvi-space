"use client";

import { ArrowRight, Loader2, Pencil, Play, RotateCw, ShieldAlert, TriangleAlert } from "lucide-react";

import { APARIENCIA_ESTADO } from "@/components/numero-id/estado-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { esEjecutable, type FilaEvaluada, type Lote } from "@/lib/numero-id/plan";
import { cn } from "@/lib/utils";

export interface ProgresoComprobacion {
  procesados: number;
  total: number;
}

interface IdnumberPreviewProps {
  lote: Lote;
  comprobacion: ProgresoComprobacion | null;
  onVolver: () => void;
  onEjecutar: () => void;
  onReintentarComprobacion: () => void;
}

const plural = (n: number, singular: string, varios: string) => (n === 1 ? singular : varios);

const nombreDe = (lote: Lote, courseId: number) => {
  const curso = lote.porId.get(courseId)?.curso;
  return curso ? `${curso.shortname} (${curso.id})` : `curso ${courseId}`;
};

function motivoDeBloqueo(lote: Lote): string | null {
  if (lote.hayBloqueoDuro) return "Resuelve los conflictos marcados en rojo para poder ejecutar.";
  if (lote.valoresPorComprobar.length > 0) return "Falta comprobar algunos valores contra Moodle.";
  if (lote.cambios === 0) return "No hay cambios que ejecutar en la selección.";
  return null;
}

export function IdnumberPreview({
  lote,
  comprobacion,
  onVolver,
  onEjecutar,
  onReintentarComprobacion,
}: IdnumberPreviewProps) {
  const seleccionadas = lote.filas.filter((fila) => fila.seleccionada);
  const bloqueadas = seleccionadas.filter((fila) => fila.cambia && !esEjecutable(fila));
  const conDuenoExterno = seleccionadas.filter((fila) => esEjecutable(fila) && fila.posibleDuenoExterno);
  const comprobando = comprobacion !== null;
  const motivo = comprobando ? "Comprobando valores en Moodle…" : motivoDeBloqueo(lote);

  return (
    <div className="space-y-4">
      {comprobando && (
        <div className="space-y-2 rounded-lg border border-dashed px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Comprobando si los valores ya los tiene otro curso: {comprobacion.procesados} de {comprobacion.total}
          </p>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Progreso de la comprobación"
            aria-valuemin={0}
            aria-valuemax={comprobacion.total}
            aria-valuenow={comprobacion.procesados}
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${comprobacion.total ? (comprobacion.procesados / comprobacion.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Contador etiqueta={plural(lote.cambios, "Cambio a aplicar", "Cambios a aplicar")} valor={lote.cambios} tono="primario" />
        <Contador etiqueta="Sin cambios (se omiten)" valor={lote.sinCambios} />
        <Contador etiqueta="Bloqueados por conflicto" valor={lote.bloqueados} tono={lote.bloqueados > 0 ? "destructivo" : undefined} />
        <Contador etiqueta={plural(lote.vaciados, "Se vacía", "Se vacían")} valor={lote.vaciados} tono={lote.vaciados > 0 ? "destructivo" : undefined} />
      </dl>

      {bloqueadas.length > 0 && (
        <Conflictos lote={lote} filas={bloqueadas} onReintentar={onReintentarComprobacion} comprobando={comprobando} />
      )}

      {conDuenoExterno.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50/70 px-4 py-3 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/20 dark:text-amber-200">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {conDuenoExterno.length} {plural(conDuenoExterno.length, "curso pierde", "cursos pierden")} un Número ID
            que no coincide con su nombre corto
          </p>
          <p className="text-xs">
            Ese valor puede pertenecer a una integración que empareja cursos por Número ID. Si es así, cambiarlo
            rompe el vínculo. No bloquea la ejecución.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {conDuenoExterno.map((fila) => (
              <li
                key={fila.curso.id}
                className="rounded border border-amber-400/60 bg-background px-2 py-0.5 font-mono text-[11px]"
              >
                {fila.curso.shortname}: {fila.curso.idnumber}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="max-h-[24rem] overflow-auto rounded-lg border">
        <Table className="min-w-[40rem]">
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow>
              <TableHead>Curso</TableHead>
              <TableHead>Actual → propuesto</TableHead>
              <TableHead className="w-44">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenarParaRevision(seleccionadas).map((fila) => (
              <TableRow key={fila.curso.id}>
                <TableCell className="align-top">
                  <span className="block text-sm leading-snug">{fila.curso.fullname}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">
                    {fila.curso.id} · {fila.curso.shortname}
                  </span>
                </TableCell>
                <TableCell className="align-top">
                  <span className="inline-flex flex-wrap items-center gap-1.5 font-mono text-xs">
                    <ValorId valor={fila.curso.idnumber} />
                    <ArrowRight className="h-3 w-3 text-muted-foreground" aria-label="pasa a" />
                    <ValorId valor={fila.propuesto} destacado={fila.cambia} />
                  </span>
                </TableCell>
                <TableCell className="align-top">
                  <Accion fila={fila} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={lote.vaciados > 0 ? "destructive" : "default"}
          onClick={onEjecutar}
          disabled={motivo !== null}
        >
          <Play className="mr-1.5 h-4 w-4" />
          Ejecutar {lote.cambios} {plural(lote.cambios, "cambio", "cambios")}
        </Button>
        <Button type="button" variant="outline" onClick={onVolver} disabled={comprobando}>
          <Pencil className="mr-1.5 h-4 w-4" />
          Volver a editar
        </Button>
        {motivo && (
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {motivo}
          </span>
        )}
      </div>
    </div>
  );
}

/** Lo que exige atención arriba: primero lo bloqueado, luego lo que cambia. */
function ordenarParaRevision(filas: FilaEvaluada[]): FilaEvaluada[] {
  const peso = (fila: FilaEvaluada) => (!fila.cambia ? 2 : esEjecutable(fila) ? 1 : 0);
  return [...filas].sort((a, b) => peso(a) - peso(b));
}

function Conflictos({
  lote,
  filas,
  onReintentar,
  comprobando,
}: {
  lote: Lote;
  filas: FilaEvaluada[];
  onReintentar: () => void;
  comprobando: boolean;
}) {
  const circulares = paresCirculares(filas);
  const sinComprobar = filas.filter((fila) => fila.estado === "sin-comprobar");

  return (
    <div className="space-y-3 rounded-lg border-2 border-destructive bg-destructive/5 px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        {filas.length} {plural(filas.length, "curso seleccionado no se escribirá", "cursos seleccionados no se escribirán")}
      </p>

      <ul className="space-y-1.5 text-xs">
        {filas
          .filter((fila) => fila.estado !== "circular")
          .map((fila) => (
            <li key={fila.curso.id} className="flex gap-2">
              <span
                className={cn("mt-1 h-3 w-1 shrink-0 rounded-full", APARIENCIA_ESTADO[fila.estado].franja)}
                aria-hidden
              />
              <span>
                <span className="font-medium">{nombreDe(lote, fila.curso.id)}</span> →{" "}
                <span className="font-mono">«{fila.propuesto}»</span>: <DescripcionConflicto fila={fila} lote={lote} />
              </span>
            </li>
          ))}
      </ul>

      {circulares.map(([a, b]) => (
        <div key={`${a}-${b}`} className="space-y-1 rounded-md border border-destructive/30 bg-background px-3 py-2 text-xs">
          <p className="font-medium text-destructive">
            Intercambio circular entre {nombreDe(lote, a)} y {nombreDe(lote, b)}
          </p>
          <p className="text-muted-foreground">
            Cada uno quiere el Número ID que hoy tiene el otro, y Moodle no admite dos cursos con el mismo valor ni
            siquiera un instante. Resuélvelo en dos pasadas: en la primera, deja vacío el Número ID propuesto de{" "}
            {nombreDe(lote, a)} y ejecuta ({nombreDe(lote, b)} podrá tomar su valor en esa misma pasada); en la
            segunda, escribe en {nombreDe(lote, a)} su valor definitivo y ejecuta de nuevo.
          </p>
        </div>
      ))}

      {sinComprobar.length > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={onReintentar} disabled={comprobando}>
          <RotateCw className="mr-1.5 h-3.5 w-3.5" />
          Reintentar la comprobación de {sinComprobar.length} {plural(sinComprobar.length, "valor", "valores")}
        </Button>
      )}
    </div>
  );
}

/** Pares únicos de un ciclo, para nombrar ambos cursos una sola vez. */
function paresCirculares(filas: FilaEvaluada[]): [number, number][] {
  const pares = new Map<string, [number, number]>();
  for (const fila of filas.filter((f) => f.estado === "circular")) {
    for (const otro of fila.conflictoCon) {
      const par: [number, number] = fila.curso.id < otro ? [fila.curso.id, otro] : [otro, fila.curso.id];
      pares.set(par.join("-"), par);
    }
  }
  return [...pares.values()];
}

function DescripcionConflicto({ fila, lote }: { fila: FilaEvaluada; lote: Lote }) {
  switch (fila.estado) {
    case "duplicado":
      return <>mismo valor que {fila.conflictoCon.map((id) => nombreDe(lote, id)).join(", ")}. Cambia uno de los dos.</>;
    case "ocupado":
      return (
        <>
          ya lo tiene{" "}
          {fila.ocupantes.map((o) => `${o.fullname} (id ${o.id}, nombre corto ${o.shortname})`).join("; ")}, fuera de
          esta consulta.
        </>
      );
    case "sin-comprobar":
      return <>no se pudo comprobar en Moodle ({fila.errorComprobacion}).</>;
    case "demasiado-largo":
      return <>tiene {[...fila.propuesto].length} caracteres; Moodle admite 100.</>;
    default:
      return null;
  }
}

function Accion({ fila }: { fila: FilaEvaluada }) {
  if (!fila.cambia) return <span className="text-xs text-muted-foreground">Omitir: sin cambios</span>;
  if (!esEjecutable(fila)) {
    return (
      <span className="text-xs font-medium text-destructive">Bloqueado: {APARIENCIA_ESTADO[fila.estado].etiqueta.toLowerCase()}</span>
    );
  }
  if (fila.accion === "vaciar") return <span className="text-xs font-semibold text-destructive">Vaciar</span>;
  return <span className="text-xs font-medium">{fila.accion === "asignar" ? "Asignar" : "Reemplazar"}</span>;
}

function ValorId({ valor, destacado = false }: { valor: string; destacado?: boolean }) {
  if (valor === "") return <span className="font-sans text-muted-foreground/70">vacío</span>;
  return (
    <span className={cn("rounded px-1 py-px", destacado ? "bg-primary/10 text-foreground" : "text-muted-foreground")}>
      {valor}
    </span>
  );
}

function Contador({
  etiqueta,
  valor,
  tono,
}: {
  etiqueta: string;
  valor: number;
  tono?: "primario" | "destructivo";
}) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse rounded-lg border px-3 py-2",
        tono === "destructivo" && "border-destructive/30 bg-destructive/5 text-destructive",
        tono === "primario" && "border-primary/30 bg-primary/5",
        !tono && "bg-muted/30",
      )}
    >
      <dt className="text-[11px] text-muted-foreground">{etiqueta}</dt>
      <dd className="text-xl font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}
