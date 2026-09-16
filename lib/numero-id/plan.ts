import {
  avisosDeValor,
  claveDeUnicidad,
  excedeLongitud,
  normalizarIdnumber,
  type AvisoValor,
} from "./valor";
import type { CursoIdnumber, CursoOcupante, ResultadoComprobacion } from "./types";

export type EstadoFila =
  | "sin-cambios"
  | "vacio"
  | "listo"
  | "duplicado"
  | "circular"
  | "ocupado"
  | "sin-comprobar"
  | "demasiado-largo";

export type AccionFila = "asignar" | "reemplazar" | "vaciar" | "ninguna";

/** Impiden ejecutar el lote hasta que se resuelvan. */
export const ESTADOS_BLOQUEANTES: ReadonlySet<EstadoFila> = new Set([
  "duplicado",
  "circular",
  "demasiado-largo",
]);

/** Filas que no se van a escribir por un conflicto; se destacan en la tabla. */
export const ESTADOS_EN_CONFLICTO: ReadonlySet<EstadoFila> = new Set([
  ...ESTADOS_BLOQUEANTES,
  "ocupado",
  "sin-comprobar",
]);

export interface FilaEvaluada {
  curso: CursoIdnumber;
  /** Valor propuesto ya normalizado. Sin edición, es el actual tal cual. */
  propuesto: string;
  cambia: boolean;
  seleccionada: boolean;
  accion: AccionFila;
  estado: EstadoFila;
  avisos: AvisoValor[];
  /** Tiene un Número ID que no coincide con el nombre corto: puede venir de una
   *  integración externa que empareja cursos por idnumber. */
  posibleDuenoExterno: boolean;
  /** Duplicado: filas con las que choca. Circular: filas de las que depende. */
  conflictoCon: number[];
  /** Cursos fuera de la tabla que ya tienen el valor propuesto. */
  ocupantes: CursoOcupante[];
  errorComprobacion?: string;
  /** Filas del lote que tienen hoy este valor y deben soltarlo antes. */
  dependeDe: number[];
}

export interface EntradaLote {
  cursos: CursoIdnumber[];
  propuestas: ReadonlyMap<number, string>;
  seleccion: ReadonlySet<number>;
  comprobaciones: ReadonlyMap<string, ResultadoComprobacion>;
}

export interface Lote {
  filas: FilaEvaluada[];
  porId: ReadonlyMap<number, FilaEvaluada>;
  /** Filas que se escriben, en orden: cada nivel solo depende de los anteriores. */
  niveles: FilaEvaluada[][];
  cambios: number;
  sinCambios: number;
  bloqueados: number;
  vaciados: number;
  hayBloqueoDuro: boolean;
  /** Valores de filas a escribir que aún no se han comprobado contra Moodle. */
  valoresPorComprobar: string[];
  conteoPorEstado: Record<EstadoFila, number>;
}

export const esEjecutable = (fila: FilaEvaluada) => fila.seleccionada && fila.estado === "listo";

/** Lo que tendrá el curso al terminar: el propuesto solo si se va a escribir. */
const valorFinal = (fila: FilaEvaluada) => (esEjecutable(fila) ? fila.propuesto : fila.curso.idnumber);

function accionDe(actual: string, propuesto: string): AccionFila {
  if (actual === propuesto) return "ninguna";
  if (propuesto === "") return "vaciar";
  return actual === "" ? "asignar" : "reemplazar";
}

/** La edición se normaliza; el valor actual se respeta tal como está en Moodle,
 *  para que un idnumber heredado con espacios no aparezca como cambio. */
export function propuestaDe(curso: CursoIdnumber, propuestas: ReadonlyMap<number, string>): string {
  const editado = propuestas.get(curso.id);
  return editado === undefined ? curso.idnumber : normalizarIdnumber(editado);
}

function evaluarFila(curso: CursoIdnumber, entrada: EntradaLote, idsEnTabla: ReadonlySet<number>): FilaEvaluada {
  const propuesto = propuestaDe(curso, entrada.propuestas);
  const cambia = propuesto !== curso.idnumber;
  const fila: FilaEvaluada = {
    curso,
    propuesto,
    cambia,
    seleccionada: entrada.seleccion.has(curso.id),
    accion: accionDe(curso.idnumber, propuesto),
    estado: "listo",
    avisos: cambia ? avisosDeValor(propuesto) : [],
    posibleDuenoExterno: curso.idnumber !== "" && curso.idnumber !== curso.shortname,
    conflictoCon: [],
    ocupantes: [],
    dependeDe: [],
  };

  if (!cambia) {
    fila.estado = curso.idnumber === "" ? "vacio" : "sin-cambios";
    return fila;
  }
  if (excedeLongitud(propuesto)) {
    fila.estado = "demasiado-largo";
    return fila;
  }

  // Vaciar no se comprueba: el vacío no está sujeto a unicidad.
  const comprobacion = propuesto === "" ? undefined : entrada.comprobaciones.get(propuesto);
  if (comprobacion?.error) {
    fila.estado = "sin-comprobar";
    fila.errorComprobacion = comprobacion.error;
    return fila;
  }

  // Un ocupante que está en la tabla se resuelve dentro del lote (duplicado o cadena).
  fila.ocupantes = (comprobacion?.ocupantes ?? []).filter((ocupante) => !idsEnTabla.has(ocupante.id));
  if (fila.ocupantes.length > 0) fila.estado = "ocupado";
  return fila;
}

/** Marca las filas cuyo valor final choca con el de otra, si alguna de ellas se
 *  va a escribir. Se marcan todas las del grupo. El vacío nunca choca. */
function marcarDuplicados(filas: FilaEvaluada[]): boolean {
  const grupos = new Map<string, FilaEvaluada[]>();
  for (const fila of filas) {
    const valor = valorFinal(fila);
    if (valor === "") continue;
    const clave = claveDeUnicidad(valor);
    grupos.set(clave, [...(grupos.get(clave) ?? []), fila]);
  }

  let huboCambios = false;
  for (const grupo of grupos.values()) {
    if (grupo.length < 2 || !grupo.some(esEjecutable)) continue;
    for (const fila of grupo) {
      fila.conflictoCon = grupo.filter((otra) => otra !== fila).map((otra) => otra.curso.id);
      if (fila.estado === "duplicado") continue;
      fila.estado = "duplicado";
      huboCambios = true;
    }
  }
  return huboCambios;
}

/** Enlaza cada fila a escribir con las filas a escribir que hoy tienen su valor. */
function enlazarDependencias(filas: FilaEvaluada[]): FilaEvaluada[] {
  const ejecutables = filas.filter(esEjecutable);
  filas.forEach((fila) => (fila.dependeDe = []));
  const porValorActual = new Map<string, FilaEvaluada[]>();
  for (const fila of ejecutables) {
    if (fila.curso.idnumber === "") continue;
    const clave = claveDeUnicidad(fila.curso.idnumber);
    porValorActual.set(clave, [...(porValorActual.get(clave) ?? []), fila]);
  }

  for (const fila of ejecutables) {
    const duenos = fila.propuesto === "" ? [] : (porValorActual.get(claveDeUnicidad(fila.propuesto)) ?? []);
    fila.dependeDe = duenos.filter((dueno) => dueno !== fila).map((dueno) => dueno.curso.id);
  }
  return ejecutables;
}

/** Ordena por niveles de dependencia. Lo que no se puede ordenar forma un ciclo
 *  (o depende de uno): A quiere el valor de B y B el de A. */
function ordenarEnNiveles(ejecutables: FilaEvaluada[]) {
  const restantes = new Set(ejecutables);
  const niveles: FilaEvaluada[][] = [];

  while (restantes.size > 0) {
    const idsRestantes = new Set([...restantes].map((fila) => fila.curso.id));
    const nivel = [...restantes].filter((fila) => fila.dependeDe.every((id) => !idsRestantes.has(id)));
    if (nivel.length === 0) break;
    nivel.forEach((fila) => restantes.delete(fila));
    niveles.push(nivel);
  }

  return { niveles, sinOrden: [...restantes] };
}

function marcarCirculares(filas: FilaEvaluada[]): boolean {
  const { sinOrden } = ordenarEnNiveles(enlazarDependencias(filas));

  for (const fila of sinOrden) {
    fila.estado = "circular";
    fila.conflictoCon = fila.dependeDe;
  }
  return sinOrden.length > 0;
}

/** Excluir una fila hace que conserve su valor actual, y eso puede crear un
 *  choque nuevo: se repite hasta que el lote queda estable. Cada vuelta excluye
 *  al menos una fila, así que termina. */
function resolverColisiones(filas: FilaEvaluada[]): void {
  while (marcarDuplicados(filas) || marcarCirculares(filas)) {
    // sin cuerpo: cada llamada ya aplica sus marcas
  }
}

function contarPorEstado(filas: FilaEvaluada[]): Record<EstadoFila, number> {
  const conteo: Record<EstadoFila, number> = {
    "sin-cambios": 0,
    vacio: 0,
    listo: 0,
    duplicado: 0,
    circular: 0,
    ocupado: 0,
    "sin-comprobar": 0,
    "demasiado-largo": 0,
  };
  for (const fila of filas) conteo[fila.estado] += 1;
  return conteo;
}

export function evaluarLote(entrada: EntradaLote): Lote {
  const idsEnTabla = new Set(entrada.cursos.map((curso) => curso.id));
  const filas = entrada.cursos.map((curso) => evaluarFila(curso, entrada, idsEnTabla));
  resolverColisiones(filas);

  const ejecutables = enlazarDependencias(filas);
  const seleccionadas = filas.filter((fila) => fila.seleccionada);

  return {
    filas,
    porId: new Map(filas.map((fila) => [fila.curso.id, fila])),
    niveles: ordenarEnNiveles(ejecutables).niveles,
    cambios: ejecutables.length,
    sinCambios: seleccionadas.filter((fila) => !fila.cambia).length,
    bloqueados: seleccionadas.filter((fila) => fila.cambia && !esEjecutable(fila)).length,
    vaciados: ejecutables.filter((fila) => fila.accion === "vaciar").length,
    hayBloqueoDuro: seleccionadas.some((fila) => fila.cambia && ESTADOS_BLOQUEANTES.has(fila.estado)),
    valoresPorComprobar: [
      ...new Set(
        ejecutables
          .filter((fila) => fila.propuesto !== "" && !entrada.comprobaciones.has(fila.propuesto))
          .map((fila) => fila.propuesto),
      ),
    ],
    conteoPorEstado: contarPorEstado(filas),
  };
}

// ── Copia asistida del nombre corto ──────────────────────────────────────────

export type ModoCopia = "vacios" | "seleccionadas" | "todas";

/** Filas a las que alcanza cada modo. «Vacíos» exige que tampoco haya una
 *  propuesta escrita: si alguien vació el campo a propósito, no se rellena. */
export function filasAlcanzadas(
  cursos: CursoIdnumber[],
  propuestas: ReadonlyMap<number, string>,
  seleccion: ReadonlySet<number>,
  modo: ModoCopia,
): CursoIdnumber[] {
  if (modo === "seleccionadas") return cursos.filter((curso) => seleccion.has(curso.id));
  if (modo === "todas") return cursos;
  return cursos.filter((curso) => curso.idnumber === "" && propuestaDe(curso, propuestas) === "");
}

/** Rellena la propuesta con el nombre corto. No ejecuta nada: devuelve las
 *  propuestas nuevas y los cursos cuyo valor cambiaría, para seleccionarlos. */
export function copiarNombreCorto(
  alcanzadas: CursoIdnumber[],
  propuestas: ReadonlyMap<number, string>,
): { propuestas: Map<number, string>; cambiadas: number[] } {
  const siguientes = new Map(propuestas);
  const cambiadas: number[] = [];

  for (const curso of alcanzadas) {
    const valor = normalizarIdnumber(curso.shortname);
    siguientes.set(curso.id, valor);
    if (valor !== curso.idnumber) cambiadas.push(curso.id);
  }

  return { propuestas: siguientes, cambiadas };
}
