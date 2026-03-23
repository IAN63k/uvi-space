import { notFound } from "next/navigation";

import { getEfcDefinition } from "@/lib/reporting/efc";

import { EfcReportClient } from "./efc-report-client";

type EfcPageProps = {
  params: Promise<{ nivel: string }>;
};

export default async function EfcPage({ params }: EfcPageProps) {
  const { nivel } = await params;
  const definition = getEfcDefinition(nivel);

  if (!definition) {
    notFound();
  }

  return <EfcReportClient level={definition.level} definition={definition} />;
}