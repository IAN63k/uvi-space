import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { adminUtilities, reportUtilities, type UtilityItem } from "@/lib/utilities";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-8">
      <header className="space-y-3">
        <Badge variant="secondary">Migración PHP → Next.js</Badge>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          UVI Space: repositorio de utilidades
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Esta base organiza los reportes y utilidades del sistema Moodle en una
          interfaz modular. Desde aquí puedes entrar a cada reporte y gestionar
          la configuración local de conexión.
        </p>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Reportes</h2>
        </div>
        <UtilityGrid items={reportUtilities} />
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Utilidades y configuración</h2>
        </div>
        <UtilityGrid items={adminUtilities} />
      </section>

      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Próximo paso recomendado: conectar cada módulo a queries y API Routes
        para reemplazar gradualmente las funciones de `services/reportRequest.php`.
      </div>
    </main>
  );
}

function UtilityGrid({ items }: { items: UtilityItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={item.href}>
          <CardHeader className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-base">{item.title}</CardTitle>
              {item.badge ? <Badge variant="outline">{item.badge}</Badge> : null}
            </div>
            <CardDescription>{item.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={item.href}
              className="inline-flex h-8 w-full items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Abrir
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
