"use client";

import { useMemo, useState } from "react";
import { CircleDashed, ListChecks, TriangleAlert, Rows3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { copiarNombreCorto, filasAlcanzadas, type ModoCopia } from "@/lib/numero-id/plan";
import type { CursoIdnumber } from "@/lib/numero-id/types";
import { cn } from "@/lib/utils";

interface CopyShortnamePanelProps {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  cursos: CursoIdnumber[];
  propuestas: ReadonlyMap<number, string>;
  seleccion: ReadonlySet<number>;
  onAplicar: (modo: ModoCopia) => void;
}

interface Impacto {
  alcanzadas: number;
  cambiarian: number;
  /** Cursos con un Número ID propio (distinto del nombre corto) que se sobrescribiría. */
  sobrescribenExterno: number;
}

function medirImpacto(
  cursos: CursoIdnumber[],
  propuestas: ReadonlyMap<number, string>,
  seleccion: ReadonlySet<number>,
  modo: ModoCopia,
): Impacto {
  const alcanzadas = filasAlcanzadas(cursos, propuestas, seleccion, modo);
  const { cambiadas } = copiarNombreCorto(alcanzadas, propuestas);
  const cambiadasIds = new Set(cambiadas);
  return {
    alcanzadas: alcanzadas.length,
    cambiarian: cambiadas.length,
    sobrescribenExterno: alcanzadas.filter((c) => cambiadasIds.has(c.id) && c.idnumber !== "").length,
  };
}

export function CopyShortnamePanel({
  abierto,
  onAbiertoChange,
  cursos,
  propuestas,
  seleccion,
  onAplicar,
}: CopyShortnamePanelProps) {
  const [modo, setModo] = useState<ModoCopia>("vacios");
  const [confirmado, setConfirmado] = useState(false);

  const impactos = useMemo(
    () => ({
      vacios: medirImpacto(cursos, propuestas, seleccion, "vacios"),
      seleccionadas: medirImpacto(cursos, propuestas, seleccion, "seleccionadas"),
      todas: medirImpacto(cursos, propuestas, seleccion, "todas"),
    }),
    [cursos, propuestas, seleccion],
  );

  const impacto = impactos[modo];
  const destructivo = modo === "todas";
  const puedeAplicar = impacto.cambiarian > 0 && (!destructivo || confirmado);

  const elegirModo = (siguiente: ModoCopia) => {
    setModo(siguiente);
    setConfirmado(false);
  };

  const cerrar = (siguienteAbierto: boolean) => {
    if (!siguienteAbierto) {
      setModo("vacios");
      setConfirmado(false);
    }
    onAbiertoChange(siguienteAbierto);
  };

  return (
    <Sheet open={abierto} onOpenChange={cerrar}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>Copiar nombre corto → Número ID</SheetTitle>
          <SheetDescription>
            Rellena la columna «Número ID propuesto» con el nombre corto de cada curso. No se ejecuta nada:
            después puedes revisar y editar cualquier fila.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-4">
          <section className="space-y-2">
            <p id="etiqueta-modo-copia" className="text-sm font-medium">
              A qué filas aplicarlo
            </p>
            <div role="radiogroup" aria-labelledby="etiqueta-modo-copia" className="grid gap-2">
              <OpcionModo
                seleccionada={modo === "vacios"}
                onSelect={() => elegirModo("vacios")}
                icono={<CircleDashed className="h-4 w-4" />}
                titulo="Solo los que están vacíos"
                descripcion="Cursos sin Número ID en Moodle y sin nada escrito en la propuesta. Es la opción segura."
                impacto={impactos.vacios}
              />
              <OpcionModo
                seleccionada={modo === "seleccionadas"}
                onSelect={() => elegirModo("seleccionadas")}
                icono={<ListChecks className="h-4 w-4" />}
                titulo="Solo las filas seleccionadas"
                descripcion="Sobrescribe la propuesta de las filas que marcaste en la tabla."
                impacto={impactos.seleccionadas}
              />
              <OpcionModo
                seleccionada={modo === "todas"}
                onSelect={() => elegirModo("todas")}
                icono={<Rows3 className="h-4 w-4" />}
                titulo="Todas, sobrescribiendo"
                descripcion="Sobrescribe la propuesta de todos los cursos consultados, tengan o no Número ID."
                impacto={impactos.todas}
                destructiva
              />
            </div>
          </section>

          {impacto.sobrescribenExterno > 0 && (
            <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50/70 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/20 dark:text-amber-200">
              <p className="flex items-start gap-2 font-medium">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {impacto.sobrescribenExterno} curso{impacto.sobrescribenExterno !== 1 ? "s" : ""} ya{" "}
                {impacto.sobrescribenExterno !== 1 ? "tienen" : "tiene"} un Número ID distinto del nombre corto
              </p>
              <p>
                Puede pertenecer a una integración que empareja cursos por Número ID. Sobrescribirlo rompería ese
                vínculo. Revisa esas filas antes de ejecutar.
              </p>
            </div>
          )}

          {destructivo && impacto.cambiarian > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5">
              <Checkbox
                id="confirmar-sobrescribir"
                checked={confirmado}
                onCheckedChange={(valor) => setConfirmado(valor === true)}
                className="mt-0.5"
              />
              <Label htmlFor="confirmar-sobrescribir" className="text-xs font-medium leading-snug text-destructive">
                Entiendo que se reemplazan las propuestas de {impacto.alcanzadas} curso
                {impacto.alcanzadas !== 1 ? "s" : ""}, incluidas las que edité a mano
              </Label>
            </div>
          )}
        </div>

        <SheetFooter className="sticky bottom-0 border-t bg-background">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {impacto.cambiarian === 0
              ? "Con este modo ninguna fila cambiaría."
              : `${impacto.cambiarian} fila${impacto.cambiarian !== 1 ? "s" : ""} cambiaría${impacto.cambiarian !== 1 ? "n" : ""} y quedaría${impacto.cambiarian !== 1 ? "n" : ""} seleccionada${impacto.cambiarian !== 1 ? "s" : ""}.`}
          </p>
          <Button
            type="button"
            variant={destructivo ? "destructive" : "default"}
            disabled={!puedeAplicar}
            onClick={() => {
              onAplicar(modo);
              cerrar(false);
            }}
          >
            Rellenar la tabla
          </Button>
          <Button type="button" variant="outline" onClick={() => cerrar(false)}>
            Cancelar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function OpcionModo({
  seleccionada,
  onSelect,
  icono,
  titulo,
  descripcion,
  impacto,
  destructiva = false,
}: {
  seleccionada: boolean;
  onSelect: () => void;
  icono: React.ReactNode;
  titulo: string;
  descripcion: string;
  impacto: Impacto;
  destructiva?: boolean;
}) {
  const acento = destructiva ? "border-destructive bg-destructive/5" : "border-primary bg-primary/5";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={seleccionada}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        seleccionada ? acento : "border-border hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "mt-0.5 shrink-0",
          seleccionada ? (destructiva ? "text-destructive" : "text-primary") : "text-muted-foreground",
        )}
      >
        {icono}
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className={cn("block text-sm font-medium", destructiva && "text-destructive")}>{titulo}</span>
        <span className="block text-xs text-muted-foreground">{descripcion}</span>
      </span>
      <span className="shrink-0 text-right text-xs tabular-nums">
        <span className="block font-semibold">{impacto.cambiarian}</span>
        <span className="block text-[10px] text-muted-foreground">cambian</span>
      </span>
    </button>
  );
}
