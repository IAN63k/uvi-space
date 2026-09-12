"use client";

import { useCallback, useEffect, useState } from "react";

import { loadMoodleConfig, type MoodleConfig } from "@/lib/encrypted-local-storage";

export interface EstadoMoodleConfig {
  config: MoodleConfig | null;
  estaConfigurado: boolean;
  cargando: boolean;
  /** Releer tras cerrar el panel de Ajustes. */
  recargar: () => Promise<void>;
}

/** Único punto de acceso al token de Moodle del módulo de roles.
 *
 *  Ningún otro archivo del módulo lee el almacenamiento del navegador: cuando
 *  el token pase a ser un secreto de servidor, el cambio es este archivo. */
export function useMoodleConfig(): EstadoMoodleConfig {
  const [config, setConfig] = useState<MoodleConfig | null>(null);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const guardada = await loadMoodleConfig();
      setConfig(guardada?.token && guardada.moodleUrl ? guardada : null);
    } catch {
      setConfig(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { config, estaConfigurado: config !== null, cargando, recargar };
}
