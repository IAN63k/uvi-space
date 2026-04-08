"use client";

import { useEffect, useRef, useState } from "react";
import {
  X, Eye, EyeOff, CheckCircle2, WifiOff, Settings2,
  Shield, Wifi, ChevronRight, ToggleLeft, ToggleRight,
  Calendar, Hash, Type, AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  clearEncryptedJson,
  clearMoodleConfig,
  loadEncryptedJson,
  loadMoodleConfig,
  saveMoodleConfig,
  saveEncryptedJson,
} from "@/lib/encrypted-local-storage";
import {
  API_FUNCTIONS,
  buildDefaultRulesConfig,
  localStorageKey,
  type ApiFunctionConfig,
  type FieldDefinition,
  type RulesConfig,
} from "@/lib/moodle/rules";

// ── Helpers ───────────────────────────────────────────────────────────────────

function validationTypePill(vtype: FieldDefinition["validationType"]) {
  const map: Record<FieldDefinition["validationType"], { label: string; cls: string }> = {
    equals:   { label: "igual a",  cls: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800" },
    contains: { label: "contiene", cls: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800" },
    exists:   { label: "existe",   cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" },
    min_date: { label: "desde",    cls: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800" },
    max_date: { label: "hasta",    cls: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800" },
  };
  const { label, cls } = map[vtype] ?? map.equals;
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

function inputIcon(t: FieldDefinition["inputType"]) {
  const cls = "h-3 w-3 shrink-0 text-muted-foreground/60";
  if (t === "boolean") return <ToggleLeft className={cls} />;
  if (t === "date")    return <Calendar className={cls} />;
  if (t === "number")  return <Hash className={cls} />;
  return <Type className={cls} />;
}

// ── Rules Modal ───────────────────────────────────────────────────────────────

function RulesModal({
  fn,
  initial,
  onClose,
  onSave,
}: {
  fn: ApiFunctionConfig;
  initial: RulesConfig;
  onClose: () => void;
  onSave: (rules: RulesConfig) => void;
}) {
  const [draft, setDraft] = useState<RulesConfig>(() => ({ ...initial }));
  const scrollRef = useRef<HTMLDivElement>(null);

  const toggleField = (name: string) =>
    setDraft((p) => ({ ...p, [name]: { ...p[name]!, active: !p[name]!.active } }));

  const setExpected = (name: string, raw: string, def: FieldDefinition) => {
    let v: string | number | boolean;
    if (def.inputType === "boolean") v = raw === "true";
    else if (def.inputType === "number") v = raw === "" ? 0 : Number(raw);
    else v = raw;
    setDraft((p) => ({ ...p, [name]: { ...p[name]!, expected: v } }));
  };

  const activeCount = Object.values(draft).filter((r) => r.active).length;
  const total = fn.fields.length;
  const allActive = activeCount === total;

  const toggleAll = () => {
    const next = !allActive;
    setDraft((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { ...v, active: next }])));
  };

  return (
    <>
      {/* Modal backdrop — on top of the sidebar */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="fixed left-1/2 top-1/2 z-[70] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border bg-background shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b bg-muted/30 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Reglas de validación</h2>
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{fn.wsfunction}</p>
          </div>

          {/* Enable / disable all */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">{activeCount}</span>/{total}
            </span>
            <button
              type="button"
              onClick={toggleAll}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                allActive
                  ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
              }`}
            >
              {allActive ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
              {allActive ? "Deshabilitar todas" : "Habilitar todas"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Field list */}
        <div ref={scrollRef} className="max-h-[60vh] overflow-y-auto px-6 py-4">
          <div className="space-y-1.5">
            {fn.fields.map((def) => {
              const rule = draft[def.name];
              if (!rule) return null;
              const active = rule.active;

              return (
                <div
                  key={def.name}
                  className={`rounded-xl border transition-all duration-150 ${
                    active ? "border-border bg-background" : "border-transparent bg-muted/20 opacity-55"
                  }`}
                >
                  <div className="flex items-center gap-3 px-3 pt-2.5 pb-1">
                    <Switch checked={active} onCheckedChange={() => toggleField(def.name)} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {inputIcon(def.inputType)}
                        <span className="text-[11px] font-semibold">{def.label}</span>
                        {validationTypePill(def.validationType)}
                      </div>
                    </div>
                  </div>

                  <p className="px-3 pb-1.5 text-[10px] leading-relaxed text-muted-foreground">{def.description}</p>

                  {active && def.validationType !== "exists" && (
                    <div className="px-3 pb-2.5">
                      {def.inputType === "boolean" ? (
                        <select
                          value={String(rule.expected)}
                          onChange={(e) => setExpected(def.name, e.target.value, def)}
                          className="h-7 w-full rounded-lg border border-input bg-background px-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="true">true — activado</option>
                          <option value="false">false — desactivado</option>
                        </select>
                      ) : (
                        <input
                          type={def.inputType === "date" ? "date" : def.inputType === "number" ? "number" : "text"}
                          value={String(rule.expected)}
                          onChange={(e) => setExpected(def.name, e.target.value, def)}
                          placeholder={def.inputType === "date" ? "YYYY-MM-DD" : "Valor esperado"}
                          className="h-7 w-full rounded-lg border border-input bg-background px-2 font-mono text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t bg-muted/20 px-6 py-3">
          <span className="text-xs text-muted-foreground">
            {activeCount} de {total} reglas activas
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={() => onSave(draft)}>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Guardar cambios
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Settings Sidebar ──────────────────────────────────────────────────────────

export interface SettingsSidebarProps {
  open: boolean;
  onClose: () => void;
  /** Called after rules are saved, so the parent can reload active rules */
  onRulesChange?: () => void;
}

export function SettingsSidebar({ open, onClose, onRulesChange }: SettingsSidebarProps) {
  // Connection state
  const [tokenInput, setTokenInput]   = useState("");
  const [urlInput, setUrlInput]       = useState("");
  const [tokenVisible, setTokenVisible] = useState(false);
  const [connectionSaved, setConnectionSaved] = useState(false);
  const [statusMsg, setStatusMsg]     = useState<string | null>(null);

  // Rules state
  const [allRules, setAllRules] = useState<Record<string, RulesConfig | null>>(
    Object.fromEntries(API_FUNCTIONS.map((fn) => [fn.storageKey, null])),
  );
  const [modalFn, setModalFn] = useState<ApiFunctionConfig | null>(null);

  // Load on open
  useEffect(() => {
    if (!open) return;
    void (async () => {
      const config = await loadMoodleConfig();
      if (config) {
        setTokenInput(config.token);
        setUrlInput(config.moodleUrl);
        setConnectionSaved(true);
      }
      const entries = await Promise.all(
        API_FUNCTIONS.map(async (fn) => {
          const saved = await loadEncryptedJson<RulesConfig>(localStorageKey(fn.storageKey));
          return [fn.storageKey, saved] as [string, RulesConfig | null];
        }),
      );
      setAllRules(Object.fromEntries(entries));
    })();
  }, [open]);

  // Trap focus & close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !modalFn) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, modalFn]);

  const saveConnection = async () => {
    const token = tokenInput.trim();
    const moodleUrl = urlInput.trim();
    if (!token || !moodleUrl) { setStatusMsg("Completa el token y la URL."); return; }
    await saveMoodleConfig({ token, moodleUrl });
    setConnectionSaved(true);
    setStatusMsg("Conexión guardada.");
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const clearConnection = () => {
    clearMoodleConfig();
    setTokenInput(""); setUrlInput(""); setConnectionSaved(false);
    setStatusMsg("Configuración eliminada.");
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleSaveRules = async (rules: RulesConfig) => {
    if (!modalFn) return;
    await saveEncryptedJson(localStorageKey(modalFn.storageKey), rules);
    setAllRules((p) => ({ ...p, [modalFn.storageKey]: rules }));
    setModalFn(null);
    onRulesChange?.();
  };

  const handleResetRules = async (fn: ApiFunctionConfig) => {
    clearEncryptedJson(localStorageKey(fn.storageKey));
    setAllRules((p) => ({ ...p, [fn.storageKey]: null }));
    onRulesChange?.();
  };

  const getInitialRules = (fn: ApiFunctionConfig): RulesConfig => {
    const defaults = buildDefaultRulesConfig(fn);
    const saved = allRules[fn.storageKey];
    return saved ? { ...defaults, ...saved } : defaults;
  };

  const isConfigured = (fn: ApiFunctionConfig) => allRules[fn.storageKey] !== null;
  const activeCount  = (fn: ApiFunctionConfig) => {
    const r = allRules[fn.storageKey] ?? buildDefaultRulesConfig(fn);
    return Object.values(r).filter((x) => x.active).length;
  };

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* ── Drawer panel ── */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Ajustes del sistema"
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l bg-background shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ── Sidebar header ── */}
        <div className="flex shrink-0 items-center justify-between border-b bg-muted/40 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border bg-background shadow-sm">
              <Settings2 className="h-3.5 w-3.5 text-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-none">Ajustes del sistema</h2>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Conexión y validación</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ajustes"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Section 1: Moodle API connection ── */}
          <section className="border-b px-5 py-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {connectionSaved
                  ? <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                  : <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                }
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Conexión API Moodle
                </h3>
              </div>
              {connectionSaved && (
                <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Configurado
                </span>
              )}
            </div>

            <div className="space-y-3">
              {/* URL */}
              <div className="space-y-1">
                <label htmlFor="s-url" className="block text-[11px] font-medium text-muted-foreground">
                  URL de Moodle
                </label>
                <input
                  id="s-url"
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://moodle.example.com"
                  className="flex h-8 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {/* Token */}
              <div className="space-y-1">
                <label htmlFor="s-token" className="block text-[11px] font-medium text-muted-foreground">
                  Token API
                </label>
                <div className="relative">
                  <input
                    id="s-token"
                    type={tokenVisible ? "text" : "password"}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Token de acceso REST"
                    className="flex h-8 w-full rounded-lg border border-input bg-background px-3 pr-9 font-mono text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setTokenVisible((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={tokenVisible ? "Ocultar token" : "Mostrar token"}
                  >
                    {tokenVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/70">
                  Cifrado localmente. Nunca expuesto en texto plano.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 flex-1 text-xs"
                  onClick={() => void saveConnection()}
                  disabled={!tokenInput.trim() || !urlInput.trim()}
                >
                  Guardar conexión
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={clearConnection}
                >
                  Limpiar
                </Button>
              </div>

              {statusMsg && (
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <AlertTriangle className="h-3 w-3" />
                  {statusMsg}
                </p>
              )}
            </div>
          </section>

          {/* ── Section 2: Validation rules ── */}
          <section className="px-5 py-5">
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Reglas de validación
              </h3>
            </div>

            <div className="space-y-2">
              {API_FUNCTIONS.map((fn) => {
                const configured = isConfigured(fn);
                const count = activeCount(fn);
                return (
                  <div
                    key={fn.wsfunction}
                    className="overflow-hidden rounded-xl border bg-muted/20 transition-colors hover:bg-muted/30"
                  >
                    <div className="px-3.5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[10px] text-muted-foreground">{fn.wsfunction}</span>
                            {configured ? (
                              <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-px text-[9px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
                                Configurado
                              </span>
                            ) : (
                              <span className="rounded border border-border bg-muted px-1.5 py-px text-[9px] font-semibold text-muted-foreground">
                                Por defecto
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">{fn.description}</p>
                          <p className="mt-1.5 text-[11px] font-medium">
                            <span className="tabular-nums text-foreground">{count}</span>
                            <span className="text-muted-foreground"> de {fn.fields.length} reglas activas</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setModalFn(fn)}
                          className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium shadow-xs transition-all hover:border-primary/50 hover:bg-accent hover:shadow-sm active:scale-95"
                        >
                          Configurar
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>

                    {configured && (
                      <div className="border-t border-dashed px-3.5 py-2">
                        <button
                          type="button"
                          onClick={() => void handleResetRules(fn)}
                          className="text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        >
                          Restablecer valores por defecto
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* ── Footer note ── */}
        <div className="shrink-0 border-t bg-muted/20 px-5 py-3">
          <p className="text-[10px] text-muted-foreground/70">
            Configuración cifrada con AES-GCM en <code className="font-mono">localStorage</code>.
          </p>
        </div>
      </aside>

      {/* ── Rules Modal (rendered on top of everything) ── */}
      {modalFn && (
        <RulesModal
          fn={modalFn}
          initial={getInitialRules(modalFn)}
          onClose={() => setModalFn(null)}
          onSave={(rules) => void handleSaveRules(rules)}
        />
      )}
    </>
  );
}
