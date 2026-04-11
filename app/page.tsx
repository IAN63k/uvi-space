import Link from "next/link";
import Image from "next/image";
import {
  ClipboardCheck,
  BarChart3,
  BookOpen,
  Users,
  Globe,
  Building2,
  Settings2,
  Database,
  Terminal,
  ArrowRight,
  ScanSearch,
} from "lucide-react";

// ── Item definitions ──────────────────────────────────────────────────────────

const REPORT_ITEMS = [
  {
    title: "Alistamiento",
    description: "Verificación técnica de estructura del curso, bloques clave y criterios institucionales.",
    href: "/reportes/alistamiento",
    icon: ClipboardCheck,
    color: "emerald",
  },
  {
    title: "Evaluación Formativa 1",
    description: "Revisión de calificaciones y retroalimentaciones para EFC01.",
    href: "/reportes/efc/1",
    badge: "EFC01",
    icon: BarChart3,
    color: "lime",
  },
  {
    title: "Evaluación Formativa 2",
    description: "Revisión de calificaciones y retroalimentaciones para EFC02.",
    href: "/reportes/efc/2",
    badge: "EFC02",
    icon: BarChart3,
    color: "lime",
  },
  {
    title: "Evaluación Formativa 3",
    description: "Revisión de calificaciones y retroalimentaciones para EFC03.",
    href: "/reportes/efc/3",
    badge: "EFC03",
    icon: BarChart3,
    color: "lime",
  },
  {
    title: "Revisión de cursos",
    description: "Valida configuración de cursos en Moodle vía REST API: formato, visibilidad y completitud.",
    href: "/reportes/revision-cursos",
    icon: BookOpen,
    color: "cyan",
  },
  {
    title: "Contenido del curso",
    description: "Verifica secciones, módulo del profesor, foro de consulta, reuniones y libro de calificaciones.",
    href: "/reportes/revision-cursos/contenido",
    icon: ScanSearch,
    color: "cyan",
  },
  {
    title: "Consultas de usuarios",
    description: "Consulta de usuarios y métricas operativas relacionadas.",
    href: "/reportes/consultas-usuarios",
    icon: Users,
    color: "violet",
  },
  {
    title: "Reporte de inglés",
    description: "Panel para reportes asociados a cursos y programas de inglés.",
    href: "/reportes/ingles",
    icon: Globe,
    color: "sky",
  },
  {
    title: "Reporte institucional",
    description: "Resumen estadístico institucional de cursos, docentes y estudiantes.",
    href: "/reportes/institucionales",
    icon: Building2,
    color: "amber",
  },
] as const;

const ADMIN_ITEMS = [
  {
    title: "Ajustes del sistema",
    description: "Token de Moodle API y reglas de validación. Configuración cifrada en el navegador.",
    href: "/configuracion/ajustes",
    icon: Settings2,
    color: "slate",
  },
  {
    title: "Base de datos",
    description: "Guarda localmente la conexión de Moodle en almacenamiento cifrado.",
    href: "/configuracion/bd",
    icon: Database,
    color: "slate",
  },
  {
    title: "Consola SQL",
    description: "Futura migración de la consola SQL interactiva desde PHP.",
    href: "/utilidades/sql-console",
    badge: "Próximamente",
    icon: Terminal,
    color: "slate",
  },
] as const;

// ── Color maps ────────────────────────────────────────────────────────────────

type ColorKey = "emerald" | "lime" | "cyan" | "violet" | "sky" | "amber" | "slate";

const ICON_BG: Record<ColorKey, string> = {
  emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  lime:    "bg-lime-500/10    text-lime-600    border-lime-500/20    dark:text-lime-400",
  cyan:    "bg-cyan-500/10    text-cyan-600    border-cyan-500/20    dark:text-cyan-400",
  violet:  "bg-violet-500/10  text-violet-600  border-violet-500/20  dark:text-violet-400",
  sky:     "bg-sky-500/10     text-sky-600     border-sky-500/20     dark:text-sky-400",
  amber:   "bg-amber-500/10   text-amber-600   border-amber-500/20   dark:text-amber-400",
  slate:   "bg-slate-500/10   text-slate-600   border-slate-500/20   dark:text-slate-400",
};

const GLOW: Record<ColorKey, string> = {
  emerald: "hover:border-emerald-500/30 hover:shadow-emerald-500/5",
  lime:    "hover:border-lime-500/30    hover:shadow-lime-500/5",
  cyan:    "hover:border-cyan-500/30    hover:shadow-cyan-500/5",
  violet:  "hover:border-violet-500/30  hover:shadow-violet-500/5",
  sky:     "hover:border-sky-500/30     hover:shadow-sky-500/5",
  amber:   "hover:border-amber-500/30   hover:shadow-amber-500/5",
  slate:   "hover:border-slate-500/30   hover:shadow-slate-500/5",
};

const ARROW: Record<ColorKey, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  lime:    "text-lime-600    dark:text-lime-400",
  cyan:    "text-cyan-600    dark:text-cyan-400",
  violet:  "text-violet-600  dark:text-violet-400",
  sky:     "text-sky-600     dark:text-sky-400",
  amber:   "text-amber-600   dark:text-amber-400",
  slate:   "text-slate-500   dark:text-slate-400",
};

// ── Static star field (deterministic, SSR-safe) ───────────────────────────────

const STARS = [
  { x: "8%",  y: "12%", size: "1px",   opacity: 0.5 },
  { x: "23%", y: "4%",  size: "1.5px", opacity: 0.35 },
  { x: "41%", y: "7%",  size: "1px",   opacity: 0.6 },
  { x: "67%", y: "3%",  size: "2px",   opacity: 0.25 },
  { x: "82%", y: "9%",  size: "1px",   opacity: 0.45 },
  { x: "91%", y: "14%", size: "1.5px", opacity: 0.5 },
  { x: "5%",  y: "28%", size: "1px",   opacity: 0.35 },
  { x: "15%", y: "38%", size: "2px",   opacity: 0.2 },
  { x: "35%", y: "22%", size: "1px",   opacity: 0.45 },
  { x: "55%", y: "18%", size: "1.5px", opacity: 0.35 },
  { x: "73%", y: "24%", size: "1px",   opacity: 0.5 },
  { x: "88%", y: "31%", size: "2px",   opacity: 0.25 },
  { x: "12%", y: "55%", size: "1.5px", opacity: 0.3 },
  { x: "28%", y: "48%", size: "1px",   opacity: 0.4 },
  { x: "48%", y: "42%", size: "2px",   opacity: 0.15 },
  { x: "62%", y: "51%", size: "1px",   opacity: 0.4 },
  { x: "79%", y: "44%", size: "1.5px", opacity: 0.45 },
  { x: "94%", y: "58%", size: "1px",   opacity: 0.35 },
  { x: "3%",  y: "72%", size: "2px",   opacity: 0.25 },
  { x: "20%", y: "65%", size: "1px",   opacity: 0.4 },
  { x: "43%", y: "78%", size: "1.5px", opacity: 0.3 },
  { x: "58%", y: "69%", size: "1px",   opacity: 0.4 },
  { x: "76%", y: "74%", size: "2px",   opacity: 0.2 },
  { x: "87%", y: "82%", size: "1px",   opacity: 0.4 },
  { x: "97%", y: "91%", size: "1.5px", opacity: 0.35 },
];

// ── Card component ────────────────────────────────────────────────────────────

type ItemDef = {
  title: string;
  description: string;
  href: string;
  badge?: string;
  icon: React.ElementType;
  color: ColorKey;
};

function ModuleCard({ item }: { item: ItemDef }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`group relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:shadow-lg ${GLOW[item.color]}`}
    >
      {/* top row */}
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${ICON_BG[item.color]}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        {item.badge && (
          <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
            {item.badge}
          </span>
        )}
      </div>

      {/* title + desc */}
      <div className="flex-1 space-y-1.5">
        <p className="text-sm font-semibold leading-snug text-foreground">{item.title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
      </div>

      {/* arrow */}
      <div className="flex items-center gap-1.5">
        <span className={`text-[11px] font-medium transition-all duration-200 group-hover:translate-x-0.5 ${ARROW[item.color]}`}>
          Abrir módulo
        </span>
        <ArrowRight className={`h-3 w-3 transition-all duration-200 group-hover:translate-x-0.5 ${ARROW[item.color]}`} />
      </div>

      {/* dark-mode glow overlay on hover */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:block hidden"
        style={{ background: "radial-gradient(circle at top right, rgba(132,204,22,0.05), transparent 65%)" }}
      />
    </Link>
  );
}

// ── Section title ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <h2
        className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60"
        style={{ fontFamily: "var(--font-orbitron)" }}
      >
        {children}
      </h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <main className="relative min-h-screen w-full bg-background">

      {/* Dark-mode atmosphere (stars + glows) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-500 dark:opacity-100" aria-hidden>
        {STARS.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{ left: s.x, top: s.y, width: s.size, height: s.size, opacity: s.opacity }}
          />
        ))}
        <div
          className="absolute -top-32 right-0 h-[500px] w-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(132,204,22,0.12) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 -left-16 h-[400px] w-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(34,197,94,0.07) 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-10 md:px-8">

        {/* ── Hero ── */}
        <header className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          {/* logo with glow */}
          <div className="relative shrink-0">
            <div
              className="absolute inset-0 rounded-full opacity-0 blur-2xl transition-opacity duration-500 dark:opacity-100"
              style={{ background: "radial-gradient(circle, rgba(132,204,22,0.3) 0%, transparent 70%)" }}
            />
            <Image
              src="/logo.png"
              alt="UVI Space"
              width={88}
              height={88}
              className="relative drop-shadow-lg dark:drop-shadow-[0_0_20px_rgba(132,204,22,0.35)]"
              priority
            />
          </div>

          {/* text */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="text-3xl font-black tracking-widest text-foreground md:text-4xl"
                style={{ fontFamily: "var(--font-orbitron)" }}
              >
                UVI SPACE
              </h1>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                PHP → Next.js
              </span>
            </div>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              Repositorio de utilidades y reportes para la gestión técnica de cursos Moodle.
              Accede a cada módulo desde el panel lateral o desde las tarjetas a continuación.
            </p>

            {/* stats strip */}
            <div className="flex flex-wrap gap-5 pt-1">
              {[
                { label: "Reportes",    value: REPORT_ITEMS.length },
                { label: "Utilidades",  value: ADMIN_ITEMS.length  },
                { label: "API Moodle",  value: "REST"              },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-baseline gap-1.5">
                  <span className="font-mono text-lg font-bold text-primary">{value}</span>
                  <span className="text-xs text-muted-foreground/60">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* ── Reports section ── */}
        <section className="space-y-5">
          <SectionTitle>Reportes</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {REPORT_ITEMS.map((item) => (
              <ModuleCard key={item.href} item={item} />
            ))}
          </div>
        </section>

        {/* ── Admin section ── */}
        <section className="space-y-5">
          <SectionTitle>Configuración</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ADMIN_ITEMS.map((item) => (
              <ModuleCard key={item.href} item={item} />
            ))}
          </div>
        </section>

        {/* ── Footer note ── */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3.5">
          <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_6px_2px_var(--tw-shadow-color)] [--tw-shadow-color:oklch(0.77_0.22_132_/_40%)]" />
          <p className="text-xs text-muted-foreground">
            Próximo paso recomendado: conectar cada módulo a queries y API Routes para reemplazar
            gradualmente las funciones de{" "}
            <code className="font-mono text-muted-foreground/60">services/reportRequest.php</code>.
          </p>
        </div>

      </div>
    </main>
  );
}
