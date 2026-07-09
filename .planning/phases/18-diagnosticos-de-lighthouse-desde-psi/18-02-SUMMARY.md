---
phase: 18-diagnosticos-de-lighthouse-desde-psi
plan: 02
subsystem: audit-engine
tags: [psi, lighthouse, worker, vitest, performance]

# Dependency graph
requires:
  - phase: 18-diagnosticos-de-lighthouse-desde-psi (plan 01)
    provides: extractDiagnostics(raw), mapDiagnosticIssues(result), PsiDiagnostics/PsiDiagnosticAudit types, PsiMetrics.diagnostics
provides:
  - "runPsi() adjunta diagnostics a cada PsiMetrics leyendo la misma respuesta PSI ya obtenida (cero llamadas HTTP extra)"
  - "apps/worker/src/index.ts persiste issues PERF-05..PERF-09 como Issue rows del audit, en la misma pasada que PERF-01/02-*"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cableado end-to-end de lógica pura (18-01) al pipeline real reusando el mismo punto de llamada que mapPerfIssues ya usaba (runOnePage en runPerfSample)"

key-files:
  created:
    - packages/psi/src/client.test.ts
  modified:
    - packages/psi/src/client.ts
    - apps/worker/src/index.ts

key-decisions:
  - "Merge de diagnostics en metrics con object spread (`{ ...parsePsiResponse(json), diagnostics: extractDiagnostics(json) }`) sobre la misma respuesta json ya parseada, sin tocar el resto de runPsi (reintentos, timeout, camino de error)"
  - "mapDiagnosticIssues se llama inmediatamente después de mapPerfIssues dentro de runOnePage, con los mismos argumentos {url, pageId, mobile, desktop} ya construidos — sin nuevo try/catch porque es función pura que nunca lanza"

patterns-established: []

requirements-completed: [PERF-05, PERF-06]

# Metrics
duration: 15min
completed: 2026-07-09
---

# Phase 18 Plan 02: Diagnósticos de Lighthouse — cableado end-to-end Summary

**runPsi adjunta diagnostics a cada PsiMetrics desde la misma respuesta PSI (cero llamadas extra) y el worker persiste issues PERF-05..PERF-09 junto al resto de issues perf en la misma pasada.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-09T15:28:00Z (aprox.)
- **Completed:** 2026-07-09T15:36:54Z
- **Tasks:** 2/2 completadas
- **Files modified:** 3 (1 creado, 2 modificados)

## Accomplishments
- `runPsi()` adjunta `diagnostics` a `PsiMetrics` (cache y llamada en vivo) reusando la misma respuesta JSON ya obtenida, sin fetch adicional.
- El worker llama `mapDiagnosticIssues` en el mismo punto donde ya llamaba `mapPerfIssues`, cerrando el flujo end-to-end de PERF-05..PERF-09 sin llamadas PSI adicionales.
- 3 tests nuevos en `client.test.ts` cubren: diagnósticos presentes, diagnósticos ausentes (`{}` no `undefined`), y camino de error intacto.

## Task Commits

Each task was committed atomically:

1. **Task 1: client.ts adjunta diagnostics a cada PsiMetrics** - `e522b48` (feat)
2. **Task 2: Worker persiste issues de diagnóstico (PERF-05..PERF-09)** - `0a03a78` (feat)

## Files Created/Modified
- `packages/psi/src/client.ts` - `runPsi` mergea `extractDiagnostics(json)` en `metrics` sobre la misma respuesta ya parseada por `parsePsiResponse`
- `packages/psi/src/client.test.ts` - Nuevo; 3 tests con `vi.stubGlobal("fetch", ...)` cubriendo éxito con diagnósticos, éxito sin diagnósticos, y camino de error
- `apps/worker/src/index.ts` - Importa `mapDiagnosticIssues` y lo llama dentro de `runOnePage` (en `runPerfSample`) junto a `mapPerfIssues`, mismos argumentos, sin nuevo try/catch

## Decisions Made
- Reusar exactamente el mismo objeto `json` ya obtenido de `res.json()` para `extractDiagnostics`, evitando cualquier segunda petición HTTP a PSI.
- No envolver `mapDiagnosticIssues` en un try/catch adicional: es función pura (mismo contrato que `mapPerfIssues`, ya verificado en 18-01) y el `try/catch` de `runPerfSample`/`processAuditJob` ya cubre cualquier fallo inesperado del pipeline como best-effort.

## Deviations from Plan

None - plan ejecutado exactamente como estaba escrito.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Verification Results

```
pnpm --filter @auditor/psi test -- client.test.ts
 Test Files  6 passed (6)
      Tests  45 passed (45)

pnpm --filter @auditor/psi test
 Test Files  6 passed (6)
      Tests  45 passed (45)

pnpm --filter @auditor/psi typecheck
(sin errores)

pnpm --filter @auditor/worker typecheck
(sin errores)

grep -n "extractDiagnostics" packages/psi/src/client.ts -> 2 líneas (import + uso)
grep -n "mapDiagnosticIssues" apps/worker/src/index.ts -> 2 líneas (import + llamada)
git diff apps/worker/src/index.ts | grep '+.*runPsi(' -> vacío (sin llamadas PSI adicionales)
```

## Known Stubs

None.

## Threat Flags

None — T-18-04 (aceptado, sin I/O adicional) y T-18-05 (mitigado, extractDiagnostics opera sobre la misma respuesta ya validada por res.ok) cubren toda la superficie tocada por este plan.

## Next Phase Readiness
- PERF-05..PERF-09 quedan completamente cableados end-to-end: extracción pura (18-01) + persistencia real en auditorías (18-02).
- No quedan tareas pendientes para esta fase (18-diagnosticos-de-lighthouse-desde-psi) — este era el último plan.

---
*Phase: 18-diagnosticos-de-lighthouse-desde-psi*
*Completed: 2026-07-09*

## Self-Check: PASSED
