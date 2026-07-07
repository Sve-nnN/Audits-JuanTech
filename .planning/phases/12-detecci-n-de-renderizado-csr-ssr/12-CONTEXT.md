# Phase 12: Detección de renderizado CSR/SSR - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Pase selectivo de Playwright (worker-only) que, sobre una muestra representativa (reusa `selectSample`, nunca las 500 URLs), determina si cada página renderiza SSR o CSR comparando HTML crudo vs DOM renderizado, y lo reporta como issue con degradación limpia. Única pieza de v1.2 que toca worker + Docker + Playwright. No entra: persistencia de `renderVerdict` (v2), agrupación por plantilla (v2, RENDER-04), re-crawl basado en render (v2, RENDER-05), export (Phase 13-14), UX del reporte (Phase 15).

</domain>

<decisions>
## Implementation Decisions

### Empaquetado y ejecución del render
- Nuevo paquete **`@auditor/render`** worker-only: aísla Playwright para que NUNCA entre al bundle de Vercel (SC#4). Solo aparece en las `dependencies` de `apps/worker`, jamás en `apps/web`.
- Añadir `playwright@1.61.1` (pin exacto) y crear `apps/worker/Dockerfile` con imagen base pinneada `mcr.microsoft.com/playwright:v1.61.1-noble` (SC#4 lo exige). Considerar `--ipc=host` / `/dev/shm` grande / `--disable-dev-shm-usage` para Chromium.
- Concurrencia de render = **2**; browsers y contexts liberados en `finally` en TODOS los caminos (éxito, fallo, timeout) — sin procesos zombie ni OOM bajo concurrencia 2 + PSI.
- Muestra: reusar `selectSample(pages, MAX_RENDER_PAGES)` con cap propio (`MAX_RENDER_PAGES`, p.ej. 10), independiente de la muestra PSI. Nunca las 500 URLs.

### Señal de detección CSR vs SSR
- Comparar presencia/longitud de **title, H1 y texto principal** en el HTML crudo (ya almacenado en `Page.html`) vs el DOM renderizado por Playwright.
- Umbral CSR (tuneable): contenido clave (title/H1/texto principal) falta en el crudo y aparece tras render, **o** ratio `texto_crudo / texto_render < 0.60`.
- Severidad: SSR → issue `ok`; contenido clave que solo aparece tras render (CSR/riesgo) → **warning**; NUNCA `critical` ni falla dura del score (out-of-scope explícito: "marcar CSR como falla dura").
- Issue: `checkId: "RENDER-01"`, `category: "aeo"` (RENDER-02 lo enmarca como riesgo SEO/AEO; warning da crédito parcial, no cero). Fingerprint estable por página (`RENDER-01:<url>`; sub-tipar si hay más de un hallazgo por página, p.ej. `RENDER-01:csr` / `RENDER-01:undetermined`).

### Degradación y frontera web/worker
- Si el render falla, se bloquea o hace timeout → issue **"no determinado"** (severity `ok`) para esa página; la auditoría completa sin caerse (SC#3).
- Timeout por página `RENDER_TIMEOUT_MS = 15000` (tuneable).
- Frontera Vercel: `@auditor/render` solo en deps del worker; añadir aserción/test de que Playwright no entra al bundle de `apps/web` (equivalente a `pnpm why playwright` vacío en el paquete web).
- Sin migración de DB: los hallazgos son Issues normales. `Page.renderVerdict` (columna persistida) queda deferido a v2 (REPORT-05).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/psi/src/sample.ts` → `selectSample(pages, max)` + `SamplePageInput` — reusar para la muestra de render (patrón ya probado en el pase PSI).
- `apps/worker/src/index.ts` → `runPerfSample` (línea ~130) muestra el patrón de "pase de muestra best-effort con try/catch que degrada sin tumbar la auditoría" — replicar para `runRenderSample`. Ahí también se persisten Issues.
- `packages/checks/src/types.ts` → `IssueDraft` (severity `critical|warning|ok`, `fingerprint`, `pageId`, `category`). Los issues de render se mapean a filas Issue igual que perf issues (worker `issueRowsWithoutDiff`).
- `Page.html` ya contiene el HTML crudo almacenado — el lado "raw" de la comparación no necesita re-fetch.

### Established Patterns
- Categorías de scoring: `type Category = "tech" | "onpage" | "schema" | "perf" | "aeo"` (`packages/scoring/src/overallScore.ts`) — usar `aeo`, NO agregar categoría nueva (evita tocar pesos de score y el "hard failure").
- Worker deps actuales: `@auditor/checks, @auditor/crawler, @auditor/db, @auditor/psi, @auditor/queue, @auditor/scoring, bullmq, ioredis`. `@auditor/render` se suma solo aquí.
- El worker corre hoy vía tsx/node sin Dockerfile — este Phase introduce el primer Dockerfile del worker.

### Integration Points
- `apps/worker/src/index.ts` — nuevo `runRenderSample(auditId, pages)` best-effort tras el pase PSI; sus Issues entran al mismo `issueRowsWithoutDiff` antes del diff/persist.
- `apps/worker/package.json` — añadir `@auditor/render` y (transitivo) `playwright`.
- `packages/render/` — nuevo paquete: cliente Playwright con pool, timeout, cleanup en finally, y la función de comparación raw-vs-rendered que emite `IssueDraft`.

</code_context>

<specifics>
## Specific Ideas

- SC#4 es el guardarraíl crítico: imagen Docker pinneada exacta a `playwright@1.61.1`, cleanup de browsers en todos los caminos, y Playwright fuera del bundle web (aserción). SC#3: degradación limpia probada (fallo/timeout → "no determinado", auditoría no cae). Añadir tests que simulen render fallido y verifiquen que el pase degrada sin excepción propagada.

</specifics>

<deferred>
## Deferred Ideas

- Persistir `Page.renderVerdict` (REPORT-05) — v2.
- Agrupación por plantilla del veredicto CSR/SSR (RENDER-04) — v2.
- Re-crawl basado en render para enlaces solo-JS (RENDER-05) — v2.

</deferred>
