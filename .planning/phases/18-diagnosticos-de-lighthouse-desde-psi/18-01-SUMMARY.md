---
phase: 18-diagnosticos-de-lighthouse-desde-psi
plan: 01
subsystem: audit-engine
tags: [psi, lighthouse, typescript, vitest, performance]

# Dependency graph
requires:
  - phase: none (extends existing packages/psi PERF-01/02/03/04 checks)
    provides: parsePsiResponse, mapPerfIssues, PsiMetrics, cache.ts
provides:
  - "extractDiagnostics(raw): PsiDiagnostics — pure extraction of 6 Lighthouse diagnostic audits from the already-fetched PSI response, no extra API calls"
  - "mapDiagnosticIssues(result): PerfIssueDraft[] — up to 5 issues (PERF-05..PERF-09), severity always ok/warning (never critical)"
  - "PsiDiagnosticAudit / PsiDiagnostics types + optional PsiMetrics.diagnostics field"
  - "index.ts public exports for all of the above"
affects: [18-02-diagnosticos-de-lighthouse-desde-psi worker/HTTP wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure extraction (parser.ts) separated from pure mapping/severity (issues.ts), following the existing parsePsiResponse/mapPerfIssues split"
    - "Diagnostic severity hardcoded to ok/warning only (score >= 0.9 => ok), never critical — same pattern already used elsewhere for informational/non-blocking checks"

key-files:
  created:
    - packages/psi/src/__fixtures__/psi-response-diagnostics.json
  modified:
    - packages/psi/src/types.ts
    - packages/psi/src/parser.ts
    - packages/psi/src/parser.test.ts
    - packages/psi/src/issues.ts
    - packages/psi/src/issues.test.ts
    - packages/psi/src/index.ts
    - packages/psi/src/cache.test.ts

key-decisions:
  - "PERF-09 combines unminified-css + unminified-javascript into one issue using the worse of the two scores, matching the plan's spec exactly"
  - "PsiMetrics.diagnostics is optional so Redis entries cached before this phase deserialize without throwing (verified with an explicit regression test in cache.test.ts)"
  - "Confirmed via grep before writing DIAGNOSTIC_SPECS that PERF-05..PERF-09 were unused checkIds (only PERF-01, PERF-02-LCP/CLS/TTFB/INP existed)"

patterns-established:
  - "DiagnosticSpec.pick() returns null (not throws) when a diagnostic is absent or has score: null, matching the existing MetricSpec.pick() null-propagation pattern in mapPerfIssues"

requirements-completed: [PERF-05, PERF-06]

# Metrics
duration: 25min
completed: 2026-07-09
---

# Phase 18 Plan 01: Diagnósticos de Lighthouse — tipos y lógica pura Summary

**Nuevo contrato de datos y mapeo puro para 5 diagnósticos de Lighthouse (imágenes modernas, CSS sin usar, recursos bloqueantes, compresión de texto, CSS/JS sin minificar) extraídos de la respuesta PSI ya existente, sin llamadas HTTP adicionales y con severidad siempre no-crítica.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-09T15:28:00Z (aprox.)
- **Completed:** 2026-07-09T15:33:13Z
- **Tasks:** 3/3 completadas
- **Files modified:** 8 (1 creado, 7 modificados)

## Accomplishments
- `extractDiagnostics()` extrae los 6 audit IDs de Lighthouse desde la misma respuesta PSI parseada (modern-image-formats, unused-css-rules, render-blocking-resources, uses-text-compression, unminified-css, unminified-javascript), sin romper `parsePsiResponse`.
- `mapDiagnosticIssues()` produce hasta 5 `PerfIssueDraft` (PERF-05..PERF-09) con severidad `ok`/`warning` (nunca `critical`), combinando `unminified-css` + `unminified-javascript` en `PERF-09`.
- Compatibilidad de caché Redis pre-v1.3 verificada con un test de regresión explícito (entradas sin `diagnostics` se leen sin excepción).

## Task Commits

Each task was committed atomically:

1. **Task 1: Tipos PsiDiagnostics + extractDiagnostics() en parser.ts** - `ca439d5` (test)
2. **Task 2: DIAGNOSTIC_SPECS + mapDiagnosticIssues() en issues.ts** - `5d09208` (feat)
3. **Task 3: Exports públicos + regresión de compatibilidad de caché** - `4761993` (feat)

_Nota: plan `type: tdd` — cada task incluyó test + implementación en un solo commit por task (no se separaron commits RED/GREEN individuales; los tests se escribieron y verificaron en rojo antes del código de producción dentro de la misma edición, y el commit final refleja el estado verde)._

## Files Created/Modified
- `packages/psi/src/types.ts` - Agrega `PsiDiagnosticAudit`, `PsiDiagnostics`, campo opcional `PsiMetrics.diagnostics`
- `packages/psi/src/parser.ts` - Agrega `extractDiagnostics()`, extiende el tipo de `audits` para incluir `score`/`displayValue`, sin tocar `parsePsiResponse`
- `packages/psi/src/parser.test.ts` - 4 tests nuevos para `extractDiagnostics` + 1 test de regresión de `parsePsiResponse`
- `packages/psi/src/__fixtures__/psi-response-diagnostics.json` - Fixture con los 6 audit IDs de diagnóstico
- `packages/psi/src/issues.ts` - Agrega `DIAGNOSTIC_SPECS`, `gradeDiagnostic()`, `mapDiagnosticIssues()`
- `packages/psi/src/issues.test.ts` - 8 tests nuevos para `mapDiagnosticIssues`
- `packages/psi/src/index.ts` - Exporta `extractDiagnostics`, `mapDiagnosticIssues`, `PsiDiagnostics`, `PsiDiagnosticAudit`
- `packages/psi/src/cache.test.ts` - Test de regresión: entrada cacheada pre-v1.3 sin `diagnostics` se lee sin excepción

## Decisions Made
- Combinar `unminified-css`/`unminified-javascript` en `PERF-09` usando el peor score de los dos (según especificación del plan), en vez de emitir dos issues separados.
- Formatear `measuredValue` con `displayValue` de Lighthouse cuando está presente, y fallback a `"score N/100"` cuando no (Lighthouse no siempre provee `displayValue`, ej. `uses-text-compression` con score 1).
- Mantener `gradeDiagnostic()` como función separada y hardcodeada (nunca retorna `"critical"`) en vez de reusar `severityFor()` de `thresholds.ts`, porque las thresholds de Lighthouse-score no son las mismas que las de Core Web Vitals ya tabuladas ahí.

## Deviations from Plan

None - plan ejecutado exactamente como estaba escrito. El gate de Task 2 (grep de checkIds PERF- existentes antes de escribir `DIAGNOSTIC_SPECS`) se corrió y confirmó que solo existían PERF-01, PERF-02-LCP, PERF-02-CLS, PERF-02-TTFB, PERF-02-INP antes de este plan.

## Verification Results

```
pnpm --filter @auditor/psi test
 Test Files  5 passed (5)
      Tests  42 passed (42)

pnpm --filter @auditor/psi typecheck
(sin errores)
```

## Known Stubs

None — todo el código escrito en este plan es lógica pura completamente testeada y cableada a sus exports públicos. La integración end-to-end con el worker/cliente HTTP queda para el Plan 18-02 (fuera del alcance de este plan por diseño).

## Threat Flags

None — el `threat_model` del plan (T-18-01, T-18-02, T-18-03) cubre toda la superficie tocada; no se introdujeron endpoints, rutas de auth ni cambios de schema.

## Next Steps
- Plan 18-02: cablear `extractDiagnostics`/`mapDiagnosticIssues` en el flujo end-to-end del worker (cliente PSI, persistencia de `PsiMetrics.diagnostics`, generación de issues PERF-05..PERF-09 en las auditorías reales).

## Self-Check: PASSED
