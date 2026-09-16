import { downloadCsv } from "@/lib/matriculas/helpers";

import type { ResultadoCurso } from "./types";

const ENCABEZADO = [
  "ID curso",
  "Nombre corto",
  "Nombre completo",
  "Número ID anterior",
  "Número ID propuesto",
  "Número ID en Moodle (verificado)",
  "Estado",
  "Detalle",
];

const ETIQUETA_ESTADO: Record<ResultadoCurso["estado"], string> = {
  aplicado: "Aplicado",
  omitido: "Omitido",
  error: "Error",
};

/** Los Números ID van como texto exacto. Excel puede mostrar «00123» como 123
 *  al abrir el archivo, pero el CSV contiene la cadena original. El detalle es
 *  el mensaje crudo de Moodle, sin reescribir: el token ya se filtró en el
 *  servidor. */
export function descargarResultado(resultados: ResultadoCurso[]): void {
  const filas = resultados.map((r) => [
    r.courseId,
    r.shortname,
    r.fullname,
    r.anterior,
    r.esperado,
    r.verificado ?? (r.estado === "omitido" ? "(no se escribió)" : "(no se pudo releer)"),
    ETIQUETA_ESTADO[r.estado],
    r.detalle ?? "",
  ]);

  const fecha = new Date().toISOString().slice(0, 10);
  downloadCsv(`numero-id-cursos-${fecha}.csv`, [ENCABEZADO, ...filas]);
}
