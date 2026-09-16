"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Folder, ListChecks, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { MoodleConfig } from "@/lib/encrypted-local-storage";
import { fetchCategories, type CategoryItem } from "@/lib/matriculas/api";
import { cn } from "@/lib/utils";

export interface CategoriaElegida {
  id: number;
  nombre: string;
}

interface CategoryPickerProps {
  config: MoodleConfig | null;
  onConsultar: (categoria: CategoriaElegida, incluirSubcategorias: boolean) => void;
  cargando: boolean;
  deshabilitado: boolean;
}

const GRUPO_RADIO = "numero-id-categoria";

/** Elige una categoría a cualquier profundidad del árbol.
 *
 *  El selector de matrículas (CategoryTreeSelector) elige cursos, no categorías,
 *  y solo muestra cursos en las hojas; por eso este módulo tiene el suyo, que
 *  reutiliza la misma API de categorías. */
export function CategoryPicker({ config, onConsultar, cargando, deshabilitado }: CategoryPickerProps) {
  const [raices, setRaices] = useState<CategoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elegida, setElegida] = useState<CategoriaElegida | null>(null);
  const [incluirSubcategorias, setIncluirSubcategorias] = useState(false);

  useEffect(() => {
    if (!config) return;
    let vigente = true;
    fetchCategories(config, 0)
      .then((categorias) => vigente && setRaices(categorias))
      .catch((err: unknown) => vigente && setError(err instanceof Error ? err.message : "Error al cargar las categorías"));
    return () => {
      vigente = false;
    };
  }, [config]);

  return (
    <div className="space-y-4">
      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-xs text-muted-foreground">
          Categoría de Moodle — despliega el árbol y elige una
        </legend>

        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
            {error}
          </p>
        )}

        {config && raices === null && !error && (
          <p className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando categorías…
          </p>
        )}

        {raices && raices.length === 0 && (
          <p className="px-1 py-2 text-sm text-muted-foreground">El token no puede ver ninguna categoría.</p>
        )}

        {config && raices && raices.length > 0 && (
          <div className="max-h-72 overflow-y-auto rounded-lg border bg-muted/10 p-1.5">
            <ul role="list">
              {raices.map((categoria) => (
                <NodoCategoria
                  key={categoria.id}
                  config={config}
                  categoria={categoria}
                  elegidaId={elegida?.id ?? null}
                  onElegir={setElegida}
                />
              ))}
            </ul>
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="incluir-subcategorias"
            checked={incluirSubcategorias}
            onCheckedChange={(valor) => setIncluirSubcategorias(valor === true)}
          />
          <Label htmlFor="incluir-subcategorias" className="text-sm font-normal">
            Incluir subcategorías
          </Label>
        </div>

        <Button
          type="button"
          onClick={() => elegida && onConsultar(elegida, incluirSubcategorias)}
          disabled={deshabilitado || cargando || !elegida}
        >
          {cargando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ListChecks className="mr-1.5 h-4 w-4" />}
          {cargando ? "Consultando…" : "Consultar cursos"}
        </Button>

        <span className="text-sm text-muted-foreground" aria-live="polite">
          {elegida ? (
            <>
              Categoría: <span className="font-medium text-foreground">{elegida.nombre}</span>
            </>
          ) : (
            "Ninguna categoría elegida"
          )}
        </span>
      </div>
    </div>
  );
}

interface NodoCategoriaProps {
  config: MoodleConfig;
  categoria: CategoryItem;
  elegidaId: number | null;
  onElegir: (categoria: CategoriaElegida) => void;
}

function NodoCategoria({ config, categoria, elegidaId, onElegir }: NodoCategoriaProps) {
  const [abierta, setAbierta] = useState(false);
  const [hijas, setHijas] = useState<CategoryItem[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alternar = async () => {
    setAbierta((previo) => !previo);
    if (hijas !== null || cargando) return;

    setCargando(true);
    setError(null);
    try {
      setHijas(await fetchCategories(config, categoria.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar las subcategorías");
    } finally {
      setCargando(false);
    }
  };

  const radioId = `categoria-${categoria.id}`;
  const esElegida = elegidaId === categoria.id;

  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md pr-2 transition-colors",
          esElegida ? "bg-primary/10" : "hover:bg-accent",
        )}
      >
        <button
          type="button"
          onClick={() => void alternar()}
          aria-expanded={abierta}
          aria-label={`${abierta ? "Plegar" : "Desplegar"} ${categoria.name}`}
          className="rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {cargando ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : abierta ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        <input
          type="radio"
          id={radioId}
          name={GRUPO_RADIO}
          checked={esElegida}
          onChange={() => onElegir({ id: categoria.id, nombre: categoria.name })}
          className="h-3.5 w-3.5 accent-primary"
        />
        <label htmlFor={radioId} className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 py-1.5 pl-1 text-sm">
          <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
          <span className="truncate">{categoria.name}</span>
          <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {categoria.coursecount} curso{categoria.coursecount !== 1 ? "s" : ""} directo
            {categoria.coursecount !== 1 ? "s" : ""}
          </span>
        </label>
      </div>

      {abierta && (
        <div className="ml-3 border-l border-border/60 pl-2">
          {error && <p className="px-2 py-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
          {hijas?.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">Sin subcategorías.</p>}
          {hijas && hijas.length > 0 && (
            <ul role="list">
              {hijas.map((hija) => (
                <NodoCategoria
                  key={hija.id}
                  config={config}
                  categoria={hija}
                  elegidaId={elegidaId}
                  onElegir={onElegir}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
