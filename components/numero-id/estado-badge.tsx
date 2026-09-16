import {
  Check,
  CircleDashed,
  CircleSlash,
  CopyX,
  Eraser,
  Lock,
  Minus,
  Repeat,
  Ruler,
  type LucideIcon,
} from "lucide-react";

import { ESTADOS_EN_CONFLICTO, type EstadoFila, type FilaEvaluada } from "@/lib/numero-id/plan";
import { cn } from "@/lib/utils";

interface Apariencia {
  etiqueta: string;
  icono: LucideIcon;
  badge: string;
  /** Franja del borde izquierdo de la fila: lo que se lee de un vistazo. */
  franja: string;
}

const CONFLICTO = "border-destructive/40 bg-destructive/10 text-destructive";

export const APARIENCIA_ESTADO: Record<EstadoFila, Apariencia> = {
  "sin-cambios": {
    etiqueta: "Sin cambios",
    icono: Minus,
    badge: "border-border bg-transparent text-muted-foreground",
    franja: "bg-transparent",
  },
  vacio: {
    etiqueta: "Vacío",
    icono: CircleDashed,
    badge: "border-dashed border-muted-foreground/50 bg-transparent text-muted-foreground",
    franja: "bg-muted-foreground/25",
  },
  listo: {
    etiqueta: "Listo",
    icono: Check,
    badge: "border-primary/30 bg-primary/10 text-primary",
    franja: "bg-primary",
  },
  duplicado: { etiqueta: "Duplicado en el lote", icono: CopyX, badge: CONFLICTO, franja: "bg-destructive" },
  circular: { etiqueta: "Intercambio circular", icono: Repeat, badge: CONFLICTO, franja: "bg-destructive" },
  ocupado: { etiqueta: "Ocupado por otro curso", icono: Lock, badge: CONFLICTO, franja: "bg-destructive" },
  "demasiado-largo": { etiqueta: "Más de 100 caracteres", icono: Ruler, badge: CONFLICTO, franja: "bg-destructive" },
  "sin-comprobar": {
    etiqueta: "Sin comprobar",
    icono: CircleSlash,
    badge: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300",
    franja: "bg-amber-500",
  },
};

export const esFilaEnConflicto = (fila: FilaEvaluada) => ESTADOS_EN_CONFLICTO.has(fila.estado);

/** «Vaciar» es una fila lista, pero se marca como destructiva. */
export function EstadoBadge({ fila, className }: { fila: FilaEvaluada; className?: string }) {
  const vacia = fila.estado === "listo" && fila.accion === "vaciar";
  const apariencia = APARIENCIA_ESTADO[fila.estado];
  const Icono = vacia ? Eraser : apariencia.icono;

  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[11px] font-medium",
        vacia ? CONFLICTO : apariencia.badge,
        className,
      )}
    >
      <Icono className="size-3" aria-hidden />
      {vacia ? "Listo · vaciar" : apariencia.etiqueta}
    </span>
  );
}
