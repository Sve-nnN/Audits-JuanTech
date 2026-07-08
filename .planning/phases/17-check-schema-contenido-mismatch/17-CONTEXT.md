# Phase 17: Check schema-contenido mismatch - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

El auditor detecta páginas que declaran JSON-LD de alto riesgo (`FAQPage`, `HowTo`, `Product`+`AggregateRating`, `Review`) sin contenido visible correspondiente en el HTML, y reporta un issue `warning` (nunca `critical`) por página afectada, suprimiendo falsos positivos en páginas confirmadas como CSR por la muestra de render de v1.2.

</domain>

<decisions>
## Implementation Decisions

### Ubicación y check ID
- Nuevo check en `packages/checks/src/checks/schema/contentMismatch.ts`.
- `CHECK_ID = "SD-06"` (siguiente ID libre en la familia `SD-*`; SD-01..SD-05 ya ocupados — nota: `SD-04` y `TECH-04` ya tienen colisión preexistente en el código, fuera de alcance de esta fase, no tocar).
- Reusa `extractJsonLdBlocks`/`flattenNodes` de `packages/checks/src/checks/schema/extract.ts` para obtener las entidades declaradas.

### Detección de mismatch
- Tipos de alto riesgo cubiertos: `FAQPage`, `HowTo`, `Product`+`AggregateRating`, `Review`.
- Heurística de contenido visible correspondiente: buscar texto visible cercano/relacionado en el HTML (preguntas+respuestas de FAQPage, pasos de HowTo, rating visible cerca del bloque de Product/Review) — implementación de la heurística exacta queda a criterio del planner/executor, documentando el criterio elegido.
- Severidad **siempre `warning`**, hardcodeada — nunca `critical` automático (SCHEMA-07).

### Reordenamiento del pipeline del worker (cruce con muestra CSR/SSR)
- `runRenderSample` se mueve para ejecutarse **antes** de `runAllChecks` en `apps/worker/src/index.ts` (no depende de resultados de checks, solo de `pages` crudas del crawl).
- Su resultado se pasa a `runAllChecks` como `ctx.renderVerdictByPageId: Record<string, RenderVerdict>` — mismo patrón ya usado para `depthByUrl` (Phase 16).
- El check de mismatch solo suprime el hallazgo cuando `ctx.renderVerdictByPageId[pageId] === "csr"` explícito. Páginas fuera de la muestra (máx. 10, `MAX_RENDER_PAGES`) o con verdict `undetermined` **siguen evaluándose normalmente** — no hay confirmación de falso positivo para ellas.
- El try/catch best-effort que ya envuelve `runRenderSample` en el worker se preserva tal cual, solo cambia su posición en el pipeline.

### Claude's Discretion
- Redacción exacta del título/recommendation del issue.
- Heurística fina de "contenido visible correspondiente" por tipo de entidad (FAQPage/HowTo/Product+AggregateRating/Review) — debe documentarse inline en el código con la razón de cada regla.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/checks/src/checks/schema/extract.ts` — `extractJsonLdBlocks`, `flattenNodes` ya extraen y aplanan entidades JSON-LD (incluye `@graph`).
- `packages/render/src/detect.ts` — `RENDER_CHECK_ID`, `RenderVerdict` type, ya define severidad SSR→ok/CSR→warning como precedente de "nunca critical automático" para heurísticas de render.
- `packages/render/src/renderSample.ts` — `runRenderSample({ auditId, pages })`, ya best-effort/degradado, `MAX_RENDER_PAGES = 10`.

### Established Patterns
- Checks tipo `SiteCheck` viven en `packages/checks/src/checks/{category}/`, se registran en `packages/checks/src/registry.ts` dentro del array de su categoría.
- Señales cross-cutting calculadas por el worker y pasadas por `ctx` (no recalculadas dentro de cada check) — patrón establecido en Phase 16 con `depthByUrl`.

### Integration Points
- `apps/worker/src/index.ts`: reordenar `runRenderSample` antes del bloque `runAllChecks`, construir `renderVerdictByPageId` a partir de `renderIssues` devueltos, pasarlo en `RunAllChecksOptions`.
- `packages/checks/src/types.ts` / `registry.ts`: extender `SiteCheckCtx`/`RunAllChecksOptions` con `renderVerdictByPageId?: Record<string, RenderVerdict>` (mismo patrón que `depthByUrl` de Phase 16).

</code_context>

<specifics>
## Specific Ideas

No hay referencias específicas adicionales — SCHEMA-06/07 en REQUIREMENTS.md ya son LOCKED y cubren el detalle funcional.

</specifics>

<deferred>
## Deferred Ideas

- Corregir colisión preexistente de `checkId` (`SD-04` duplicado, `TECH-04` duplicado) — bug preexistente no introducido por esta fase, fuera de alcance; anotar como tech debt para el audit de milestone.

</deferred>
