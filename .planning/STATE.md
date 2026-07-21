---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: Fingerprinting técnico + fixes personalizados por CMS
current_phase: 25
current_phase_name: Fingerprint de stack técnico — contrato de datos y motor de detección
status: executing
stopped_at: Completed 25-04-PLAN.md
last_updated: "2026-07-21T21:15:11.614Z"
last_activity: 2026-07-21
last_activity_desc: "Plan 25-01 ejecutado: paquete @auditor/fingerprint creado, contrato de datos (DetectedStack/AxisResult/Signature/PageFingerprintInput) fijado y en verde"
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-21 after v1.5 milestone opened)

**Core value:** Cualquier persona ingresa una URL y recibe una auditoría completa, precisa y accionable de su web (errores reales priorizados por severidad), a cambio de su email verificado.
**Current focus:** v1.5 (Fingerprinting técnico + fixes personalizados por CMS). Roadmap recién creado (Phases 25-27), 17/17 requirements mapeados. Ninguna fase iniciada aún.

## Current Position

Phase: 25 of 27 (Fingerprint de stack técnico — contrato de datos y motor de detección)
Plan: 3 of 4 complete (25-01 — scaffold @auditor/fingerprint + contrato de datos)
Status: Ready to execute
Last activity: 2026-07-21 — Plan 25-01 ejecutado: paquete @auditor/fingerprint creado, contrato de datos (DetectedStack/AxisResult/Signature/PageFingerprintInput) fijado y en verde

Progress: [██████████] 100%

## Milestone v1.5 — Phases

| Phase | Nombre | Requirements | UI |
|-------|--------|--------------|-----|
| 25 | Fingerprint de stack técnico — contrato de datos y motor de detección | FPRINT-01..08 | no |
| 26 | Wiring en el worker + tabla de stack en el reporte | FPRINT-09, STACKUI-01..03 | sí |
| 27 | Motor de recomendaciones por CMS — patrón adaptador + fallback | CMSFIX-01..05 | no |

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

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

### Pending Todos

None yet.

### Blockers/Concerns

- Firmas de builders WP (Elementor/WPBakery/Divi) y de CDN son de fuentes MEDIUM confidence (agregado de blogs/comunidad, no verificadas contra sitios reales) — planear QA manual contra 2-3 instalaciones reales por builder durante Phase 25, no solo fixtures sintéticos.
- Copy de fix por plataforma×builder para checks fuera de los ejemplos ya calibrados (title/meta, H1, OG, sitemap/robots.txt) necesita cruzarse contra documentación oficial de cada plataforma durante Phase 27.
- Decisión de granularidad Wix vs Squarespace (un solo adapter técnico, detección separada a nivel de label) — validar si el fallback compartido produce copy suficientemente específico en la primera vuelta de Phase 27.

## Deferred Items

Items acknowledged and carried forward from previous milestone close (v1.4, 2026-07-10):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| debug | pdf-export-crash-reading-s (crash export PDF, `TypeError: Cannot read properties of undefined (reading 'S')`, runtime Next server) | fixing — next_action pendiente: exportar `@react-pdf/renderer` vía `serverExternalPackages` | v1.4 close (2026-07-10) |
| tech debt | SD-07 sin dedupe/cap de mensajes; `SchemaEntities.tsx` usa índice de array como key de React (bajo riesgo) | not started | v1.4 close (2026-07-10) |
| v2 | Deploy a producción (Vercel/Railway/Resend/GDPR), monetización, RENDER-04/05, EXPORT-06, REPORT-05, Domain Rating, FPRINT-10..14, CMSFIX-06/07 | not started | v1.4 close (2026-07-10) / v1.5 REQUIREMENTS.md |

## Notas de ejecución (convenciones del proyecto, persisten entre milestones)

- Cada fase: smart discuss (AskUserQuestion con grey areas batch) → planner (gsd-planner) → plan-checker (gsd-plan-checker) → executor(es) secuenciales en main tree → code-review (gsd-code-reviewer) + verify (gsd-verifier) en paralelo → fix warnings inline → commit.
- `packages/db` es schema-first (`pnpm db:push`, sin carpeta migrations). Cuando el worker/report-model escribe una columna nueva (ej. `Page.responseHeaders`, `Audit.stack`), correr `pnpm db:push` contra Neon antes de probar contra datos reales.
- Verificar fixes de datos contra un audit real (ej. aprendoclub) con `tsx` (script `.mts` en el paquete relevante).
- `packages/fingerprint` y `packages/cms-adapters` (nuevos en v1.5) deben mantenerse desacoplados de `@auditor/db`/`@auditor/crawler`/`@auditor/checks` en runtime — el único punto de contacto entre recomendaciones y checks es el `checkId` string ya persistido en `Issue`.

## Session Continuity

Last session: 2026-07-21T21:15:11.608Z
Stopped at: Completed 25-04-PLAN.md
Resume file: None
