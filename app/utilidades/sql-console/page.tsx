import { ModuleShell } from "@/components/module-shell";

export default function SqlConsolePage() {
  return (
    <ModuleShell
      title="Consola SQL"
      description="Espacio reservado para migrar la consola SQL interactiva con controles de seguridad por roles."
      sourceFile="report/sql_console.php"
    />
  );
}