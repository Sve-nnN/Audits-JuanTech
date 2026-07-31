# Stack Research — v1.6 (Meta Tags / Open Graph / Social + performance por página)

**Domain:** Auditoría profunda de meta tags sociales (Open Graph, Twitter Card, favicon, charset/viewport), validación de la imagen social remota, panel visual de preview social, y métricas de performance por página (response time, HTML size) no derivadas de PSI/Lighthouse. Todo agregado sobre el pipeline Crawlee/Cheerio + checks + report-model ya existente.
**Researched:** 2026-07-31
**Confidence:** HIGH — la recomendación central (casi cero dependencias nuevas: una sola librería, `image-size`, más código propio sobre lo ya instalado) está verificada contra el código del repo y contra los tipos de las dependencias ya instaladas. Las especificaciones de plataforma (Facebook, Google, X) vienen de docs oficiales salvo las de X, que están MEDIUM (docs oficiales devolvieron 402; se usaron fuentes secundarias cruzadas).

> Nota: reemplaza el `STACK.md` de v1.5 (fingerprinting + fixes por CMS), ya implementado y archivado. Este documento es la investigación de stack para el milestone activo v1.6.

## Resumen de la decisión

**Una sola dependencia nueva de producción: `image-size@2.0.2`.** Todo lo demás se construye sobre lo que el monorepo ya tiene instalado y validado:

- **Parseo de OG/Twitter/favicon/charset/viewport** → Cheerio, ya presente en `packages/checks` y ya parseado una vez por página en el pipeline de checks. No hace falta nada nuevo.
- **Response time + HTML size** → ya están disponibles gratis en el `requestHandler` de `packages/crawler/src/crawl.ts` (`response.timings.phases` de got + longitud en bytes del body). Cero requests extra, cero dependencias.
- **Preview social** → componentes React con los design tokens existentes. Es exactamente lo que hacen las herramientas del mercado (mockup HTML/CSS, no captura real). Cero Chromium, no rompe el boundary de Vercel.
- **Snippets de fix HTML** → strings/plantillas en `packages/checks` (o en `packages/cms-adapters` si se quiere variante por CMS). Cero dependencias.

Lo único que no se puede resolver con lo instalado es leer las dimensiones reales de la `og:image` remota, y eso necesita `image-size`.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **`image-size`** | 2.0.2 | Leer ancho/alto/tipo de la `og:image` / `twitter:image` remota a partir de los primeros bytes del archivo | Es la única pieza realmente nueva. Cero dependencias, MIT, sync, y su API v2 acepta directamente un `Buffer`/`Uint8Array` — que es exactamente lo que necesitamos: nosotros controlamos el `fetch` con `Range: bytes=0-65535`, le pasamos el buffer parcial y obtenemos dimensiones sin bajar la imagen completa. Lee sólo cabeceras, nunca decodifica el píxel. Cubre todos los formatos que aparecen en la vida real como `og:image`: JPEG, PNG, WebP, GIF, AVIF/HEIC, SVG (usa `viewBox`), ICO/CUR, BMP, TIFF, PSD, JPEG-XL. HIGH confidence: docs oficiales del repo vía Context7, verificadas contra la versión publicada hoy en el registry. |
| **Cheerio (ya instalado)** | ^1.2.0 | Parsear `<meta property="og:*">`, `<meta name="twitter:*">`, `<link rel="icon">`/`apple-touch-icon`/`manifest`, `<meta charset>`, `<meta name="viewport">` | Ya está en `packages/checks` y el pipeline de checks ya recibe un `$` parseado por página (ver la firma `run({ page, $ })` en `packages/checks/src/checks/onpage/openGraph.ts`). Todo lo que v1.6 necesita extraer del `<head>` son selectores CSS triviales sobre ese mismo `$`. Agregar un parser distinto duplicaría el parseo del HTML sin ganar nada — y el proyecto ya tiene la regla explícita de "un solo parseo de HTML" (ARCH-03, comentada en `crawl.ts:120`). |
| **`got` timings vía Crawlee (ya instalado, transitiva)** | got 14.x bajo `@crawlee/http@3.17.0` | Response time real por página (TTFB y total) | **Verificado en el repo:** `CheerioCrawlingContext.response` es `PlainResponse` de got-scraping (`@crawlee/http/internals/http-crawler.d.ts:149`), y `PlainResponse` expone `timings: Timings` con `phases.firstByte` (TTFB), `phases.download`, `phases.total`, `phases.dns`, `phases.tcp`, `phases.tls` (`got/dist/source/core/response.d.ts:55-68`). O sea: la métrica de "response time por página" ya está en la mano dentro del `requestHandler` actual, sin request extra y sin instalar nada. Esta es la diferencia clave contra PSI/CWV, que sólo cubren una muestra y sólo con datos de laboratorio/campo de Google. |
| **`Buffer.byteLength` (Node stdlib)** | — | HTML size por página | El body ya se materializa en `crawl.ts:114` (`const html = ... body?.toString("utf-8")`). `Buffer.byteLength(html, "utf8")` da el tamaño descomprimido; el header `content-length` de la respuesta da el tamaño transferido (comprimido) cuando el servidor lo manda. Reportar ambos es más honesto que reportar uno solo: "1.2 MB de HTML servido en 180 KB comprimidos" es un hallazgo distinto a "1.2 MB sin comprimir". Cero dependencias. |
| **React + design tokens existentes** | — | Panel de preview social (Google / X / Facebook / LinkedIn) | Verificado contra el mercado: las herramientas de referencia (metatags.io, opengraph.io, los previewers de Toolsana y similares) renderizan **mockups estáticos de HTML/CSS parametrizados con los meta tags leídos**, no capturas reales de la plataforma. Nadie hace screenshot real: sería lento, caro, y las plataformas no exponen un endpoint de render. Esto encaja perfecto con la restricción dura del proyecto ("Chromium fuera del bundle de Vercel"): el preview es JSX + CSS con los tokens del design system, se renderiza en el server component del reporte y no toca un navegador headless nunca. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `undici` / `fetch` global (Node 20+, ya disponible) | — | Probe HTTP de la imagen social: `Range: bytes=0-65535` + lectura de `content-length` / `content-type` | Un helper propio (~60 líneas) en `packages/crawler`: intenta `HEAD` para peso y tipo; si el servidor no soporta `HEAD` (405/501) o no devuelve `content-length`, cae a `GET` con `Range` y lee `content-range` para el total. Si el servidor ignora el `Range` y responde 200 con el archivo completo, se aborta el stream tras N bytes con `reader.cancel()` / `AbortController`. No hace falta librería para esto; lo que sí hace falta es el timeout acotado y el cap de bytes, mismo patrón que ya usa `resolveCanonicalUrl`. |
| `zod` (ya en el stack del proyecto) | latest | Validar/normalizar la forma del JSON persistido de meta social | Opcional. Sólo si se quiere blindar el `Json?` nuevo de Prisma igual que se hizo con el JSON-LD. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `vitest` (ya instalado) | Tests de los checks nuevos y del parser de dimensiones | Los tests del probe de imagen deben correr contra **buffers fixture** (los primeros KB de un PNG/JPEG/WebP/SVG/AVIF committeados como fixture), nunca contra URLs reales — el pipeline de tests no debe depender de red. Mismo patrón que `captureHeaders.test.ts`. |
| Fixtures HTML de `<head>` reales | Tests de los checks de OG/Twitter/favicon | Reusar el patrón de `testUtils.ts` de `packages/checks`. Incluir al menos: head completo, head vacío, `og:image` relativa, `twitter:card` sin `twitter:image`, favicon sólo por convención `/favicon.ico` sin `<link>`. |

## Installation

```bash
# Core — única dependencia nueva de producción
pnpm --filter @auditor/checks add image-size@^2.0.2
# (o en @auditor/crawler si el probe de imagen vive del lado del crawler — ver "Puntos de integración")

# Supporting — nada nuevo. fetch/AbortController son stdlib de Node 20+.

# Dev — nada nuevo. vitest ya está en todos los paquetes.
```

## Puntos de integración con la arquitectura existente

### 1. `packages/crawler/src/crawl.ts` — captura de métricas de página (aditivo, sin request extra)

Dentro del `requestHandler` que ya existe, junto a donde hoy se calcula `responseHeaders` y `cookieNames` (líneas ~112-116):

- `responseTimeMs` ← `response.timings?.phases?.total ?? null`
- `ttfbMs` ← `response.timings?.phases?.firstByte ?? null`
- `htmlBytes` ← `html ? Buffer.byteLength(html, "utf8") : null`
- `transferBytes` ← `Number(response.headers["content-length"]) || null`

Van al mismo `prisma.page.upsert` que ya está ahí. **Cero requests adicionales** — exactamente el mismo principio que hizo bien FPRINT-01 en v1.5.

Advertencia importante: estos timings son de **la corrida del crawler**, no del navegador de un usuario. Hay que etiquetarlos así en el reporte ("tiempo de respuesta del servidor medido durante el rastreo") para que no se confundan con LCP/TTFB de campo de CrUX que ya reporta `packages/psi`. Si no se separa la narrativa, el reporte se contradice a sí mismo.

### 2. `packages/db/prisma/schema.prisma` — model `Page`

Columnas nuevas, todas nullable (el patrón de v1.5 con `responseHeaders`/`cookieNames`):

```prisma
responseTimeMs  Int?     // total de la request durante el crawl (got timings)
ttfbMs          Int?
htmlBytes       Int?     // tamaño descomprimido del HTML
transferBytes   Int?     // content-length cuando el servidor lo manda
socialMeta      Json?    // og:*, twitter:*, favicon(s), charset, viewport ya extraídos
```

`socialMeta` sigue el mismo patrón que `schemaJson` de v1.4: se extrae una vez en el pipeline (worker), se persiste compacto, y el reporte lo lee sin volver a parsear los 500 HTML. Esto es lo que hace viable el panel de preview sin costo de render.

### 3. `packages/checks` — categoría nueva

- Nuevo directorio `src/checks/social/` (hermano de `onpage/`, `tech/`, `schema/`, `aeo/`), registrado en `registry.ts`.
- **Categoría nueva `"social"`** en `types.ts` — necesaria para que `packages/scoring` la trate como quinta/sexta categoría con su propio health-ratio, sin tocar el cálculo de las existentes.
- Los checks nuevos reciben el mismo `{ page, $ }` de siempre.

### 4. Qué NO tocar / qué NO duplicar

`ONPAGE-05` (`packages/checks/src/checks/onpage/openGraph.ts`) ya cubre **presencia** de las 4 etiquetas base (`og:title`, `og:description`, `og:image`, `og:url`) y emite un issue por página con `pageFingerprint("ONPAGE-05", url)`. Decisión recomendada:

- **Mantener `ONPAGE-05` como está y no moverlo de categoría.** Moverlo rompe la comparación entre corridas (el diff de v1.0 se hace por `fingerprint`, y el fingerprint incluye el `checkId`; recategorizarlo haría que todas las auditorías previas reporten el issue como "resuelto" y uno nuevo como "nuevo").
- Los checks de `social` arrancan donde `ONPAGE-05` termina: **calidad**, no presencia. Si `ONPAGE-05` ya dice "faltan las 4", los checks de calidad deben degradar limpio (no emitir ruido duplicado) — el mismo patrón de supresión que se usó en SCHEMA-06/07 con la muestra CSR.
- Concretamente, lo nuevo es: longitud óptima de `og:title`/`og:description`, `og:image` absoluta vs relativa, dimensiones y aspect ratio reales de la imagen, peso de la imagen, formato de la imagen no soportado por las plataformas, `og:type`/`og:site_name`, presencia y coherencia de `twitter:card`, favicon (formatos/tamaños/declaración), `charset` presente y en los primeros 1024 bytes, `viewport` correcto.

Ojo con `viewport`: ya hay un check técnico de viewport en la categoría técnica (mencionado en los requisitos validados de v1). Antes de escribir uno nuevo hay que grepear el catálogo y **reusar el checkId existente**, no crear un duplicado con otro id.

### 5. `packages/report-model` + `apps/web` — panel de preview

`buildReportModel` lee `Page.socialMeta` y arma el modelo del preview. El componente de preview es tokens-only, igual que el resto de la librería de v1.1. La `og:image` remota se muestra con un `<img>` plano:

```jsx
<img src={ogImageUrl} loading="lazy" referrerPolicy="no-referrer" alt="" />
```

**No usar `next/image` acá.** Requiere whitelist de `remotePatterns` — imposible con dominios arbitrarios de sitios auditados — y además factura optimización de imágenes en Vercel por cada imagen de cada sitio auditado. Si por algún motivo se quiere `next/image`, tiene que ser con `unoptimized`, que es lo mismo que un `<img>` con más ceremonia.

Verificado en el repo: **hoy `apps/web` no configura ningún header `Content-Security-Policy`** (no hay middleware ni headers en `next.config.ts`). Así que el `<img>` remoto funciona hoy sin cambios. Si más adelante se agrega CSP (que sería sano), debe incluir `img-src 'self' https: data:` o el panel de preview queda vacío en producción sin error visible.

### 6. `packages/export` — límite real a documentar

`@react-pdf/renderer` sólo resuelve **JPEG y PNG** para `<Image>` (verificado: el tipo de retorno de `@react-pdf/image` es `format: 'jpeg' | 'png'`). Una `og:image` en WebP, AVIF o SVG — cada vez más comunes — **crashea o se cae silenciosamente** en el export PDF. El panel de preview en el PDF debe: (a) mirar el formato ya detectado por `image-size` y (b) si no es JPEG/PNG, renderizar un placeholder con la URL en texto en vez de intentar embeber. Esto es un requisito, no un nice-to-have: es un crash en producción esperando a pasar, y el proyecto ya tiene un crash abierto de export PDF.

## Criterios de validación (fuentes oficiales)

| Check | Umbral | Fuente | Confidence |
|-------|--------|--------|------------|
| `og:image` dimensiones | mínimo absoluto 200×200; por debajo de 600×315 se muestra chico; óptimo ≥1200×630 | Facebook Sharing Webmasters (oficial) | HIGH |
| `og:image` aspect ratio | 1.91:1 para evitar recorte | Facebook Sharing Webmasters (oficial) | HIGH |
| `og:image` peso | máximo 8 MB (Facebook) | Facebook Sharing Webmasters (oficial) | HIGH |
| `twitter:image` (`summary_large_image`) | mínimo 300×157, recomendado 1200×628 (1.91:1), máximo 5 MB, formatos JPEG/PNG/GIF/WebP | Fuentes secundarias cruzadas (docs oficiales de X devolvieron 402) | MEDIUM |
| Favicon | cuadrado 1:1, mínimo 8×8, recomendado >48×48, declarado con `<link rel="icon">` en el `<head>` del home, URL estable, crawleable | Google Search Central — Favicon in Search (oficial) | HIGH |
| Favicon: un solo favicon por host | Google sólo soporta uno por hostname | Google Search Central (oficial) | HIGH |
| `og:title` / `og:description` longitud | no hay límite oficial de plataforma; usar los umbrales prácticos de truncado (~60 y ~155-200 chars) y reportarlo como recomendación, no como error duro | Convención de la industria | MEDIUM |

Nota de umbral para el peso: el límite duro de Facebook es 8 MB pero el de X es 5 MB. El check debe usar **el más estricto** (5 MB) como umbral de warning si la página declara `twitter:image`, porque una imagen de 6 MB pasa en Facebook y falla en X. Reportar el número medido, no sólo pasa/falla — es la convención que ya sigue todo el reporte ("valor medido / criterio").

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `image-size@2.0.2` + fetch propio con `Range` | `probe-image-size@7.3.0` | `probe-image-size` hace el fetch por vos y aborta solo, lo cual suena más cómodo. Pero arrastra `needle` (cliente HTTP viejo, ajeno al resto del stack), `lodash.merge` y `stream-parser` — tres dependencias transitivas para algo que ya sabemos hacer, y su HTTP no comparte user-agent, timeouts ni política de reintentos con el crawler. Elegirlo sólo si el helper de fetch con `Range` resulta más frágil de lo esperado contra CDNs raros; en ese caso vale la pena la comodidad. |
| `image-size` (lee headers) | `sharp@0.35.3` | `sharp` sólo si en algún momento hace falta **procesar** la imagen (recortar, generar un thumbnail propio). Para leer dimensiones es un binario nativo enorme (libvips) que además complicaría el Dockerfile del worker. Para v1.6 es sobredimensionado. |
| Preview como mockup HTML/CSS | Captura real con Playwright | Nunca para este caso. Ninguna plataforma social expone una URL que renderice la card; habría que screenshotear el sitio, que no es lo mismo que la card. Además Playwright ya está capado a `MAX_RENDER_PAGES=10` por costo. |
| Preview como mockup HTML/CSS | `satori` / `@vercel/og` (renderizar la preview a PNG) | Sólo tendría sentido si se quisiera **exportar** el preview como imagen dentro del PDF/PPTX con fidelidad pixel. Dado el límite JPEG/PNG de `@react-pdf/renderer`, `satori`+`resvg` produciría un PNG embebible. Es una salida válida al problema de la sección 6, pero agrega dos dependencias pesadas; el placeholder de texto resuelve el 90% del valor a costo cero. Revisar sólo si Juan quiere el preview visual dentro del PDF. |
| Timings de got (crawler) | Medir con `performance.now()` alrededor del fetch | Los timings de got desglosan DNS/TCP/TLS/TTFB/download por separado; un cronómetro manual da un solo número opaco y además mide tiempo de cola del pool de Crawlee, no de red. Usar el cronómetro sólo si por algún motivo `response.timings` viniera `undefined` (defensivo con `?? null`). |
| `socialMeta` persistido en `Page` | Derivar el preview leyendo `Page.html` en `buildReportModel` | El HTML crudo de 500 páginas ya está en Postgres; re-parsearlo en cada vista del reporte es exactamente el antipatrón que v1.5 evitó con `Audit.stack`. Derivar en lectura sólo si el volumen de páginas con preview visible fuera muy chico (ej. sólo el home). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Descargar la `og:image` completa para medirla | Una imagen social pesa 200 KB-8 MB. Multiplicado por páginas únicas de un sitio de 500 URLs es un download de gigabytes que el worker no debería hacer para responder "¿mide 1200×630?" | `Range: bytes=0-65535` + `image-size` sobre el buffer parcial. 64 KB alcanzan sobradamente para el header de cualquier formato. |
| Probar la `og:image` una vez por página | La mayoría de los sitios usan la **misma** imagen de fallback en cientos de páginas. Probar 500 veces la misma URL es abuso del servidor auditado y viola la política de politeness que el crawler ya respeta. | Deduplicar por URL de imagen dentro de la auditoría y capear el total de probes (sugerido: máximo ~50 URLs únicas, priorizando home + una por plantilla, reusando la heurística de `TEMPLATE-01`). |
| `next/image` para la `og:image` del preview | Exige `remotePatterns` con dominios arbitrarios (imposible) y factura optimización de Vercel por imagen de sitio ajeno | `<img>` plano con `loading="lazy"` y `referrerPolicy="no-referrer"` |
| Embeber la `og:image` en el PDF sin chequear formato | `@react-pdf/renderer` sólo soporta JPEG/PNG; WebP/AVIF/SVG rompen el render | Chequear `format` de `image-size` y caer a placeholder de texto |
| Un parser HTML nuevo (jsdom, parse5, htmlparser2 directo) para favicon/manifest | El pipeline ya parsea cada página una vez con Cheerio y lo pasa por contexto; agregar un segundo parser duplica CPU y memoria sobre 500 páginas para leer cuatro `<link>` | El `$` de Cheerio que los checks ya reciben |
| Mover `ONPAGE-05` a la categoría `social` | Rompe el diff entre corridas: el fingerprint incluye el `checkId`, así que todas las auditorías previas marcarían el issue como resuelto y aparecería uno nuevo idéntico | Dejar `ONPAGE-05` donde está; los checks de `social` cubren calidad, no presencia |
| Un check de `viewport` nuevo | Ya existe uno en la categoría técnica desde v1 | Reusar el checkId existente; si hace falta profundizar (ej. `user-scalable=no`), extender ese check |
| Fetchear `/site.webmanifest` por página | Es un recurso por sitio, no por página | Una sola vez por auditoría, junto al fetch de `robots.txt` / `sitemap.xml` que ya se hace. `JSON.parse` alcanza, no hace falta librería. |
| Presentar `responseTimeMs` como Core Web Vital | Es tiempo de servidor medido por el crawler desde el datacenter del worker, no una métrica de campo de usuarios reales | Etiquetarlo explícitamente como "medido durante el rastreo" y mantenerlo separado del bloque de CWV/PSI |

## Stack Patterns by Variant

**Si el sitio usa una sola `og:image` global (caso más común en WordPress/Shopify con plugin SEO):**
- El dedupe por URL colapsa las 500 páginas a 1-3 probes.
- El issue debe reportarse **agregado** ("342 páginas comparten una og:image de 600×315"), no 342 veces. Reusar el patrón de issue agregado que ya se implementó en DEPTH-03.

**Si el sitio no declara `og:image` en absoluto:**
- No probar nada, no emitir issues de calidad de imagen. `ONPAGE-05` ya cubre la ausencia.
- El panel de preview debe renderizar el estado "sin imagen" tal como lo mostraría la plataforma (card de texto), que es en sí mismo el hallazgo más elocuente del panel.

**Si la `og:image` es SVG:**
- Facebook y X no renderizan SVG. Es un warning propio, aparte del de dimensiones (`image-size` sí lee el `viewBox`, así que las dimensiones se reportan igual).

**Si el servidor de la imagen ignora `Range` y responde 200:**
- Abortar el stream tras 64 KB. No dejar que la respuesta se materialice entera "por las dudas".
- Si aun así falla, degradar a `unknown` en vez de emitir un falso positivo de "imagen demasiado chica". La regla de v1.5 aplica igual: nunca forzar una respuesta sin señal.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `image-size@2.0.2` | Node 20+ | Cero dependencias, ESM + CJS, tipos TS incluidos. La API v2 (`imageSize(buffer)`) es distinta de la v1 (`sizeOf`) — no copiar ejemplos viejos de internet, son de la v1. |
| `image-size@2.0.2` | `@auditor/checks` / `@auditor/crawler` | No importa dónde viva mientras no se meta en `apps/web`. Preferible `@auditor/crawler` si el probe de red vive ahí (coherente con `resolveCanonicalUrl`); `@auditor/checks` si se prefiere mantener el crawler sin lógica de imágenes. |
| `image-size` | `apps/web` (Vercel) | **No agregarlo a `apps/web`.** El probe corre en el worker. Si un check de web lo importara transitivamente, el guardarrail `assert:web-boundary` debería seguir pasando (es JS puro, sin binarios), pero conceptualmente rompe la separación worker/web. |
| `got` timings | `@crawlee/http@3.17.0` | Ya presente. Acceder siempre con optional chaining (`response.timings?.phases?.total`) — en respuestas cacheadas o en algunos paths de error los timings pueden venir incompletos. |
| `@react-pdf/renderer` | `og:image` remota | Sólo JPEG/PNG. Ver sección 6. |
| Columnas nuevas de `Page` | Auditorías existentes | Todas nullable → migración sin backfill, auditorías viejas muestran "sin dato" en vez de romper. Mismo criterio que v1.5. |

## Sources

- `/image-size/image-size` (Context7) — API v2, entrada por `Buffer`/`Uint8Array`, formatos soportados, limitación de "sólo lee headers" — HIGH confidence (docs oficiales del repo)
- `/diegomura/react-pdf` (Context7) — `@react-pdf/image` devuelve `format: 'jpeg' | 'png'`, confirma la limitación de formatos — HIGH confidence (docs oficiales)
- [Facebook Sharing — Webmasters/Images](https://developers.facebook.com/docs/sharing/webmasters/images/) — mínimo 200×200, óptimo 1200×630, ratio 1.91:1, máximo 8 MB — HIGH confidence (docs oficiales)
- [Google Search Central — Favicon in Search](https://developers.google.com/search/docs/appearance/favicon-in-search) — 1:1, mínimo 8×8, recomendado >48×48, declaración con `<link rel="icon">`, un favicon por hostname, URL estable — HIGH confidence (docs oficiales)
- [Twitter Card Image Size Guide (opengraphplus)](https://opengraphplus.com/consumers/twitter/images) y [Twitter Image Specs 2026 (soona)](https://soona.co/image-resizer/twitter-spec-guide) — mínimo 300×157, recomendado 1200×628, máximo 5 MB, formatos — MEDIUM confidence (fuentes secundarias cruzadas entre sí; developers.x.com devolvió HTTP 402)
- [OpenGraph.io Link Preview](https://www.opengraph.io/link-preview) y [Toolsana OpenGraph Preview](https://toolsana.com/tools/opengraph-preview/) — confirman que las herramientas del mercado renderizan mockups HTML/CSS client-side, no capturas reales — MEDIUM-HIGH confidence (múltiples herramientas independientes, comportamiento consistente)
- npm registry (consultado 2026-07-31) — `image-size@2.0.2` (MIT, cero deps), `probe-image-size@7.3.0` (MIT, deps: needle/lodash.merge/stream-parser), `sharp@0.35.3` — HIGH confidence (consulta en vivo)
- Código del repo — `packages/checks/src/checks/onpage/openGraph.ts` (ONPAGE-05 actual), `packages/crawler/src/crawl.ts:110-150` (punto de captura), `packages/db/prisma/schema.prisma:107-136` (model `Page`), `@crawlee/http/internals/http-crawler.d.ts:149` (`response: PlainResponse`), `got/dist/source/core/response.d.ts:55-68` (`timings.phases`), `apps/web/next.config.ts` (sin CSP configurada) — HIGH confidence (lectura directa)

---
*Stack research for: auditoría de meta tags sociales + performance por página (v1.6)*
*Researched: 2026-07-31*
