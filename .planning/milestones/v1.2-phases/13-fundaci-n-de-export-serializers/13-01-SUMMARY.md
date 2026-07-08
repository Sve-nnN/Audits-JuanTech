---
phase: 13-fundaci-n-de-export-serializers
plan: 01
subsystem: api
tags: [report-model, prisma, next, monorepo, vitest, serializable]

# Dependency graph
requires:
  - phase: 06-scoring
    provides: "Audit.scores (overall/status/byCategory/diff) y tipos Category/ScoreStatus/CategoryScoreResult"
  - phase: 11-checks-profundos
    provides: "issues TECH-04:* (canonical) y ONPAGE-08:* (headings) persistidas"
  - phase: 12-render
    provides: "issues RENDER-01:* (render CSR/SSR, category aeo) persistidas"
provides:
  - "Paquete puro @auditor/report-model con buildReportModel(auditId): Promise<ReportModel | null>"
  - "ReportModel serializable (cero React/Prisma/PII) reusado por page.tsx y los serializers de export (Plans 02/03)"
  - "priorityCandidates (set completo critical+warning) + totalPriorityCandidates como fuente de la M en 'mostrando N de M'"
affects: [13-02-export-serializers, 13-03-pdf, 13-04-export-route, 15-ux-reporte]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Paquete puro que ensambla un modelo serializable desde datos persistidos (sin recomputar checks)"
    - "buildReportModel como single source of truth compartida entre UI y exports"

key-files:
  created:
    - packages/report-model/src/build.ts
    - packages/report-model/src/model.ts
    - packages/report-model/src/index.ts
    - packages/report-model/src/build.test.ts
    - packages/report-model/package.json
    - packages/report-model/tsconfig.json
    - packages/report-model/vitest.config.ts
  modified:
    - apps/web/app/audits/[id]/page.tsx
    - apps/web/package.json

key-decisions:
  - "buildReportModel devuelve null para audit inexistente O status != done; page.tsx conserva una consulta ligera para distinguir notFound() de la pantalla de progreso"
  - "url del issue derivada replicando issueUrl (source ?? scope) para preservar el render idéntico, en lugar de incluir la relación Page"
  - "priorityCandidates = una sola findMany sin take (reemplaza el findMany+count separados de page.tsx) preservando la semántica exacta de N de M"
  - "issuesByCategory tipado Record<Category, ReportIssue[]> con las 5 categorías inicializadas — mismo conjunto renderizado que el Map original"

patterns-established:
  - "Modelo de reporte serializable puro: primitivos/objetos planos, cero PII (nunca email ni token)"
  - "Tests con vi.mock('@auditor/db') para ejercitar buildReportModel sin Postgres real"

requirements-completed: [EXPORT-01, EXPORT-02, EXPORT-03, EXPORT-05]

# Metrics
duration: ~14min
completed: 2026-07-07
---

# Phase 13 Plan 01: @auditor/report-model + refactor de page.tsx Summary

**Paquete puro `@auditor/report-model` con `buildReportModel(auditId)` que ensambla un `ReportModel` serializable sin PII (expone priorityCandidates completo + priorityIssues capado a 60), y `page.tsx` refactorizado para consumirlo como single source of truth sin cambiar el render.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-07-07T18:17Z
- **Completed:** 2026-07-07T18:31Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Nuevo paquete workspace `@auditor/report-model` (deps `@auditor/db` + `@auditor/scoring`) con tipos `ReportModel`/`ReportIssue` serializables.
- `buildReportModel` extrae verbatim la lógica de ensamblado que vivía inline en `page.tsx`: scores, diff con resueltas, perf, issuesByCategory (incluye checks de Phases 11/12) y los prioritarios.
- Expone dos conjuntos distintos de prioritarios: `priorityCandidates` (TODAS las critical+warning, sin recorte, fuente de la M) y `priorityIssues` (recorte de pantalla a `MAX_PRIORITY_ROWS`=60), más `totalPriorityCandidates`.
- `page.tsx` consume `buildReportModel`; se eliminaron las tres `prisma.issue.findMany` + el `prisma.issue.count` inline y los tipos locales `AuditScores`/`AuditStats`. Render y títulos acentuados intactos.
- Test de equivalencia con aserción de cero PII sobre `JSON.stringify(model)` (5 tests verdes) + typecheck verde; web typechea y compila.

## Task Commits

1. **Task 1 (RED): tests de buildReportModel** - `c4dc91a` (test)
2. **Task 1 (GREEN): implementación de buildReportModel** - `ae924f9` (feat)
3. **Task 2: refactor de page.tsx a single source of truth** - `50d22a7` (refactor)

_Task 1 es TDD: commit test (RED) → commit feat (GREEN)._

## Files Created/Modified
- `packages/report-model/src/model.ts` - Tipos serializables `ReportModel`/`ReportIssue`/`ReportPerf`/`ReportDiff` (reusan Category/ScoreStatus/CategoryScoreResult de @auditor/scoring); cero PII.
- `packages/report-model/src/build.ts` - `buildReportModel(auditId)` + `MAX_PRIORITY_ROWS`; lee prisma.audit/issue (datos persistidos), deriva url vía issueUrl.
- `packages/report-model/src/index.ts` - Reexporta buildReportModel, MAX_PRIORITY_ROWS y los tipos.
- `packages/report-model/src/build.test.ts` - 5 tests (modelo poblado, null para inexistente/no-done, priorityCandidates vs cap 60, cero PII) con vi.mock de @auditor/db.
- `packages/report-model/{package.json,tsconfig.json,vitest.config.ts}` - Scaffold del paquete puro.
- `apps/web/app/audits/[id]/page.tsx` - Consume buildReportModel; sin ensamblado inline; JSX y títulos con tilde sin cambios.
- `apps/web/package.json` - Añade `@auditor/report-model: workspace:*`.

## Decisions Made
- `buildReportModel` retorna `null` tanto para audit inexistente como para status != done; `page.tsx` mantiene su `prisma.audit.findUnique` inicial para distinguir `notFound()` de la pantalla de progreso, y usa `if (!model) notFound()` como guarda de seguridad.
- La `url` de cada issue se deriva replicando `issueUrl` (`source ?? scope`, primer token) en lugar de incluir la relación Page, para garantizar render idéntico.
- `issuesByCategory` pasa de `Map<string, Issue[]>` a `Record<Category, ReportIssue[]>` inicializado con las 5 categorías — mismo subconjunto que el JSX renderiza (CATEGORY_ORDER).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Todos los paquetes typechean y compilan; los 5 tests pasan a la primera tras GREEN.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `buildReportModel` + `ReportModel` listos como fuente de datos para `@auditor/export` (Plan 02: cap top-N + serializers Markdown/PPTX) y el serializer PDF (Plan 03).
- `priorityCandidates`/`totalPriorityCandidates` ya disponibles para el cap "mostrando N de M" compartido de EXPORT-05.
- Cero PII garantizado por test — base para las compuertas de PII de los serializers.

## Self-Check: PASSED

- Archivos creados/modificados: todos presentes (build.ts, model.ts, index.ts, build.test.ts, page.tsx).
- Commits verificados: c4dc91a (test), ae924f9 (feat), 50d22a7 (refactor).

---
*Phase: 13-fundaci-n-de-export-serializers*
*Completed: 2026-07-07*
