---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: Fingerprinting técnico + fixes personalizados por CMS
current_phase: 27
current_phase_name: Motor de recomendaciones por CMS — patrón adaptador + fallback
status: planning
stopped_at: Completed 25-04-PLAN.md
last_updated: "2026-07-25T01:51:35.131Z"
last_activity: 2026-07-24
last_activity_desc: Phase 26 complete, transitioned to Phase 27
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 9
  completed_plans: 9
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-21 after v1.5 milestone opened)

**Core value:** Cualquier persona ingresa una URL y recibe una auditoría completa, precisa y accionable de su web (errores reales priorizados por severidad), a cambio de su email verificado.
**Current focus:** v1.5 (Fingerprinting técnico + fixes personalizados por CMS). Phases 25-26 shipped (fingerprint + tabla de stack en el reporte). Phase 27 (motor de recomendaciones por CMS) es la última fase del milestone.

## Current Position

Phase: 27 of 27 (Motor de recomendaciones por CMS — patrón adaptador + fallback)
Plan: Not started
Status: Ready to plan
Last activity: 2026-07-24 — Phase 26 complete, transitioned to Phase 27

Progress: [██████████] 100%

## Milestone v1.5 — Phases

| Phase | Nombre | Requirements | UI |
|-------|--------|--------------|-----|
| 25 | Fingerprint de stack técnico — contrato de datos y motor de detección | FPRINT-01..08 | no |
| 26 | Wiring en el worker + tabla de stack en el reporte | FPRINT-09, STACKUI-01..03 | sí |
| 27 | Motor de recomendaciones por CMS — patrón adaptador + fallback | CMSFIX-01..05 | no |

## Performance Metrics

**Velocity:**

- Total plans completed: 9
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 25 | 4 | - | - |
| 26 | 5 | - | - |

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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. Recent decisions affecting current work:

- Research v1.5: motor de fingerprint propio (~150-300 líneas, patrón registry) en vez de `wappalyzer-core` (deprecado, GPL-3.0) o APIs pagas — requisito explícito de Juan.
- Research v1.5: contrato de datos con `confidence` tipado (alto/medio/bajo/no-detectado) fijado antes de escribir reglas de detección o copy de fix (evita retrabajo en cascada sobre cada adapter/UI).
- Research v1.5: detección independiente por eje (CMS, CDN, hosting, framework, analytics), nunca winner-take-all; recomendación de CMS resuelta en `buildReportModel` (tiempo de lectura), nunca persistida pre-calculada.
- Phase 25: `@auditor/fingerprint` paquete puro (única dep runtime `cheerio`), `DetectedStack` con 6 ejes tipados por `Confidence` (alto/medio/bajo/no-detectado), `analytics` como array (coexistencia GA4+GTM+Meta Pixel), motor `detectStack` con resolución independiente por eje.
- Phase 25 code-review: firma de GTM en `analytics.ts` corregida (matcheaba `dataLayer` genérico compartido con el snippet estándar de GA4 → falso positivo sistemático); needles de Meta Pixel/GA4 endurecidos.

### Pending Todos

None yet.

### Blockers/Concerns

- Copy de fix por plataforma×builder para checks fuera de los ejemplos ya calibrados (title/meta, H1, OG, sitemap/robots.txt) necesita cruzarse contra documentación oficial de cada plataforma durante Phase 27.
- Decisión de granularidad Wix vs Squarespace (un solo adapter técnico, detección separada a nivel de label) — validar si el fallback compartido produce copy suficientemente específico en la primera vuelta de Phase 27.
- [Phase 25, no bloqueante] `resolveConfidence` topa CDNs multi-header (ej. Fastly) en confianza `medio` aunque haya 3+ headers del mismo vendor — el conteo (`Signature.test`) no se usa para subir confianza, solo para desempate de builder. Documentado como limitación conocida en `cdn.ts`; revisar si Phase 26 necesita que suba a `alto`.

## Deferred Items

Items acknowledged and carried forward from previous milestone close (v1.4, 2026-07-10):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| debug | pdf-export-crash-reading-s (crash export PDF, `TypeError: Cannot read properties of undefined (reading 'S')`, runtime Next server) | fixing — next_action pendiente: exportar `@react-pdf/renderer` vía `serverExternalPackages` | v1.4 close (2026-07-10) |
| tech debt | SD-07 sin dedupe/cap de mensajes; `SchemaEntities.tsx` usa índice de array como key de React (bajo riesgo) | not started | v1.4 close (2026-07-10) |
| v2 | Deploy a producción (Vercel/Railway/Resend/GDPR), monetización, RENDER-04/05, EXPORT-06, REPORT-05, Domain Rating, FPRINT-10..14, CMSFIX-06/07 | not started | v1.4 close (2026-07-10) / v1.5 REQUIREMENTS.md |

## Notas de ejecución (convenciones del proyecto, persisten entre milestones)

- Cada fase: smart discuss (AskUserQuestion con grey areas batch) → planner (gsd-planner) → plan-checker (gsd-plan-checker) → executor(es) secuenciales en main tree → code-review (gsd-code-reviewer) + verify (gsd-verifier) en paralelo → fix warnings inline → commit.
- `packages/db` es schema-first (`pnpm db:push`, sin carpeta migrations). Cuando el worker/report-model escribe una columna nueva (ej. `Page.responseHeaders`, `Audit.stack`), correr `pnpm db:push` contra la base de datos configurada antes de probar contra datos reales.
- Backend de Postgres migrado de Neon a instancia propia (`shared-postgres`, tenant `auditor`) durante el deploy de producción (2026-07-24). `DATABASE_URL` actualizada por Juan localmente; el schema es provider-agnostic (`provider = "postgresql"` en Prisma), sin lógica acoplada a Neon en el código.
- Verificar fixes de datos contra un audit real (ej. aprendoclub) con `tsx` (script `.mts` en el paquete relevante).
- `packages/fingerprint` y `packages/cms-adapters` (nuevos en v1.5) deben mantenerse desacoplados de `@auditor/db`/`@auditor/crawler`/`@auditor/checks` en runtime — el único punto de contacto entre recomendaciones y checks es el `checkId` string ya persistido en `Issue`.

## Session Continuity

Last session: 2026-07-24T00:00:00.000Z
Stopped at: Phase 26 complete (human verification confirmada por Juan), ready to plan Phase 27
Resume file: None
