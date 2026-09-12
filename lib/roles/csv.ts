import { downloadCsv } from "@/lib/matriculas/helpers";
import { nombreRol } from "@/lib/moodle/roles";

import type { ParticipanteConsolidado, ResultadoOperacion } from "./types";

const ENCABEZADO = [
  "Usuario",
  "Correo",
  "ID Moodle",
  "Curso",
  "Rol",
  "Acción",
  "Estado",
  "Detalle",
];

const ETIQUETA_ESTADO: Record<ResultadoOperacion["estado"], string> = {
  ok: "Aplicado",
  omitido: "Omitido",
  error: "Error",
};

/** Log de ejecución en filas de CSV.
 *
 *  El `detalle` va tal como lo devolvió Moodle, sin reescribir ni truncar: es
 *  la única pista para diagnosticar, por ejemplo, una asignación creada por un
 *  plugin de matriculación que la API no puede retirar. El token nunca llega
 *  hasta aquí, se filtra en el servidor. */
export function filasDeResultados(
  resultados: ResultadoOperacion[],
  participantes: ParticipanteConsolidado[],
): (string | number)[][] {
  const porId = new Map(participantes.map((p) => [p.userId, p]));

  const filas = resultados.map((resultado) => {
    const participante = porId.get(resultado.userId);
    return [
      participante?.fullname ?? `Usuario ${resultado.userId}`,
      participante?.email ?? "",
      resultado.userId,
      resultado.courseId,
      nombreRol(resultado.roleId),
      resultado.accion === "asignar" ? "Asignar" : "Retirar",
      ETIQUETA_ESTADO[resultado.estado],
      resultado.detalle ?? "",
    ];
  });

  return [ENCABEZADO, ...filas];
}

export function descargarLog(
  resultados: ResultadoOperacion[],
  participantes: ParticipanteConsolidado[],
): void {
  const fecha = new Date().toISOString().slice(0, 10);
  downloadCsv(`cambio-roles-${fecha}.csv`, filasDeResultados(resultados, participantes));
}
