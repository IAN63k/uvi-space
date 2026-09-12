import { mapConConcurrencia } from "@/lib/moodle/concurrency";
import { assignRoles, getEnrolledUsers, unassignRoles } from "@/lib/moodle/moodle.service";
import { sinToken } from "@/lib/moodle/sanitize";

import type { OperacionRol, ResultadoOperacion } from "./types";

/** Moodle es un servidor compartido: nunca más de 3 llamadas en vuelo. */
const CONCURRENCIA = 3;

interface CambiarRolesParams {
  moodleUrl: string;
  token: string;
  courseId: number;
  operaciones: OperacionRol[];
}

function textoDeError(err: unknown): string {
  return err instanceof Error ? err.message : "Error desconocido de Moodle";
}

/** Aplica los cambios de rol de un curso en tres fases: asignar, verificar y
 *  solo entonces retirar.
 *
 *  El retiro nunca se ejecuta sin haber releído el curso y confirmado que el
 *  rol destino quedó realmente asignado. Si la verificación no se puede hacer,
 *  o el destino no aparece, no se retira nada y la operación queda reportada.
 *  Un error en una operación no detiene al resto del lote. */
export async function cambiarRolesEnCurso({
  moodleUrl,
  token,
  courseId,
  operaciones,
}: CambiarRolesParams): Promise<ResultadoOperacion[]> {
  const leerRoles = async (): Promise<Map<number, Set<number>>> => {
    const usuarios = await getEnrolledUsers(moodleUrl, token, courseId);
    return new Map(usuarios.map((u) => [u.id, new Set((u.roles ?? []).map((r) => r.roleid))]));
  };

  let rolesPorUsuario = await leerRoles();
  const resultados: ResultadoOperacion[] = [];

  // ── Fase 1: decidir qué hay que asignar ────────────────────────────────────
  const porAsignar: OperacionRol[] = [];

  for (const operacion of operaciones) {
    const base = {
      userId: operacion.userId,
      courseId,
      roleId: operacion.roleDestinoId,
      accion: "asignar" as const,
    };
    const rolesActuales = rolesPorUsuario.get(operacion.userId);

    if (!rolesActuales) {
      resultados.push({
        ...base,
        estado: "error",
        detalle: "El usuario no está matriculado en el curso. Esta herramienta asigna roles, no matricula.",
      });
      continue;
    }

    if (rolesActuales.has(operacion.roleDestinoId)) {
      resultados.push({ ...base, estado: "omitido", detalle: "Ya tenía el rol destino en el curso." });
      continue;
    }

    porAsignar.push(operacion);
  }

  // ── Fase 2: asignar el rol destino ─────────────────────────────────────────
  const asignaciones = await mapConConcurrencia(porAsignar, CONCURRENCIA, async (operacion) => {
    try {
      await assignRoles(moodleUrl, token, [
        { roleid: operacion.roleDestinoId, userid: operacion.userId, courseid: courseId },
      ]);
      return { operacion, ok: true, detalle: undefined as string | undefined };
    } catch (err) {
      return { operacion, ok: false, detalle: sinToken(textoDeError(err), token) };
    }
  });

  for (const { operacion, ok, detalle } of asignaciones) {
    resultados.push({
      userId: operacion.userId,
      courseId,
      roleId: operacion.roleDestinoId,
      accion: "asignar",
      estado: ok ? "ok" : "error",
      detalle,
    });
  }

  // ── Fase 3: verificar releyendo el curso ───────────────────────────────────
  // Solo hace falta si hubo escrituras: si todo se omitió por idempotencia, la
  // lectura de la fase 1 ya es prueba de que el rol destino está puesto.
  let errorDeVerificacion: string | null = null;

  if (asignaciones.length > 0) {
    try {
      rolesPorUsuario = await leerRoles();
    } catch (err) {
      errorDeVerificacion = sinToken(textoDeError(err), token);
    }
  }

  // ── Fase 4: retirar los roles anteriores ya verificados ────────────────────
  const porRetirar: Array<{ userId: number; roleId: number }> = [];

  for (const operacion of operaciones) {
    const aRetirar = operacion.rolesARetirar.filter((roleId) => roleId !== operacion.roleDestinoId);
    if (aRetirar.length === 0) continue;

    const rolesActuales = rolesPorUsuario.get(operacion.userId);
    if (!rolesActuales) continue; // no matriculado: ya se reportó en la fase 1

    const destinoVerificado = !errorDeVerificacion && rolesActuales.has(operacion.roleDestinoId);

    for (const roleId of aRetirar) {
      const base = { userId: operacion.userId, courseId, roleId, accion: "retirar" as const };

      if (!destinoVerificado) {
        resultados.push({
          ...base,
          estado: "omitido",
          detalle: errorDeVerificacion
            ? `No se retira: no se pudo releer el curso para verificar el rol destino (${errorDeVerificacion})`
            : "No se retira: el rol destino no quedó asignado.",
        });
        continue;
      }

      if (!rolesActuales.has(roleId)) {
        resultados.push({ ...base, estado: "omitido", detalle: "El usuario no tenía este rol en el curso." });
        continue;
      }

      porRetirar.push({ userId: operacion.userId, roleId });
    }
  }

  const retiros = await mapConConcurrencia(porRetirar, CONCURRENCIA, async (retiro) => {
    try {
      await unassignRoles(moodleUrl, token, [
        { roleid: retiro.roleId, userid: retiro.userId, courseid: courseId },
      ]);
      return { retiro, ok: true, detalle: undefined as string | undefined };
    } catch (err) {
      return { retiro, ok: false, detalle: sinToken(textoDeError(err), token) };
    }
  });

  for (const { retiro, ok, detalle } of retiros) {
    resultados.push({
      userId: retiro.userId,
      courseId,
      roleId: retiro.roleId,
      accion: "retirar",
      estado: ok ? "ok" : "error",
      detalle,
    });
  }

  const ordenDeUsuario = new Map(operaciones.map((operacion, i) => [operacion.userId, i]));
  return resultados.sort((a, b) => {
    const ordenA = ordenDeUsuario.get(a.userId) ?? 0;
    const ordenB = ordenDeUsuario.get(b.userId) ?? 0;
    if (ordenA !== ordenB) return ordenA - ordenB;
    if (a.accion !== b.accion) return a.accion === "asignar" ? -1 : 1;
    return a.roleId - b.roleId;
  });
}
