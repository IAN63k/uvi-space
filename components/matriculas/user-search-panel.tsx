"use client";

import { useState } from "react";
import { Search, Loader2, UserX, Mail, AtSign, Hash, BookMarked, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchUser } from "@/lib/matriculas/api";
import type { MoodleConfig } from "@/lib/encrypted-local-storage";
import type { MoodleUser, UserSearchField } from "@/lib/moodle/types";

const SEARCH_FIELDS: { value: UserSearchField; label: string }[] = [
  { value: "idnumber", label: "Número de documento" },
  { value: "username", label: "Username" },
  { value: "email", label: "Email" },
  { value: "fullname", label: "Nombre completo" },
];

const fieldLabel = (field: UserSearchField): string =>
  SEARCH_FIELDS.find((f) => f.value === field)?.label ?? field;

export interface FoundUser {
  user: MoodleUser;
  enrolledCount: number;
}

interface UserSearchPanelProps {
  config: MoodleConfig | null;
  found: FoundUser | null;
  onUserFound: (found: FoundUser | null) => void;
}

export function UserSearchPanel({ config, found, onUserFound }: UserSearchPanelProps) {
  const [field, setField] = useState<UserSearchField>("idnumber");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<{ field: UserSearchField; value: string } | null>(null);

  const handleSearch = async () => {
    if (!config) {
      setError("Configura el Token y la URL de Moodle en Ajustes antes de buscar.");
      return;
    }
    if (!value.trim()) {
      setError("Ingresa un valor para buscar.");
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(null);
    onUserFound(null);

    try {
      const res = await searchUser(config, field, value);
      if (!res.found || !res.user) {
        setNotFound({ field: res.field, value: res.value });
        return;
      }
      onUserFound({ user: res.user, enrolledCount: res.enrolledCount ?? 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado al buscar el usuario");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void handleSearch();
  };

  const clearUser = () => {
    onUserFound(null);
    setNotFound(null);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1 sm:w-56">
          <Label htmlFor="search-field" className="text-xs text-muted-foreground">Buscar por</Label>
          <select
            id="search-field"
            value={field}
            onChange={(e) => setField(e.target.value as UserSearchField)}
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {SEARCH_FIELDS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 space-y-1">
          <Label htmlFor="search-value" className="text-xs text-muted-foreground">Valor</Label>
          <Input
            id="search-value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Ingresa el ${fieldLabel(field).toLowerCase()}`}
          />
        </div>
        <Button type="submit" disabled={loading || !value.trim()}>
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />}
          {loading ? "Buscando…" : "Buscar"}
        </Button>
      </form>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </div>
      )}

      {notFound && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
          <UserX className="h-4 w-4 shrink-0" />
          <span>
            No se encontró ningún usuario con <span className="font-semibold">{fieldLabel(notFound.field)}</span>{" "}
            = <span className="font-mono">&quot;{notFound.value}&quot;</span>.
          </span>
        </div>
      )}

      {found && <UserCard found={found} onClear={clearUser} />}
    </div>
  );
}

function UserCard({ found, onClear }: { found: FoundUser; onClear: () => void }) {
  const { user, enrolledCount } = found;
  const [imgFailed, setImgFailed] = useState(false);
  const initials = `${user.firstname?.[0] ?? ""}${user.lastname?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="relative flex items-start gap-4 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-4 dark:border-emerald-900/40 dark:bg-emerald-950/15">
      <button
        type="button"
        onClick={onClear}
        aria-label="Quitar usuario"
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      {user.profileimageurl && !imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.profileimageurl}
          alt={user.fullname}
          onError={() => setImgFailed(true)}
          className="h-16 w-16 shrink-0 rounded-full border border-emerald-200 object-cover dark:border-emerald-800/60"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-lg font-semibold text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/40 dark:text-emerald-300">
          {initials || "?"}
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-1.5 pr-6">
        <h3 className="text-base font-semibold leading-snug">{user.fullname}</h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <InfoRow icon={<Mail className="h-3.5 w-3.5" />} value={user.email} />
          <InfoRow icon={<AtSign className="h-3.5 w-3.5" />} value={user.username} mono />
          <InfoRow icon={<Hash className="h-3.5 w-3.5" />} label="ID Moodle" value={String(user.id)} mono />
          {user.idnumber && (
            <InfoRow icon={<Hash className="h-3.5 w-3.5" />} label="Documento" value={user.idnumber} mono />
          )}
        </dl>
        <div className="flex items-center gap-1.5 pt-0.5 text-sm text-emerald-700 dark:text-emerald-400">
          <BookMarked className="h-3.5 w-3.5" />
          <span className="font-semibold">{enrolledCount}</span>
          <span className="text-muted-foreground">curso{enrolledCount !== 1 ? "s" : ""} matriculado{enrolledCount !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, mono }: { icon: React.ReactNode; label?: string; value: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
      <span className="shrink-0 text-muted-foreground/60">{icon}</span>
      {label && <span className="shrink-0 text-xs">{label}:</span>}
      <span className={`truncate text-foreground ${mono ? "font-mono text-xs" : ""}`} title={value}>{value}</span>
    </div>
  );
}
