"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  Copy,
  FolderTree,
  Hash,
  Loader2,
  Play,
  Settings2,
} from "lucide-react";

import { CategoryPicker, type CategoriaElegida } from "@/components/numero-id/category-picker";
import { CopyShortnamePanel } from "@/components/numero-id/copy-shortname-panel";
import { CoursesTable } from "@/components/numero-id/courses-table";
import { ExecutionPanel } from "@/components/numero-id/execution-panel";
import { IdnumberPreview, type ProgresoComprobacion } from "@/components/numero-id/idnumber-preview";
import { SettingsSidebar } from "@/components/settings-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMoodleConfig } from "@/hooks/use-moodle-config";
import { comprobarValores, consultarCursos } from "@/lib/numero-id/api";
import { copiarNombreCorto, evaluarLote, filasAlcanzadas, type ModoCopia } from "@/lib/numero-id/plan";
import type { CursosResponse, ResultadoComprobacion } from "@/lib/numero-id/types";
import { normalizarIdnumber } from "@/lib/numero-id/valor";

type Fase = "edicion" | "previsualizar" | "ejecutar";

interface Consulta {
  categoria: CategoriaElegida;
  incluirSubcategorias: boolean;
}

const mensajeDe = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto);

export default function NumeroIdCursosPage() {
  const { config, estaConfigurado, recargar } = useMoodleConfig();
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);

  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [respuesta, setRespuesta] = useState<CursosResponse | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState<string | null>(null);
  const [errorRefresco, setErrorRefresco] = useState<string | null>(null);

  // Propuestas: texto escrito por curso. Selección: lo que se ejecuta.
  const [propuestas, setPropuestas] = useState<Map<number, string>>(new Map());
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [comprobaciones, setComprobaciones] = useState<Map<string, ResultadoComprobacion>>(new Map());
  const [progresoComprobacion, setProgresoComprobacion] = useState<ProgresoComprobacion | null>(null);
  const [copiaAbierta, setCopiaAbierta] = useState(false);
  const [fase, setFase] = useState<Fase>("edicion");
  const previsualizacionRef = useRef<HTMLDivElement>(null);

  const cursos = useMemo(() => respuesta?.cursos ?? [], [respuesta]);
  const porId = useMemo(() => new Map(cursos.map((curso) => [curso.id, curso])), [cursos]);
  const lote = useMemo(
    () => evaluarLote({ cursos, propuestas, seleccion, comprobaciones }),
    [cursos, propuestas, seleccion, comprobaciones],
  );

  const categoriasFallidas = respuesta?.categorias.filter((categoria) => !categoria.ok) ?? [];
  const mostrarCategoria = (respuesta?.categorias.length ?? 0) > 1;

  const consultar = useCallback(
    async (categoria: CategoriaElegida, incluirSubcategorias: boolean) => {
      if (!config) return;
      setConsultando(true);
      setErrorConsulta(null);
      setErrorRefresco(null);

      try {
        setRespuesta(await consultarCursos(config, categoria.id, incluirSubcategorias));
        setConsulta({ categoria, incluirSubcategorias });
        setPropuestas(new Map());
        setSeleccion(new Set());
        setComprobaciones(new Map());
        setFase("edicion");
      } catch (err) {
        setRespuesta(null);
        setErrorConsulta(mensajeDe(err, "Error inesperado al consultar los cursos"));
      } finally {
        setConsultando(false);
      }
    },
    [config],
  );

  /** Tras ejecutar, la tabla debe mostrar lo que hay en Moodle. Las filas que
   *  ya tienen su valor pierden la propuesta y la selección; las que fallaron
   *  las conservan para reintentar. */
  const refrescar = useCallback(async () => {
    if (!config || !consulta) return;
    setComprobaciones(new Map());

    try {
      const nueva = await consultarCursos(config, consulta.categoria.id, consulta.incluirSubcategorias);
      const actuales = new Map(nueva.cursos.map((curso) => [curso.id, curso.idnumber]));
      const pendientes = new Map(
        [...propuestas].filter(([id, valor]) => actuales.has(id) && normalizarIdnumber(valor) !== actuales.get(id)),
      );
      setRespuesta(nueva);
      setPropuestas(pendientes);
      setSeleccion((previa) => new Set([...previa].filter((id) => pendientes.has(id))));
      setErrorRefresco(null);
    } catch (err) {
      setErrorRefresco(mensajeDe(err, "Error inesperado al volver a consultar los cursos"));
    }
  }, [config, consulta, propuestas]);

  const cambiarPropuesta = useCallback(
    (courseId: number, valor: string) => {
      setPropuestas((previas) => new Map(previas).set(courseId, valor));
      const curso = porId.get(courseId);
      if (curso && normalizarIdnumber(valor) !== curso.idnumber) {
        setSeleccion((previa) => (previa.has(courseId) ? previa : new Set(previa).add(courseId)));
      }
    },
    [porId],
  );

  const restablecer = useCallback((courseIds: number[]) => {
    setPropuestas((previas) => {
      const siguientes = new Map(previas);
      courseIds.forEach((id) => siguientes.delete(id));
      return siguientes;
    });
  }, []);

  const aplicarCopia = (modo: ModoCopia) => {
    const alcanzadas = filasAlcanzadas(cursos, propuestas, seleccion, modo);
    const resultado = copiarNombreCorto(alcanzadas, propuestas);
    setPropuestas(resultado.propuestas);
    setSeleccion((previa) => new Set([...previa, ...resultado.cambiadas]));
  };

  const comprobar = async (valores: string[]) => {
    if (!config || valores.length === 0) return;
    setProgresoComprobacion({ procesados: 0, total: valores.length });

    const resultados = await comprobarValores(config, valores, (procesados) =>
      setProgresoComprobacion({ procesados, total: valores.length }),
    );

    setComprobaciones((previas) => {
      const siguientes = new Map(previas);
      resultados.forEach((resultado) => siguientes.set(resultado.valor, resultado));
      return siguientes;
    });
    setProgresoComprobacion(null);
  };

  const previsualizar = () => {
    setFase("previsualizar");
    requestAnimationFrame(() => previsualizacionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    void comprobar(lote.valoresPorComprobar);
  };

  const reintentarComprobacion = () => {
    const valores = [
      ...new Set(lote.filas.filter((f) => f.seleccionada && f.estado === "sin-comprobar").map((f) => f.propuesto)),
    ];
    setComprobaciones((previas) => {
      const siguientes = new Map(previas);
      valores.forEach((valor) => siguientes.delete(valor));
      return siguientes;
    });
    void comprobar(valores);
  };

  const edicionBloqueada = fase !== "edicion";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:px-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">API REST Moodle</Badge>
          {estaConfigurado && (
            <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-400">
              Token configurado
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Número ID de cursos</h1>
          <Button type="button" variant="outline" onClick={() => setAjustesAbiertos(true)}>
            <Settings2 className="mr-1.5 h-4 w-4" />
            Ajustes
          </Button>
        </div>
        <p className="text-muted-foreground">
          Revisa y corrige en lote el Número ID de los cursos de una categoría. Solo modifica ese campo: no toca
          nombres, categoría, matrículas ni roles.
        </p>
      </header>

      {!estaConfigurado && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
          Configura el Token y la URL de Moodle en{" "}
          <button
            type="button"
            onClick={() => setAjustesAbiertos(true)}
            className="rounded font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ajustes
          </button>{" "}
          para comenzar.
        </div>
      )}

      {/* ── 1. Categoría ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderTree className="h-4 w-4 text-muted-foreground" /> 1. Categoría
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryPicker
            config={config}
            onConsultar={(categoria, incluir) => void consultar(categoria, incluir)}
            cargando={consultando}
            deshabilitado={!estaConfigurado || edicionBloqueada}
          />
        </CardContent>
      </Card>

      {/* ── 2. Cursos ── */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Hash className="h-4 w-4 text-muted-foreground" /> 2. Cursos y Número ID
            {consulta && (
              <span className="text-sm font-normal text-muted-foreground">
                · {consulta.categoria.nombre}
                {consulta.incluirSubcategorias ? " y subcategorías" : ""}
              </span>
            )}
          </CardTitle>
          {respuesta && cursos.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setCopiaAbierta(true)} disabled={edicionBloqueada}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copiar nombre corto → Número ID
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {consultando && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Consultando los cursos en Moodle…
            </div>
          )}

          {!consultando && errorConsulta && <Aviso tono="error">{errorConsulta}</Aviso>}

          {!consultando && !errorConsulta && !respuesta && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
              <Hash className="h-6 w-6 text-muted-foreground/60" />
              <p className="text-sm font-medium">Aún no hay cursos</p>
              <p className="text-sm text-muted-foreground">
                Elige una categoría arriba y consulta para ver el nombre corto y el Número ID de cada curso.
              </p>
            </div>
          )}

          {!consultando && respuesta && (
            <>
              {errorRefresco && (
                <Aviso tono="aviso">
                  No se pudo volver a consultar Moodle después de ejecutar, así que la tabla puede no reflejar el
                  estado real. Usa el resultado de la ejecución o consulta de nuevo. Detalle: {errorRefresco}
                </Aviso>
              )}

              {categoriasFallidas.length > 0 && (
                <Aviso tono="aviso">
                  {categoriasFallidas.length} {categoriasFallidas.length === 1 ? "categoría no se pudo" : "categorías no se pudieron"}{" "}
                  consultar; sus cursos no aparecen en la tabla:
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {categoriasFallidas.map((categoria) => (
                      <li key={categoria.id}>
                        <span className="font-medium">{categoria.nombre}</span> ({categoria.id}) — {categoria.error}
                      </li>
                    ))}
                  </ul>
                </Aviso>
              )}

              <CoursesTable
                lote={lote}
                propuestas={propuestas}
                seleccion={seleccion}
                onSeleccionChange={setSeleccion}
                onPropuestaChange={cambiarPropuesta}
                onRestablecer={restablecer}
                soloLectura={edicionBloqueada}
                mostrarCategoria={mostrarCategoria}
              />

              {fase === "edicion" && cursos.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                  <Button type="button" onClick={previsualizar} disabled={seleccion.size === 0}>
                    <ClipboardList className="mr-1.5 h-4 w-4" />
                    Previsualizar {seleccion.size} seleccionado{seleccion.size !== 1 ? "s" : ""}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Solo se ejecutan las filas seleccionadas. Antes se comprueba en Moodle que cada valor esté libre.
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Previsualización ── */}
      {fase === "previsualizar" && (
        <Card ref={previsualizacionRef}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-muted-foreground" /> 3. Previsualización
            </CardTitle>
          </CardHeader>
          <CardContent>
            <IdnumberPreview
              lote={lote}
              comprobacion={progresoComprobacion}
              onVolver={() => setFase("edicion")}
              onEjecutar={() => setFase("ejecutar")}
              onReintentarComprobacion={reintentarComprobacion}
            />
          </CardContent>
        </Card>
      )}

      {/* ── 4. Ejecución ── */}
      {fase === "ejecutar" && config && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Play className="h-4 w-4 text-muted-foreground" /> 4. Ejecución
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExecutionPanel
              config={config}
              lote={lote}
              onCancelar={() => setFase("previsualizar")}
              onFinalizado={() => void refrescar()}
              onVolverALaTabla={() => setFase("edicion")}
            />
          </CardContent>
        </Card>
      )}

      <CopyShortnamePanel
        abierto={copiaAbierta}
        onAbiertoChange={setCopiaAbierta}
        cursos={cursos}
        propuestas={propuestas}
        seleccion={seleccion}
        onAplicar={aplicarCopia}
      />

      <SettingsSidebar
        open={ajustesAbiertos}
        onClose={() => {
          setAjustesAbiertos(false);
          void recargar();
        }}
      />
    </main>
  );
}

function Aviso({ tono, children }: { tono: "error" | "aviso"; children: React.ReactNode }) {
  const clases =
    tono === "error"
      ? "border-rose-200 bg-rose-50/70 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300"
      : "border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300";

  return (
    <div role={tono === "error" ? "alert" : undefined} className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${clases}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
