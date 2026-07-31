# Project Research Summary

**Project:** Auditor Web (SEO/Técnico) — Lead Magnet para juan-tech.com
**Domain:** v1.6 — Meta Tags / Open Graph / Social preview + performance por página, agregado sobre un auditor SEO ya construido
**Researched:** 2026-07-31
**Confidence:** HIGH

## Executive Summary

v1.6 no es un producto nuevo: es una sexta categoría de checks ("Meta Tags/Social") y dos métricas de performance por página, montadas sobre un pipeline Crawlee/Cheerio/Prisma/Next.js ya validado en cinco milestones anteriores. La investigación confirma que casi todo lo que hace falta ya está disponible en el código existente: `response.timings` de got (vía Crawlee) para tiempo de respuesta, el `$` de Cheerio ya parseado una vez por página para leer tags OG/Twitter/favicon/charset, y el patrón de dedupe+cap+concurrencia ya usado en `linkChecker.ts` para verificar la `og:image`. La única dependencia de producción nueva es `image-size@2.0.2` (cero dependencias transitivas, MIT), usada sobre un `Range: bytes=0-65535` para leer dimensiones sin descargar la imagen completa. El panel de preview social se construye como mockup React/CSS con los design tokens existentes, nunca screenshots reales ni Chromium extra, preservando la restricción dura del proyecto de mantener Vercel libre de navegadores headless.

El riesgo real de v1.6 no es técnico sino de diseño de producto y de scoring. Existe una colisión directa con `ONPAGE-05` (el check actual que ya evalúa presencia de og:title/description/image/url en categoría `onpage`): si los checks nuevos no lo retiran o compensan, un sitio sin Open Graph pierde puntos dos veces y el peso efectivo del OG en el score general queda duplicado sin que nadie lo decidiera. Agregar una sexta categoría también exige rebalancear `CATEGORY_WEIGHTS` explícitamente: la función de scoring renormaliza en silencio si la suma no da 1.0, así que un olvido no rompe nada visiblemente, sólo corrompe la comparabilidad histórica de scores. Y el diff entre corridas (por fingerprint) va a mostrar cientos de "issues nuevos" falsos en la primera auditoría v1.6 de cualquier sitio ya auditado, salvo que se versione el catálogo de checks.

El enfoque recomendado: separar el trabajo en fases de riesgo ascendente, igual que en milestones previos. Primero el motor puro de extracción/umbrales (testeable con fixtures, sin infraestructura), luego las métricas de crawl (tocan `crawl.ts`, el único componente que ningún milestone anterior había modificado), después los checks de contenido, luego la categoría de scoring (el único cambio que mueve el score de auditorías existentes, debe ir casi al final con comparación de fixture antes/después), y por último la UI/preview/exports. Los pitfalls de comportamiento de plataformas (X cambió su formato de preview en 2023, LinkedIn cachea agresivamente, no hay límites oficiales de longitud de og:title/description) exigen tratar el panel como "aproximado", nunca como "así se ve", y nunca emitir severidad `critical` por longitud de texto.

## Key Findings

### Recommended Stack

Una sola dependencia nueva de producción: `image-size@2.0.2`, para leer ancho/alto/formato de la `og:image`/`twitter:image` remota a partir de un buffer parcial (Range request de 64 KB). Todo lo demás se construye sobre lo ya instalado.

**Core technologies:**
- `image-size@2.0.2` — dimensiones de imagen social vía buffer parcial — cero dependencias, API v2 acepta `Buffer` directo, cubre JPEG/PNG/WebP/GIF/AVIF/SVG/ICO
- Cheerio (ya instalado) — parseo de OG/Twitter/favicon/charset/viewport — reusa el mismo `$` que ya recibe el pipeline de checks, sin segundo parseo (invariante ARCH-03 del repo)
- `got` timings vía Crawlee (transitiva, ya instalada) — response time/TTFB por página sin request extra — `response.timings.phases.{firstByte,total}` ya existe en `CheerioCrawlingContext`
- `Buffer.byteLength` (Node stdlib) — tamaño de HTML sin comprimir — gratis, el body ya está materializado en `crawl.ts`
- React + design tokens existentes — panel de preview social como mockup CSS, no captura real — patrón que usa toda la competencia (metatags.io, opengraph.io)

**Supporting:** fetch/`AbortController` propio (Node 20+ stdlib) para el probe de imagen con `Range`; `zod` (ya en el stack) opcional para validar el JSON persistido.

### Expected Features

**Must have (table stakes) — v1.6:**
- Checks de meta/social por página: og:title/description/image/url, og:type, duplicados de tags, twitter:card, charset, favicon
- Retiro/migración de ONPAGE-05 con guardarraíl anti-duplicados
- Categoría "social" en el scoring con decisión explícita de pesos
- Response time + HTML size por página, con umbrales de severidad
- Panel de preview: Google + Facebook/LinkedIn (comparten layout 1.91:1) + X/Twitter — 3 layouts
- Snippets HTML de fix prellenados con valores reales de la página
- Validación de og:image alcanzable + dimensiones + peso, con dedupe por URL

**Should have (competitivo, defer a v1.6.x/v1.7):**
- Previews de WhatsApp/Discord/Slack/Telegram (mismo layout base, sólo CSS)
- Snippets de fix por CMS vía `cms-adapters` (motor ya existe desde v1.5)
- Issue agregado de og:image por defecto compartida en todo el sitio
- Favicon alcanzable (más allá de presencia)

**Defer (v2+):** generador de og:image, editor de preview interactivo, validación de og:video/og:audio, comparación contra competidores.

**Diferencial de mercado (verificado contra competidores):** todas las herramientas de OG conocidas (opengraph.to, opengraph.io, Meta Tags.io) son single-URL; Ahrefs es site-wide pero de pago y sin preview visual. El hueco defendible es preview visual + snippet de fix a escala de sitio completo (500 URLs) en el free tier.

### Architecture Approach

El diseño separa dos capas: un motor puro nuevo (`packages/meta-social`) que extrae `SocialMeta` del `$` de Cheerio, define umbrales y genera snippets, sin dependencias de db/crawler/checks, igual que `packages/fingerprint`; y los checks dentro del paquete `packages/checks` existente (`src/checks/social/`), que consumen ese motor y producen `IssueDraft`. Response time/HTML size se capturan en el mismo `requestHandler` de `crawl.ts` que ya existe, sin fetch adicional. Las dimensiones de `og:image` se resuelven con un `NetworkCheck` que deduplica por URL de imagen (no por página) y reusa el patrón cap+concurrencia de `linkChecker.ts`. Todo lo derivado se persiste una vez (`Page.socialMeta`, `Page.ttfbMs`, etc.) y se resuelve en lectura dentro de `buildReportModel`, que sigue siendo la única fuente de verdad para web/PDF/Markdown/PPTX.

**Componentes mayores:**
1. `packages/meta-social` (nuevo) — extracción de tags, umbrales, generación de snippets — puro, sin dependencias de runtime salvo Cheerio
2. `packages/checks/src/checks/social/` (nuevo, dentro de paquete existente) — checks de página, sitio y red que consumen `meta-social`
3. `packages/crawler/src/crawl.ts` (modificado) — captura `ttfbMs`/`responseMs`/`htmlBytes` en el fetch existente
4. `packages/scoring` (modificado) — nueva categoría `"social"` + rebalanceo de `CATEGORY_WEIGHTS`
5. `packages/report-model` (modificado) — `buildMetaSnippet`, `buildSocialPreview`, `buildPagePerf`, resueltos en lectura

### Critical Pitfalls

1. **Doble penalización por ONPAGE-05** — decidir explícitamente retirar/reducir/compensar el check existente antes de escribir los nuevos; verificación mecánica con test de registry.
2. **Rebalanceo silencioso de `CATEGORY_WEIGHTS`** — la función de score renormaliza sin fallar si la suma ≠ 1.0; agregar test de suma = 1.0 y registrar el delta del fixture antes/después.
3. **Dilución del health-ratio con checks que casi siempre pasan** — checks triviales (charset, viewport) inflan el score a 90+ para todo el mundo; convertirlos en site-level o excluirlos del score.
4. **Response time contaminado por el rate limiter del propio crawler** — medir sólo la transacción HTTP vía `got` timings, descartar reintentos, nunca cronómetro manual alrededor del handler.
5. **Diff entre corridas lleno de ruido** en la primera auditoría v1.6 (fingerprints nuevos aparecen como "nuevo", ONPAGE-05 retirado aparece como "resuelto") — versionar el catálogo de checks y avisarlo en la UI del historial.

## Implications for Roadmap

### Phase 1: Motor puro `packages/meta-social`
**Rationale:** cero infraestructura, 100% testeable con fixtures, riesgo cero. Espeja el patrón de fases previas (fingerprint primero en v1.5).
**Delivers:** tipos `SocialMeta`, `extractSocialMeta($)`, umbrales de dimensiones/longitud, `buildMetaSnippet()`.
**Addresses:** base de todos los checks de meta/social del milestone.
**Avoids:** Pitfall 5 (selector property/name), Pitfall 10 (umbrales de longitud como reglas duras) — se resuelven acá con fixtures de Yoast/RankMath/Shopify/Webflow/Next.js.

### Phase 2: Métricas de crawl (response time + HTML size)
**Rationale:** toca `crawl.ts`, el único componente que ningún milestone anterior modificó — aislarla temprano, con smoke test de re-crawl. Independiente de la Fase 1, podría paralelizarse.
**Delivers:** columnas nullable `ttfbMs`/`responseMs`/`htmlBytes` en `Page`, captura en el `requestHandler` existente sin request extra.
**Uses:** `response.timings` de got (transitiva de Crawlee), `Buffer.byteLength`.
**Avoids:** Pitfall 8 (response time sesgado por el rate limiter), Pitfall 9 (HTML size ambiguo sin distinguir comprimido/sin comprimir).

### Phase 3: Checks de meta/social + validación de og:image
**Rationale:** necesita el motor (Fase 1) y las columnas de perf (Fase 2). Genera los issues pero todavía sin categoría de score, para no acoplar dos cambios de riesgo distinto.
**Delivers:** `checks/social/*` (OG, twitter:card, favicon, charset/viewport), probe de imagen con dedupe+cap+Range, persistencia de `socialMeta`.
**Implements:** `NetworkCheck` de dimensiones con el patrón de `linkChecker.ts`/`brokenResourcesCheck`.
**Avoids:** Pitfall 4 (favicon como page-level en vez de site-level), Pitfall 6 (og:image relativa/múltiple/fallback de Twitter), Pitfall 7 (un request por imagen sobre 500 URLs).

### Phase 4: Categoría de scoring + report-model
**Rationale:** único cambio que mueve el score de auditorías existentes, debe llegar después de que los datos existan, con comparación de fixture antes/después, lo más tarde posible.
**Delivers:** `Category` con `"social"`, `CATEGORY_WEIGHTS` rebalanceado, los tres `CATEGORY_ORDER` sincronizados, `ReportIssue.snippet`, `socialPreview`/`pagePerf` en el modelo.
**Addresses:** decisión explícita de pesos y de qué pasa con ONPAGE-05, resolviendo Pitfalls 1, 2, 3, 13.

### Phase 5: UI + exports
**Rationale:** puramente presentación sobre un modelo ya estable; v1.5 demostró que los exports salen casi gratis si el modelo es la única fuente.
**Delivers:** panel de preview social (Google/FB+LinkedIn/X), tabla de perf por página, botón copiar snippet, `CATEGORY_LABEL` sincronizado en los dos archivos de labels.
**Avoids:** Pitfall 11 (preview vendido como fiel a la plataforma), Pitfall 12 (XSS/SSRF/CSP con contenido de terceros), Pitfall 14 (categoría ausente en algún export).

### Phase Ordering Rationale

- Fases 1 y 2 son independientes entre sí (podrían paralelizarse); Fase 3 necesita ambas; Fase 4 necesita 3; Fase 5 necesita 4.
- La regla que gobierna el orden: la única fase que altera un número ya validado (el score general histórico) llega lo más tarde posible, con todo lo demás en su lugar y testeado.
- Esto replica el patrón de riesgo ascendente que ya funcionó en v1.2 y v1.5 del mismo proyecto.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (scoring):** decisión de producto de Juan sobre el peso exacto de la categoría nueva y qué hacer con ONPAGE-05 — no es investigable, es una decisión a validar antes de codificar.
- **Phase 5 (UI/preview):** verificar en el momento de implementar el formato vigente de preview de cada plataforma (X cambió el suyo en 2023-2024; LinkedIn cachea) — dato de vida corta, no confiar en este research.

Phases with standard patterns (skip research-phase):
- **Phase 1 (motor puro):** patrón ya establecido en el repo (`fingerprint`, `cms-adapters`); fixtures conocidos.
- **Phase 2 (métricas de crawl):** API de `got`/Crawlee ya verificada en los `.d.ts` instalados.
- **Phase 3 (checks + probe de imagen):** reusa `linkChecker.ts`/`brokenResourcesCheck` tal cual.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verificado contra código del repo y tipos de dependencias instaladas; única incertidumbre es las specs de X (docs oficiales devolvieron 402, se usaron fuentes secundarias cruzadas, MEDIUM) |
| Features | MEDIUM-HIGH | Catálogo de checks y specs de plataforma HIGH; fórmulas de score de competidores MEDIUM (nadie publica su algoritmo); taxonomía error/warning MEDIUM (derivada por convergencia, no estándar) |
| Architecture | HIGH | Puntos de integración leídos directamente del código (`crawl.ts`, `registry.ts`, `build.ts`, `overallScore.ts`, `schema.prisma`); umbrales de dimensiones OG y peso de categoría MEDIUM/LOW (consenso de industria, no calibrado) |
| Pitfalls | HIGH en arquitectura (verificados contra el código de este repo); MEDIUM en comportamiento de plataformas (Facebook/X/LinkedIn no documentan límites y cambian sin aviso) |

**Overall confidence:** HIGH

### Gaps to Address

- **Peso exacto de la categoría "social" en `CATEGORY_WEIGHTS`** — el 0.10 propuesto (tomado de onpage y schema) es un punto de partida, no un valor calibrado; requiere decisión explícita de Juan antes de la Fase 4.
- **Destino de ONPAGE-05** (retirar / reducir / mantener y compensar peso) — bloquea el diseño del catálogo de checks de la Fase 3; debe quedar escrito en Key Decisions antes de codificar.
- **Confirmación en runtime de `response.timings`** — el tipo lo garantiza pero no se probó contra una corrida real; se cierra en minutos durante la Fase 2 contra juan-tech.com.
- **Carga de imágenes de terceros en el reporte** (proxy vs miniatura persistida vs placeholder) — no hay CSP configurada hoy en `apps/web/next.config.ts`, pero conviene decidir la estrategia antes de la Fase 5 por hotlinking/SSRF/privacidad.
- **Formato vigente de preview de cada plataforma** — dato de vida corta (X cambió el suyo recientemente); verificar en el momento de implementar la Fase 5, no confiar en este documento.

## Sources

### Primary (HIGH confidence)
- `/image-size/image-size` (Context7) — API v2, formatos soportados
- `/diegomura/react-pdf` (Context7) — limitación de formatos JPEG/PNG en `@react-pdf/image`
- [Facebook Sharing — Webmasters/Images](https://developers.facebook.com/docs/sharing/webmasters/images/) — dimensiones, ratio, peso máximo
- [Google Search Central — Favicon in Search](https://developers.google.com/search/docs/appearance/favicon-in-search) — reglas oficiales de favicon
- Código del repo (lectura directa): `packages/crawler/src/crawl.ts`, `packages/checks/src/checks/onpage/openGraph.ts`, `packages/checks/src/checks/network/linkChecker.ts`, `packages/scoring/src/overallScore.ts`, `packages/report-model/src/build.ts`, `packages/db/prisma/schema.prisma`, `apps/web/next.config.ts`
- `node_modules/.pnpm/@crawlee+http@3.17.0` y `got@14.6.6` `.d.ts` — timings de respuesta HTTP
- npm registry (consultado 2026-07-31) — versiones exactas de `image-size`, `probe-image-size`, `sharp`

### Secondary (MEDIUM confidence)
- [Twitter Card Image Size Guide (opengraphplus)](https://opengraphplus.com/consumers/twitter/images) y [Twitter Image Specs 2026 (soona)](https://soona.co/image-resizer/twitter-spec-guide) — specs de X (docs oficiales devolvieron 402)
- [OpenGraph.to](https://www.opengraph.to/) y [OpenGraph.io](https://www.opengraph.io/og-test) — producto de referencia del milestone, fórmula de score no publicada
- [Social Media Today — cambios de formato de preview de X](https://www.socialmediatoday.com/news/xs-updated-link-preview-format-removes-headlines-descriptions/695681/) — prensa especializada, dos fuentes coincidentes
- [Ahrefs — Open Graph Meta Tags guide](https://ahrefs.com/blog/open-graph-meta-tags/) — tags requeridos vs recomendados

### Tertiary (LOW confidence)
- [OGTester](https://ogtester.com/blog/what-is-maximum-length-of-og-title-and-og-description) y [Letter Counter](https://lettercounter.org/blog/og-title-character-limit/) — límites de longitud de og:title/description, fuentes se contradicen entre sí (60-70 vs 40-50 caracteres); tratar como orientativo, nunca como regla dura

---
*Research completed: 2026-07-31*
*Ready for roadmap: yes*
