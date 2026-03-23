import { ModuleShell } from "@/components/module-shell";

export default function ConsultasUsuariosPage() {
  return (
    <ModuleShell
      title="Consultas de usuarios"
      description="Módulo para búsquedas y consulta operativa de usuarios en Moodle."
      sourceFile="report/user_consult.php"
    />
  );
}