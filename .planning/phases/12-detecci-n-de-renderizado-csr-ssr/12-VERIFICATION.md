---
phase: 12-detecci-n-de-renderizado-csr-ssr
verified: 2026-07-07T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: findings
  previous_score: "review (deep): 1 critical, 4 warning, 3 info"
  gaps_closed:
    - "CR-01: lazy browser launch race → orphaned Chromium (memoized browserPromise ??= launchBrowser, closed via same promise; exactly-once launch test added)"
    - "WR-01: waitUntil networkidle → over-reports undetermined (switched to waitUntil load)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Construir la imagen Docker del worker (apps/worker/Dockerfile) y correr una auditoría real de un sitio con >=10 páginas dentro del contenedor pinneado (mcr.microsoft.com/playwright:v1.61.1-noble), en paralelo con el pase PSI/Lighthouse."
    expected: "El render pass clasifica la muestra SSR/CSR sin caerse; al terminar N auditorías repetidas no quedan procesos Chromium huérfanos (ps aux | grep chrome) ni el contenedor llega a OOM bajo RENDER_CONCURRENCY=2 + PSI."
    why_human: "El contrato de código (launch única memoizada + close en finally en todos los caminos, imagen pinneada) está verificado y cubierto por test unitario, pero el comportamiento real de memoria/procesos de Chromium en la imagen Docker sólo es observable ejecutando el contenedor — no es verificable con grep/tests."
---

# Phase 12: Detección de renderizado CSR/SSR — Verification Report

**Phase Goal:** La auditoría determina, sobre una muestra representativa, si cada página renderiza SSR o CSR comparando HTML crudo vs DOM renderizado, y lo reporta como riesgo sin comprometer la estabilidad del pipeline ni la frontera web/worker.
**Verified:** 2026-07-07
**Status:** human_needed (los 4 criterios verificados en código; 1 confirmación runtime de contenedor pendiente)
**Re-verification:** Sí — tras cierre del BLOCKER del review (CR-01) y WR-01.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Sobre muestra representativa (reusa `selectSample`, nunca 500 URLs), el reporte indica por página SSR/CSR mediante un issue | ✓ VERIFIED | `renderSample.ts:56` `selectSample(pages, MAX_RENDER_PAGES)` con `MAX_RENDER_PAGES = 10` (l.11); `detectRenderVerdict` emite un `RenderIssueDraft` por página (l.79-86); worker lo mapea a filas Issue y persiste (`apps/worker/src/index.ts:408-421`). Test "caps rendered pages at MAX_RENDER_PAGES" verde. |
| 2 | Contenido clave faltante en HTML crudo y visible tras render JS → riesgo SEO/AEO con severidad acorde, nunca falla dura del score | ✓ VERIFIED | `detect.ts:66-76` clasifica CSR por `missingKeyContent` (title/H1/text) o ratio<0.60; CSR → `severity: "warning"` (l.85), SSR → `"ok"` (l.101). Grep de `severity:` en render src devuelve sólo `warning`/`ok` — ningún `critical` emitido. Categoría `"aeo"` fluye por el mismo path de scoring (crédito parcial). Test CSR→warning verde. |
| 3 | Si render falla/bloquea/timeout → "no determinado" para esa página y la auditoría completa sin caerse | ✓ VERIFIED | `runRenderSample` degrada cada fallo per-page a `undeterminedVerdict` (`renderSample.ts:87-90`), nunca rechaza; worker doble-guarda con try/catch (`index.ts:356-370`). `undeterminedVerdict` → severity "ok" (`detect.ts:118-135`). Tests throw/timeout/all-fail (3) verdes. |
| 4 | Playwright en contenedor con imagen pinneada, libera navegadores en todos los caminos (sin zombies/OOM bajo concurrencia 2 + PSI), y Playwright nunca llega al bundle de Vercel (@auditor/render worker-only) | ✓ VERIFIED (código) / ⚠ runtime pendiente | Dockerfile pinneado `mcr.microsoft.com/playwright:v1.61.1-noble` en ambos stages (l.27, l.77); `browserPromise ??= launchBrowser()` memoiza launch única, cerrada vía la misma promise en `finally` (`renderSample.ts:64-70,106-117`); `snapshotPage` cierra context en `finally` en todo camino (`browser.ts:125-128`); `RENDER_CONCURRENCY = 2`. Boundary script `assert-no-playwright-in-web.mjs` exit 0; sin `@auditor/render` en apps/web. Confirmación de OOM/zombies en contenedor real → human. |

**Score:** 4/4 truths verificados en código.

### BLOCKER del review — cierre confirmado

| Hallazgo | Estado | Evidencia |
|----------|--------|-----------|
| CR-01 (race de launch → Chromium huérfano) | ✓ FIXED | `renderSample.ts:64-70` memoiza el **promise** de launch (`browserPromise ??= launchBrowser()`), cerrado vía el mismo promise (l.110-116). Test "launchBrowser is called EXACTLY ONCE ... no orphan Chromium" (`renderSample.test.ts:159-181`): 6 páginas concurrentes, `launchBrowser` 1 llamada, `close` 1 llamada. Verde. |
| WR-01 (networkidle → sobre-reporta undetermined) | ✓ FIXED | `browser.ts:89-92` usa `waitUntil: "load"`; sin `networkidle` en el path activo (sólo referenciado en comentario explicativo). |
| No existe path `critical` | ✓ CONFIRMED | Único uso de `"critical"` en render src es el string del type union (`types.ts:14`) y un comentario; ninguna rama lo emite. |
| Cap muestra = 10 | ✓ CONFIRMED | `MAX_RENDER_PAGES = 10` (`renderSample.ts:11`). |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/render/src/detect.ts` | Comparación pura raw-vs-render, emite IssueDraft aeo | ✓ VERIFIED | Exporta `detectRenderVerdict`, `undeterminedVerdict`, `RENDER_CHECK_ID`, `RENDER_CSR_RATIO`. Sin dependencia Playwright. |
| `packages/render/src/browser.ts` | Cliente Playwright, timeout, cleanup en finally, concurrencia 2 | ✓ VERIFIED | `launchBrowser` (args low-shm), `snapshotPage` (context.close en finally), `RENDER_TIMEOUT_MS=15000`, `RENDER_CONCURRENCY=2`, `waitUntil: load`. |
| `packages/render/src/renderSample.ts` | Orquestación best-effort + degradación + browser lifecycle | ✓ VERIFIED | `selectSample`, cap 10, pool de 2 lanes con cursor compartido, launch memoizada, close en finally, nunca rechaza. |
| `packages/render/src/types.ts` | Contratos locales sin dep @auditor/checks | ✓ VERIFIED | `RenderVerdict`, `RenderedSnapshot`, `RenderIssueDraft` estructuralmente idéntico a IssueDraft. |
| `apps/worker/Dockerfile` | Imagen pinneada, sin apps/web | ✓ VERIFIED | Base `v1.61.1-noble` en builder+runtime; copia sólo packages worker-side, no apps/web. |
| `scripts/assert-no-playwright-in-web.mjs` | Guardrail frontera web/worker | ✓ VERIFIED | 121 líneas, Checks A/B/C; exit 0. WR-04 (parsing frágil de `pnpm why`) sigue siendo nota de robustez, no bloqueante. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/worker/src/index.ts` | `@auditor/render` | `runRenderSample({ auditId, pages })` | ✓ WIRED | Import l.29-32; llamada l.366; resultado mapeado a filas Issue l.408-421. |
| render issues | scoring aeo | mismo path diff → Issue.createMany | ✓ WIRED | renderIssues normalizados junto a issueDrafts/perfIssues (index.ts:408). |
| `@auditor/render` | Vercel bundle | (ausencia) | ✓ WIRED (negativo) | Sin `@auditor/render` en apps/web; boundary script exit 0. |
| `renderSample.ts` | `@auditor/psi` selectSample | reuso de muestreo | ✓ WIRED | Import l.1, uso l.56. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Tests del paquete render | `pnpm --filter @auditor/render test` | 2 files, 16 passed | ✓ PASS |
| Typecheck del worker (integración) | `pnpm --filter @auditor/worker typecheck` | tsc --noEmit, exit 0 | ✓ PASS |
| Guardrail frontera web/worker | `node scripts/assert-no-playwright-in-web.mjs` | PASS, exit 0 | ✓ PASS |
| Sin severidad critical emitida | `grep 'severity:' packages/render/src/*.ts` | sólo warning/ok | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RENDER-01 | 12-01/02/03 | Determina SSR/CSR sobre muestra y lo reporta como issue | ✓ SATISFIED | detect.ts + runRenderSample + wiring worker |
| RENDER-02 | 12-01/03 | Contenido clave faltante → riesgo SEO/AEO, no falla dura | ✓ SATISFIED | severity warning/ok, categoría aeo, crédito parcial |
| RENDER-03 | 12-02 | Degradación limpia → "no determinado", no tumba auditoría | ✓ SATISFIED | undeterminedVerdict + doble guarda worker |

### Anti-Patterns Found

Ninguno bloqueante. No hay marcadores de deuda (TODO/FIXME/XXX) sin referencia en los archivos de la fase. Los identificadores `T-12-0x` en comentarios son IDs del threat model, no marcadores de deuda. Notas de calidad de señal del review (WR-02 extractores distintos raw/render, WR-03 docstring, WR-04 parsing pnpm, IN-01/02/03) permanecen como mejoras futuras no bloqueantes del objetivo de fase.

### Human Verification Required

#### 1. Runtime del contenedor: sin zombies ni OOM bajo carga real

**Test:** Construir `apps/worker/Dockerfile` y correr una auditoría real de un sitio con >=10 páginas dentro del contenedor pinneado, en paralelo con el pase PSI/Lighthouse; repetir varias auditorías.
**Expected:** Clasificación SSR/CSR sin caídas; sin procesos Chromium huérfanos al terminar y sin OOM bajo RENDER_CONCURRENCY=2 + PSI.
**Why human:** El contrato de código (launch única + close en finally + imagen pinneada) está verificado y cubierto por test unitario, pero el comportamiento real de memoria/procesos de Chromium sólo es observable ejecutando el contenedor.

### Gaps Summary

No hay gaps de código. Los 4 success criteria del ROADMAP son observablemente verdaderos en `packages/render` y `apps/worker`, con tests (16) y typecheck en verde y el guardrail de frontera pasando. El BLOCKER del review (CR-01, race de launch) está corregido con memoización del promise y cubierto por un test que asegura exactamente una llamada a `launchBrowser` y un `close` sobre una muestra concurrente de 6 páginas; WR-01 también corregido (`waitUntil: load`). El único ítem abierto es una confirmación runtime del contenedor (Docker + Chromium real + ausencia de OOM), inherentemente no verificable con grep/tests — de ahí `status: human_needed` en lugar de `passed`.

---

_Verified: 2026-07-07_
_Verifier: Claude (gsd-verifier)_
