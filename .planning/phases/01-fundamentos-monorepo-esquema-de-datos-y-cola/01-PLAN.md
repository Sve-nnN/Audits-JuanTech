# Phase 1 Plan: Fundamentos — monorepo, esquema de datos y cola

**Requirements:** INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Mode:** mvp

## Tasks

1. **Monorepo scaffold** — pnpm workspace + Turborepo. Root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, base `tsconfig.base.json`, `.gitignore`, `.env.example`. (INFRA-01)
2. **packages/db** — Prisma schema con Email, Site, Audit, Page, Issue, QuotaUsage, JobRun. Cliente Prisma exportado. Scripts `db:generate`, `db:push`, `db:migrate`. (INFRA-02)
3. **packages/queue** — BullMQ Queue + Worker factory, tipos de job compartidos (`AuditJob`, `NoopJob`), conexión Redis (Upstash-compatible: `maxRetriesPerRequest: null`). (INFRA-03)
4. **apps/web** — Next.js App Router mínimo. Ruta API `POST /api/audits` que crea un `Audit` (status=queued) en Postgres y encola un job en BullMQ. Ruta `GET /api/audits/[id]` que devuelve el estado. Página mínima con botón de prueba. (INFRA-03)
5. **apps/worker** — proceso long-running con BullMQ Worker que consume el job, marca Audit running → done, con timeout por job, stalled detection y marcado failed. Script `dev`/`start`. (INFRA-03, INFRA-04)
6. **Verificación de wiring** — con DATABASE_URL (Neon) + REDIS_URL (Upstash): `db push`, arrancar worker, POST /api/audits, confirmar transición queued→running→done en DB; inyectar un fallo para confirmar failed. (INFRA-03, INFRA-04)

## Success Criteria (del ROADMAP)
1. Monorepo con web y worker desplegables por separado, build/deploy propio cada uno.
2. Esquema Postgres consultable para email, site, audit, page, issue, quota_usage.
3. Job no-op: web encola → worker toma → estado queued→running→done en DB.
4. Job colgado/fallado se detecta y marca failed (no zombi).

## Verification Strategy
- Automatizable sin servicios: `pnpm install`, `pnpm -r typecheck`, `prisma validate`, `turbo build` (web+worker compilan).
- Requiere servicios (Neon+Upstash): script `verify:wiring` end-to-end. Bloquea hasta tener connection strings.
