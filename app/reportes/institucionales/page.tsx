import { ModuleShell } from "@/components/module-shell";

export default function InstitucionalesPage() {
  return (
    <ModuleShell
      title="Reporte institucional"
      description="Resumen institucional de cursos, docentes, estudiantes y categorías."
      sourceFile="report/estadistica_institucionales.php"
    />
  );
}