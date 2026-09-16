/** Reglas del valor del Número ID del curso (idnumber).
 *
 *  ⚠ El idnumber es SIEMPRE una cadena: en el cliente, en las rutas, en el
 *  servicio y en la verificación. Nunca se convierte a número, ni siquiera
 *  cuando solo tiene dígitos: `Number("00123")` es 123 y Moodle guardaría
 *  «123» sin reportar error. Las rutas genéricas /api/moodle/update-course y
 *  /api/moodle/update-courses-batch ya cometen ese error; este módulo no las usa.
 *  Cualquier comparación se hace entre cadenas con `===`. */

/** Longitud de la columna mdl_course.idnumber (varchar(100), en caracteres). */
export const LONGITUD_MAXIMA_IDNUMBER = 100;

export type AvisoValor = "espacios-internos" | "caracteres-inusuales";

const CARACTERES_HABITUALES = /^[A-Za-z0-9_.\-/\s]*$/;
const MARCAS_DIACRITICAS = /[̀-ͯ]/g;

/** Recorta espacios al inicio y al final. No toca nada más. */
export function normalizarIdnumber(valor: string): string {
  return valor.trim();
}

/** Clave para detectar colisiones como las detecta la base de datos de Moodle.
 *
 *  MySQL con colación _ci no distingue mayúsculas ni tildes, así que «MAT-101»,
 *  «mat-101» y «MÁT-101» chocan. La clave es conservadora: si la instancia
 *  distinguiera mayúsculas, se marcan conflictos de más, nunca de menos.
 *  Solo sirve para comparar: nunca se envía a Moodle. */
export function claveDeUnicidad(valor: string): string {
  return valor.normalize("NFD").replace(MARCAS_DIACRITICAS, "").toLocaleLowerCase("es");
}

/** Cuenta caracteres, no unidades UTF-16, igual que la columna de MySQL. */
export function excedeLongitud(valor: string): boolean {
  return [...valor].length > LONGITUD_MAXIMA_IDNUMBER;
}

/** Avisos que no bloquean: el valor es válido para Moodle, pero poco habitual. */
export function avisosDeValor(valor: string): AvisoValor[] {
  const avisos: AvisoValor[] = [];
  if (/\s/.test(valor)) avisos.push("espacios-internos");
  if (!CARACTERES_HABITUALES.test(valor)) avisos.push("caracteres-inusuales");
  return avisos;
}
