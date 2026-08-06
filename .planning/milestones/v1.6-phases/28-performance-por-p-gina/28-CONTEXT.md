# Phase 28: Performance por página - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

El crawler mide y persiste el tiempo de respuesta y el tamaño del HTML de cada página auditada, sin requests adicionales, y el auditor advierte (issue de severidad warning/critical) cuando alguno de los dos supera el umbral esperado. Cubre PAGEPERF-01/02/03. No incluye UI (Phase 28 no tiene panel propio — las issues nuevas aparecen en la tabla de issues genérica existente).

</domain>

<decisions>
## Implementation Decisions

### Captura de métricas en el crawl

- Persistir sólo `responseMs` (tiempo total) + `htmlBytes` — sin `ttfbMs`, se mantiene el scope exacto de PAGEPERF-01/02.
- `responseMs` sale de `response.timings.phases.total` (got-scraping, ya expuesto por `CheerioCrawler`, cero requests extra).
- `htmlBytes` sale de `Buffer.byteLength(html, 'utf-8')` sobre el string ya cargado en memoria en `requestHandler` — no usar el header `content-length` (poco confiable con compresión/chunked).
- Páginas que caen en `failedRequestHandler` (sin `response`/`html`): `responseMs`/`htmlBytes` quedan `null`, sin tocar el manejo de `Page.error` ya existente.

### Checks nuevos (severity/category/registry)

- Categoría: reusar `"perf"` (ya existe en `Category` de `packages/scoring`, mismo peso que CWV) — cero cambios de `CATEGORY_WEIGHTS` en esta fase.
- checkIds: `PERF-07` (tiempo de respuesta) y `PERF-08` (tamaño HTML), continuando la numeración de PERF-05/06 (PSI) aunque vivan en paquete distinto (`packages/checks`, no `packages/psi`).
- Dos `PageCheck` independientes (uno por métrica), mismo patrón que el resto del catálogo (1 checkId = 1 criterio con su propio umbral) — no un check combinado.
- Página sin dato (`responseMs`/`htmlBytes` en `null`): omitir el check para esa página, sin emitir issue — mismo patrón que checks que ya hacen guard sobre `page.html` en `registry.ts`.

### Umbrales, formato y persistencia

- Comparación estrictamente mayor que (`> 600`, `> 1500`, `> 100 * 1024`, `> 300 * 1024`), tal como redacta PAGEPERF-03 — el valor límite exacto cuenta como "ok".
- `measuredValue` de HTML size en KB redondeado (`Math.round(bytes / 1024)`), coherente con los umbrales ya expresados en KB en REQUIREMENTS.md.
- Los dos checks van dentro de `packages/checks/src/registry.ts` (carpeta nueva `checks/perf/`) como `PageCheck` normales — los datos ya están en `page.responseMs`/`page.htmlBytes` gracias al crawl, sin llamada externa (a diferencia de PERF-05/06 que sí dependen de la respuesta de PSI).
- Migración Prisma: columnas `Int?` nullable en `Page` — auditorías previas a esta fase quedan con `null`, sin backfill obligatorio.

### Claude's Discretion

- Nombres exactos de archivo/función dentro de `checks/perf/` (ej. `responseTime.ts`, `htmlSize.ts`) y redacción exacta de `title`/`criterion`/`recommendation` — seguir el tono ya validado del proyecto (español neutro, sin voceo, imperativo impersonal — ver `contentLengthCheck` como referencia) y el `fingerprint` (`pageFingerprint(checkId, url)`).
- Nombres exactos de las columnas Prisma (`responseMs`, `htmlBytes` como punto de partida, ajustable si colisiona con convención existente al escribir el schema).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/crawler/src/crawl.ts` — `requestHandler` ya tiene `response` (got Response, vía `CheerioCrawler`) y `html` (string) disponibles en el mismo punto donde se hace el `prisma.page.upsert()`; ahí se agregan los 2 campos nuevos al `create`/`update`.
- `packages/checks/src/checks/onpage/contentLength.ts` — referencia directa de patrón `PageCheck` con severidad de 2 niveles + issue "ok" explícito cuando pasa.
- `packages/checks/src/types.ts` — `PageCheckCtx.page` es el tipo `Page` de `@auditor/db` (Prisma), los campos nuevos aparecen ahí automáticamente tras `pnpm db:push` + generate.
- `packages/scoring/src/overallScore.ts` — `Category` union y `CATEGORY_WEIGHTS`, `"perf"` ya existe, no se toca en esta fase.

### Established Patterns
- Confirmado en `node_modules/.pnpm/got@14.6.6`: `response.timings.phases.total` = `(timings.end ?? timings.error ?? timings.abort) - timings.start`, disponible sin configuración extra.
- `PerfMetric` (tabla separada) es sólo para la muestra de PSI/CWV (mobile/desktop) — los campos nuevos de esta fase van directo en `Page`, no en `PerfMetric` (según PAGEPERF-02, "persistido en Page").
- Convención del proyecto (`STATE.md`): tras agregar columna a `Page`, correr `pnpm db:push` contra la base configurada antes de probar contra datos reales.

### Integration Points
- `packages/checks/src/registry.ts` — agregar `perfPageChecks` (nuevo) al array `pageChecks`, siguiendo el mismo import pattern que `onPageChecks`/`techPageChecks`.
- `packages/db/prisma/schema.prisma` — `model Page` gana 2 columnas `Int?` (junto a los demás campos opcionales ya existentes como `depth`, `statusCode`).

</code_context>

<specifics>
## Specific Ideas

No hay referencias específicas adicionales — los umbrales, IDs de requirement y approach técnico ya venían resueltos de REQUIREMENTS.md/STATE.md antes de esta discusión; las 3 áreas grises fueron aceptadas con la respuesta recomendada en las 3 rondas.

</specifics>

<deferred>
## Deferred Ideas

- `ttfbMs` (tiempo al primer byte) como columna adicional — evaluado y descartado para esta fase por exceder el scope literal de PAGEPERF-01 (sólo "tiempo de respuesta"); si se quiere en el futuro, viene gratis del mismo `response.timings` ya disponible.

</deferred>
