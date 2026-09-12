/** Ejecuta `tarea` sobre cada elemento manteniendo como mucho `limite` llamadas
 *  en vuelo. El resultado conserva el orden de `items`.
 *
 *  Moodle es un servidor compartido: las operaciones de este módulo se lanzan
 *  de a pocas a propósito, no en paralelo total. */
export async function mapConConcurrencia<T, R>(
  items: readonly T[],
  limite: number,
  tarea: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const resultados = new Array<R>(items.length);
  let siguiente = 0;

  const trabajador = async () => {
    while (siguiente < items.length) {
      const indice = siguiente;
      siguiente += 1;
      resultados[indice] = await tarea(items[indice] as T, indice);
    }
  };

  const enParalelo = Math.max(1, Math.min(limite, items.length));
  await Promise.all(Array.from({ length: enParalelo }, () => trabajador()));

  return resultados;
}
