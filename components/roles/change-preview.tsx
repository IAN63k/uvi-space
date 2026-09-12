"use client";

import { ArrowRight, Minus, Pencil, Play } from "lucide-react";

import { RolBadge } from "@/components/roles/rol-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { nombreRol } from "@/lib/moodle/roles";
import type { Plan } from "@/lib/roles/plan";

interface ChangePreviewProps {
  plan: Plan;
  onVolver: () => void;
  onEjecutar: () => void;
}

export function ChangePreview({ plan, onVolver, onEjecutar }: ChangePreviewProps) {
  const hayRetiros = plan.retiros > 0;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Contador etiqueta="Asignaciones a agregar" valor={plan.asignaciones} destacado />
        <Contador etiqueta="Asignaciones a retirar" valor={plan.retiros} destructivo={hayRetiros} />
        <Contador etiqueta="Cursos afectados" valor={plan.cursos} />
        <Contador etiqueta="Usuarios" valor={plan.usuarios} />
      </dl>

      {plan.sinCambios > 0 && (
        <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {plan.sinCambios} caso{plan.sinCambios !== 1 ? "s" : ""} ya {plan.sinCambios !== 1 ? "tienen" : "tiene"} el
          rol destino y se {plan.sinCambios !== 1 ? "omitirán" : "omitirá"} como «sin cambios».
        </p>
      )}

      <div className="max-h-[24rem] overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead className="w-24">Curso</TableHead>
              <TableHead>Rol actual</TableHead>
              <TableHead>Qué se hace</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plan.filas.map((fila) => (
              <TableRow key={`${fila.userId}-${fila.courseId}`}>
                <TableCell className="align-top">
                  <span className="block text-sm">{fila.fullname}</span>
                  <span className="block text-[10px] text-muted-foreground">{fila.email}</span>
                </TableCell>
                <TableCell className="align-top font-mono text-xs">{fila.courseId}</TableCell>
                <TableCell className="align-top">
                  <div className="flex flex-wrap gap-1">
                    {fila.rolesActuales.length === 0 ? (
                      <span className="text-xs text-muted-foreground/70">—</span>
                    ) : (
                      fila.rolesActuales.map((rol) => (
                        <RolBadge
                          key={rol.roleId}
                          roleId={rol.roleId}
                          nombreEnMoodle={rol.nombreEnMoodle}
                        />
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <ul className="space-y-1 text-xs">
                    <li className="flex items-center gap-1.5">
                      {fila.yaTieneDestino ? (
                        <span className="text-muted-foreground">
                          Sin cambios: ya tiene {nombreRol(fila.roleDestinoId)}
                        </span>
                      ) : (
                        <>
                          <ArrowRight className="h-3 w-3 shrink-0 text-primary" />
                          <span>
                            Agregar{" "}
                            <span className="font-medium">{nombreRol(fila.roleDestinoId)}</span>
                          </span>
                        </>
                      )}
                    </li>
                    {fila.rolesARetirar.map((roleId) => (
                      <li key={roleId} className="flex items-center gap-1.5 text-destructive">
                        <Minus className="h-3 w-3 shrink-0" />
                        <span>
                          Retirar <span className="font-medium">{nombreRol(roleId)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={hayRetiros ? "destructive" : "default"} onClick={onEjecutar}>
          <Play className="mr-1.5 h-4 w-4" />
          Ejecutar cambios
        </Button>
        <Button type="button" variant="outline" onClick={onVolver}>
          <Pencil className="mr-1.5 h-4 w-4" />
          Volver a configurar
        </Button>
      </div>
    </div>
  );
}

function Contador({
  etiqueta,
  valor,
  destacado = false,
  destructivo = false,
}: {
  etiqueta: string;
  valor: number;
  destacado?: boolean;
  destructivo?: boolean;
}) {
  const acento = destructivo
    ? "border-destructive/30 bg-destructive/5 text-destructive"
    : destacado
      ? "border-primary/30 bg-primary/5 text-foreground"
      : "bg-muted/30 text-foreground";

  return (
    <div className={"rounded-lg border px-3 py-2 " + acento}>
      <dd className="text-xl font-semibold tabular-nums">{valor}</dd>
      <dt className="text-[11px] text-muted-foreground">{etiqueta}</dt>
    </div>
  );
}
