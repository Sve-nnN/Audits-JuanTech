---
status: passed
phase: 1
verified: 2026-07-05
---

# Phase 1 Verification: Fundamentos — monorepo, esquema de datos y cola

**Result:** ✅ PASSED — 4/4 success criteria verified against real cloud infra (Neon Postgres + Upstash Redis).

## Success Criteria

### 1. Monorepo con web y worker desplegables por separado ✅
- pnpm workspace + Turborepo. `apps/web` (Next.js 15), `apps/worker` (Node/tsx), `packages/db` (Prisma), `packages/queue` (BullMQ).
- `pnpm -r typecheck` limpio en los 4 paquetes. `turbo build` compila web y worker de forma independiente.

### 2. Esquema Postgres consultable ✅
- `prisma db push` sincronizó el schema con Neon (`neondb`) en 6.8s.
- Modelos creados y consultables: Email, Site, Audit, Page, Issue, QuotaUsage (+ enums AuditStatus, IssueSeverity).

### 3. Job no-op: web encola → worker toma → queued→running→done ✅
- Verificado por dos caminos:
  - `scripts/verify-wiring.ts` (encola vía @auditor/queue): observó queued → running → done. Exit 0.
  - **Web API real:** `POST /api/audits {domain}` → `{auditId}`; worker procesó; `GET /api/audits/[id]` devolvió `status: done` con startedAt/finishedAt. E2E completo Vercel-path ↔ Upstash ↔ worker ↔ Neon.

### 4. Job colgado/fallado se detecta y marca failed (no zombi) ✅
- `scripts/verify-failed.ts` (job con `simulateFailure: true`): observó queued → failed con `error: "simulated failure (test hook)"`. Exit 0.
- Guard: el handler `failed` no sobrescribe estados terminales; timeout por job (`withTimeout`, 15s) + `stalledInterval`/`maxStalledCount` para jobs colgados.

## Requirements
- INFRA-01 ✅  INFRA-02 ✅  INFRA-03 ✅  INFRA-04 ✅

## Notas
- Credenciales en `.env` (gitignored, nunca commiteado). `.env.example` documenta el formato Neon/Upstash.
- Deploy real a Vercel/Railway no ejecutado (fuera de scope de fase); documentado en README.
- Hook de test `simulateFailure` en AuditJobData: inofensivo en prod, sólo para verificar persistencia de fallos.

## Human verification
Ninguna pendiente — todo verificado automáticamente contra servicios reales.
