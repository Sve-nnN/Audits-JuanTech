# Phase 25: Fingerprint de stack técnico — contrato de datos y motor de detección - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

<domain>
## Phase Boundary

El sistema puede determinar, a partir de headers/cookies/HTML ya capturados durante el crawl (sin requests adicionales), el stack técnico de un sitio —CMS+builder, CDN/proxy, hosting, framework JS, analytics— con un nivel de confianza tipado por eje, sin nunca forzar una respuesta cuando la señal es insuficiente. Cubre FPRINT-01..08. No incluye wiring en el worker ni UI de reporte (Phase 26), ni motor de recomendaciones por CMS (Phase 27).

</domain>

<decisions>
## Implementation Decisions

### Captura de headers y cookies
- Persistir una lista curada de headers HTTP relevantes a fingerprinting (server, x-powered-by, via, cf-ray, x-generator, link, set-cookie, x-drupal-*, x-shopify-*, etc.), no el objeto completo de headers crudo.
- Capturar por página (no solo home) — sin costo extra, ya estamos dentro del `requestHandler` del crawler.
- Cookies: solo nombres de cookie (no valores/expiry/domain/flags), parseados del header `Set-Cookie`, por FPRINT-01.
- Persistencia: columnas nuevas `Page.responseHeaders` (Json, headers curados) + `Page.cookieNames` (String[]), no una tabla separada.

### Motor de detección — arquitectura y señales
- Patrón de reglas: registry de "signatures" por eje, forma `{ id, axis, test(input), weight }`, evaluado sobre el agregado de todas las páginas del audit (headers + cookies + HTML markers + paths conocidos), no regex sueltos sin estructura.
- Multi-señal → confianza vía reglas explícitas (no puntaje numérico 0-100): alto = 2+ señales fuertes coincidentes o 1 señal inequívoca; medio = 1 señal fuerte sola; bajo = señal débil/indirecta; no-detectado = 0 señales.
- Fuente de HTML para matching: `Page.html` ya persistido, prioriza home page, con fallback a cualquier página si home falló/vacía.
- Independencia entre ejes: nunca winner-take-all — decisión previa ya fijada en STATE.md, se mantiene.

### Detección de builder WordPress
- Marcadores por builder (multi-señal, nunca un solo header):
  - Elementor: clases `elementor-*`/`data-elementor-*`, paths `/wp-content/plugins/elementor/`.
  - WPBakery: clases `wpb_*`/`vc_row`, path `js_composer`.
  - Divi: clases `et_pb_*`, tema/path `Divi`/`et-builder`.
  - Gutenberg: regla POSITIVA explícita (`wp-block-*`, comentarios `<!-- wp:paragraph -->`) — nunca default implícito.
- Empate entre builders con confianza alta: gana el de mayor conteo de marcadores; empate real → "no detectado con certeza" (no prioridad fija arbitraria).
- QA contra sitios reales: durante ejecución, buscar 2-3 sitios públicos conocidos por builder (showcases Elementor/Divi/WPBakery) para validar contra fixtures sintéticos — cierra el blocker ya anotado en STATE.md.
- CMS=WordPress sin ningún builder matcheando: builder = "no detectado con certeza", incluso con CMS claro. Nunca asumir Gutenberg sin marcador positivo (FPRINT-08, success criteria #2 del ROADMAP).

### Estructura del paquete `packages/fingerprint`
- Paquete nuevo `packages/fingerprint`, desacoplado en runtime de `@auditor/db`/`@auditor/crawler`/`@auditor/checks` (decisión previa en STATE.md, se mantiene).
- API pública: función pura `detectStack(input: { pages: PageFingerprintInput[] }): DetectedStack`, sin I/O propio.
- Forma de `DetectedStack`: objeto por eje — `{ cms, builder, cdn, hosting, jsFramework, analytics }`. Cada eje (salvo `analytics`) es `AxisResult = { value, confidence, signals[] }`. `analytics` es un array de `AxisResult` porque pueden coexistir varias herramientas (GA4 + GTM + Meta Pixel simultáneamente).
- Testing: fixtures HTML/headers sintéticos por firma + tests unitarios por eje, sumado a la QA manual contra sitios reales.

### Claude's Discretion
Ninguna decisión quedó en discreción total de Claude — las 4 áreas se resolvieron con "Aceptar todo" sobre las propuestas recomendadas.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/crawler/src/crawl.ts` — `CheerioCrawler` con `requestHandler(ctx)` que ya tiene `ctx.response` (headers) y `ctx.$`/`ctx.body` (HTML) disponibles antes del `prisma.page.upsert`. Punto de inserción natural para capturar headers/cookies sin requests adicionales.
- `Page.html` ya persistido (columna `@db.Text`) — fuente de HTML para matching sin re-fetch.
- Patrón de columnas Json aditivas ya usado en `Page.schemaGraph`/`Page.schemaJson` (Phase 4/24) — mismo patrón aplica para `Page.responseHeaders`.

### Established Patterns
- Schema Prisma es schema-first (`pnpm db:push`, sin carpeta migrations) — correr `pnpm db:push` contra Neon al agregar columnas nuevas, antes de probar contra datos reales (convención ya en STATE.md).
- Paquetes nuevos del monorepo se mantienen desacoplados en runtime del resto (mismo patrón que `packages/graph`, `packages/scoring` — solo dependen de tipos, no de Prisma/DB directamente).
- Verificación de datos reales vía script `tsx` (`.mts`) contra un audit real (ej. aprendoclub), convención repetida en fases anteriores.

### Integration Points
- `apps/worker/src/index.ts` es quien orquesta el pipeline post-crawl (ver línea ~548 donde ya escribe `schemaGraph`/`schemaJson` a `Page`) — Phase 26 conectará `detectStack` ahí, pero Phase 25 solo entrega el motor + tipos, no el wiring.
- `packages/crawler/src/crawl.ts` requestHandler es el único punto de captura de headers/cookies — no hay otro lugar en el pipeline donde esos datos estén disponibles sin request extra.

</code_context>

<specifics>
## Specific Ideas

- `DetectedStack.analytics` debe ser array (no un solo valor) porque un sitio real típicamente tiene GA4 + GTM + Meta Pixel simultáneamente — no forzar a elegir uno.
- Confianza "alto" requiere 2+ señales fuertes o 1 señal inequívoca — nunca un solo header ambiguo sube a "alto".
- Gutenberg nunca es default implícito — necesita marcador positivo propio, mismo criterio aplicado a todos los ejes (no forzar respuesta sin señal).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
