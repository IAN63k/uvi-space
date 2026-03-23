import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ModuleShellProps = {
  title: string;
  description: string;
  sourceFile: string;
  children?: React.ReactNode;
};

export function ModuleShell({
  title,
  description,
  sourceFile,
  children,
}: ModuleShellProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10 md:px-8">
      <div className="space-y-2">
        <Badge variant="secondary">Módulo migrado</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado de migración</CardTitle>
          <CardDescription>
            Este módulo ya tiene ruta en Next.js y está listo para conectar su
            lógica con API Routes y acceso a base de datos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Archivo fuente de referencia en PHP: {sourceFile}</p>
          {children}
          <Link
            href="/"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition hover:bg-muted"
          >
            Volver al repositorio de utilidades
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}