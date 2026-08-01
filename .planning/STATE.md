---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: Meta Tags / Social
current_phase: 28
current_phase_name: performance-por-p-gina
status: executing
stopped_at: Completed 28-02-PLAN.md
last_updated: "2026-08-01T15:16:40.154Z"
last_activity: 2026-08-01
last_activity_desc: Phase 28 execution started
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-31 — Milestone v1.6 iniciado)

**Core value:** Cualquier persona ingresa una URL y recibe una auditoría completa, precisa y accionable de su web (errores reales priorizados por severidad), a cambio de su email verificado.
**Current focus:** Phase 28 — performance-por-p-gina

## Current Position

Phase: 28 (performance-por-p-gina) — EXECUTING
Plan: 3 of 3
Status: Ready to execute
Last activity: 2026-08-01 — Phase 28 execution started

Progress: [███████░░░] 67%

## Milestone v1.6 — Phases

| Phase | Nombre | Requirements | UI |
|-------|--------|--------------|-----|
| 28 | Performance por página | PAGEPERF-01..03 | no |
| 29 | Scoring — categoría Social + retiro de ONPAGE-05 | SCORE-01/02, SOCIAL-09 | no |
| 30 | Checks de meta tags/social | SOCIAL-01..08 | no |
| 31 | Validación de og:image | IMG-01..04 | no |
| 32 | Panel de preview social + snippets de fix | PREVIEW-01..04, FIX-01/02 | sí |

## Performance Metrics

**Velocity:**

- Total plans completed: 12 (acumulado hasta v1.5)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 25 | 4 | - | - |
| 26 | 5 | - | - |
| 27 | 3 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 25 P01 | 6 min | 2 tasks | 5 files |
| Phase 25 P03 | 4min | 2 tasks | 8 files |
| Phase 25 P04 | 14min | 3 tasks | 5 files |
| Phase 28 P01 | 6min | 3 tasks | 10 files |
| Phase 28 P02 | 5min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. Recent decisions affecting current work:

- Research v1.6: única dependencia de producción nueva es `image-size@2.0.2` (cero dependencias transitivas) para dimensiones de `og:image`/`twitter:image` vía buffer parcial (Range request); todo lo demás se construye sobre lo ya instalado (Cheerio, `got` timings de Crawlee, `Buffer.byteLength`).
- Research v1.6: panel de preview social se construye como mockup React/CSS con design tokens existentes, nunca screenshots reales — preserva la restricción dura de mantener Vercel libre de navegadores headless.
- Roadmap v1.6: orden de fases ajustado sobre la propuesta de research — Scoring (categoría social + retiro de ONPAGE-05) se secuencia ANTES de los checks nuevos de SOCIAL-01..08 (Phase 29 antes de Phase 30), para no escribir checks contra un modelo de scoring que todavía puede cambiar. SOCIAL-09 (retiro de ONPAGE-05) se agrupó con la fase de Scoring, no con la de checks nuevos, porque es migración de scoring/código existente, no un check nuevo.
- Roadmap v1.6: PAGEPERF aislado en Phase 28 (primera fase) porque toca `crawl.ts`, único componente que ningún milestone anterior había modificado.
- Roadmap v1.6: IMG (validación de og:image) aislado en su propia fase (31) por ser infra nueva de red (fetcher dedupeado), mismo patrón que Phase 12 (render+Docker) en v1.2.
- [Phase ?]: Phase 28: checkIds PERF-10 (tiempo de respuesta) y PERF-11 (tamano HTML) en lugar de PERF-07/PERF-08, que ya estan ocupados por diagnosticos de PSI y colisionarian fingerprints en el diff historico
- [Phase ?]: Phase 28: extractPageMetrics tipa response de forma laxa (TimedResponse) + cast en el call site, porque el PlainResponse de Crawlee no declara timings aunque got-scraping lo adjunta en runtime
- [Phase ?]: Phase 28: responseMs y htmlBytes se escriben en las ramas create Y update del prisma.page.upsert para que un re-crawl no deje valores rancios
- [Phase ?]: Phase 28: Guardarrail de colision de checkId lee packages/psi/src/issues.ts por fs (readFileSync + import.meta.url), nunca por import, para no agregar @auditor/psi al grafo que resuelve apps/web
- [Phase ?]: Phase 28: La capacidad de deteccion del guardarrail se prueba con datos sinteticos (findCollisions), nunca mutando codigo de produccion

### Pending Todos

- E2e `verify-cms-fix.mts` contra un audit real (ej. aprendoclub) con acceso a Postgres — diferido a Juan, corrida manual (`pnpm --filter @auditor/worker exec tsx scripts/verify-cms-fix.mts [auditId]`). No bloqueante, lógica ya cubierta por 21+48 tests automatizados.
- Idea nueva (Juan, 2026-07-25): detección de stack de frontend para sitios "hechos a código" (Tailwind CSS, shadcn/ui, etc.) — candidato a FPRINT-15+ para un milestone futuro, sólo capturado en backlog (`PROJECT.md`).

### Blockers/Concerns

- [Phase 25, no bloqueante] `resolveConfidence` topa CDNs multi-header (ej. Fastly) en confianza `medio` aunque haya 3+ headers del mismo vendor — el conteo (`Signature.test`) no se usa para subir confianza, solo para desempate de builder. Documentado como limitación conocida en `cdn.ts`.
- [Research v1.6, gap a resolver antes de Phase 29] Peso exacto de la categoría "social" en `CATEGORY_WEIGHTS` (0.10 propuesto, tomado de onpage y schema) es punto de partida, no valor calibrado — requiere confirmación explícita de Juan durante la planeación de Phase 29.
- [Research v1.6, gap a resolver antes de Phase 32] Estrategia de carga de imágenes de terceros en el reporte (proxy server-side con allowlist, decidido en PREVIEW-04) — no hay CSP configurada hoy en `apps/web/next.config.ts`; confirmar diseño exacto del proxy durante la planeación de Phase 32.

## Deferred Items

Items acknowledged and carried forward from previous milestone close (v1.4, 2026-07-10):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| debug | pdf-export-crash-reading-s (crash export PDF, `TypeError: Cannot read properties of undefined (reading 'S')`, runtime Next server) | fixing — next_action pendiente: exportar `@react-pdf/renderer` vía `serverExternalPackages` | v1.4 close (2026-07-10) |
| tech debt | SD-07 sin dedupe/cap de mensajes; `SchemaEntities.tsx` usa índice de array como key de React (bajo riesgo) | not started | v1.4 close (2026-07-10) |
| v2 | Deploy a producción (Vercel/Railway/Resend/GDPR), monetización, RENDER-04/05, EXPORT-06, REPORT-05, Domain Rating, FPRINT-10..14, CMSFIX-06/07 | not started | v1.4 close (2026-07-10) / v1.5 REQUIREMENTS.md |
| v1.6.x/v1.7 | SOCIAL-10..12 (previews WhatsApp/Discord/Slack/Telegram, og:image default compartida, alt de imágenes sociales), CMSFIX-08 (snippets por CMS vía cms-adapters), IMG-05 (favicon alcanzable) | not started | v1.6 REQUIREMENTS.md (2026-07-31) |

## Notas de ejecución (convenciones del proyecto, persisten entre milestones)

- Cada fase: smart discuss (AskUserQuestion con grey areas batch) → planner (gsd-planner) → plan-checker (gsd-plan-checker) → executor(es) secuenciales en main tree → code-review (gsd-code-reviewer) + verify (gsd-verifier) en paralelo → fix warnings inline → commit.
- `packages/db` es schema-first (`pnpm db:push`, sin carpeta migrations). Cuando el worker/report-model escribe una columna nueva (ej. `Page.responseHeaders`, `Audit.stack`, y ahora `Page.ttfbMs`/`responseMs`/`htmlBytes`/`socialMeta` en v1.6), correr `pnpm db:push` contra la base de datos configurada antes de probar contra datos reales.
- Backend de Postgres migrado de Neon a instancia propia (`shared-postgres`, tenant `auditor`) durante el deploy de producción (2026-07-24). `DATABASE_URL` actualizada por Juan localmente; el schema es provider-agnostic (`provider = "postgresql"` en Prisma), sin lógica acoplada a Neon en el código.
- Verificar fixes de datos contra un audit real (ej. aprendoclub) con `tsx` (script `.mts` en el paquete relevante).
- `packages/fingerprint` y `packages/cms-adapters` (v1.5) deben mantenerse desacoplados de `@auditor/db`/`@auditor/crawler`/`@auditor/checks` en runtime — el único punto de contacto entre recomendaciones y checks es el `checkId` string ya persistido en `Issue`. El nuevo `packages/meta-social` (v1.6, motor puro de extracción/umbrales/snippets) debe seguir el mismo patrón: sin dependencias de runtime salvo Cheerio.
- `buildReportModel` sigue siendo la única fuente de verdad para reporte web + los 3 exports; lo derivado de v1.6 (preview social, snippet de fix, perf por página) se resuelve en lectura ahí, mismo patrón que el fingerprint/CMS de v1.5.

## Session Continuity

Last session: 2026-08-01T15:16:31.825Z
Stopped at: Completed 28-02-PLAN.md
Resume file: None

## Operator Next Steps

- Revisar y aprobar el roadmap v1.6 (`.planning/ROADMAP.md`).
- Planear Phase 28 con `/gsd-plan-phase 28`.
