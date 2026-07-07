---
phase: 12-detecci-n-de-renderizado-csr-ssr
plan: 02
subsystem: worker
tags: [render, playwright, csr, ssr, timeout, cleanup, best-effort, vitest, tdd]

# Dependency graph
requires:
  - phase: 12-detecci-n-de-renderizado-csr-ssr
    provides: detectRenderVerdict / undeterminedVerdict / RenderedSnapshot (12-01)
  - phase: 05-psi
    provides: selectSample + SamplePageInput (@auditor/psi)
provides:
  - "Playwright browser pool: launchBrowser (single Chromium) + snapshotPage (per-page 15s timeout, context.close in finally on ALL paths)"
  - "runRenderSample best-effort orchestrator: selectSample(MAX_RENDER_PAGES=10) → snapshot → detectRenderVerdict, degrading any failure/timeout to undetermined without throwing"
  - "RenderSamplePage / SnapshotFn / RunRenderSampleArgs contracts + injectable snapshot fn for Chromium-free tests"
affects: [12-03, worker, playwright, docker]

# Tech tracking
tech-stack:
  added: [playwright 1.61.1 (exact pin, @auditor/render only), "@auditor/psi (workspace dep of render)"]
  patterns:
    - "Single browser, many contexts — never one browser per page; browser closed in finally"
    - "Per-page hard timeout via page.goto timeout AND a Promise.race guard (belt-and-suspenders)"
    - "Injectable per-page render fn (SnapshotFn) so orchestrator tests never launch real Chromium"
    - "cursor/lane concurrency mirroring runPerfSample (RENDER_CONCURRENCY=2)"

key-files:
  created:
    - packages/render/src/browser.ts
    - packages/render/src/renderSample.ts
    - packages/render/src/renderSample.test.ts
  modified:
    - packages/render/package.json
    - packages/render/tsconfig.json
    - packages/render/src/index.ts

key-decisions:
  - "playwright pineado EXACTO a 1.61.1 (sin caret) en @auditor/render — worker-only, jamás en apps/web"
  - "DOM lib añadida al tsconfig de render sólo para tipar page.evaluate (callback corre en el browser)"
  - "@auditor/psi agregado como dependency de render para reusar selectSample (no reimplementar el muestreo)"
  - "Browser lazily-launched: si se inyecta snapshot stub nunca se lanza Chromium; el default cierra el browser en finally aun si todas las páginas fallan"
  - "MAX_RENDER_PAGES=10, independiente de MAX_PSI_PAGES=5; nunca las 500 URLs"

patterns-established:
  - "Lifecycle leak-free de Playwright probado por diseño (finally) + inyección de dependencia en tests"
  - "Degradación best-effort: per-page try/catch → undetermined; la función jamás rechaza"

requirements-completed: [RENDER-01, RENDER-03]

# Metrics
duration: ~4min
completed: 2026-07-07
---

# Phase 12 Plan 02: Playwright client (pool/timeout/cleanup) + runRenderSample Summary

**Capa de browser Playwright para `@auditor/render`: `snapshotPage` con timeout duro de 15s y `context.close()` en `finally` en TODOS los caminos, más `runRenderSample` best-effort que reusa `selectSample` (cap propio de 10, nunca 500 URLs), clasifica cada página SSR/CSR y degrada cualquier fallo/timeout a "no determinado" sin lanzar excepción — con Playwright pineado a 1.61.1 y ciclo de vida sin fugas.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-07T03:06:33Z
- **Completed:** 2026-07-07T03:10:00Z
- **Tasks:** 2 (Task 2 en ciclo TDD RED→GREEN)
- **Files:** 3 creados, 3 modificados

## Accomplishments
- `browser.ts`: `launchBrowser()` lanza un único Chromium headless con args para contenedores low-shm (`--disable-dev-shm-usage`, `--no-sandbox`); `snapshotPage(browser, url)` crea un context fresco, navega con `waitUntil: networkidle` acotado por `RENDER_TIMEOUT_MS=15000` (timeout de `goto` + guardia `Promise.race`), extrae title/H1/innerText normalizados y **cierra el context en `finally` en éxito, error y timeout** (T-12-03/T-12-04).
- Constantes exportadas: `RENDER_TIMEOUT_MS=15000`, `RENDER_CONCURRENCY=2`.
- `renderSample.ts`: `runRenderSample({ auditId, pages, snapshot })` reusa `selectSample(pages, MAX_RENDER_PAGES=10)` (independiente de la muestra PSI), corre hasta 2 lanes (patrón cursor/lane de `runPerfSample`), alimenta raw (`Page.html`) vs rendered a `detectRenderVerdict`, y en cualquier throw/block/timeout hace push de `undeterminedVerdict` — **nunca rechaza**. El browser por defecto se lanza lazy y se cierra en `finally` aun si todas las páginas fallaron.
- `snapshot` inyectable (`SnapshotFn`): los tests pasan un stub y **jamás se lanza Chromium real** (suite corre en ~1s).
- 7 tests de `renderSample` (cap ≤10, SSR-ok, CSR-warning, degradación throw, degradación timeout, never-throws all-fail, muestra vacía → []) + 8 de detect = **15 tests verdes**.
- `playwright` pineado exacto a `1.61.1` sólo en `@auditor/render` (worker-only, fuera del bundle de Vercel).

## Task Commits

1. **Task 1: Playwright browser pool + timeout + cleanup-in-finally** — `7cb2f0b` (feat)
2. **Task 2 (RED): failing tests for runRenderSample** — `6083abf` (test)
3. **Task 2 (GREEN): implement runRenderSample orchestrator** — `7147249` (feat)

_TDD: RED (test) → GREEN (feat). Refactor no necesario._

## Files Created/Modified
- `packages/render/src/browser.ts` (creado) — launchBrowser, snapshotPage, RENDER_TIMEOUT_MS, RENDER_CONCURRENCY, withTimeout race guard
- `packages/render/src/renderSample.ts` (creado) — runRenderSample, MAX_RENDER_PAGES, RenderSamplePage/SnapshotFn/RunRenderSampleArgs
- `packages/render/src/renderSample.test.ts` (creado) — 7 tests con snapshot inyectado (sin Chromium real)
- `packages/render/package.json` (mod) — playwright 1.61.1 + @auditor/psi workspace:*
- `packages/render/tsconfig.json` (mod) — lib ES2022+DOM para tipar page.evaluate
- `packages/render/src/index.ts` (mod) — re-exporta símbolos de browser + renderSample

## Decisions Made
- Playwright pineado EXACTO `1.61.1` (sin caret), sólo en render, para coincidir 1:1 con la imagen Docker de 12-03 y no filtrarse a `apps/web`.
- `DOM` lib en el tsconfig de render únicamente para tipar el callback de `page.evaluate` (corre en el browser, no en Node).
- `@auditor/psi` como dependency de render para reusar `selectSample` en vez de duplicar el muestreo.
- Browser lazy + cierre en `finally`: sin procesos zombie ni OOM bajo concurrencia 2 + PSI (T-12-03).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `@auditor/psi` agregado como dependency de `@auditor/render`**
- **Found during:** Task 2
- **Issue:** El plan pide reusar `selectSample` de `@auditor/psi`, pero render aún no declaraba esa dependencia — el import no resolvería.
- **Fix:** Añadido `"@auditor/psi": "workspace:*"` a `dependencies` de render y `pnpm install`.
- **Files modified:** packages/render/package.json
- **Commit:** 7cb2f0b (junto con la infra de browser)

**2. [Rule 3 - Blocking] `DOM` lib añadida al tsconfig de render**
- **Found during:** Task 1
- **Issue:** `page.evaluate` referencia `document`/`document.body`, que no existen con `lib: ["ES2022"]` — rompía el typecheck.
- **Fix:** `lib: ["ES2022", "DOM"]` en el tsconfig de render (el callback corre en el browser).
- **Files modified:** packages/render/tsconfig.json
- **Commit:** 7cb2f0b

---
**Total deviations:** 2 auto-fixed (2 blocking). Sin cambio de alcance.

## Issues Encountered
None — `pnpm install` con `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` instaló el paquete npm sin descargar el binario de Chromium; los tests no lo necesitan (usan snapshot inyectado). Los browsers los provee la imagen pinneada en runtime (12-03).

## User Setup Required
None — no se requiere configuración de servicio externo. El binario de Chromium se provisiona vía la imagen Docker en 12-03.

## Next Phase Readiness
- Capa de render lista para que 12-03 la integre en `apps/worker` (`runRenderSample` tras el pase PSI), añada el Dockerfile pinneado `mcr.microsoft.com/playwright:v1.61.1-noble` y la aserción de que Playwright NO entra al bundle de `apps/web` (SC#4, la mitad de infra que queda).
- Ciclo de vida leak-free (SC#4 lifecycle) y degradación limpia (SC#3) garantizados y probados aquí.

---
*Phase: 12-detecci-n-de-renderizado-csr-ssr*
*Completed: 2026-07-07*

## Self-Check: PASSED

- Todos los archivos creados existen (4/4: browser.ts, renderSample.ts, renderSample.test.ts, SUMMARY).
- Todos los commits existen: 7cb2f0b (Task 1), 6083abf (RED), 7147249 (GREEN).
- 15 tests verdes + typecheck limpio, sin lanzar Chromium real.
