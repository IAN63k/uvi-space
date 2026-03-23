"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  clearEncryptedDbConfig,
  loadEncryptedDbConfig,
  saveEncryptedDbConfig,
} from "@/lib/encrypted-local-storage";
import type { DatabaseConfig } from "@/lib/database-config";

const initialState: DatabaseConfig = {
  server: "",
  user: "",
  password: "",
  database: "",
};

export default function DatabaseSettingsPage() {
  const [form, setForm] = useState<DatabaseConfig>(initialState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [hasSavedConfig, setHasSavedConfig] = useState(false);
  const [testPassed, setTestPassed] = useState(false);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const stored = await loadEncryptedDbConfig();

        if (stored) {
          setForm(stored);
          setHasSavedConfig(true);
        }
      } catch {
        setStatusMessage("No se pudo leer la configuración local cifrada.");
      } finally {
        setLoading(false);
      }
    };

    void hydrate();
  }, []);

  const onChange = (key: keyof DatabaseConfig, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setTestPassed(false);
  };

  const validateForm = () => {
    const server = form.server.trim();
    const user = form.user.trim();
    const database = form.database.trim();
    const password = form.password;

    if (!server || !user || !database || !password) {
      return "Todos los campos son obligatorios.";
    }

    return null;
  };

  const testConnection = async () => {
    const validationError = validateForm();

    if (validationError) {
      setStatusMessage(validationError);
      return false;
    }

    setStatusMessage(null);
    setTesting(true);

    try {
      const response = await fetch("/api/configuracion/test-bd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dbConfig: form }),
      });

      const data = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !data.ok) {
        setTestPassed(false);
        setStatusMessage(data.message ?? "Falló la validación de la conexión.");
        return false;
      }

      setTestPassed(true);
      setStatusMessage(data.message ?? "Conexión validada correctamente.");
      return true;
    } catch {
      setTestPassed(false);
      setStatusMessage("No fue posible ejecutar el test de conexión.");
      return false;
    } finally {
      setTesting(false);
    }
  };

  const onSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);
    setSaving(true);

    try {
      const isValid = await testConnection();

      if (!isValid) {
        return;
      }

      await saveEncryptedDbConfig(form);
      setHasSavedConfig(true);
      setStatusMessage("Configuración guardada correctamente en localStorage cifrado.");
    } catch {
      setStatusMessage("Ocurrió un error guardando la configuración.");
    } finally {
      setSaving(false);
    }
  };

  const onClear = () => {
    clearEncryptedDbConfig();
    setForm(initialState);
    setHasSavedConfig(false);
    setTestPassed(false);
    setStatusMessage("Configuración local eliminada.");
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10 md:px-8">
      <header className="space-y-2">
        <Badge variant="secondary">Configuración</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Conexión a base de datos</h1>
        <p className="text-muted-foreground">
          Define los datos de conexión para Moodle y guárdalos de manera cifrada
          en el navegador.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Ajustes de conexión</CardTitle>
          <CardDescription>
            Esta configuración se guarda en `localStorage` del navegador actual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={onSave}>
            <div className="space-y-2">
              <Label htmlFor="server">Servidor</Label>
              <Input
                id="server"
                value={form.server}
                onChange={(event) => onChange("server", event.target.value)}
                placeholder="host o endpoint"
                required
                disabled={loading || saving}
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="user">Usuario</Label>
                <Input
                  id="user"
                  value={form.user}
                  onChange={(event) => onChange("user", event.target.value)}
                  required
                  disabled={loading || saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="database">Base de datos</Label>
                <Input
                  id="database"
                  value={form.database}
                  onChange={(event) => onChange("database", event.target.value)}
                  required
                  disabled={loading || saving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(event) => onChange("password", event.target.value)}
                required
                disabled={loading || saving}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" onClick={() => void testConnection()} disabled={loading || saving || testing}>
                {testing ? "Testeando..." : "Probar conexión"}
              </Button>
              <Button type="submit" disabled={loading || saving || testing}>
                {saving ? "Guardando..." : "Guardar configuración"}
              </Button>
              <Button type="button" variant="outline" onClick={onClear} disabled={loading || saving || testing}>
                Limpiar
              </Button>
              {hasSavedConfig ? <Badge variant="outline">Configuración guardada</Badge> : null}
              {testPassed ? <Badge variant="secondary">Conexión válida</Badge> : null}
            </div>
          </form>
        </CardContent>
      </Card>

      {statusMessage ? (
        <p className="text-sm text-muted-foreground">{statusMessage}</p>
      ) : null}

      <Separator />

      <div className="flex gap-3">
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}