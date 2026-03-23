import { notFound } from "next/navigation";

import { ModuleShell } from "@/components/module-shell";

type EfcPageProps = {
  params: Promise<{ nivel: string }>;
};

const catalog: Record<string, { title: string; code: string }> = {
  "1": { title: "Evaluación formativa y continua 1", code: "EFC01" },
  "2": { title: "Evaluación formativa y continua 2", code: "EFC02" },
  "3": { title: "Evaluación formativa y continua 3", code: "EFC03" },
};

export default async function EfcPage({ params }: EfcPageProps) {
  const { nivel } = await params;
  const item = catalog[nivel];

  if (!item) {
    notFound();
  }

  return (
    <ModuleShell
      title={item.title}
      description={`Revisión de actividades, cuestionarios y retroalimentaciones para ${item.code}.`}
      sourceFile="report/avances.php"
    />
  );
}