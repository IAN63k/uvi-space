import { redirect } from "next/navigation";

/**
 * Los ajustes del sistema ahora viven en el sidebar de cada módulo.
 * Esta ruta ya no está en el menú de navegación.
 */
export default function AjustesPage() {
  redirect("/reportes/revision-cursos");
}
