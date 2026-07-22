/** Resultado de un ítem dentro de un lote de (des)matrícula. */
export interface BatchOutcome<K> {
  key: K;
  success: boolean;
  error?: string;
}

interface RunBatchParams<T, K> {
  items: T[];
  /** Identificador con el que se reporta cada ítem (courseId, userId…) */
  keyOf: (item: T) => K;
  /** Ejecuta la operación de Moodle sobre el subconjunto recibido */
  run: (batch: T[]) => Promise<void>;
  /** Mensaje cuando el error no trae detalle */
  errorMessage?: string;
}

/** Ejecuta un lote de (des)matrículas y devuelve el resultado por ítem.
 *
 *  Las funciones enrol_manual_* de Moodle son atómicas: si un ítem falla, lanza
 *  excepción y ninguno del lote se aplica. Por eso se intenta primero el lote
 *  completo (camino feliz, una sola llamada) y, sólo si falla, se reintenta ítem
 *  por ítem para identificar exactamente cuáles fallan sin detener al resto. */
export async function runEnrolmentBatch<T, K>({
  items,
  keyOf,
  run,
  errorMessage = "Error al procesar la operación",
}: RunBatchParams<T, K>): Promise<BatchOutcome<K>[]> {
  if (items.length === 0) return [];

  try {
    await run(items);
    return items.map((item) => ({ key: keyOf(item), success: true }));
  } catch {
    return Promise.all(
      items.map(async (item): Promise<BatchOutcome<K>> => {
        try {
          await run([item]);
          return { key: keyOf(item), success: true };
        } catch (err) {
          return {
            key: keyOf(item),
            success: false,
            error: err instanceof Error ? err.message : errorMessage,
          };
        }
      }),
    );
  }
}
