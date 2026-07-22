"use client";

import { useState } from "react";
import { ClipboardList, Search, FolderInput, Users, X, ShieldCheck, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BulkUserInput } from "@/components/matriculas/bulk-user-input";
import { UserSearchAdd } from "@/components/matriculas/user-search-add";
import { CourseUsersImport } from "@/components/matriculas/course-users-import";
import { ENROLMENT_ROLES, type BulkUser, type BulkUserRow, type BulkUserSource } from "@/lib/matriculas/api";
import type { MoodleConfig } from "@/lib/encrypted-local-storage";

type AddMode = "paste" | "search" | "course";

interface UserListPanelProps {
  config: MoodleConfig | null;
  rows: BulkUserRow[];
  /** Rol que se asigna a los usuarios que se añadan a continuación */
  addRoleId: number;
  onAddRoleChange: (roleId: number) => void;
  onAdd: (users: BulkUser[], source: BulkUserSource) => void;
  onRemove: (userId: number) => void;
  onRowRoleChange: (userId: number, roleId: number) => void;
  onClearAll: () => void;
  /** En desmatrícula el rol no aplica */
  showRoles: boolean;
}

export function UserListPanel({
  config,
  rows,
  addRoleId,
  onAddRoleChange,
  onAdd,
  onRemove,
  onRowRoleChange,
  onClearAll,
  showRoles,
}: UserListPanelProps) {
  const [mode, setMode] = useState<AddMode>("paste");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Formas de añadir usuarios */}
      <div className="space-y-3">
        <div className="inline-flex flex-wrap rounded-lg border bg-muted/30 p-0.5">
          <ModeButton active={mode === "paste"} onClick={() => setMode("paste")} icon={<ClipboardList className="h-3.5 w-3.5" />}>
            Lista / CSV
          </ModeButton>
          <ModeButton active={mode === "search"} onClick={() => setMode("search")} icon={<Search className="h-3.5 w-3.5" />}>
            Buscar
          </ModeButton>
          <ModeButton active={mode === "course"} onClick={() => setMode("course")} icon={<FolderInput className="h-3.5 w-3.5" />}>
            Desde otro curso
          </ModeButton>
        </div>

        {showRoles && (
          <div className="space-y-1">
            <Label htmlFor="add-role" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Rol para los usuarios que añadas
            </Label>
            <select
              id="add-role"
              value={addRoleId}
              onChange={(e) => onAddRoleChange(Number(e.target.value))}
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ENROLMENT_ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground/70">
              Puedes cambiarlo entre bloques para mezclar estudiantes y docentes; cada fila queda editable.
            </p>
          </div>
        )}

        {mode === "paste" && <BulkUserInput config={config} onAdd={(users) => onAdd(users, "paste")} />}
        {mode === "search" && <UserSearchAdd config={config} onAdd={(users) => onAdd(users, "search")} />}
        {mode === "course" && <CourseUsersImport config={config} onAdd={(users) => onAdd(users, "course")} />}
      </div>

      {/* Lista construida */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <Users className="h-4 w-4 text-muted-foreground" />
            Usuarios a matricular
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {rows.length}
            </span>
          </h3>
          {rows.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={onClearAll}>
              Limpiar
            </Button>
          )}
        </div>

        <div className="max-h-[26rem] space-y-1 overflow-y-auto rounded-lg border bg-muted/10 p-2">
          {rows.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Aún no has añadido usuarios.
            </p>
          ) : (
            rows.map((row) => (
              <div key={row.user.id} className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate" title={row.user.fullname}>{row.user.fullname}</span>
                    {row.alreadyEnrolled && (
                      <span
                        title="Ya está matriculado en el curso destino"
                        className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      >
                        <CheckCircle2 className="h-2.5 w-2.5" /> ya matriculado
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {row.user.idnumber || row.user.username} · ID {row.user.id}
                  </span>
                </div>

                {showRoles && (
                  <select
                    value={row.roleId}
                    onChange={(e) => onRowRoleChange(row.user.id, Number(e.target.value))}
                    aria-label={`Rol de ${row.user.fullname}`}
                    className="h-7 shrink-0 rounded-md border border-input bg-background px-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {ENROLMENT_ROLES.map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={() => onRemove(row.user.id)}
                  aria-label={`Quitar a ${row.user.fullname}`}
                  className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
