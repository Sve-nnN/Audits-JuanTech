# Phase 1: Fundamentos — monorepo, esquema de datos y cola - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (grey areas resolved with user)

<domain>
## Phase Boundary

Existe la base de datos, el monorepo (web + worker) y la cola de trabajos, con un job no-op que prueba el wiring completo Vercel↔Redis↔worker↔Postgres. Cubre INFRA-01..04. NO incluye lógica de crawl, checks ni UI de reporte (fases posteriores).
</domain>

<decisions>
## Implementation Decisions

### Resueltas con el usuario (grey areas)
- **Monorepo:** pnpm workspaces + Turborepo. Estructura `apps/web` (Next.js App Router), `apps/worker` (Node long-running), `packages/db` (Prisma schema + client), `packages/queue` (BullMQ setup + tipos de job compartidos).
- **ORM/DB:** Prisma sobre Postgres. Host de producción/dev: **Neon** (connection string vía `DATABASE_URL`).
- **Cola/Redis:** BullMQ sobre Redis. Host: **Upstash** (vía `REDIS_URL`). Nota: BullMQ requiere `maxRetriesPerRequest: null` con Upstash.
- **Job de prueba:** un job `noop` que el worker consume y que transiciona el estado en Postgres queued → running → done.
- **Resiliencia:** BullMQ Worker con `stalledInterval` + `maxStalledCount` y `lockDuration`, más un timeout por job; un job colgado/fallado se marca `failed` en DB (no queda zombi).

### Claude's Discretion
- Versiones exactas de dependencias (usar latest estable: Next 15, Prisma 6, BullMQ 5).
- Nombres de scripts, estructura fina de carpetas, tsconfig base compartido.
- Uso de `tsx`/`tsup` para el worker.
</decisions>

<code_context>
## Existing Code Insights

Greenfield: no hay código. Referencia de arquitectura en `.planning/research/ARCHITECTURE.md` (monorepo apps/web + apps/worker + packages, boundary: Vercel nunca importa Chrome/crawl; solo escribe DB y encola).
</code_context>

<specifics>
## Specific Ideas

Modelo de datos inicial (Prisma), suficiente para wiring + fases futuras:
- `Email` (id, address normalizado, verified, verifiedAt, consent fields) — usado en Fase 7, se crea el modelo base ahora.
- `Site` (id, domain)
- `Audit` (id, siteId, emailId, status enum, urlLimit, createdAt, startedAt, finishedAt, stats Json)
- `Page` (id, auditId, url, statusCode, ...) — mínimo ahora, se expande en Fase 3+.
- `Issue` (id, auditId, pageId, checkId, severity, fingerprint, ...) — mínimo ahora.
- `QuotaUsage` (id, emailId, weekStart, count) — usado en Fase 7.
- `Job`/estado: el estado de la corrida vive en `Audit.status` (queued|running|done|failed). El job no-op de esta fase usa un `Audit` de prueba o una tabla `JobRun` mínima.
</specifics>

<deferred>
## Deferred Ideas

- Lógica de crawl, checks, scoring, UI, email verification, cuota real → fases 2-7. Los modelos Email/QuotaUsage se crean como esqueleto pero su lógica es de Fase 7.
- Deploy real a Vercel/Railway → se documenta env, no se ejecuta en esta fase.
</deferred>
