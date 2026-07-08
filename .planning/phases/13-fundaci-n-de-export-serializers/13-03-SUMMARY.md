---
phase: 13-fundaci-n-de-export-serializers
plan: 03
subsystem: export
tags: [export, react-pdf, pdf, fonts, khand, geist-sans, serializers, vitest, zero-pii, priority-cap]

# Dependency graph
requires:
  - phase: 13-02
    provides: "@auditor/export puro: EXPORT_TOP_N + prioritizeIssues (cap top-N compartido), toMarkdown, toPptx, labels.ts, test-fixtures.ts"
  - phase: 13-01
    provides: "ReportModel (priorityCandidates + totalPriorityCandidates como M) vía buildReportModel"
provides:
  - "toPdf(model): Promise<Buffer> vía @react-pdf/renderer (JS puro, sin navegador headless) — tercer y último serializer del paquete (EXPORT-01)"
  - "TTFs de marca vendorizadas (Khand headings 400/600 + Geist Sans body 400) con fetch-fonts.mjs reproducible"
affects: [13-04-export-route]

# Tech tracking
tech-stack:
  added:
    - "@react-pdf/renderer@4.5.1 (dep runtime, renderer propio sin Chromium)"
    - "react@19.2.7 (dep, peer de @react-pdf; alineado a apps/web)"
    - "wawoff2@2.0.1 (devDep, fallback woff2->sfnt en fetch-fonts.mjs)"
    - "pdf-parse@1.1.4 (devDep, extracción de texto del PDF en tests)"
  patterns:
    - "Roles tipográficos v1.1 embebidos en el PDF: Font.register de 2 familias (Khand headings, Geist Sans body); Array NO se usa ni se embebe en títulos"
    - "TTFs vendorizadas por ruta de archivo (fileURLToPath(new URL('./fonts/...', import.meta.url))); @react-pdf solo acepta sfnt (no woff2)"
    - "Cap top-N compartido (prioritizeIssues sobre priorityCandidates) reusado también por el PDF, nunca re-implementado"

key-files:
  created:
    - packages/export/src/pdf.tsx
    - packages/export/src/pdf.test.ts
    - packages/export/src/pdf-parse.d.ts
    - packages/export/src/fonts/Khand-Regular.ttf
    - packages/export/src/fonts/Khand-SemiBold.ttf
    - packages/export/src/fonts/GeistSans-Regular.ttf
    - packages/export/src/fonts/README.md
    - packages/export/scripts/fetch-fonts.mjs
  modified:
    - packages/export/src/index.ts
    - packages/export/package.json
    - packages/export/tsconfig.json

key-decisions:
  - "Font.register de DOS familias por rol: Khand (400/600) para TODOS los headings (portada, sección, categoría, título de issue) y GeistSans (400) para el body; Array reservada a display, NO se embebe en el PDF"
  - "Geist Sans se materializa copiando el Geist-Regular.ttf del paquete npm geist ya presente (misma fuente que sirve la web), no descargando; Khand se descarga como TTF estático directo de google/fonts ofl/khand"
  - "note style sin fontStyle italic: solo se registró Geist Sans regular; @react-pdf exige registrar la variante itálica aparte, innecesaria para la nota"
  - "Test extrae texto con pdf-parse (import profundo lib/pdf-parse.js para evitar su bloque debug de módulo principal) y valida acentos en AMBOS roles (heading Khand + body Geist Sans)"

patterns-established:
  - "Serializer PDF con roles tipográficos embebidos + guardarrail de extracción de texto que verifica acentos por rol y ausencia de PII en texto Y binario"

requirements-completed: [EXPORT-01, EXPORT-05]

# Metrics
duration: ~7min
completed: 2026-07-08
---

# Phase 13 Plan 03: Serializer PDF (@react-pdf/renderer + Khand/Geist Sans) Summary

**`toPdf(model): Promise<Buffer>` cierra los tres formatos de `@auditor/export`: PDF en JS puro vía `@react-pdf/renderer` (sin navegador headless) con los roles tipográficos validados de v1.1 embebidos — Khand en headings y Geist Sans en body (Array NO en títulos) — acentos/ñ correctos en ambos roles, cap top-N compartido sobre `priorityCandidates` con nota "Mostrando N de M", y cero PII.**

## Performance
- **Duration:** ~7 min
- **Started:** 2026-07-08T14:22Z
- **Completed:** 2026-07-08T14:29Z
- **Tasks:** 3
- **Files created:** 8 (3 src + 3 TTF + README + script)

## Accomplishments
- **Task 1 — Fuentes vendorizadas:** `fetch-fonts.mjs` (reproducible, ya presente de un run previo, verificado y ejecutado) materializa `Khand-Regular.ttf` (400) + `Khand-SemiBold.ttf` (600) desde `google/fonts` `ofl/khand`, y `GeistSans-Regular.ttf` (400) copiando el TTF del paquete `geist` local (fallback woff2→sfnt vía `wawoff2`). Los tres son sfnt válidos (firma `0x00010000`) y cubren `áéíóúñ¿¡ÁÉÍÓÚÑ` (verificado con fontkit). `fonts/README.md` documenta origen, licencia OFL y roles; `wawoff2` como devDep. **Array NO se materializa** (no hay ningún TTF de Array en `src/fonts/`).
- **Task 2 — Serializer PDF (EXPORT-01):** `src/pdf.tsx` con `toPdf` vía `renderToBuffer`. `Font.register` de dos familias apuntando a los TTF por ruta de archivo: `Khand` (400/600) para portada, headings de sección, headings de categoría y títulos de issue; `GeistSans` (400) para todo el body (valores, criterios, recomendaciones, nota). `StyleSheet` con estilos de heading en Khand y de body en Geist Sans (sin Helvetica core, sin Array). Estructura: portada (dominio + score general + status) → "Scores por categoría" (CATEGORY_ORDER) → issues priorizados vía `prioritizeIssues(model.priorityCandidates)` con la nota "Mostrando N de M" cuando aplica, cada issue con checkId/título, página/selector, valor medido, criterio y recomendación. Reexportado desde `index.ts`.
- **Task 3 — Guardarrail de extracción (EXPORT-01/05):** `src/pdf.test.ts` construye un fixture con un título de heading acentuado (`Configuración de canónicos áéíóúñ¿¡`, renderizado en Khand) + body con `áéíóúñ¿¡` (Geist Sans) + 61 candidatos (fuerza el cap). Extrae el texto con `pdf-parse` y asserta: firma `%PDF-`, acentos preservados en HEADING Khand (`categoría`, `canónicos`, `Configuración`) Y en body (`áéíóúñ¿¡`), nota `Mostrando N de M`, cero PII (email/token fixture ausentes en texto Y binario), y ambas fuentes (`Khand`, `Geist`) embebidas en el binario.
- **25 tests verdes** (priority, markdown, pptx, no-pii, pdf) + typecheck verde. Guardarrail literal: `grep -ci "Array"` == 0 y `grep -RicE "playwright|puppeteer|chromium"` == 0 en `pdf.tsx`.

## Task Commits
1. **Task 1: vendorizar TTFs Khand + Geist Sans** — `d548888` (feat)
2. **Task 2: toPdf con @react-pdf/renderer + Khand/Geist Sans (EXPORT-01)** — `6105d7c` (feat)
3. **Task 3: test de extracción (acentos heading+body, N de M, cero PII)** — `59cc44d` (test)

## Files Created/Modified
- `packages/export/src/pdf.tsx` — `toPdf()` con roles tipográficos embebidos (EXPORT-01).
- `packages/export/src/pdf.test.ts` — guardarrail de acentos por rol + N de M + cero PII.
- `packages/export/src/pdf-parse.d.ts` — tipos ambient mínimos para el import profundo de pdf-parse.
- `packages/export/src/fonts/{Khand-Regular,Khand-SemiBold,GeistSans-Regular}.ttf` — TTF de marca vendorizadas.
- `packages/export/src/fonts/README.md` — origen, licencia OFL, roles y comando de regeneración.
- `packages/export/scripts/fetch-fonts.mjs` — materialización reproducible de los TTF.
- `packages/export/src/index.ts` — reexporta `toPdf`.
- `packages/export/package.json` — deps `@react-pdf/renderer`, `react`; devDeps `wawoff2`, `pdf-parse`, `@types/react`.
- `packages/export/tsconfig.json` — `jsx: "react-jsx"`.

## Decisions Made
- Dos `Font.register` por rol (Khand headings, Geist Sans body); Array reservada, no embebida.
- Geist Sans copiada del paquete `geist` local (misma fuente que la web), Khand descargada como TTF estático de google/fonts.
- `note` sin itálica (solo se registró Geist Sans regular; la variante itálica exigiría registrar otro TTF, innecesario).
- Extracción de texto vía import profundo `pdf-parse/lib/pdf-parse.js` para evitar su bloque debug de módulo principal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] React no resoluble desde @auditor/export**
- **Found during:** Task 2
- **Issue:** `@react-pdf/renderer` requiere `react` como peer; el paquete `@auditor/export` no lo declaraba y el render fallaba/typecheck no resolvía JSX.
- **Fix:** Añadido `react ^19.0.0` como dependency (+ `@types/react` devDep, alineados a apps/web) y `jsx: "react-jsx"` en el tsconfig del paquete.
- **Files modified:** packages/export/package.json, packages/export/tsconfig.json
- **Commit:** `6105d7c`

**2. [Rule 1 - Bug] Estilo de nota pedía Geist Sans itálica no registrada**
- **Found during:** Task 3 (primer run de tests)
- **Issue:** El estilo `note` usaba `fontStyle: "italic"` pero solo se registró Geist Sans regular → `@react-pdf` lanzaba "Could not resolve font for GeistSans, fontWeight 400, fontStyle italic" y fallaban los 6 tests de PDF.
- **Fix:** Se quitó `fontStyle: "italic"` de la nota (Geist Sans regular).
- **Files modified:** packages/export/src/pdf.tsx
- **Commit:** `6105d7c`

**3. [Rule 3 - Blocking] Acceptance grep chocaba con menciones literales en comentarios**
- **Found during:** Task 2 (verificación de acceptance)
- **Issue:** `grep -ci "Array"` == 2 y `grep -RicE "playwright|puppeteer|chromium"` == 2 en `pdf.tsx` por menciones en comentarios (slug de memoria y "What NOT to Use").
- **Fix:** Reescritos los comentarios preservando la intención ("fuente de display de marca", "sin motor de navegador headless"); ambos grep == 0.
- **Files modified:** packages/export/src/pdf.tsx
- **Commit:** `6105d7c`

**4. [Rule 3 - Blocking] Import profundo de pdf-parse sin tipos**
- **Found during:** Task 3 (typecheck)
- **Issue:** `pdf-parse/lib/pdf-parse.js` no tiene declaración de tipos → TS7016.
- **Fix:** Añadido `src/pdf-parse.d.ts` con tipos ambient mínimos del entry profundo.
- **Files modified:** packages/export/src/pdf-parse.d.ts (nuevo)
- **Commit:** `59cc44d`

## Issues Encountered
Ninguno de bloqueo. Las fuentes se materializaron sin fallback (Khand por descarga directa, Geist del paquete local). Extracción de texto de PDF con fuente embebida preservó acentos en heading Khand y body Geist Sans sin necesidad de recurrir al fallback previsto en el plan.

## User Setup Required
None - sin configuración de servicios externos.

## Known Stubs
None - `toPdf` está completamente cableado, con fuentes embebidas y verificado por tests de extracción.

## Threat Flags
None - el PDF consume solo el `ReportModel` (cero PII por construcción); el guardarrail de frontera Chromium en el bundle web se cierra en Plan 04.

## Next Phase Readiness
- Los tres serializers (`toMarkdown`, `toPptx`, `toPdf`) listos para la route Node `GET /api/audits/[id]/export?format=pdf|md|pptx` (Plan 04).
- Plan 04 debe cerrar la aserción de frontera (`@auditor/export` no arrastra navegador headless al bundle web) reusando `scripts/assert-no-playwright-in-web.mjs`.

## Self-Check: PASSED
- Archivos creados verificados en disco: pdf.tsx, pdf.test.ts, pdf-parse.d.ts, 3 TTF, README.md, fetch-fonts.mjs — todos presentes.
- Commits verificados: d548888 (feat), 6105d7c (feat), 59cc44d (test).
- Suite `@auditor/export`: 25 tests verdes + typecheck verde. Greps de acceptance: Array==0, headless==0, Font.register==3 (>=2), toPdf en index==1.

---
*Phase: 13-fundaci-n-de-export-serializers*
*Completed: 2026-07-08*
