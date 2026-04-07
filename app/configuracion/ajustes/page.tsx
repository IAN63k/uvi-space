"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Settings2, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  type RulesConfig,
} from "@/lib/moodle/rules";

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

  const toggleField = (field: string) => {
    setDraft((prev) => ({
      ...prev,
      [field]: { ...prev[field]!, active: !prev[field]!.active },
    }));
  };

  const setExpected = (field: string, raw: string, inputType: "text" | "number") => {
    const value = inputType === "number" ? (raw === "" ? 0 : Number(raw)) : raw;
    setDraft((prev) => ({
      ...prev,
      [field]: { ...prev[field]!, expected: value },
    }));
  };

  const activeCount = Object.values(draft).filter((r) => r.active).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h2 className="text-base font-semibold">
            Reglas de validación — <span className="font-mono text-sm">{fn.wsfunction}</span>
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Define qué campos se validan y cuál es el valor esperado.
          </p>
        </div>

        {/* Table */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <th className="pb-2 pr-4">Campo</th>
                <th className="pb-2 pr-4">Descripción</th>
                <th className="pb-2 pr-4 text-center">Activo</th>
                <th className="pb-2">Valor esperado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {fn.fields.map((fieldDef) => {
                const rule = draft[fieldDef.name];
                if (!rule) return null;
                return (
                  <tr key={fieldDef.name} className={`${!rule.active ? "opacity-50" : ""} transition-opacity`}>
                    <td className="py-2.5 pr-4">
                      <span className="font-mono text-xs font-medium">{fieldDef.name}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{fieldDef.description}</td>
                    <td className="py-2.5 pr-4 text-center">
                      <Switch
                        checked={rule.active}
                        onCheckedChange={() => toggleField(fieldDef.name)}
                        size="sm"
                      />
                    </td>
                    <td className="py-2.5">
                      <input
                        type={fieldDef.inputType}
                        value={String(rule.expected)}
                        onChange={(e) => setExpected(fieldDef.name, e.target.value, fieldDef.inputType)}
                        disabled={!rule.active}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-xs shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-3">
          <span className="text-xs text-muted-foreground">
            {activeCount} de {fn.fields.length} campos activos
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => onSave(draft)}>
              Guardar cambios
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── API Function Card ─────────────────────────────────────────────────────────

function ApiFunctionCard({
  fn,
  savedRules,
  onConfigure,
}: {
  fn: ApiFunctionConfig;
  savedRules: RulesConfig | null;
  onConfigure: () => void;
}) {
  const rules = savedRules ?? buildDefaultRulesConfig(fn);
  const activeFields = Object.entries(rules).filter(([, r]) => r.active);

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium">{fn.label}</span>
          {savedRules ? (
            <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-400">
              Configurado
            </Badge>
          ) : (
            <Badge variant="secondary">Por defecto</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{fn.description}</p>
        {activeFields.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {activeFields.map(([field, rule]) => (
              <span key={field} className="rounded border bg-muted/50 px-2 py-0.5 font-mono text-[11px]">
                {field}:{" "}
                <span className="font-semibold">
                  {String(rule.expected) === "" ? '""' : String(rule.expected)}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onConfigure} className="shrink-0">
        <Settings2 className="mr-1.5 h-3.5 w-3.5" />
        Configurar
      </Button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AjustesPage() {
  // Moodle connection
  const [tokenInput, setTokenInput] = useState("");
  const [moodleUrlInput, setMoodleUrlInput] = useState("");
  const [tokenVisible, setTokenVisible] = useState(false);
  const [connectionSaved, setConnectionSaved] = useState(false);
  const [connectionStatusMsg, setConnectionStatusMsg] = useState<string | null>(null);

  // API rules: map from storageKey → RulesConfig | null
  const [allRules, setAllRules] = useState<Record<string, RulesConfig | null>>(
    Object.fromEntries(API_FUNCTIONS.map((fn) => [fn.storageKey, null])),
  );

  // Modal state
  const [modalFn, setModalFn] = useState<ApiFunctionConfig | null>(null);

  // Load all saved settings on mount
  useEffect(() => {
    async function hydrate() {
      const config = await loadMoodleConfig();
      if (config) {
        setTokenInput(config.token);
        setMoodleUrlInput(config.moodleUrl);
        setConnectionSaved(true);
      }

      const rulesEntries = await Promise.all(
        API_FUNCTIONS.map(async (fn) => {
          const key = localStorageKey(fn.storageKey);
          const saved = await loadEncryptedJson<RulesConfig>(key);
          return [fn.storageKey, saved] as [string, RulesConfig | null];
        }),
      );
      setAllRules(Object.fromEntries(rulesEntries));
    }
    void hydrate();
  }, []);

  const saveConnection = async () => {
    const token = tokenInput.trim();
    const moodleUrl = moodleUrlInput.trim();
    if (!token || !moodleUrl) {
      setConnectionStatusMsg("Completa el token y la URL antes de guardar.");
      return;
    }
    await saveMoodleConfig({ token, moodleUrl });
    setConnectionSaved(true);
    setConnectionStatusMsg("Conexión guardada correctamente.");
    setTimeout(() => setConnectionStatusMsg(null), 3000);
  };

  const clearConnection = () => {
    clearMoodleConfig();
    setTokenInput("");
    setMoodleUrlInput("");
    setConnectionSaved(false);
    setConnectionStatusMsg("Configuración de conexión eliminada.");
    setTimeout(() => setConnectionStatusMsg(null), 3000);
  };

  const openModal = (fn: ApiFunctionConfig) => setModalFn(fn);

  const handleSaveRules = async (rules: RulesConfig) => {
    if (!modalFn) return;
    const key = localStorageKey(modalFn.storageKey);
    await saveEncryptedJson(key, rules);
    setAllRules((prev) => ({ ...prev, [modalFn.storageKey]: rules }));
    setModalFn(null);
  };

  const handleResetRules = async (fn: ApiFunctionConfig) => {
    const key = localStorageKey(fn.storageKey);
    clearEncryptedJson(key);
    setAllRules((prev) => ({ ...prev, [fn.storageKey]: null }));
  };

  const getModalInitialRules = (fn: ApiFunctionConfig): RulesConfig => {
    const defaults = buildDefaultRulesConfig(fn);
    const saved = allRules[fn.storageKey];
    // Merge: defaults provide structure for new fields; saved values override known fields
    return saved ? { ...defaults, ...saved } : defaults;
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10 md:px-8">
      <header className="space-y-2">
        <Badge variant="secondary">Configuración</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Ajustes del sistema</h1>
        <p className="text-muted-foreground">
          Configura las conexiones y reglas de validación utilizadas por los informes.
        </p>
      </header>

      {/* ── Moodle API section ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Moodle API</h2>
          <p className="text-sm text-muted-foreground">
            Acceso y reglas de validación para la API REST de Moodle.
          </p>
        </div>

        {/* Connection card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Conexión</CardTitle>
                <CardDescription>
                  Token y URL de la instancia de Moodle. Se cifran en este navegador.
                </CardDescription>
              </div>
              {connectionSaved && (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Guardado
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="moodleUrl">URL de Moodle</Label>
              <input
                id="moodleUrl"
                type="url"
                value={moodleUrlInput}
                onChange={(e) => setMoodleUrlInput(e.target.value)}
                placeholder="https://moodle.example.com"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="moodleToken">Token API Moodle</Label>
              <div className="relative">
                <input
                  id="moodleToken"
                  type={tokenVisible ? "text" : "password"}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Token de acceso para la API REST"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pr-10 font-mono text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setTokenVisible((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={tokenVisible ? "Ocultar token" : "Revelar token"}
                >
                  {tokenVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Este token se usa únicamente en el servidor. Nunca se expone en el cliente en texto plano.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => void saveConnection()}
                disabled={!tokenInput.trim() || !moodleUrlInput.trim()}
              >
                Guardar
              </Button>
              <Button type="button" variant="outline" onClick={clearConnection}>
                Limpiar
              </Button>
            </div>

            {connectionStatusMsg && (
              <p className="text-sm text-muted-foreground">{connectionStatusMsg}</p>
            )}
          </CardContent>
        </Card>

        {/* API Functions card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funciones API</CardTitle>
            <CardDescription>
              Reglas de validación por función. Haz clic en "Configurar" para editar los campos activos y sus valores esperados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {API_FUNCTIONS.map((fn) => (
              <div key={fn.wsfunction} className="space-y-1">
                <ApiFunctionCard
                  fn={fn}
                  savedRules={allRules[fn.storageKey] ?? null}
                  onConfigure={() => openModal(fn)}
                />
                {allRules[fn.storageKey] && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handleResetRules(fn)}
                      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Restablecer valores por defecto
                    </button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Separator />

      <p className="text-xs text-muted-foreground">
        Toda la configuración se almacena cifrada (AES-GCM) en el <code>localStorage</code> de este navegador.
        El token nunca se transmite al cliente en texto plano.
      </p>

      {/* ── Rules Modal ── */}
      {modalFn && (
        <RulesModal
          fn={modalFn}
          initial={getModalInitialRules(modalFn)}
          onClose={() => setModalFn(null)}
          onSave={(rules) => void handleSaveRules(rules)}
        />
      )}
    </main>
  );
}
