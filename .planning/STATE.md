---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: Fingerprinting técnico + fixes personalizados por CMS
status: Awaiting next milestone
stopped_at: Phase 27 complete (verificación + nyquist + security pasados), milestone v1.5 100% completo — pendiente lifecycle (audit → complete → cleanup)
last_updated: "2026-07-25T15:55:53.968Z"
last_activity: 2026-07-25
last_activity_desc: Milestone v1.5 completed and archived
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 12
  completed_plans: 12
  percent: 100
current_phase: 27
current_phase_name: motor-de-recomendaciones-por-cms-patr-n-adaptador-fallback
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-25 after Phase 27)

**Core value:** Cualquier persona ingresa una URL y recibe una auditoría completa, precisa y accionable de su web (errores reales priorizados por severidad), a cambio de su email verificado.
**Current focus:** Milestone v1.5 completo — cierre pendiente (audit → complete → cleanup)

## Current Position

Phase: Milestone v1.5 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-07-25 — Milestone v1.5 completed and archived

## Milestone v1.5 — Phases

| Phase | Nombre | Requirements | UI |
|-------|--------|--------------|-----|
| 25 | Fingerprint de stack técnico — contrato de datos y motor de detección | FPRINT-01..08 | no |
| 26 | Wiring en el worker + tabla de stack en el reporte | FPRINT-09, STACKUI-01..03 | sí |
| 27 | Motor de recomendaciones por CMS — patrón adaptador + fallback | CMSFIX-01..05 | no |

## Performance Metrics

**Velocity:**

- Total plans completed: 12
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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. Recent decisions affecting current work:

- Research v1.5: motor de fingerprint propio (~150-300 líneas, patrón registry) en vez de `wappalyzer-core` (deprecado, GPL-3.0) o APIs pagas — requisito explícito de Juan.
- Research v1.5: contrato de datos con `confidence` tipado (alto/medio/bajo/no-detectado) fijado antes de escribir reglas de detección o copy de fix (evita retrabajo en cascada sobre cada adapter/UI).
- Research v1.5: detección independiente por eje (CMS, CDN, hosting, framework, analytics), nunca winner-take-all; recomendación de CMS resuelta en `buildReportModel` (tiempo de lectura), nunca persistida pre-calculada.
- Phase 25: `@auditor/fingerprint` paquete puro (única dep runtime `cheerio`), `DetectedStack` con 6 ejes tipados por `Confidence` (alto/medio/bajo/no-detectado), `analytics` como array (coexistencia GA4+GTM+Meta Pixel), motor `detectStack` con resolución independiente por eje.
- Phase 25 code-review: firma de GTM en `analytics.ts` corregida (matcheaba `dataLayer` genérico compartido con el snippet estándar de GA4 → falso positivo sistemático); needles de Meta Pixel/GA4 endurecidos.
- Phase 27: `@auditor/cms-adapters` paquete puro (única dep `@auditor/fingerprint`), patrón adaptador por plataforma (`CmsAdapter.lookup`) + `registry` + `resolveCmsRecommendation` con gating por confianza y fallback genérico garantizado. Wix/Squarespace comparten módulo técnico, ramificado por `label`. Resuelto en `toReportIssue` de `report-model` vía `rawStack`, nunca persistido.
- Phase 27 code-review: 3 warnings resueltos — `coverage.test.ts` ahora valida contra el `registry` real (no un mapa paralelo); umbral de confianza `ACTIVATING_CONFIDENCE` extraído a constante compartida en `types.ts`; copy de TECH-04 extendida para cubrir sub-casos de `canonicalDeep` (destino roto/en cadena/con noindex), aprobada por Juan.
- Phase 27: 7 rutas de menú `[REVISAR]` verificadas contra Wix Support/Webflow Help Center/Squarespace Help Center (WebSearch) y actualizadas donde la UI real difería del copy original (Wix: panel renombrado a "SEO y accesibilidad"; robots.txt ahora en "SEO & GEO → Tools and settings"; Webflow: robots.txt/sitemap viven en subsecciones "Indexing"/"Sitemap" de la pestaña SEO; Squarespace: label oficial "Hide page from search results").

### Pending Todos

- E2e `verify-cms-fix.mts` contra un audit real (ej. aprendoclub) con acceso a Postgres — diferido a Juan, corrida manual (`pnpm --filter @auditor/worker exec tsx scripts/verify-cms-fix.mts [auditId]`). No bloqueante, lógica ya cubierta por 21+48 tests automatizados.

### Blockers/Concerns

- [Phase 25, no bloqueante] `resolveConfidence` topa CDNs multi-header (ej. Fastly) en confianza `medio` aunque haya 3+ headers del mismo vendor — el conteo (`Signature.test`) no se usa para subir confianza, solo para desempate de builder. Documentado como limitación conocida en `cdn.ts`.

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

Last session: 2026-07-25T00:00:00.000Z
Stopped at: Phase 27 complete (verificación + nyquist + security pasados), milestone v1.5 100% completo — pendiente lifecycle (audit → complete → cleanup)
Resume file: None

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
