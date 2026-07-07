---
phase: 13-fundaci-n-de-export-serializers
plan: 02
subsystem: export
tags: [export, pptxgenjs, markdown, serializers, monorepo, vitest, priority-cap, zero-pii]

# Dependency graph
requires:
  - phase: 13-01
    provides: "ReportModel serializable (priorityCandidates completo + totalPriorityCandidates como M) vía buildReportModel"
  - phase: 06-scoring
    provides: "Category, ScoreStatus, CategoryScoreResult, CATEGORY_ORDER"
provides:
  - "Paquete puro @auditor/export (JS puro, sin headless browser)"
  - "prioritizeIssues(candidates) + EXPORT_TOP_N=50: única fuente del cap top-N para los tres formatos (EXPORT-05)"
  - "toMarkdown(model): Markdown-LLM estructurado (EXPORT-02)"
  - "toPptx(model): PPTX 7-12 slides garantizado, incl. sparse (EXPORT-03)"
affects: [13-03-pdf, 13-04-export-route]

# Tech tracking
tech-stack:
  added:
    - "pptxgenjs@4.0.1 (dep runtime, JS puro sin Chromium)"
    - "jszip@3.10.1 (devDep, extracción de texto del PPTX en tests)"
  patterns:
    - "Cap top-N compartido único (prioritizeIssues) reusado por todos los serializers, nunca re-implementado"
    - "PPTX con piso de slides garantizado por fórmula BASE_SLIDES + issues acotados (rango invariante [7,12])"
    - "labels.ts local que duplica copy neutro sin acoplar el paquete puro a apps/web"

key-files:
  created:
    - packages/export/package.json
    - packages/export/tsconfig.json
    - packages/export/vitest.config.ts
    - packages/export/src/index.ts
    - packages/export/src/labels.ts
    - packages/export/src/priority.ts
    - packages/export/src/markdown.ts
    - packages/export/src/pptx.ts
    - packages/export/src/test-fixtures.ts
    - packages/export/src/priority.test.ts
    - packages/export/src/markdown.test.ts
    - packages/export/src/pptx.test.ts
    - packages/export/src/no-pii.test.ts
  modified: []

key-decisions:
  - "prioritizeIssues opera SIEMPRE sobre model.priorityCandidates (set completo critical+warning), nunca sobre priorityIssues (cap 60 de pantalla); M = totalPriorityCandidates"
  - "PPTX garantiza [7,12] por construcción: 7 base fijas (portada+resumen+5 categorías) + 0..5 slides de issues; sparse (0 issues) → exactamente 7"
  - "buildPptxDeck expone slideCount (el tipo de pptxgenjs no publica .slides) para contar slides sin serializar"
  - "labels.ts local (CATEGORY_ORDER/LABEL, STATUS/SEVERITY_LABEL, SEVERITY_SORT_WEIGHT) copiado verbatim para no acoplar el paquete puro a apps/web"

patterns-established:
  - "Serializer de export puro consumiendo ReportModel: cero PII por construcción, acentos UTF-8 sin escapar"
  - "Guardrail cero-PII transversal: PII fixture en scope adyacente jamás aparece en ninguna salida"

requirements-completed: [EXPORT-02, EXPORT-03, EXPORT-05]

# Metrics
duration: ~22min
completed: 2026-07-07
---

# Phase 13 Plan 02: @auditor/export (cap top-N + Markdown-LLM + PPTX) Summary

**Paquete puro `@auditor/export` con el guardarrail de volumen compartido (`prioritizeIssues` + `EXPORT_TOP_N=50` sobre el set completo critical+warning) y dos serializers: `toMarkdown` (estructurado issue→página→valor→criterio→recomendación para LLM) y `toPptx` (PPTX 7-12 slides garantizado incl. sparse), en JS puro sin Chromium y con cero PII.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-07-07T23:31Z
- **Completed:** 2026-07-07T23:54Z
- **Tasks:** 3
- **Files created:** 13

## Accomplishments
- Nuevo paquete workspace `@auditor/export` (deps `@auditor/report-model`, `@auditor/scoring`, `pptxgenjs@4.0.1`).
- `priority.ts`: `EXPORT_TOP_N=50` (tuneable, una sola definición) + `prioritizeIssues(candidates)` → `{ issues, shown, total, capped, note }`. Ordena por severidad (critical→warning→ok, mismo peso que `SEVERITY_SORT_WEIGHT`) y criterio estable (categoría→checkId→id), recorta al top 50, y `total == candidates.length == totalPriorityCandidates` (la "M"). Única fuente del cap para los tres formatos.
- `markdown.ts`: `toMarkdown(model)` builder de strings puro — encabezado (dominio + score general + status + scores por categoría en `CATEGORY_ORDER`) + una sección por issue con el orden fijo checkId → página/selector → valor medido → criterio → recomendación. Alimenta el cap con `model.priorityCandidates` (verificado: 70 candidates / 60 priorityIssues → nota "50 de 70", no 60). Acentos/ñ intactos.
- `pptx.ts`: `toPptx(model): Promise<Uint8Array>` in-memory vía `pptxgenjs`. Fórmula documentada: `BASE_SLIDES=7` (portada + resumen + 1 slide por cada una de las 5 categorías, con "sin datos" si no puntúa) + `[0..MAX_ISSUE_SLIDES=5]` slides de issues paginados (10 por slide) → total invariante en [7,12]. Sparse (0 issues) → exactamente 7. Reusa `prioritizeIssues` (no re-implementa el cap); nota "mostrando N de M" en el pie del último slide de issues.
- `no-pii.test.ts`: guardrail transversal EXPORT-05 — email/token fixture en scope adyacente jamás aparece en MD ni PPTX; acentos/ñ preservados en ambos (texto del PPTX extraído descomprimiendo el ZIP en memoria con JSZip).
- 19 tests verdes (priority, markdown, pptx, no-pii) + typecheck verde. Guardrail literal `grep playwright|puppeteer|chromium` en pptx.ts == 0.

## Task Commits

1. **Task 1 (RED): scaffold + tests de cap top-N y Markdown** - `166fc51` (test)
2. **Task 1 (GREEN): priority.ts + markdown.ts + labels.ts** - `7a64606` (feat)
3. **Task 2 (RED): test de PPTX 7-12 slides** - `71b3e63` (test)
4. **Task 2 (GREEN): pptx.ts con piso de 7 slides** - `49c7e2e` (feat)
5. **Task 3: guardrail transversal cero-PII + acentos** - `75880f2` (test)

_Tasks 1 y 2 son TDD: commit test (RED) → commit feat (GREEN)._

## Files Created/Modified
- `packages/export/src/priority.ts` - `EXPORT_TOP_N=50` + `prioritizeIssues()`; cap único sobre el set completo critical+warning.
- `packages/export/src/markdown.ts` - `toMarkdown()` estructurado para LLM (EXPORT-02).
- `packages/export/src/pptx.ts` - `toPptx()`/`buildPptxDeck()`; PPTX [7,12] slides garantizado (EXPORT-03).
- `packages/export/src/labels.ts` - `CATEGORY_ORDER/LABEL`, `STATUS/SEVERITY_LABEL`, `SEVERITY_SORT_WEIGHT` (sin dep de apps/web).
- `packages/export/src/index.ts` - Reexporta `EXPORT_TOP_N`, `prioritizeIssues`, `toMarkdown`, `toPptx`, `buildPptxDeck`.
- `packages/export/src/test-fixtures.ts` - Builders de `ReportModel`/`ReportIssue` (cero PII por construcción).
- `packages/export/src/{priority,markdown,pptx,no-pii}.test.ts` - 19 tests.
- `packages/export/{package.json,tsconfig.json,vitest.config.ts}` - Scaffold del paquete puro.

## Decisions Made
- `prioritizeIssues` recibe siempre `model.priorityCandidates` (set completo, M correcto), nunca el recorte de pantalla `priorityIssues`.
- PPTX invariante [7,12] por construcción (7 base + 0..5 issues), garantizando el piso incluso en auditorías sparse.
- `buildPptxDeck` devuelve `slideCount` explícito porque el tipo de `pptxgenjs` no publica `.slides`; permite contar slides sin serializar y también parseando el binario en el test.
- Copy de etiquetas duplicado en `labels.ts` local para mantener el paquete puro desacoplado de `apps/web`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Aserción de test propia contaba mal las secciones de issue**
- **Found during:** Task 1 (GREEN)
- **Issue:** El test "emits at most EXPORT_TOP_N issue sections" contaba `CHECK-\d{3}` que aparece 2 veces por issue (encabezado + línea "Check"), reportando 100 en vez de ≤50.
- **Fix:** Se cambió el conteo a encabezados de sección `^### \d+\. ` (uno por issue).
- **Files modified:** packages/export/src/markdown.test.ts
- **Commit:** `7a64606`

**2. [Rule 3 - Blocking] index.ts referenciaba ./pptx antes de existir (Task 2)**
- **Found during:** Task 1
- **Issue:** El plan pedía reexportar `toPptx` en index.ts, pero pptx.ts se crea en Task 2 → typecheck de Task 1 rompía.
- **Fix:** Se difirió el reexport de `toPptx` a Task 2 (comentario placeholder en Task 1); añadido al completar pptx.ts.
- **Files modified:** packages/export/src/index.ts
- **Commit:** `7a64606` → `49c7e2e`

**3. [Rule 3 - Blocking] API `.slides` no publicada por el tipo de pptxgenjs**
- **Found during:** Task 2
- **Issue:** El test contaba `deck.slides.length`, pero el tipo de `pptxgenjs` no expone `.slides` (rompía typecheck).
- **Fix:** `buildPptxDeck` devuelve `slideCount` rastreado internamente; el test usa `deck.slideCount` (y el binario se parsea con JSZip para el caso sparse).
- **Files modified:** packages/export/src/pptx.test.ts, packages/export/src/pptx.ts
- **Commit:** `49c7e2e`

**4. [Rule 3 - Blocking] Guardrail literal grep chocaba con un comentario**
- **Found during:** Task 2
- **Issue:** El acceptance `grep -RniE "playwright|puppeteer|chromium" pptx.ts == 0` fallaba por mencionar esos términos en un comentario.
- **Fix:** Se reescribió el comentario ("no headless-browser engine") preservando la intención; grep == 0.
- **Files modified:** packages/export/src/pptx.ts
- **Commit:** `49c7e2e`

## Issues Encountered
Ninguno de bloqueo. `pptxgenjs` y `jszip` instalados vía pnpm sin incidencias; los 19 tests pasan y typecheck es verde.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `@auditor/export` listo como base del serializer PDF (Plan 03) sobre el mismo `prioritizeIssues` compartido.
- `toMarkdown` y `toPptx` listos para la route Node `GET /api/audits/[id]/export` (Plan 04); el guardarrail de frontera Chromium se cierra en ese plan (aserción de bundle web).

## Known Stubs
None - los tres artefactos (priority, markdown, pptx) están completamente cableados y verificados con tests.

## Self-Check: PASSED

- Archivos creados: priority.ts, markdown.ts, pptx.ts, labels.ts, index.ts, test-fixtures.ts, 4 archivos .test.ts, package.json, tsconfig.json, vitest.config.ts — todos presentes.
- Commits verificados: 166fc51 (test), 7a64606 (feat), 71b3e63 (test), 49c7e2e (feat), 75880f2 (test).
- Suite `@auditor/export`: 19 tests verdes + typecheck verde.

---
*Phase: 13-fundaci-n-de-export-serializers*
*Completed: 2026-07-07*
