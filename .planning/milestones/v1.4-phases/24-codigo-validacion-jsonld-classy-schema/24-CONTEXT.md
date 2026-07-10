# Phase 24: Código + validación JSON-LD estilo Classy Schema - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

El detalle de página (`/audits/[id]/pages/[pageId]`) muestra el JSON-LD **formateado por entidad** (SDVIZ-02) con **validación por propiedad/tipo** contra un subconjunto de alto valor SEO/rich-results del vocabulario schema.org (SDVIZ-03), estilo Classy Schema. La lógica de validación vive en `packages/checks` (reutilizable/testeable) y se conecta al pipeline de scoring como uno o más checks nuevos (severidad ok/warning, nunca critical). Cubre: (1) render de árbol de propiedades por entidad con badges por propiedad/entidad, (2) motor de validación por tipo/propiedad reusando/extendiendo `SCHEMA_RULES`, (3) persistir el JSON-LD crudo por entidad para no depender del HTML en la web.

</domain>

<decisions>
## Implementation Decisions

### 1. Fuente del JSON-LD crudo (SDVIZ-02) — DECIDIDO: opción A
- **Persistir un campo nuevo `Page.schemaJson` (Json?)** en el worker vía `pnpm db:push` (schema-first, sin carpeta migrations). Contiene el array de entidades JSON-LD por página (los `JsonLdNode.data` flatten, con `@type` y propiedades).
- **Fallback para auditorías viejas** (sin `schemaJson`): re-extraer desde `Page.html` con los helpers Playwright-free de `@auditor/checks` (`extractJsonLdBlocks` + `flattenNodes` sobre `cheerio.load(page.html)`). `cheerio` es seguro en web; Playwright NO.
- El worker ya computa el grafo (`computeSchemaGraph`) y escribe `Page.schemaGraph` en `apps/worker/src/index.ts` (~537-548); el write de `schemaJson` va en paralelo ahí.

### 2. Impacto en el score (SDVIZ-03) — DECIDIDO: cambia recomendación inicial
- **SÍ afecta el score**: la validación por entidad/propiedad se registra como **check(s) nuevo(s)** dentro del pipeline de scoring existente (estilo SD-01..SD-06), NO como función pura aislada solo-UI.
- **Severidad ok/warning, NUNCA critical**: mantener el criterio "nunca falla dura del score" — schema no debe destruir el score. `warning` = 0.5 de health, `ok` = 1.0 (coherente con SD-06). Sin `critical`.
- El **mismo motor** de validación por propiedad/tipo alimenta tanto el/los check(s) de scoring como la UI del detalle (badges por nodo/propiedad). Motor puro y testeable en `packages/checks`; los checks lo envuelven para emitir `IssueDraft`, y la UI lo llama para pintar estados.

### 3. Alcance de reglas de validación (SDVIZ-03) — DECIDIDO: opción A
- **Extender `SCHEMA_RULES` a mano** (hoy en `packages/checks/src/checks/schema/schemaValidate.ts`, ~11 tipos) al subconjunto de **13 tipos de alto impacto**: Organization, WebSite, Article, BlogPosting, Product, FAQPage, Person, LocalBusiness, BreadcrumbList, Event, Recipe, Review, Offer.
- Por tipo: `required` + `recommended` + **advertencias específicas de alto valor** (ej. `Product` con `AggregateRating` sin `reviewCount`/`ratingValue`; `Article`/`BlogPosting` sin `author`/`datePublished`; etc.).
- **Propiedades desconocidas: NO marcarlas** (evita ruido en la audiencia lead-magnet). Sólo se valida required/recommended + anti-patrones conocidos.
- **Sin archivo/fuente externa** del vocab schema.org: curado a mano, mantenible. (No requiere research pesado; el set de reglas se cura desde conocimiento SEO/rich-results.)

### 4. Presentación (SDVIZ-02) — DECIDIDO: árbol de propiedades + toggle a crudo
- **Árbol de propiedades por entidad**: card con header `@type` + filas `propiedad → valor`, entidades anidadas indentadas, con **badge de estado por propiedad/entidad** (ok/warning/error) según el motor de validación. Estilo panel de propiedades de Classy Schema.
- **Toggle opcional a "ver código crudo"**: bloque JSON-LD formateado/indentado (pre + `JSON.stringify(data, null, 2)`, mono font token).
- Copy en español neutral (como el resto de los checks). Tokens-only, sin hex (DS-01), CSP-safe. Sin dependencias nuevas de UI/highlighter.

### Claude's Discretion
- Estructura exacta del/los check(s) nuevo(s) (¿uno agregado por página que resume, o uno por entidad?): a criterio, respetando el patrón `PageCheck`/`IssueDraft` y el registro en `schemaPageChecks`.
- Forma exacta del tipo de resultado del motor de validación (estados por entidad/propiedad) y su API.
- Diseño fino del árbol de propiedades (indentación, colapsables, cómo se muestran valores anidados vs referencias `@id`), badges, toggle.
- Reglas específicas por tipo dentro del subconjunto de 13 (required/recommended/anti-patrones concretos).
- Si el motor de validación es un módulo puro nuevo (ej. `schema/validateEntities.ts`) o extiende `schemaValidate.ts`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/checks/src/checks/schema/extract.ts` — `JsonLdNode = { blockIndex, data }` (mantiene el objeto entidad completo), `extractJsonLdBlocks($)`, `flattenNodes(blocks)` (expande arrays + `@graph`), `typesOf(data)`, `hasProp(data, prop)`. Playwright-free (seguro en web).
- `packages/checks/src/checks/schema/schemaValidate.ts` — **SD-04**: `SCHEMA_RULES` (type → `{ required[], recommended[] }`, ~11 tipos), exportado vía index.ts. Emite critical (missing required) / warning (missing recommended) / ok. **Base a extender** para SDVIZ-03.
- `packages/checks/src/checks/schema/schemaTypes.ts` — `HIGH_IMPACT_TYPES` set (13 tipos).
- `packages/checks/src/checks/schema/contentMismatch.ts` — **SD-06**: precedente "nunca falla dura" (siempre warning), lógica de `AggregateRating`/`ratingValue`/`HowTo`.
- `packages/checks/src/checks/schema/index.ts` — registra `schemaPageChecks` (SD-01/02/03/04/05) y `schemaSiteChecks`; re-exporta helpers. Acá se registra el/los check(s) nuevo(s).
- `packages/checks/src/types.ts` — `IssueSeverityValue = "critical"|"warning"|"ok"` (no hay "info"; informativo = "ok"). `PageCheck { checkId; run(ctx): IssueDraft[] }`. `IssueDraft` shape.
- `packages/scoring/src/categoryScore.ts` — `SEVERITY_HEALTH = { ok:1, warning:0.5, critical:0 }`; score = pass-rate ponderado por severidad. `warning` baja a 0.5, nunca 0.
- `apps/web/app/audits/[id]/pages/[pageId]/page.tsx` — server component; hoy selecciona `{ id, url, finalUrl, statusCode, schemaGraph }` y renderiza sección "Grafo de entidades" (`EntityGraphSvg`) + "Hallazgos". Agregar selección de `schemaJson` (o `html` para fallback) y una **nueva `<section>`** para SDVIZ-02 entre el grafo y los hallazgos.
- `apps/web/app/audits/[id]/pages/[pageId]/pages.module.css` — `.section`/`.sectionTitle`/`.graphCard` (card surface+border+radius), `.finding*`, mono font `var(--font-geist-mono)`. Tokens `--surface`, `--border`, `--radius-*`, `--space-*`, `--critical/--warning/--success`.
- `apps/web/app/components/ui/Badge` (`SeverityBadge`), `components/ui/JsonLdBadge.tsx` (`jsonLdStateForPage`) — patrón de badges a espejar por propiedad/entidad. `components/ui/EmptyState`.
- `packages/db/prisma/schema.prisma` — Page model (~102-125): tiene `schemaGraph Json?` y `html String? @db.Text`. Agregar `schemaJson Json?` (schema-first, `pnpm db:push`).

### Established Patterns
- Checks colocados en `packages/checks/src/checks/schema/*.ts` + test `*.test.ts` (vitest default config del paquete, `testUtils.ts` helper). Copy en español neutral.
- `apps/web` NO puede resolver Playwright (`scripts/assert-no-playwright-in-web.mjs`); `@auditor/checks` extract helpers son seguros.
- Schema-first en `packages/db`: `pnpm db:push` (sin migrations). Cuando el worker escribe una columna nueva, correr `pnpm db:push` contra Neon o las auditorías fallan.

### Integration Points
- Worker: `apps/worker/src/index.ts` (~537-548) escribe `Page.schemaGraph`; agregar write de `schemaJson`.
- Web: nueva sección en el detalle de página; consume `schemaJson` (o fallback `html`) + el motor de validación de `@auditor/checks`.

</code_context>

<specifics>
## Specific Ideas

- Referencia visual: panel de propiedades de Classy Schema (árbol tipo→propiedades con estados por fila). Juan es design-conscious e itera el look → la fase cierra en **checkpoint:human-verify** (validación visual antes de cerrar).
- Anti-patrón concreto que Juan mencionó como ejemplo de alto valor: `Product` declara `AggregateRating` sin `reviewCount` (patrón que Google penaliza).
- Es la fase más pesada del milestone; alcance pragmático (subconjunto de alto valor, no vocab completo).

</specifics>

<deferred>
## Deferred Ideas

- Validación del vocab schema.org completo (cientos de tipos/propiedades) — fuera de alcance por diseño (abrumaría al lead-magnet + mantenimiento).
- Marcado de propiedades desconocidas — explícitamente NO en esta fase (decisión de Juan, evitar ruido).
- Syntax highlighter / dependencia de UI para el código crudo — no; `<pre>` + `JSON.stringify` + mono token alcanza.

</deferred>
