"use client";

import { ShieldCheck, CalendarRange } from "lucide-react";

import { Label } from "@/components/ui/label";
import { ENROLMENT_ROLES, roleLabel } from "@/lib/matriculas/api";

export type EnrolmentMode = "enrol" | "unenrol";

interface EnrolmentConfigPanelProps {
  mode: EnrolmentMode;
  roleId: number;
  onRoleChange: (roleId: number) => void;
  timestart: string;
  timeend: string;
  onTimestartChange: (value: string) => void;
  onTimeendChange: (value: string) => void;
  userName: string;
  courseCount: number;
}

export function EnrolmentConfigPanel({
  mode,
  roleId,
  onRoleChange,
  timestart,
  timeend,
  onTimestartChange,
  onTimeendChange,
  userName,
  courseCount,
}: EnrolmentConfigPanelProps) {
  const isEnrol = mode === "enrol";

  return (
    <div className="space-y-4">
      {isEnrol && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="role" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Rol
            </Label>
            <select
              id="role"
              value={roleId}
              onChange={(e) => onRoleChange(Number(e.target.value))}
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ENROLMENT_ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="timestart" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5" /> Fecha de inicio (opcional)
            </Label>
            <input
              id="timestart"
              type="date"
              value={timestart}
              onChange={(e) => onTimestartChange(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground/70">Vacío = inmediato</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="timeend" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5" /> Fecha de fin (opcional)
            </Label>
            <input
              id="timeend"
              type="date"
              value={timeend}
              onChange={(e) => onTimeendChange(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground/70">Vacío = sin límite</p>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        Se va a <span className="font-semibold">{isEnrol ? "matricular" : "desmatricular"}</span> a{" "}
        <span className="font-semibold">{userName}</span> en{" "}
        <span className="font-semibold">{courseCount}</span> curso{courseCount !== 1 ? "s" : ""}
        {isEnrol && (
          <> con el rol <span className="font-semibold">{roleLabel(roleId)}</span></>
        )}.
      </div>
    </div>
  );
}
