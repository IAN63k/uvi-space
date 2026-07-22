"use client";

import { useState } from "react";
import { Loader2, Download, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchCourseUsers, ENROLMENT_ROLES, type BulkUser } from "@/lib/matriculas/api";
import type { MoodleConfig } from "@/lib/encrypted-local-storage";

interface CourseUsersImportProps {
  config: MoodleConfig | null;
  onAdd: (users: BulkUser[]) => void;
}

/** Trae los matriculados de otro curso para replicarlos en el curso destino. */
export function CourseUsersImport({ config, onAdd }: CourseUsersImportProps) {
  const [raw, setRaw] = useState("");
  const [roleFilter, setRoleFilter] = useState(0); // 0 = todos los roles
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<BulkUser[] | null>(null);

  const handleFetch = async () => {
    if (!config) {
      setError("Configura el Token y la URL de Moodle en Ajustes antes de consultar.");
      return;
    }
    const id = Number(raw.trim());
    if (!Number.isInteger(id) || id <= 0) {
      setError("Ingresa un ID de curso válido.");
      return;
    }

    setLoading(true);
    setError(null);
    setUsers(null);
    try {
      const found = await fetchCourseUsers(config, id, roleFilter || undefined);
      setUsers(found);
      if (found.length === 0) {
        setError("El curso no tiene matriculados con ese rol, o el token no puede consultarlos.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado al consultar los matriculados");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleFetch();
      }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="source-course" className="text-xs text-muted-foreground">ID del curso origen</Label>
          <Input
            id="source-course"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Ej: 31961"
            inputMode="numeric"
            className="font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="source-role" className="text-xs text-muted-foreground">Traer sólo</Label>
          <select
            id="source-role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(Number(e.target.value))}
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value={0}>Todos los matriculados</option>
            {ENROLMENT_ROLES.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      <Button type="submit" disabled={loading || !raw.trim()}>
        {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
        {loading ? "Consultando…" : "Traer matriculados"}
      </Button>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </div>
      )}

      {users && users.length > 0 && (
        <div className="space-y-2">
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border bg-muted/10 p-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm">
                <span className="flex-1 truncate" title={u.fullname}>{u.fullname}</span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{u.idnumber || u.username}</span>
              </div>
            ))}
          </div>
          <Button type="button" onClick={() => onAdd(users)}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Añadir {users.length} usuario{users.length !== 1 ? "s" : ""} a la lista
          </Button>
        </div>
      )}
    </form>
  );
}
