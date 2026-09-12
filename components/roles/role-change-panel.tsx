"use client";

import { ArrowRightLeft, Plus, TriangleAlert } from "lucide-react";

import { RolBadge } from "@/components/roles/rol-badge";
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
import { ROLES_ASIGNABLES, nombreRol } from "@/lib/moodle/roles";
import { rolesRetirables } from "@/lib/roles/plan";
import type { ModoCambio, ParticipanteConsolidado } from "@/lib/roles/types";

interface RoleChangePanelProps {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  seleccionados: ParticipanteConsolidado[];
  roleDestinoId: number;
  onRoleDestinoChange: (roleId: number) => void;
  modo: ModoCambio;
  onModoChange: (modo: ModoCambio) => void;
  esCursoExcluido: (userId: number, courseId: number) => boolean;
  onAlternarCurso: (userId: number, courseId: number, incluido: boolean) => void;
  esRetiroDesmarcado: (userId: number, courseId: number, roleId: number) => boolean;
  onAlternarRetiro: (userId: number, courseId: number, roleId: number, retirar: boolean) => void;
  cursosIncluidos: number;
  onPrevisualizar: () => void;
}

export function RoleChangePanel({
  abierto,
  onAbiertoChange,
  seleccionados,
  roleDestinoId,
  onRoleDestinoChange,
  modo,
  onModoChange,
  esCursoExcluido,
  onAlternarCurso,
  esRetiroDesmarcado,
  onAlternarRetiro,
  cursosIncluidos,
  onPrevisualizar,
}: RoleChangePanelProps) {
  const intercambia = modo === "intercambiar";

  return (
    <Sheet open={abierto} onOpenChange={onAbiertoChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-xl"
        aria-label="Configurar el cambio de rol"
      >
        <SheetHeader className="border-b">
          <SheetTitle>Configurar el cambio de rol</SheetTitle>
          <SheetDescription>
            {seleccionados.length} usuario{seleccionados.length !== 1 ? "s" : ""} seleccionado
            {seleccionados.length !== 1 ? "s" : ""}. Elige el rol destino y en qué cursos aplicarlo.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-4">
          {/* ── Rol destino ── */}
          <section className="space-y-1.5">
            <Label htmlFor="rol-destino" className="text-sm font-medium">
              Rol destino
            </Label>
            <select
              id="rol-destino"
              value={roleDestinoId}
              onChange={(event) => onRoleDestinoChange(Number(event.target.value))}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ROLES_ASIGNABLES.map((rol) => (
                <option key={rol.id} value={rol.id}>
                  {rol.nombre}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground/70">
              Solo se listan los roles que esta herramienta puede asignar.
            </p>
          </section>

          {/* ── Modo ── */}
          <section className="space-y-2">
            <p id="etiqueta-modo" className="text-sm font-medium">
              Qué hacer con el rol actual
            </p>
            <div className="grid gap-2" role="radiogroup" aria-labelledby="etiqueta-modo">
              <OpcionModo
                seleccionada={!intercambia}
                onSelect={() => onModoChange("agregar")}
                icono={<Plus className="h-4 w-4" />}
                titulo="Solo agregar"
                descripcion="El usuario acumula el rol nuevo y conserva los que ya tenía."
              />
              <OpcionModo
                seleccionada={intercambia}
                onSelect={() => onModoChange("intercambiar")}
                icono={<ArrowRightLeft className="h-4 w-4" />}
                titulo="Intercambiar"
                descripcion="Agrega el rol nuevo y retira los actuales marcados abajo."
                destructiva
              />
            </div>

            {intercambia && (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                El retiro solo se ejecuta después de comprobar que el rol destino quedó asignado. Si
                la comprobación falla, no se retira nada.
              </p>
            )}
          </section>

          {/* ── Cursos por usuario ── */}
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">Cursos donde aplicar</p>
              <span className="text-xs text-muted-foreground">
                {cursosIncluidos} cambio{cursosIncluidos !== 1 ? "s" : ""} en cola
              </span>
            </div>

            <ul className="space-y-3">
              {seleccionados.map((participante) => (
                <li key={participante.userId} className="rounded-lg border">
                  <div className="border-b bg-muted/30 px-3 py-2">
                    <p className="text-sm font-medium">{participante.fullname}</p>
                    <p className="text-xs text-muted-foreground">{participante.email}</p>
                  </div>

                  <ul className="divide-y">
                    {participante.cursos.map((curso) => {
                      const incluido = !esCursoExcluido(participante.userId, curso.courseId);
                      const yaTiene = curso.roles.some((rol) => rol.roleId === roleDestinoId);
                      const retirables = rolesRetirables(curso.roles, roleDestinoId);
                      const cursoCheckboxId = `curso-${participante.userId}-${curso.courseId}`;

                      return (
                        <li key={curso.courseId} className="space-y-2 px-3 py-2.5">
                          <div className="flex items-start gap-2.5">
                            <Checkbox
                              id={cursoCheckboxId}
                              checked={incluido}
                              onCheckedChange={(valor) =>
                                onAlternarCurso(participante.userId, curso.courseId, valor === true)
                              }
                              className="mt-0.5"
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <Label
                                htmlFor={cursoCheckboxId}
                                className="flex flex-wrap items-center gap-1.5 font-mono text-xs font-medium"
                              >
                                Curso {curso.courseId}
                                {yaTiene && (
                                  <span className="rounded border border-border px-1.5 py-px font-sans text-[10px] font-medium text-muted-foreground">
                                    ya tiene el rol destino
                                  </span>
                                )}
                              </Label>

                              <div className="flex flex-wrap items-center gap-1.5">
                                {curso.roles.length === 0 ? (
                                  <span className="text-[11px] text-muted-foreground/70">
                                    Sin roles visibles
                                  </span>
                                ) : (
                                  curso.roles.map((rol) => (
                                    <RolBadge
                                      key={rol.roleId}
                                      roleId={rol.roleId}
                                      nombreEnMoodle={rol.nombreEnMoodle}
                                    />
                                  ))
                                )}
                              </div>
                            </div>
                          </div>

                          {intercambia && incluido && (
                            <RolesARetirar
                              retirables={retirables.map((rol) => rol.roleId)}
                              noGestionables={curso.roles.filter(
                                (rol) =>
                                  rol.roleId !== roleDestinoId &&
                                  !retirables.some((r) => r.roleId === rol.roleId),
                              )}
                              userId={participante.userId}
                              courseId={curso.courseId}
                              esRetiroDesmarcado={esRetiroDesmarcado}
                              onAlternarRetiro={onAlternarRetiro}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <SheetFooter className="sticky bottom-0 border-t bg-background">
          <Button type="button" onClick={onPrevisualizar} disabled={cursosIncluidos === 0}>
            Previsualizar cambios
          </Button>
          <Button type="button" variant="outline" onClick={() => onAbiertoChange(false)}>
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
  destructiva = false,
}: {
  seleccionada: boolean;
  onSelect: () => void;
  icono: React.ReactNode;
  titulo: string;
  descripcion: string;
  destructiva?: boolean;
}) {
  const acento = destructiva ? "border-destructive bg-destructive/5" : "border-primary bg-primary/5";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={seleccionada}
      onClick={onSelect}
      className={
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
        (seleccionada ? acento : "border-border hover:bg-muted/50")
      }
    >
      <span
        className={
          "mt-0.5 shrink-0 " +
          (seleccionada
            ? destructiva
              ? "text-destructive"
              : "text-primary"
            : "text-muted-foreground")
        }
      >
        {icono}
      </span>
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{titulo}</span>
        <span className="block text-xs text-muted-foreground">{descripcion}</span>
      </span>
    </button>
  );
}

function RolesARetirar({
  retirables,
  noGestionables,
  userId,
  courseId,
  esRetiroDesmarcado,
  onAlternarRetiro,
}: {
  retirables: number[];
  noGestionables: Array<{ roleId: number; nombreEnMoodle: string }>;
  userId: number;
  courseId: number;
  esRetiroDesmarcado: (userId: number, courseId: number, roleId: number) => boolean;
  onAlternarRetiro: (userId: number, courseId: number, roleId: number, retirar: boolean) => void;
}) {
  if (retirables.length === 0 && noGestionables.length === 0) {
    return (
      <p className="pl-7 text-[11px] text-muted-foreground/70">
        No hay roles anteriores que retirar en este curso.
      </p>
    );
  }

  return (
    <div className="space-y-1.5 pl-7">
      {retirables.length > 0 && (
        <>
          <p className="text-[11px] font-medium text-destructive">Retirar de este curso</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {retirables.map((roleId) => {
              const checkboxId = `retiro-${userId}-${courseId}-${roleId}`;
              return (
                <li key={roleId} className="flex items-center gap-1.5">
                  <Checkbox
                    id={checkboxId}
                    checked={!esRetiroDesmarcado(userId, courseId, roleId)}
                    onCheckedChange={(valor) =>
                      onAlternarRetiro(userId, courseId, roleId, valor === true)
                    }
                  />
                  <Label htmlFor={checkboxId} className="text-xs font-normal">
                    {nombreRol(roleId)}
                  </Label>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {noGestionables.length > 0 && (
        <p className="text-[11px] text-muted-foreground/70">
          Sin gestionar por no estar en el catálogo:{" "}
          {noGestionables.map((rol) => nombreRol(rol.roleId, rol.nombreEnMoodle)).join(", ")}
        </p>
      )}
    </div>
  );
}
