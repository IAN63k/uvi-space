"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AlertTriangle, ArrowDownToLine, BookOpen, Search, TriangleAlert, Undo2 } from "lucide-react";

import { APARIENCIA_ESTADO, EstadoBadge, esFilaEnConflicto } from "@/components/numero-id/estado-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EstadoFila, FilaEvaluada, Lote } from "@/lib/numero-id/plan";
import type { AvisoValor } from "@/lib/numero-id/valor";
import { cn } from "@/lib/utils";

type Filtro = "todos" | "conflictos" | EstadoFila;

const ORDEN_ESTADOS: EstadoFila[] = [
  "listo",
  "vacio",
  "sin-cambios",
  "duplicado",
  "circular",
  "ocupado",
  "sin-comprobar",
  "demasiado-largo",
];

const TEXTO_AVISO: Record<AvisoValor, string> = {
  "espacios-internos": "Tiene espacios internos",
  "caracteres-inusuales": "Tiene caracteres poco habituales",
};

interface CoursesTableProps {
  lote: Lote;
  /** Texto tal como se escribió en cada campo; sin entrada, el valor actual. */
  propuestas: ReadonlyMap<number, string>;
  seleccion: ReadonlySet<number>;
  onSeleccionChange: (seleccion: Set<number>) => void;
  onPropuestaChange: (courseId: number, valor: string) => void;
  onRestablecer: (courseIds: number[]) => void;
  soloLectura: boolean;
  mostrarCategoria: boolean;
}

export function CoursesTable({
  lote,
  propuestas,
  seleccion,
  onSeleccionChange,
  onPropuestaChange,
  onRestablecer,
  soloLectura,
  mostrarCategoria,
}: CoursesTableProps) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const contenedorRef = useRef<HTMLDivElement>(null);
  const ultimoConflictoRef = useRef<string | null>(null);

  const conflictos = lote.filas.filter(esFilaEnConflicto).length;

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return lote.filas.filter((fila) => {
      const coincideFiltro =
        filtro === "todos" || (filtro === "conflictos" ? esFilaEnConflicto(fila) : fila.estado === filtro);
      const { curso } = fila;
      const coincideTexto =
        !texto ||
        curso.fullname.toLowerCase().includes(texto) ||
        curso.shortname.toLowerCase().includes(texto) ||
        curso.idnumber.toLowerCase().includes(texto) ||
        String(curso.id) === texto;
      return coincideFiltro && coincideTexto;
    });
  }, [lote.filas, busqueda, filtro]);

  const idsVisibles = visibles.map((fila) => fila.curso.id);
  const seleccionadasVisibles = idsVisibles.filter((id) => seleccion.has(id)).length;
  const todasSeleccionadas = idsVisibles.length > 0 && seleccionadasVisibles === idsVisibles.length;

  const alternarSeleccion = (ids: number[], marcar: boolean) => {
    const siguiente = new Set(seleccion);
    ids.forEach((id) => (marcar ? siguiente.add(id) : siguiente.delete(id)));
    onSeleccionChange(siguiente);
  };

  const campos = () => [...(contenedorRef.current?.querySelectorAll<HTMLInputElement>("input[data-propuesta]") ?? [])];

  const enfocarCampo = (campo: HTMLInputElement | undefined) => {
    if (!campo) return;
    campo.focus();
    campo.select();
    campo.scrollIntoView({ block: "nearest" });
  };

  // Al pulsar el botón el foco sale del campo: se recuerda el último conflicto
  // visitado para que cada pulsación avance al siguiente.
  const irAlSiguienteConflicto = () => {
    const lista = campos();
    const desde = lista.findIndex((campo) => campo.dataset.courseId === ultimoConflictoRef.current);
    const enConflicto = (campo: HTMLInputElement) => campo.dataset.conflicto === "true";
    const siguiente = lista.slice(desde + 1).find(enConflicto) ?? lista.find(enConflicto);
    ultimoConflictoRef.current = siguiente?.dataset.courseId ?? null;
    enfocarCampo(siguiente);
  };

  const alPulsarTecla = (event: KeyboardEvent<HTMLInputElement>, courseId: number) => {
    const campo = event.currentTarget;
    const lista = campos();
    const indice = lista.indexOf(campo);

    if (event.key === "ArrowDown" || event.key === "Enter") {
      event.preventDefault();
      enfocarCampo(lista[indice + 1]);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      enfocarCampo(lista[indice - 1]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onPropuestaChange(courseId, campo.dataset.alEnfocar ?? campo.value);
    }
  };

  const conEdicion = [...seleccion].filter((id) => propuestas.has(id));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-1">
          <Label htmlFor="buscar-curso" className="text-xs text-muted-foreground">
            Buscar por nombre, nombre corto, Número ID o ID de curso
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="buscar-curso"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Ej. MAT-101 o Cálculo diferencial"
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={irAlSiguienteConflicto}
            disabled={!visibles.some(esFilaEnConflicto)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-destructive/40 px-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Siguiente conflicto
          </button>
          {!soloLectura && conEdicion.length > 0 && (
            <button
              type="button"
              onClick={() => onRestablecer(conEdicion)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Restablecer {conEdicion.length} seleccionada{conEdicion.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
        <ChipFiltro activo={filtro === "todos"} onClick={() => setFiltro("todos")} etiqueta="Todos" valor={lote.filas.length} />
        {conflictos > 0 && (
          <ChipFiltro
            activo={filtro === "conflictos"}
            onClick={() => setFiltro("conflictos")}
            etiqueta="En conflicto"
            valor={conflictos}
            franja="bg-destructive"
          />
        )}
        {ORDEN_ESTADOS.filter((estado) => lote.conteoPorEstado[estado] > 0 || estado === "vacio").map((estado) => (
          <ChipFiltro
            key={estado}
            activo={filtro === estado}
            onClick={() => setFiltro(estado)}
            etiqueta={APARIENCIA_ESTADO[estado].etiqueta}
            valor={lote.conteoPorEstado[estado]}
            franja={APARIENCIA_ESTADO[estado].franja}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        Mostrando <span className="font-semibold tabular-nums text-foreground">{visibles.length}</span> de{" "}
        {lote.filas.length} cursos ·{" "}
        <span className="font-semibold tabular-nums text-foreground">{seleccion.size}</span> seleccionado
        {seleccion.size !== 1 ? "s" : ""} para ejecutar
      </p>

      {visibles.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
          <BookOpen className="h-6 w-6 text-muted-foreground/60" />
          <p className="text-sm font-medium">
            {lote.filas.length === 0 ? "La categoría no tiene cursos" : "Ningún curso coincide con el filtro"}
          </p>
          <p className="text-sm text-muted-foreground">
            {lote.filas.length === 0
              ? "Prueba a incluir subcategorías o verifica que el token pueda ver los cursos ocultos."
              : "Ajusta la búsqueda o elige otro estado."}
          </p>
        </div>
      ) : (
        <div ref={contenedorRef} className="max-h-[36rem] overflow-auto rounded-lg border">
          <Table className="min-w-[60rem]">
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={todasSeleccionadas}
                    indeterminate={seleccionadasVisibles > 0 && !todasSeleccionadas}
                    onCheckedChange={(marcado) => alternarSeleccion(idsVisibles, marcado === true)}
                    disabled={soloLectura}
                    aria-label="Seleccionar todos los cursos visibles"
                  />
                </TableHead>
                <TableHead className="w-20">ID</TableHead>
                <TableHead>Nombre completo</TableHead>
                <TableHead>Nombre corto</TableHead>
                <TableHead>Número ID actual</TableHead>
                <TableHead className="w-64">Número ID propuesto</TableHead>
                <TableHead className="w-52">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((fila) => (
                <FilaCurso
                  key={fila.curso.id}
                  fila={fila}
                  lote={lote}
                  texto={propuestas.get(fila.curso.id) ?? fila.curso.idnumber}
                  editada={propuestas.has(fila.curso.id) && fila.cambia}
                  seleccionada={seleccion.has(fila.curso.id)}
                  soloLectura={soloLectura}
                  mostrarCategoria={mostrarCategoria}
                  onSeleccionar={(marcar) => alternarSeleccion([fila.curso.id], marcar)}
                  onCambiar={(valor) => onPropuestaChange(fila.curso.id, valor)}
                  onRestablecer={() => onRestablecer([fila.curso.id])}
                  onTecla={(event) => alPulsarTecla(event, fila.curso.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!soloLectura && (
        <p className="text-[11px] text-muted-foreground/80">
          En el campo propuesto: ↑ ↓ o Enter cambian de fila · Esc deshace lo escrito desde que entraste al campo.
        </p>
      )}
    </div>
  );
}

function ChipFiltro({
  activo,
  onClick,
  etiqueta,
  valor,
  franja,
}: {
  activo: boolean;
  onClick: () => void;
  etiqueta: string;
  valor: number;
  franja?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        activo ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
      )}
    >
      {franja && <span className={cn("h-3 w-1 rounded-full", franja)} aria-hidden />}
      {etiqueta}
      <span className="font-semibold tabular-nums">{valor}</span>
    </button>
  );
}

interface FilaCursoProps {
  fila: FilaEvaluada;
  lote: Lote;
  texto: string;
  editada: boolean;
  seleccionada: boolean;
  soloLectura: boolean;
  mostrarCategoria: boolean;
  onSeleccionar: (marcar: boolean) => void;
  onCambiar: (valor: string) => void;
  onRestablecer: () => void;
  onTecla: (event: KeyboardEvent<HTMLInputElement>) => void;
}

function FilaCurso({
  fila,
  lote,
  texto,
  editada,
  seleccionada,
  soloLectura,
  mostrarCategoria,
  onSeleccionar,
  onCambiar,
  onRestablecer,
  onTecla,
}: FilaCursoProps) {
  const { curso } = fila;
  const enConflicto = esFilaEnConflicto(fila);
  const nombre = `${curso.shortname} (${curso.id})`;

  return (
    <TableRow
      data-state={seleccionada ? "selected" : undefined}
      className={cn(enConflicto && "bg-destructive/[0.04] hover:bg-destructive/[0.07]")}
    >
      <TableCell className="relative pl-4 align-top">
        <span className={cn("absolute inset-y-0 left-0 w-1", APARIENCIA_ESTADO[fila.estado].franja)} aria-hidden />
        <Checkbox
          checked={seleccionada}
          onCheckedChange={(valor) => onSeleccionar(valor === true)}
          disabled={soloLectura}
          aria-label={`Seleccionar ${nombre} para ejecutar`}
          className="mt-1.5"
        />
      </TableCell>
      <TableCell className="align-top pt-3 font-mono text-xs text-muted-foreground">{curso.id}</TableCell>
      <TableCell className="max-w-[18rem] align-top pt-2.5">
        <span className="block whitespace-normal text-sm leading-snug">{curso.fullname}</span>
        {mostrarCategoria && (
          <span className="block truncate text-[11px] text-muted-foreground">{curso.categoryName}</span>
        )}
      </TableCell>
      <TableCell className="align-top pt-2.5 font-mono text-xs">{curso.shortname}</TableCell>
      <TableCell className="align-top pt-2.5">
        {curso.idnumber === "" ? (
          <span className="text-xs text-muted-foreground/60">— vacío —</span>
        ) : (
          <span className="font-mono text-xs">{curso.idnumber}</span>
        )}
        {fila.posibleDuenoExterno && (
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
            <TriangleAlert className="h-3 w-3 shrink-0" aria-hidden />
            No coincide con el nombre corto
          </span>
        )}
      </TableCell>
      <TableCell className="align-top">
        <div className="flex items-center gap-1">
          <input
            data-propuesta
            data-course-id={curso.id}
            data-conflicto={enConflicto}
            value={texto}
            readOnly={soloLectura}
            onFocus={(event) => {
              event.currentTarget.dataset.alEnfocar = event.currentTarget.value;
            }}
            onChange={(event) => onCambiar(event.target.value)}
            onBlur={(event) => {
              const recortado = event.target.value.trim();
              if (recortado !== event.target.value) onCambiar(recortado);
            }}
            onKeyDown={onTecla}
            aria-label={`Número ID propuesto para ${nombre}`}
            aria-invalid={enConflicto || undefined}
            spellCheck={false}
            autoComplete="off"
            className={cn(
              "h-8 w-full min-w-[11rem] rounded-md border bg-background px-2 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring read-only:bg-muted/40",
              enConflicto ? "border-destructive/60" : fila.cambia ? "border-primary/50" : "border-input",
            )}
          />
          {editada && !soloLectura && (
            <button
              type="button"
              onClick={onRestablecer}
              aria-label={`Restablecer el Número ID actual de ${nombre}`}
              title="Restablecer el valor actual"
              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {fila.avisos.map((aviso) => (
          <span key={aviso} className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
            {TEXTO_AVISO[aviso]}
          </span>
        ))}
      </TableCell>
      <TableCell className="align-top pt-2">
        <EstadoBadge fila={fila} />
        <DetalleEstado fila={fila} lote={lote} />
      </TableCell>
    </TableRow>
  );
}

const referencia = (lote: Lote, courseId: number) => {
  const curso = lote.porId.get(courseId)?.curso;
  return curso ? `${curso.id} · ${curso.shortname}` : String(courseId);
};

function DetalleEstado({ fila, lote }: { fila: FilaEvaluada; lote: Lote }) {
  const clase = "mt-1 block whitespace-normal text-[11px] leading-snug";

  if (fila.estado === "duplicado") {
    return (
      <span className={cn(clase, "text-destructive")}>
        Mismo valor que {fila.conflictoCon.map((id) => referencia(lote, id)).join(", ")}
      </span>
    );
  }
  if (fila.estado === "circular") {
    return (
      <span className={cn(clase, "text-destructive")}>
        Su valor lo tiene {fila.conflictoCon.map((id) => referencia(lote, id)).join(", ")}, que a su vez espera este
      </span>
    );
  }
  if (fila.estado === "ocupado") {
    return (
      <span className={cn(clase, "text-destructive")}>
        Lo tiene {fila.ocupantes.map((o) => `${o.id} · ${o.shortname}`).join(", ")}
      </span>
    );
  }
  if (fila.estado === "sin-comprobar") {
    return <span className={cn(clase, "text-amber-700 dark:text-amber-400")}>{fila.errorComprobacion}</span>;
  }
  if (fila.estado === "demasiado-largo") {
    return <span className={cn(clase, "text-destructive")}>{[...fila.propuesto].length} caracteres</span>;
  }
  if (fila.cambia && !fila.seleccionada) {
    return <span className={cn(clase, "text-muted-foreground")}>No seleccionado: no se ejecutará</span>;
  }
  return null;
}
