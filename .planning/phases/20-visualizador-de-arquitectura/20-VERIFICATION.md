---
phase: 20-visualizador-de-arquitectura
verified: 2026-07-09T13:10:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Abrir un reporte de auditoría reciente (post-Phase-16, con graph persistido) en /audits/[id] y observar la sección 'Arquitectura del sitio'."
    expected: "Se ve de un vistazo un árbol jerárquico en SVG agrupado en filas por profundidad (Profundidad 0/1/2/3+) más una fila 'Huérfanas' cuando aplica. Cada tarjeta muestra título o URL, la plantilla, un badge de profundidad ('N clic(s)' o 'sin ruta'), el marcador 'huérfana' en huérfanas y '+3 clics' en páginas profundas. Layout legible, sin solapamientos, colores por token."
    why_human: "El objetivo del phase es que el usuario 'vea de un vistazo' la arquitectura — la calidad visual del renderizado SVG (legibilidad, agrupamiento, layout, escalado responsive) solo se confirma inspeccionando la página renderizada en el navegador."
  - test: "Abrir un reporte de una auditoría PREVIA a Phase 16 (sin Audit.stats.graph)."
    expected: "El reporte carga normalmente y la sección 'Arquitectura del sitio' se omite por completo — sin errores ni crash."
    why_human: "La degradación se verificó estáticamente (guard model.architecture &&) pero conviene confirmar en un reporte real antiguo que no rompe."
---

# Phase 20: Visualizador de arquitectura Verification Report

**Phase Goal:** El usuario puede ver de un vistazo la arquitectura jerárquica de su sitio, con señales de profundidad, páginas huérfanas y plantilla por nodo.
**Verified:** 2026-07-09T13:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (from ROADMAP Success Criteria) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | El reporte incluye un árbol jerárquico en SVG puro, agrupado por profundidad 0/1/2/3+ | ✓ VERIFIED | `ArchitectureTreeSvg.tsx` (226 líneas) recorre `DEPTH_ORDER` renderizando una fila por bucket 0/1/2/3+ (líneas 59-66); SVG puro, imports solo de `@auditor/report-model`, `./ui/labels` y su CSS module — cero deps nuevas. Cableado en `page.tsx:364-373` bajo `{model.architecture && (...)}`. |
| 2 | Cada nodo muestra URL/título, profundidad, indicador huérfana e indicador >3 clics | ✓ VERIFIED | En `ArchitectureTreeSvg.tsx`: `label = node.title ?? node.url` (l.132) truncado y dibujado (l.150-151); badge de profundidad `${node.depth} clic(s)` / `sin ruta` (l.178); marcador `huérfana` bajo `node.isOrphan` (l.182-190); marcador `+3 clics` bajo `node.isDeep` (l.195-203). El modelo deriva `isDeep = depth > 3` en `build.ts:203`. |
| 3 | El árbol reusa el grafo/BFS persistido en Phase 16, sin re-parsear HTML | ✓ VERIFIED | `build.ts:121` lee `const graph = stats?.graph` (grafo persistido en Phase 16); la única query añadida es `prisma.page.findMany` con `select: { id, url, title, finalUrl }` (l.148-151) — NO carga `html` ni parsea nada. El `<title>` se extrae una sola vez en el crawl desde el Cheerio `$` ya cargado (`crawl.ts:112`). |
| 4 | Cuando la plantilla (Phase 19) está disponible, el nodo la muestra | ✓ VERIFIED | `build.ts:202,216` asigna `template: classifyTemplate(node.url)` a cada nodo y huérfana; el componente pinta `TEMPLATE_LABEL[node.template]` (l.159) y una franja de color por token según plantilla (`classForTemplate`, l.144). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/db/prisma/schema.prisma` | `title String?` en Page | ✓ VERIFIED | Línea 100, columna nullable dentro de `model Page` (l.95). No se creó carpeta migrations. |
| `packages/crawler/src/crawl.ts` | extrae y persiste `<title>` | ✓ VERIFIED | `$("title").first().text().trim() || null` (l.112); `title` escrito en ambas ramas create (l.119) y update (l.130) del upsert. |
| `packages/report-model/src/model.ts` | `ArchNode`, `ReportArchitecture`, `architecture?` | ✓ VERIFIED | `interface ArchNode` (l.83, con isDeep/isOrphan), `ReportArchitecture` (l.100), `architecture?` opcional (l.138). |
| `packages/report-model/src/build.ts` | ensamblaje desde `stats.graph` + single page load | ✓ VERIFIED | `stats?.graph` (l.121), `prisma.page.findMany` única (l.148), buckets 0/1/2/3+ (l.189-207), orphans (l.209-220), `depth > 3` (l.203). |
| `packages/report-model/src/index.ts` | export de tipos | ✓ VERIFIED | `ArchNode` (l.18), `ReportArchitecture` (l.19). |
| `apps/web/app/components/ArchitectureTreeSvg.tsx` | árbol SVG (min 60 líneas) | ✓ VERIFIED | 226 líneas; sin `dangerouslySetInnerHTML`; `role="img"` + aria-label. |
| `apps/web/app/components/ArchitectureTreeSvg.module.css` | tokens-only (sin hex) | ✓ VERIFIED | Grep de `#[0-9a-fA-F]{3,8}` no devuelve nada. |
| `apps/web/app/audits/[id]/page.tsx` | sección condicional | ✓ VERIFIED | import (l.18) + JSX bajo `{model.architecture && (...)}` (l.364-373). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `crawl.ts` | `prisma.page.upsert` | title desde `$("title")` | ✓ WIRED | title escrito en create+update. |
| `build.ts` | `Audit.stats.graph` | `stats?.graph` | ✓ WIRED | l.121, mismo patrón que `stats?.perf`. |
| `build.ts` | `classifyTemplate` | por URL de nodo/huérfana | ✓ WIRED | l.202, l.216. |
| `build.ts` | `Page.title` | `page.findMany` con `title: true` | ✓ WIRED | l.150 selecciona la columna real. |
| `page.tsx` | `ArchitectureTreeSvg` | render cuando `model.architecture` | ✓ WIRED | l.18 import, l.367 JSX, guard l.364. |
| `ArchitectureTreeSvg` | `TEMPLATE_LABEL` | label por plantilla | ✓ WIRED | l.2 import de `./ui/labels`, l.159 uso. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `ArchitectureTreeSvg` | `architecture` prop | `model.architecture` de `buildReportModel` | Sí — ensamblado desde `Audit.stats.graph` persistido + `Page` rows reales (title columna real) | ✓ FLOWING |
| `build.ts` architecture | `graph.nodes` / `pages` | `stats.graph` (Phase 16) + `prisma.page.findMany` | Sí — no hay retorno estático; `undefined` solo cuando no hay grafo | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Ensamblaje de architecture + degradación | `pnpm --filter @auditor/report-model test` | 33 tests passed (incluye buckets 0/1/2/3+, depth exacto 3 → 3+ isDeep=false, orphans, architecture===undefined sin grafo) | ✓ PASS |
| Page.title columna real en cliente generado | `pnpm --filter @auditor/db typecheck` + `@auditor/crawler typecheck` | exit 0 (title no es campo fantasma) | ✓ PASS |
| Modelo tipa contra title | `pnpm --filter @auditor/report-model typecheck` | exit 0 | ✓ PASS |
| Componente + wiring compilan | `pnpm --filter @auditor/web typecheck` | exit 0 | ✓ PASS |
| Render visual del árbol en navegador | (requiere servidor + reporte real) | — | ? SKIP → human |

### Probe Execution

No aplica — este phase no declara probes ni es un phase de migración/tooling.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| ARCH-01 | 20-03 | Árbol jerárquico SVG puro agrupado por profundidad 0/1/2/3+ | ✓ SATISFIED | `ArchitectureTreeSvg.tsx` DEPTH_ORDER rows, SVG puro cero deps. |
| ARCH-02 | 20-01, 20-03 | Nodo muestra URL/título, profundidad, huérfana, >3 clics | ✓ SATISFIED | Page.title real + render de los 4 signals. |
| ARCH-03 | 20-02 | Reusa BFS/grafo, no re-parsea HTML | ✓ SATISFIED | `stats?.graph` + `page.findMany` sin cargar html; título extraído una vez en el crawl. (Nota: el checkbox en REQUIREMENTS.md sigue `[ ]`/"Pending" — desfase de documentación, no de implementación.) |
| ARCH-04 | 20-02, 20-03 | Nodo muestra plantilla clasificada | ✓ SATISFIED | `classifyTemplate` por nodo + `TEMPLATE_LABEL` en el render. |

Todos los IDs de requirement declarados en los planes (ARCH-01..04) están cubiertos. No hay requirements huérfanos mapeados a Phase 20 sin plan.

### Anti-Patterns Found

Ninguno. Sin marcadores de deuda (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) en los archivos modificados. Sin `dangerouslySetInnerHTML`. Sin hex crudo en el CSS. Los 7 commits del phase existen en el árbol de git.

### Human Verification Required

Ver frontmatter `human_verification`. Resumen:

1. **Render visual del árbol** — abrir un reporte post-Phase-16 y confirmar que la arquitectura se ve "de un vistazo": filas por profundidad, tarjetas legibles con título/plantilla/badge, marcadores huérfana y +3 clics, layout sin solapamientos.
2. **Degradación en auditoría antigua** — abrir un reporte pre-Phase-16 (sin grafo) y confirmar que la sección se omite sin crash.

### Gaps Summary

No hay gaps que bloqueen el objetivo. Las 4 verdades observables (los 4 Success Criteria del roadmap) están verificadas estáticamente y con tests, y los 4 requirements (ARCH-01..04) están satisfechos en el código. Los typechecks de db, crawler, report-model y web pasan; la suite de report-model (33 tests) pasa cubriendo buckets, orphans y degradación.

El único punto pendiente es inherente a un phase de UI: la confirmación visual de que el árbol renderizado cumple la promesa "ver de un vistazo" solo se logra inspeccionando la página en el navegador. Por eso el estado es `human_needed` en lugar de `passed`, pese a score 4/4.

Observación menor (no bloqueante): en `REQUIREMENTS.md` el checkbox de ARCH-03 sigue en `[ ]` y la tabla de estado lo marca "Pending", mientras que la implementación sí satisface ARCH-03. Conviene actualizar ese checkbox para que la documentación refleje el código.

---

_Verified: 2026-07-09T13:10:00Z_
_Verifier: Claude (gsd-verifier)_
