---
phase: 12-detecci-n-de-renderizado-csr-ssr
plan: 01
subsystem: api
tags: [render, csr, ssr, cheerio, aeo, vitest, tdd]

# Dependency graph
requires:
  - phase: 11-checks-m-s-profundos
    provides: IssueDraft shape + fingerprint sub-typing pattern (checkId:subtype:url)
provides:
  - "@auditor/render worker-only package (cheerio, zero Playwright)"
  - "Pure detectRenderVerdict(rawHtml vs RenderedSnapshot) → RenderIssueDraft (category aeo)"
  - "RenderVerdict/RenderedSnapshot/RenderIssueDraft contracts decoupled from @auditor/checks"
  - "undeterminedVerdict() degradation-path helper for plan 12-02"
affects: [12-02, render, playwright, worker]

# Tech tracking
tech-stack:
  added: [cheerio ^1.2.0 (render package)]
  patterns:
    - "Local IssueDraft-shaped contract (RenderIssueDraft) to keep package decoupled — same pattern as PerfIssueDraft in @auditor/psi"
    - "Fingerprint sub-typed by verdict: RENDER-01:<verdict>:<url>"
    - "Tunable classification constant isolated from browser infra (RENDER_CSR_RATIO)"

key-files:
  created:
    - packages/render/package.json
    - packages/render/tsconfig.json
    - packages/render/src/index.ts
    - packages/render/src/types.ts
    - packages/render/src/detect.ts
    - packages/render/src/detect.test.ts
  modified: []

key-decisions:
  - "RENDER_CSR_RATIO = 0.60 exportado como constante tuneable, aislada de la infra de browser (12-02)"
  - "rawHtml null se trata como lado crudo vacío (candidato CSR), sin lanzar excepción (T-12-01)"
  - "Contratos locales (RenderIssueDraft) para que @auditor/render NO dependa de @auditor/checks"

patterns-established:
  - "Detección de render pura y 100% unit-testeable, separada de Playwright (que llega en 12-02)"
  - "Severidad SSR→ok / CSR→warning, nunca critical (CSR no es falla dura del score)"

requirements-completed: [RENDER-01, RENDER-02]

# Metrics
duration: ~4min
completed: 2026-07-07
---

# Phase 12 Plan 01: @auditor/render + detección pura SSR/CSR Summary

**Paquete worker-only `@auditor/render` con `detectRenderVerdict` puro: compara HTML crudo (cheerio) contra un snapshot renderizado y emite un veredicto SSR/CSR como IssueDraft (category aeo), sin Playwright y 100% unit-testeado.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-07T02:58:31Z
- **Completed:** 2026-07-07T03:02:00Z
- **Tasks:** 2
- **Files modified:** 6 (creados)

## Accomplishments
- Scaffold del paquete `@auditor/render` espejando `@auditor/psi` (private, type module, scripts typecheck/test), con dependencia `cheerio` y CERO Playwright.
- Contratos `RenderVerdict`, `RenderedSnapshot`, `RenderIssueDraft` decoplados de `@auditor/checks` (mismo patrón que `PerfIssueDraft`).
- `detectRenderVerdict` puro: clasifica CSR si falta contenido clave (title/H1/texto) en el crudo pero aparece renderizado, o si el ratio `rawText/renderedText < 0.60`; SSR en caso contrario.
- Severidad SSR→`ok`, CSR→`warning`, nunca `critical`; category `aeo`; fingerprint `RENDER-01:<verdict>:<url>`.
- `undeterminedVerdict()` para la ruta de degradación de 12-02 (severity `ok`).
- 8 tests pasan (SSR-ok, CSR-missing, CSR-ratio, null-rawHtml, never-critical, fingerprint único, ratio constant, undetermined).

## Task Commits

Cada tarea se commiteó atómicamente:

1. **Task 1: Scaffold @auditor/render package + contracts** - `44e113f` (feat)
2. **Task 2 (RED): failing tests for detectRenderVerdict** - `113634a` (test)
3. **Task 2 (GREEN): implement pure detectRenderVerdict** - `1c39427` (feat)

_TDD: RED (test) → GREEN (feat). Refactor no necesario._

## Files Created/Modified
- `packages/render/package.json` - Paquete worker-only, cheerio dep, zero Playwright
- `packages/render/tsconfig.json` - extends tsconfig.base, types node, include src
- `packages/render/src/types.ts` - RenderVerdict, RenderedSnapshot, RenderIssueDraft
- `packages/render/src/detect.ts` - detectRenderVerdict, undeterminedVerdict, RENDER_CHECK_ID, RENDER_CSR_RATIO
- `packages/render/src/detect.test.ts` - Cobertura SSR-ok/CSR-warning/ratio/never-critical/fingerprint
- `packages/render/src/index.ts` - Re-exporta tipos y símbolos de detect

## Decisions Made
- `RENDER_CSR_RATIO = 0.60` como constante exportada tuneable, aislada de la infra de browser.
- `rawHtml` null → lado crudo vacío (candidato CSR), sin throw (mitiga T-12-01).
- Contratos locales para no acoplar `@auditor/render` a `@auditor/checks`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] index.ts re-export de detect diferido a Task 2**
- **Found during:** Task 1 (scaffold)
- **Issue:** El plan pide que `index.ts` re-exporte símbolos de `detect` en Task 1, pero `detect.ts` no existe hasta Task 2 (TDD), lo que rompería el `typecheck` de Task 1.
- **Fix:** En Task 1 `index.ts` exporta sólo los tipos; los re-exports de `detect` se añadieron en el commit GREEN de Task 2.
- **Files modified:** packages/render/src/index.ts
- **Verification:** typecheck verde en Task 1; re-exports completos y test verde en Task 2.
- **Committed in:** 44e113f (Task 1) + 1c39427 (Task 2 GREEN)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Ajuste de orden para respetar el ciclo TDD; sin cambio de alcance. Estado final idéntico al especificado (index re-exporta tipos + símbolos de detect).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Lógica de clasificación SSR/CSR bloqueada y probada; lista para que 12-02 conecte el pool de Playwright y alimente `RenderedSnapshot`.
- `undeterminedVerdict()` disponible para la ruta de degradación (fallo/timeout) de 12-02.
- Guardarraíl SC#4 (Playwright fuera del bundle) queda pendiente para 12-02: aquí ya se garantiza cero Playwright en `@auditor/render`.

---
*Phase: 12-detecci-n-de-renderizado-csr-ssr*
*Completed: 2026-07-07*

## Self-Check: PASSED

- Todos los archivos creados existen (6/6).
- Todos los commits existen: 44e113f (Task 1), 113634a (RED), 1c39427 (GREEN).
