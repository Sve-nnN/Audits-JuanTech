# Stack Research — v1.5 (fingerprinting de stack técnico + fixes personalizados por CMS)

**Domain:** Fingerprinting de tecnología web (CMS/builder/CDN/hosting/framework JS/analytics) sin servicios pagos de terceros, más motor de recomendaciones adaptador-por-CMS, agregado sobre el crawler Crawlee/Cheerio y el pipeline de checks ya existentes.
**Researched:** 2026-07-21
**Confidence:** MEDIUM — la recomendación central (construir un motor de firmas propio en vez de adoptar una librería empaquetada) es HIGH confidence; las afirmaciones puntuales sobre firmas de tecnologías concretas (headers/paths/cookies) son de fuentes web cruzadas, MEDIUM confidence.

> Nota: reemplaza el `STACK.md` de v1.3 (árbol de arquitectura/Lighthouse diagnostics/template grouping), que ya fue implementado y archivado. Este documento es la investigación de stack para el milestone activo v1.5.

## Recommended Stack

### Core Technologies

No se necesita ningún framework nuevo. La decisión correcta para este milestone es **no** adoptar una librería de detección de terceros completa, sino agregar un módulo propio de matching de firmas dentro del pipeline ya existente — porque toda opción empaquetada disponible hoy está muerta, licenciada GPL, o es una API paga, lo cual choca con el requisito explícito del milestone ("fingerprint propio, sin servicios pagos de terceros").

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Paquete nuevo `packages/fingerprint` (workspace propio, TypeScript plano, sin runtime deps nuevas de peso) | n/a | Motor de matching de firmas: evalúa un set curado de firmas contra `{ headers, html, cookies, scriptSrc, metaGenerator }` ya producido por el crawl, por página o por sitio | Cada opción de "instalar y listo" falla al menos una restricción dura (ver Alternatives / What NOT to Use). Un matcher de ~150-300 líneas sobre la pasada de Cheerio que `packages/checks` ya hace es la única opción simultáneamente gratuita, limpia en licencia, y acotada a las ~40-60 tecnologías que este proyecto realmente necesita (no las ~7.500 de Wappalyzer). Esto calca el patrón que el propio proyecto ya estableció: `packages/checks/src/registry.ts` ya corre un arreglo de objetos de check tipados (`PageCheck`/`SiteCheck`/`NetworkCheck`) sobre una única pasada de `cheerio.load()` por página — un módulo de fingerprint es estructuralmente el mismo tipo de registry, sólo que produce un `TechStack` en vez de `IssueDraft`s. |
| `set-cookie-parser` | 3.1.2 | Parsear los headers `Set-Cookie` crudos de la respuesta en objetos estructurados `{ name, value, domain, path }` | El fingerprinting de CDN/CMS/analytics depende mucho de nombres de cookies (`__cf_bm`/`__cfduid` → Cloudflare, `_shopify_s`/`_secure_session_id` → Shopify, `wp-settings-*`/`wordpress_logged_in_*` → WordPress, `_wixCIDX`/`XSRF-TOKEN` en Wix, `_ga`/`_gid` → GA). Crawlee/got-scraping expone el `Set-Cookie` crudo como array de strings en la respuesta; parsearlo bien (múltiples cookies, atributos) es un problema ya resuelto que no vale la pena reinventar. Mantenida activamente, cero dependencias, encaja con el patrón ya usado en el proyecto de "librería de soporte chica y enfocada" (`fast-xml-parser`, `robots-parser`). Verificado directo contra el registro de npm (versión actual, sin deprecar). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cheerio` (ya es dependencia) | 1.2.0 (pinneada, igual que en `packages/checks`/`packages/crawler`) | Extraer `<meta name="generator">`, atributos `src` de `<script>`, `href` de `<link>`, cuerpos de `<script>` inline (para matchear strings de `dataLayer`/`gtag`/`fbq`), y marcadores del DOM (ej. `data-wf-page`, `.elementor`, `.et_pb_*`, `.vc_row`) | Reusar el mismo `$` ya cargado una vez por página dentro de `runAllChecks` (por `ARCH-03` — "no re-parseo de HTML en ningún otro lado"). El fingerprint debe engancharse en ese loop existente como una pasada más sobre el mismo `$`, no abrir un segundo parseo. |
| Matcher de firmas basado en regex (escrito a mano, sin librería) | n/a | Matchear `headers`, strings de `html`/`meta`/`scriptSrc`, y nombres de cookies contra objetos de firma por tecnología (`{ id, category, headers?, html?, scriptSrc?, cookies?, metaGenerator? }`) | Este es el "motor" real — deliberadamente no el motor de `wappalyzer-core` (ver abajo). Una firma es simplemente `{ pattern: RegExp, confidence: number }` por campo; el matching es `Object.entries(signatures).filter(sig => testSignature(sig, evidence))`. Suficientemente simple como para que importar un motor añada más riesgo (licencia, dependencias sin mantener) del que ahorra trabajo. |
| Dataset de firmas propio y curado (JSON/TS de primera mano, ~40-60 entradas) | n/a | Las reglas de fingerprint reales para: CMS (WordPress, Shopify, Webflow, Wix, Squarespace, Ghost, Joomla, Drupal), builders de WordPress (Elementor, WPBakery/`js_composer`, Divi/`et_pb_*`, Oxygen), CDN/proxy (Cloudflare, Fastly, Akamai, Vercel, Netlify, CloudFront), frameworks JS (React, Next.js, Vue, Nuxt, Angular — vía `__NEXT_DATA__`, `data-reactroot`, `__nuxt`, `ng-version`), analytics/tag managers (GA4, GTM, Meta Pixel, Hotjar) | Escribirlas desde investigación propia de los headers/meta tags/dominios de CDN de assets/nombres de cookies conocidos de cada plataforma (la sección Sources de este documento ya deja señales concretas para CDNs y builders de WP como punto de partida). **No** copiar el archivo `technologies.json` de `enthec/webappanalyzer` textual al repo — ver nota de licenciamiento en "What NOT to Use". Leer ese dataset público como referencia para verificar las firmas propias está bien; vendorizar su archivo de datos GPL-3.0 dentro del árbol de fuentes de un producto propietario es lo que hay que evitar. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Ninguna nueva | — | No se necesita tooling de dev/build nuevo; esto se envía como un paquete de workspace TS plano siguiendo las convenciones ya existentes de `packages/checks` (Vitest para tests, `tsc --noEmit` para typecheck). |

## Installation

```bash
# Única dependencia de runtime genuinamente nueva en todo el milestone:
pnpm --filter @auditor/fingerprint add set-cookie-parser@3.1.2

# Todo lo demás (cheerio, crawlee) ya está instalado en las versiones que
# asume esta investigación (cheerio@1.2.0, @crawlee/cheerio@3.17.0) — sin bump necesario.
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Motor de firmas propio + dataset de firmas propio curado | `wappalyzer-core` (npm) + traer el `technologies.json` de `enthec/webappanalyzer` en build/runtime | Sólo si Juan decide explícitamente que la cobertura de ~7.500 tecnologías vale (a) sumar código y datos licenciados GPL-3.0 dentro de un producto comercial, y (b) el riesgo de mantenimiento continuo de un fork comunitario no oficial sin paquete npm propio (habría que traer/vendorizar el JSON crudo desde GitHub a mano, sin pinning de versión vía npm). No recomendado para un proyecto cuyo objetivo declarado son 5 categorías puntuales (CMS/builder, CDN, hosting, framework JS, analytics) — la cobertura completa de Wappalyzer resuelve un problema mucho más grande del que tiene este milestone. |
| Motor de firmas propio | API paga de Wappalyzer (`wappalyzer.com/api`) | Nunca para este proyecto — explícitamente fuera de alcance según el brief del milestone ("sin servicios pagos de terceros"), y reintroduce una dependencia externa por request/costo sobre una herramienta gratuita tipo lead magnet que ya escala a 500 URLs/auditoría. |
| Motor de firmas propio | `@ryntab/wappalyzer-node` u otros wrappers comunitarios | Estos envuelven el mismo motor/dataset GPL-3.0 de `wappalyzer-core` (algunos además levantan Puppeteer por default en modo "browser") — mismo problema de licencia que arriba, más peso extra (Puppeteer) que la pasada Cheerio-first de este proyecto no necesita. |
| Curar dataset de firmas propio (~40-60 entradas) | Vendorizar un subconjunto del `technologies.json` de `enthec/webappanalyzer` directamente | Si el tiempo de entrega importa más que la higiene de licenciamiento y Juan está cómodo con las obligaciones de GPL-3.0 sobre ese archivo de datos (una pregunta legal poco clara de "dato vs. código" — vale una consulta rápida a quien maneje temas legales de juan-tech.com si se toma este camino en un producto comercial). El default más seguro es escribir las propias regex desde investigación de primera mano de cada plataforma, usando el dataset público sólo como verificación cruzada, no como fuente de copia. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `wappalyzer-core` (npm) | Marcado explícitamente `DEPRECATED` en el registro de npm desde la v6.10.66 (sin mantenimiento desde agosto 2023, cuando Wappalyzer puso su API detrás de un paywall); motor y dataset licenciados GPL-3.0, ambos sin actualizaciones upstream desde que el vendor se volvió comercial. Confirmado vía consulta directa `npm view wappalyzer-core` al registro. | Motor de firmas propio (recomendación central de este documento) |
| Cualquier API paga de detección de tecnología (Wappalyzer API, BuiltWith API, etc.) como dependencia por request de auditoría | El brief del milestone la descarta explícitamente; además reintroduce riesgo de costo/rate-limit por request en una herramienta que ya corre auditorías gratis sobre hasta 500 URLs/semana/email — el mismo razonamiento que ya descartó Domain Rating (Ahrefs) como input puntuado en v1.0. | Motor de firmas propio contra datos ya capturados por el crawl |
| Correr un navegador headless (Playwright) sólo para fingerprintear stack (ej. leer `window.dataLayer`, `window.gtag`) en cada página | Este proyecto ya restringe Playwright a una muestra chica para el veredicto de render (`MAX_RENDER_PAGES=10`, según `RENDER-01..03`) precisamente porque cuesta 5-10x más que Cheerio. Fingerprintear desde HTML/headers/cookies crudos cubre la gran mayoría de señales de CMS/CDN/hosting/analytics (las URLs de `src` de script y las llamadas inline `gtag(`/`fbq(`/`dataLayer.push(` son visibles en el HTML crudo para la enorme mayoría de sitios) sin tocar el presupuesto de render. | Fingerprintear desde la pasada Cheerio ya existente (headers/html/meta/scriptSrc/cookies) en cada página; recurrir al DOM ya renderizado de la muestra existente (reusando las páginas de veredicto de render, no una pasada nueva de Playwright) sólo para el caso raro de HTML crudo vacío/shell de CSR. |
| Vendorizar el `technologies.json` de `enthec/webappanalyzer` textual en este repo | Archivo de datos licenciado GPL-3.0; commitearlo en un codebase propietario/comercial levanta una pregunta real (aunque debatida) de copyleft, y no hay paquete npm oficial para pinnearlo/versionarlo de forma limpia de todos modos — habría que scrapear contenido crudo de GitHub para el build. | Escribir firmas propias para las ~40-60 tecnologías que este proyecto puntúa, usando docs públicas/headers/nombres de cookies como insumo de investigación (no como artefacto copiado) |

## Stack Patterns by Variant

**Punto de integración del fingerprinting:**
- Extender el `requestHandler` de `packages/crawler/src/crawl.ts` para capturar `response.headers` (ya disponible en el objeto `response` de Crawlee/got-scraping, hoy descartado) y el header `Set-Cookie` crudo, al menos para el request de la página de inicio/depth-0 — el crawl hoy persiste `title`/`statusCode`/`html`/`contentType`/`redirectChain` pero ningún header ni cookie, así que esto es captura de datos nueva, no sólo procesamiento nuevo.
- Agregar campos para persistir esto: ya sea una columna `Page.responseHeaders Json?` (si importa la variación por página, ej. distinto CDN detrás de distintos paths) o un único snapshot `Audit.techStack Json?` computado una vez desde la página de inicio (más simple, y encaja con cómo el brief del milestone describe la feature: "tabla de stack detectado al inicio del reporte", una tabla a nivel sitio, no por página). Se recomienda esto último para el alcance de v1.5 — computarlo una vez desde la respuesta + HTML de la home ya resuelta, mantenerlo simple, revisar variación por página sólo si auditorías reales lo muestran (ej. un CDN sólo delante de algunos subpaths).
- Correr el módulo de fingerprint nuevo como una pasada más dentro del loop por página de `cheerio.load()` que `runAllChecks` ya tiene (`packages/checks/src/registry.ts`), reusando el mismo `$` — no agregar un segundo parseo de HTML.

**Patrón del motor de recomendaciones adaptador-por-CMS:**
- Seguir el mismo idioma que ya usa `packages/checks/src/registry.ts` (arreglos/mapas de objetos tipados con una función `run()`/`recommend()`, no clases) en vez de introducir herencia OOP — el codebase de este proyecto es functional-registry-style de punta a punta (`pageChecks`, `siteChecks`, `networkChecks` como arreglos), y el patrón adaptador debería leerse como "un registry más", no como un paradigma nuevo.
- Concretamente: un mapa `Record<CmsId, CmsAdapter>` (`wordpress`, `shopify`, `webflow`, `wix`, `squarespace`, `generic`) donde cada `CmsAdapter` implementa `recommend(issue: IssueDraft, ctx: { techStack: TechStack }): string | null` — devolviendo un string de instrucciones específico del CMS (ej. "en WordPress, agregá el alt text desde el editor de medios…") o `null` para dejar pasar al fallback.
- Dispatch: `(adapters[detectedCms] ?? adapters.generic).recommend(issue, ctx)` — el adapter `generic` no es opcional ni un afterthought, es una entrada de primera clase en el mismo mapa, garantizando que cada issue siempre reciba una recomendación aunque la detección de CMS sea nula o de baja confianza.
- Como un CMS se detecta una vez por auditoría (no por página), pasar el `TechStack` detectado hacia abajo a través del mismo objeto `siteCtx` que `runAllChecks` ya inyecta en cada check (`{ pages, origin, robotsTxt, sitemapUrls, depthByUrl, renderVerdictByPageId }` → agregar `techStack`), en vez de crear un camino nuevo de parámetros.

**Si el builder de WordPress no se puede identificar con confianza (sin marcadores de Elementor/WPBakery/Divi/Oxygen):**
- Caer a un nivel de adapter genérico "WordPress" (no al fallback totalmente genérico) — instrucciones específicas de WordPress ("desde el editor de bloques / Gutenberg…") siguen siendo más útiles que el fallback genérico total aunque no haya granularidad a nivel de builder.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `set-cookie-parser@3.1.2` | Node 18+ (ya es el baseline del proyecto) | Cero dependencias; sin conflictos de peer range. |
| Paquete nuevo `packages/fingerprint` | `cheerio@1.2.0`, modelos Prisma `Page`/`Audit` existentes | Debe agregarse como paquete de workspace consumido por `packages/checks` y/o `apps/worker`, siguiendo el mismo límite de "sin dependencias de navegador filtrándose al bundle de Vercel" ya reforzado para exports (`assert:web-boundary`) — este módulo no tiene dependencias de navegador/Playwright, así que es seguro en ambos lados, pero mantenerlo en `packages/` (no directo en `apps/web`) para preservar la simplicidad de ese chequeo. |
| `wappalyzer-core@6.10.66` (si se reconsidera alguna vez) | GPL-3.0, deprecado, sin publicaciones npm activas desde 2023 | Explícitamente no recomendado — listado acá sólo para dejar registro de por qué se descartó (ver What NOT to Use). |

## Sources

- Registro de npm, consulta directa (`npm view wappalyzer-core`, verificado 2026-07-21) — confirma `DEPRECATED`, licencia `GPL-3.0`, última publicación "hace más de un año" (dist-tag `latest` 7.0.3) — HIGH confidence (consulta directa al registro, fuente primaria)
- Registro de npm, consulta directa (`npm view set-cookie-parser`, `npm view cheerio`, `npm view crawlee`, verificado 2026-07-21) — versiones actuales 3.1.2 / 1.2.0 / 3.17.0, las últimas dos coincidiendo con lo ya pinneado en este proyecto — HIGH confidence (consulta directa al registro)
- [enthec/webappanalyzer](https://github.com/enthec/webappanalyzer) (README + CONTRIBUTING, consultado 2026-07-21) — licencia GPL-3.0, schema de `technologies.json` (`cats`, `website` requeridos; `headers`/`meta`/`scriptSrc`/`cookies`/`dom`/`js`/`css`/`dns`/`certIssuer`/`implies` como campos de patrón opcionales), sin paquete npm oficial documentado — MEDIUM confidence (docs del repo oficial, pero resumen vía scrape de página, no lectura manual completa)
- [Wappalyzer Paywalled Itself in 2023 — the OSS-Powered Replacement (DEV Community)](https://dev.to/nexgendata/wappalyzer-paywalled-itself-in-2023-heres-the-oss-powered-replacement-3i01) — contexto del evento de paywall de 2023 y los forks comunitarios (`enthec/webappanalyzer`, `tunetheweb/wappalyzer`, `dochne/wappalyzer`) — MEDIUM confidence (resumen de tercero, cruzado contra el repo oficial directamente para las afirmaciones de schema/licencia)
- Resultados de búsqueda web sobre firmas de headers de CDN (Cloudflare `Server: cloudflare`/`CF-Ray`/`__cf_bm`; Fastly `X-Served-By`/`X-Cache`; Akamai `X-Check-Cacheable`/`X-Akamai-Transformed`) — MEDIUM confidence (agregado de múltiples fuentes independientes de blogs de herramientas de detección, consistentes entre sí y con el comportamiento de headers públicamente documentado de cada vendor de CDN)
- Resultados de búsqueda web sobre firmas DOM de builders de WordPress (clases `et_pb_*`/`elementor-*` de Elementor/Divi, clases `vc_row`/`vc_column`/`wpb_wrapper` de WPBakery + path de asset `/js_composer/` + meta tag `generator`, comentario `<!-- Oxygen Builder -->` de Oxygen) — MEDIUM confidence (fuentes de blog/comunidad agregadas; no verificado de forma independiente contra instalaciones de WordPress reales en esta pasada de investigación — marcar para verificación puntual contra 2-3 sitios reales por builder durante la implementación)
- `packages/crawler/src/crawl.ts`, `packages/checks/src/registry.ts`, `packages/db/prisma/schema.prisma` (leídos directamente de este repo, 2026-07-21) — confirman la arquitectura actual de crawl/checks/persistencia y el gap de integración puntual (hoy no se persisten headers ni cookies) — HIGH confidence (fuente primaria: el codebase real)

---
*Stack research for: fingerprinting de stack técnico + recomendaciones personalizadas por CMS (milestone v1.5)*
*Researched: 2026-07-21*
