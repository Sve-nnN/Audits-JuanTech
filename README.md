# Auditor

Herramienta de auditoría web (SEO técnico, on-page, datos estructurados,
performance/CWV y visibilidad en IA) usada como lead magnet para
juan-tech.com. Un crawler audita hasta 500 URLs de un sitio y produce un
reporte con score general, scores por categoría e issues priorizados.

Este repo cubre el andamiaje de la Fase 1: monorepo, esquema de datos y la
cola de trabajos (job no-op que verifica el wiring completo
Vercel/web -> Redis -> worker -> Postgres). No incluye lógica de crawl,
checks ni UI de reporte todavía.

## Cómo correr

```bash
pnpm install
cp .env.example .env   # completar DATABASE_URL (Neon) y REDIS_URL (Upstash, rediss://)
pnpm db:push            # sincroniza el esquema Prisma contra Postgres
pnpm dev                 # levanta apps/web y apps/worker en paralelo (via Turborepo)
```

## Arquitectura

- `apps/web` (Next.js App Router, desplegado en Vercel): captura el request de
  auditoría, escribe en Postgres y encola un job en BullMQ. Nunca importa
  lógica de crawl ni Chrome/Playwright.
- `apps/worker` (proceso Node long-running, pensado para un contenedor propio
  tipo Railway/Fly): consume jobs de la cola y ejecuta el crawl/auditoría.
  Es el único lugar donde correrá Crawlee/Playwright/Lighthouse en fases
  futuras.
- `packages/db` (`@auditor/db`): schema de Prisma + cliente compartido entre
  web y worker.
- `packages/queue` (`@auditor/queue`): factory de Queue/Worker de BullMQ y
  tipos de job compartidos, con conexión Redis compatible con Upstash
  (TLS vía `rediss://`, `maxRetriesPerRequest: null`).

Boundary estricto: `apps/web` nunca importa el crawler; `apps/worker` nunca
importa Next.js.
