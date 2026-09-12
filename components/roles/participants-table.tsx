"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Search, Users } from "lucide-react";

import { RolBadge } from "@/components/roles/rol-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { nombreRol } from "@/lib/moodle/roles";
import type { CursoConsultado, ParticipanteConsolidado } from "@/lib/roles/types";

interface ParticipantsTableProps {
  participantes: ParticipanteConsolidado[];
  cursos: CursoConsultado[];
  seleccion: Set<number>;
  onSeleccionChange: (seleccion: Set<number>) => void;
}

const TODOS = "todos";

export function ParticipantsTable({
  participantes,
  cursos,
  seleccion,
  onSeleccionChange,
}: ParticipantsTableProps) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState<string>(TODOS);

  const cursosFallidos = cursos.filter((curso) => !curso.ok);

  const rolesPresentes = useMemo(() => {
    const vistos = new Map<number, string>();
    for (const participante of participantes) {
      for (const curso of participante.cursos) {
        for (const rol of curso.roles) {
          if (!vistos.has(rol.roleId)) {
            vistos.set(rol.roleId, nombreRol(rol.roleId, rol.nombreEnMoodle));
          }
        }
      }
    }
    return [...vistos.entries()]
      .map(([roleId, nombre]) => ({ roleId, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [participantes]);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const rolBuscado = filtroRol === TODOS ? null : Number(filtroRol);

    return participantes.filter((participante) => {
      const coincideTexto =
        !texto ||
        participante.fullname.toLowerCase().includes(texto) ||
        participante.email.toLowerCase().includes(texto);

      const coincideRol =
        rolBuscado === null ||
        participante.cursos.some((curso) => curso.roles.some((rol) => rol.roleId === rolBuscado));

      return coincideTexto && coincideRol;
    });
  }, [participantes, busqueda, filtroRol]);

  const idsVisibles = visibles.map((participante) => participante.userId);
  const seleccionadosVisibles = idsVisibles.filter((id) => seleccion.has(id));
  const todosSeleccionados =
    idsVisibles.length > 0 && seleccionadosVisibles.length === idsVisibles.length;
  const algunoSeleccionado = seleccionadosVisibles.length > 0 && !todosSeleccionados;

  const alternarUno = (userId: number, marcado: boolean) => {
    const siguiente = new Set(seleccion);
    if (marcado) siguiente.add(userId);
    else siguiente.delete(userId);
    onSeleccionChange(siguiente);
  };

  const alternarVisibles = (marcado: boolean) => {
    const siguiente = new Set(seleccion);
    for (const id of idsVisibles) {
      if (marcado) siguiente.add(id);
      else siguiente.delete(id);
    }
    onSeleccionChange(siguiente);
  };

  return (
    <div className="space-y-4">
      {cursosFallidos.length > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {cursosFallidos.length} curso{cursosFallidos.length !== 1 ? "s" : ""} no se pudo
            consultar
          </p>
          <ul className="space-y-0.5 pl-6 text-xs">
            {cursosFallidos.map((curso) => (
              <li key={curso.courseId}>
                <span className="font-mono">{curso.courseId}</span> — {curso.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1">
          <Label htmlFor="buscar-participante" className="text-xs text-muted-foreground">
            Buscar por nombre o correo
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="buscar-participante"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Nombre o correo institucional"
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="filtro-rol" className="text-xs text-muted-foreground">
            Filtrar por rol
          </Label>
          <select
            id="filtro-rol"
            value={filtroRol}
            onChange={(event) => setFiltroRol(event.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-56"
          >
            <option value={TODOS}>Todos los roles</option>
            {rolesPresentes.map((rol) => (
              <option key={rol.roleId} value={rol.roleId}>
                {rol.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        Mostrando{" "}
        <span className="font-semibold tabular-nums text-foreground">{visibles.length}</span> de{" "}
        {participantes.length} usuario{participantes.length !== 1 ? "s" : ""}
        {seleccion.size > 0 && (
          <>
            {" "}
            · <span className="font-semibold tabular-nums text-foreground">{seleccion.size}</span>{" "}
            seleccionado{seleccion.size !== 1 ? "s" : ""}
          </>
        )}
      </p>

      {visibles.length === 0 ? (
        <EstadoVacio hayParticipantes={participantes.length > 0} />
      ) : (
        <div className="max-h-[32rem] overflow-auto rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={todosSeleccionados}
                    indeterminate={algunoSeleccionado}
                    onCheckedChange={(marcado) => alternarVisibles(marcado === true)}
                    aria-label="Seleccionar todos los usuarios visibles"
                  />
                </TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Cursos y rol actual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((participante) => {
                const marcado = seleccion.has(participante.userId);
                return (
                  <TableRow key={participante.userId} data-state={marcado ? "selected" : undefined}>
                    <TableCell className="align-top">
                      <Checkbox
                        checked={marcado}
                        onCheckedChange={(valor) => alternarUno(participante.userId, valor === true)}
                        aria-label={"Seleccionar a " + participante.fullname}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <span className="block font-medium">{participante.fullname}</span>
                      <span className="block text-xs text-muted-foreground">
                        {participante.email}
                      </span>
                      <span className="block font-mono text-[10px] text-muted-foreground/70">
                        ID {participante.userId}
                        {participante.idnumber ? " · " + participante.idnumber : ""}
                      </span>
                    </TableCell>
                    <TableCell className="align-top">
                      <ul className="space-y-1">
                        {participante.cursos.map((curso) => (
                          <li key={curso.courseId} className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs text-muted-foreground">
                              {curso.courseId}
                            </span>
                            {curso.roles.length === 0 ? (
                              <span className="text-xs text-muted-foreground/70">
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
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function EstadoVacio({ hayParticipantes }: { hayParticipantes: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
      <Users className="h-6 w-6 text-muted-foreground/60" />
      {hayParticipantes ? (
        <>
          <p className="text-sm font-medium">Ningún usuario coincide con el filtro</p>
          <p className="text-sm text-muted-foreground">
            Ajusta la búsqueda o el filtro de rol para ver resultados.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium">Los cursos consultados no tienen participantes</p>
          <p className="text-sm text-muted-foreground">
            Verifica los IDs de curso o si el token puede ver a los participantes.
          </p>
        </>
      )}
    </div>
  );
}
