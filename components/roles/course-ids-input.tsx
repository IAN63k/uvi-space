"use client";

import { useState } from "react";
import { ListChecks, Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface CourseIdsInputProps {
  ids: number[];
  onChange: (ids: number[]) => void;
  onConsultar: () => void;
  cargando: boolean;
  deshabilitado: boolean;
}

interface Analisis {
  validos: number[];
  invalidos: string[];
}

/** Acepta lo que se pegue desde Excel: comas, espacios, tabulaciones,
 *  punto y coma o saltos de línea. */
function analizar(texto: string): Analisis {
  const piezas = texto.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean);
  const validos: number[] = [];
  const invalidos: string[] = [];

  for (const pieza of piezas) {
    const numero = Number(pieza);
    if (Number.isInteger(numero) && numero > 0) validos.push(numero);
    else invalidos.push(pieza);
  }

  return { validos, invalidos };
}

export function CourseIdsInput({
  ids,
  onChange,
  onConsultar,
  cargando,
  deshabilitado,
}: CourseIdsInputProps) {
  const [texto, setTexto] = useState("");
  const [rechazados, setRechazados] = useState<string[]>([]);

  const agregar = () => {
    const { validos, invalidos } = analizar(texto);
    setRechazados(invalidos);

    if (validos.length > 0) {
      onChange([...new Set([...ids, ...validos])]);
      setTexto("");
    }
  };

  const quitar = (id: number) => onChange(ids.filter((actual) => actual !== id));

  const { validos: pendientes } = analizar(texto);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="course-ids" className="text-xs text-muted-foreground">
          IDs de cursos — pégalos desde Excel, separados por coma, espacio o salto de línea
        </Label>
        <textarea
          id="course-ids"
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              agregar();
            }
          }}
          rows={3}
          placeholder="32776, 32777&#10;32778"
          className="w-full rounded-lg border border-input bg-background px-2.5 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-[11px] text-muted-foreground/70">
          Enter agrega a la lista. Shift+Enter hace un salto de línea.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={agregar} disabled={pendientes.length === 0}>
          <Plus className="mr-1.5 h-4 w-4" />
          Agregar {pendientes.length > 0 ? `${pendientes.length} curso${pendientes.length !== 1 ? "s" : ""}` : "a la lista"}
        </Button>

        <Button type="button" onClick={onConsultar} disabled={deshabilitado || cargando || ids.length === 0}>
          {cargando ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <ListChecks className="mr-1.5 h-4 w-4" />
          )}
          {cargando ? "Consultando…" : "Consultar participantes"}
        </Button>
      </div>

      {rechazados.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Se descartaron {rechazados.length} valor{rechazados.length !== 1 ? "es" : ""} que no
          {rechazados.length !== 1 ? " son IDs numéricos" : " es un ID numérico"}:{" "}
          <span className="font-mono">{rechazados.slice(0, 5).join(", ")}</span>
          {rechazados.length > 5 ? "…" : ""}
        </p>
      )}

      {ids.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {ids.length} curso{ids.length !== 1 ? "s" : ""} en la lista
            </span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="rounded text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Vaciar lista
            </button>
          </div>

          <ul className="flex flex-wrap gap-1.5">
            {ids.map((id) => (
              <li key={id}>
                <span className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 py-1 pl-2.5 pr-1 font-mono text-xs">
                  {id}
                  <button
                    type="button"
                    onClick={() => quitar(id)}
                    aria-label={`Quitar el curso ${id}`}
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
