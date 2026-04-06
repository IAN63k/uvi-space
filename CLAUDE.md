# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**UVI Space** is a Next.js migration of a legacy PHP/Moodle reporting system. It generates technical reports from Moodle's MySQL database (course enlistment, formative evaluation, statistics) for local operators. The PHP original lives at `c:\xampp\htdocs\Informes\` (sibling directory); this project is its modern replacement.

## Commands

```bash
npm run dev      # Start development server (Next.js)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

No test suite is configured yet.

## Architecture

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind CSS v4 + shadcn/ui (base-nova) + mysql2

**Database access:** No ORM. Direct MySQL queries via `mysql2/promise`. All Moodle tables use the `mdl_` prefix. Database credentials are AES-GCM encrypted and stored in browser `localStorage`, then sent with each API request (transitional design for local operator use — not production-ready).

### Layer structure

| Layer | Location | Purpose |
|---|---|---|
| Pages | `app/reportes/`, `app/configuracion/`, `app/utilidades/` | UI routes |
| API routes | `app/api/` | Server-side DB queries |
| Report logic | `lib/reporting/` | Query builders and type definitions per report |
| Shared utils | `lib/` | DB config, encryption, utilities |
| Components | `components/` | Layout (`AppShell`, `app-sidebar`) and shadcn/ui primitives |

### Report data flow

1. User selects a Moodle category (populated from `POST /api/categorias`)
2. Page calls its API route with `categoryId` + encrypted `dbConfig` from localStorage
3. API route builds hierarchical MySQL queries: Category → Programs → Semesters → Courses
4. Results are validated and assigned status values: `CUMPLE`, `NO CUMPLE`, `NO APLICA`, `NO EXISTE`
5. Percentage calculated; data rendered in filterable/sortable table with CSV export

### Active reports

| Route | API | Status |
|---|---|---|
| `/reportes/alistamiento` | `POST /api/reportes/alistamiento` | Complete |
| `/reportes/efc/[1\|2\|3]` | `POST /api/reportes/efc/[nivel]` | In progress |
| `/reportes/consultas-usuarios`, `/ingles`, `/institucionales` | — | Stubs |

### Evaluation constants (`lib/reporting/status.ts`)

```ts
CUMPLE | NO CUMPLE | NO APLICA | NO EXISTE
```

The PHP legacy used `$succes = 'CUMPLE'` (intentional typo) — maintain `CUMPLE` spelling in this codebase.

### Moodle grade category codes

```
EFC01 → Evaluación Formativa y Continua 1
EFC02 → Evaluación Formativa y Continua 2
EFC03 → Evaluación Formativa y Continua 3
```

## Key conventions

- **DB credentials**: sent as JSON in POST request body (`dbConfig` field). Parsed in API routes via `lib/database-config.ts` / `lib/utilities.ts` (`sanitizeDbConfig`).
- **API routes**: always `POST` (credentials can't go in GET query params). Return `NextResponse.json(...)`.
- **shadcn/ui**: configured with `base-nova` style. Add new components via `npx shadcn add <component>`.
- **Path alias**: `@/*` maps to the repo root (configured in `tsconfig.json`).
- **Tailwind v4**: uses PostCSS plugin (`@tailwindcss/postcss`). CSS variables defined in `app/globals.css`.
