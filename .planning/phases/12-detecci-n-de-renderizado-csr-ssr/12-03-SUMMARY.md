---
phase: 12-detecci-n-de-renderizado-csr-ssr
plan: 03
subsystem: worker
tags: [render, playwright, worker, docker, boundary, aeo, best-effort, ci-guardrail]

# Dependency graph
requires:
  - phase: 12-detecci-n-de-renderizado-csr-ssr
    provides: runRenderSample + RenderIssueDraft + RenderSamplePage (@auditor/render, 12-02)
  - phase: 05-psi
    provides: runPerfSample best-effort pattern + issueRowsWithoutDiff mapping (apps/worker)
provides:
  - "Worker pipeline runs runRenderSample best-effort after the PSI pass; its aeo issues join issueRowsWithoutDiff → diff → Issue.createMany → aeo scoring, unchanged"
  - "Double-guarded render pass: even a catastrophic render-layer failure never fails the audit (audit still reaches status done, SC#3)"
  - "apps/worker/Dockerfile: first worker container image, pinned FROM mcr.microsoft.com/playwright:v1.61.1-noble (matches playwright@1.61.1, SC#4)"
  - "scripts/assert-no-playwright-in-web.mjs: CI guardrail proving @auditor/render (real Playwright carrier) never resolves in the @auditor/web bundle"
affects: [worker, docker, ci, railway]

# Tech tracking
tech-stack:
  added: ["@auditor/render (workspace dep of apps/worker — pulls playwright worker-only)"]
  patterns:
    - "Render pass mirrors runPerfSample: best-effort try/catch that degrades, never rethrows"
    - "Render issues (category aeo) merged into issueRowsWithoutDiff exactly like perfIssues (scope: null)"
    - "Multi-stage monorepo Dockerfile: copy manifests → pnpm install --filter → prisma generate → build; runtime via node --import tsx (workspace packages ship TS source)"
    - "SC#4 boundary asserted by @auditor/render absence in web graph, not by naive `pnpm why playwright` (crawlee surfaces playwright as a peer in both web and worker)"

key-files:
  created:
    - apps/worker/Dockerfile
    - apps/worker/.dockerignore
    - scripts/assert-no-playwright-in-web.mjs
  modified:
    - apps/worker/package.json
    - apps/worker/src/index.ts
    - packages/render/src/browser.ts
    - package.json

key-decisions:
  - "Render pass double-guarded: runRenderSample ya degrada per-página sin lanzar; el try/catch del worker es belt-and-suspenders para fallos catastróficos del layer (Chromium no arranca) — la auditoría nunca cae (SC#3)"
  - "browser.ts desacoplado del DOM ambiental vía shim tipado en globalThis, para que el worker (lib Node-only) typechee el source de @auditor/render sin necesitar la lib DOM — mantiene DOM aislado a render"
  - "Dockerfile arranca con `node --import tsx apps/worker/dist/index.js`: los paquetes @auditor/* exponen src TS (no emiten JS), así tsx transpila esas imports en runtime mientras el entry es el dist compilado"
  - "SC#4 se asevera por ausencia de @auditor/render en el grafo de web (portador real de playwright), NO por `pnpm why playwright` vacío: crawlee declara playwright como peer y aparece idéntico en web y worker (cadena preexistente que Next.js tree-shakea)"

requirements-completed: [RENDER-01, RENDER-03]

# Metrics
duration: ~7min
completed: 2026-07-07
---

# Phase 12 Plan 03: Integración del render en el worker + Dockerfile pinneado + guardarraíl de bundle Summary

**`runRenderSample` cableado best-effort en el pipeline del worker (tras el pase PSI, sus issues `aeo` entran a `issueRowsWithoutDiff` sin tocar el flujo diff/score/persist y un fallo jamás tumba la auditoría), más el primer `apps/worker/Dockerfile` pinneado exacto a `mcr.microsoft.com/playwright:v1.61.1-noble` y un script de CI que prueba que Playwright/`@auditor/render` nunca llega al bundle de Vercel — cerrando SC#3 (auditoría sobrevive al fallo de render de punta a punta) y SC#4 (imagen pinneada + frontera web/worker).**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-07-07T03:13:07Z
- **Completed:** 2026-07-07T03:20:15Z
- **Tasks:** 3
- **Files:** 3 creados, 4 modificados

## Accomplishments
- **Task 1 — worker wiring (RENDER-01/03):** `apps/worker/package.json` gana `@auditor/render` (arrastra `playwright` solo al worker). En `crawlAndCheck`, tras el try/catch de PSI, un pase de render best-effort mapea `pages` a `RenderSamplePage[]` y llama `runRenderSample({ auditId, pages })`; sus `RenderIssueDraft[]` se mapean a filas Issue idénticas a `perfIssues` (`scope: null`) y entran a `issueRowsWithoutDiff` → `diffIssues` → `Issue.createMany` → scoring `aeo`, sin cambiar nada del flujo validado. Doble guarda: `runRenderSample` ya degrada per-página sin lanzar, y el try/catch del worker atrapa cualquier fallo catastrófico del layer (p.ej. Chromium no arranca) dejando `renderIssues = []` — la auditoría siempre llega a `done` (SC#3).
- **Task 2 — Dockerfile pinneado (SC#4):** primer `apps/worker/Dockerfile`, multi-stage `FROM mcr.microsoft.com/playwright:v1.61.1-noble` (coincide 1:1 con `playwright@1.61.1`, nunca `:latest`). Copia manifests del monorepo, `pnpm install --filter @auditor/worker...`, `prisma generate`, build del worker; arranca `node --import tsx apps/worker/dist/index.js`. Sin puerto HTTP (worker de fondo). `apps/web` excluido para que Playwright jamás se empaquete con Vercel. Guía low-shm (`--disable-dev-shm-usage` ya en `@auditor/render`; `--ipc=host` / `--shm-size` en runtime del host). `.dockerignore` excluye `node_modules`, `dist`, `.next`, `apps/web`.
- **Task 3 — guardarraíl de frontera (SC#4):** `scripts/assert-no-playwright-in-web.mjs` (registrado como root script `assert:web-boundary`) falla si (A) `playwright` es dep directa de web, (B) `@auditor/render` resuelve en el grafo de `@auditor/web`, o (C) hay algún edge `playwright` **no-peer** (real) en web. Verificado PASS hoy y FAIL al agregar `@auditor/render` a web.
- Worker typecheck limpio, `@auditor/render` typecheck limpio, 15 tests de render verdes, aserción verde.

## Task Commits

1. **Task 1: Wire runRenderSample best-effort into the worker** — `69e7dac` (feat)
2. **Task 2: Pinned worker Dockerfile + .dockerignore** — `071ea06` (chore)
3. **Task 3: Assert Playwright never reaches the web bundle** — `1684f94` (test)

## Files Created/Modified
- `apps/worker/src/index.ts` (mod) — import de `runRenderSample`/`RenderIssueDraft`/`RenderSamplePage`; pase de render best-effort doble-guardado tras PSI; merge de render issues en `issueRowsWithoutDiff`
- `apps/worker/package.json` (mod) — `@auditor/render": "workspace:*"`
- `packages/render/src/browser.ts` (mod) — `page.evaluate` desacoplado del `document` ambiental vía shim tipado en `globalThis`
- `apps/worker/Dockerfile` (creado) — imagen multi-stage pinneada a `v1.61.1-noble`
- `apps/worker/.dockerignore` (creado) — excluye node_modules/dist/.next/apps/web
- `scripts/assert-no-playwright-in-web.mjs` (creado) — guardarraíl SC#4
- `package.json` (mod) — script root `assert:web-boundary`

## Decisions Made
- **Doble guarda del pase de render:** `runRenderSample` nunca rechaza (degrada per-página a `undetermined`), pero el worker añade un try/catch externo para el caso catastrófico (layer entero falla). Garantiza SC#3 de punta a punta.
- **Shim de `document` en `browser.ts`:** el worker (lib Node-only) typechea el source de `@auditor/render`; referenciar `document` ambiental exigía la lib DOM en el worker. Un shim tipado sobre `globalThis` mantiene DOM aislado a render y hace el paquete autónomo para cualquier consumidor.
- **Runtime `node --import tsx`:** los `@auditor/*` exponen `src/index.ts` (no emiten JS), así el entry compilado `dist/index.js` importa TS en runtime; tsx los transpila. El build (`tsc`) sigue presente para validar tipos y producir el entry.
- **SC#4 por ausencia de `@auditor/render`, no por `pnpm why playwright` vacío** (ver Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `browser.ts` desacoplado del DOM ambiental para que el worker typechee**
- **Found during:** Task 1
- **Issue:** `@auditor/render` expone `src/index.ts` como tipos, así que `pnpm --filter @auditor/worker typecheck` sigue el import hacia `packages/render/src/browser.ts`, que usa `document`/`document.body` en el callback de `page.evaluate`. El `lib` del worker es Node-only (sin DOM) → `error TS2584: Cannot find name 'document'`. La decisión de 12-02 fue mantener DOM aislado a render; añadir DOM al worker rompería esa aislación.
- **Fix:** El callback (que corre serializado en el browser) accede a `document` vía `globalThis` con un shim tipado local. Render y worker typechequean sin la lib DOM; comportamiento en runtime idéntico (document real en el browser). 15 tests de render siguen verdes.
- **Files modified:** packages/render/src/browser.ts
- **Commit:** 69e7dac

**2. [Rule 1 - Bug] La aserción SC#4 no puede basarse en `pnpm why playwright` vacío (habría dado falso fallo)**
- **Found during:** Task 3
- **Issue:** El plan/decisión bloqueada especifica "equivalente a `pnpm why playwright` vacío en el paquete web". Empíricamente NO está vacío ni puede estarlo: `apps/web → @auditor/checks → @auditor/crawler → crawlee → @crawlee/playwright` declara `playwright` como **peer**, y aparece idéntico en el grafo de web y de worker (cadena preexistente desde fase 2/3, que Next.js tree-shakea porque web usa el crawler Cheerio). Un check ingenuo "no vacío → FAIL" fallaría hoy pese a que `@auditor/render` es correctamente worker-only. Además `pnpm why playwright` NO discrimina web de worker (la cadena peer domina en ambos y el edge real de render ni aparece por dedup de pnpm).
- **Fix:** El script asevera la frontera real de SC#4: (A) `playwright` no es dep directa de web, (B) `@auditor/render` (el portador real de `playwright: 1.61.1`) no resuelve en el grafo de web, (C) no hay ningún edge `playwright` **no-peer** en web (tolera la cadena peer de crawlee). Esto PASA hoy y FALLA de forma determinista si `@auditor/render` o un importador real de playwright se filtra a web — verificado positivo y negativo.
- **Files modified:** scripts/assert-no-playwright-in-web.mjs
- **Commit:** 1684f94

---
**Total deviations:** 2 auto-fixed (1 blocking, 1 bug/refinamiento de guardarraíl). Sin cambio de alcance: se cumplen SC#3 y SC#4 con una aserción más precisa que la formulación literal.

## Threat Model Coverage
- **T-12-06 (Denial — render tumba la auditoría):** mitigado. Doble guarda (degradación interna de `runRenderSample` + try/catch externo del worker); la auditoría llega a `done` siempre (Task 1).
- **T-12-07 (Tampering — imagen Playwright drift):** mitigado. Dockerfile pinneado a `v1.61.1-noble`, sin `:latest` (Task 2).
- **T-12-08 (Info disclosure — Playwright en el bundle Vercel):** mitigado. `assert:web-boundary` falla en CI si `@auditor/render`/playwright real entra a web (Task 3).
- **T-12-SC (playwright transitivo al worker):** aceptado por diseño — paquete oficial de Microsoft, pin exacto 1.61.1; sin checkpoint de legitimidad.

## Issues Encountered
None bloqueante. `pnpm install` con `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` instala el paquete npm sin bajar Chromium (los binarios los provee la imagen pinneada en runtime).

## Known Stubs
None — el pase de render está totalmente cableado al pipeline real; sus issues se persisten y puntúan `aeo`. No hay datos placeholder.

## Runtime Note (deferred, no bloqueante)
Es el primer Dockerfile del worker. Los paquetes `@auditor/*` distribuyen TS source (no emiten JS), por eso el arranque usa `node --import tsx` para resolver esas imports en runtime. Productivizar el runtime del worker (build de todos los paquetes a JS puro para correr `node` sin loader) queda como mejora futura fuera del alcance de esta fase; SC#4 (pinning + aislación) queda cumplido.

## User Setup Required
None para el código. Al desplegar el worker en Railway: correr el contenedor con `--ipc=host` o `--shm-size=1g` para headroom de Chromium bajo concurrencia (la guía está documentada en el Dockerfile).

## Next Phase Readiness
- Fase 12 cerrada (3/3 planes). Detección de render SSR/CSR integrada de punta a punta: `@auditor/render` puro (12-01) + pool Playwright leak-free (12-02) + cableado worker + Docker pinneado + guardarraíl de bundle (12-03).
- RENDER-01/02/03 completos. Listo para Phase 13 (fundación de export).

---
*Phase: 12-detecci-n-de-renderizado-csr-ssr*
*Completed: 2026-07-07*

## Self-Check: PASSED

- Archivos creados existen (3/3: apps/worker/Dockerfile, apps/worker/.dockerignore, scripts/assert-no-playwright-in-web.mjs).
- Commits existen: 69e7dac (Task 1), 071ea06 (Task 2), 1684f94 (Task 3).
- Worker typecheck limpio, render typecheck limpio, 15 tests de render verdes, `assert:web-boundary` PASS (y FAIL en test negativo).
