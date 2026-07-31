# Architecture Research

**Domain:** Auditoría web SEO — milestone v1.6 Meta Tags / Open Graph / Social preview
**Researched:** 2026-07-31
**Confidence:** HIGH (integración con el código existente, verificada leyendo el repo) / MEDIUM (umbrales de dimensiones OG, consenso de industria)

## Resumen ejecutivo (respuestas directas)

| Pregunta | Respuesta | Confianza |
|----------|-----------|-----------|
| ¿Response time / HTML size se mide en el crawl o en un paso aparte? | **En el crawl.** `response.timings.phases.firstByte/total` ya está disponible dentro del `requestHandler` de Crawlee (el tipo es `PlainResponse` de got), y `body` da el tamaño. Cero requests extra. Un paso aparte duplicaría 500 requests y mediría contra caché caliente. | HIGH |
| ¿Dimensiones OG requieren un request por página? | **No: un request por imagen ÚNICA.** `og:image` es casi siempre constante por plantilla/sitio — 500 páginas suelen dar 1-20 URLs únicas. Se deduplica por URL absoluta de imagen y se aplica el mismo cap que los network checks existentes (150) + concurrencia 12. | HIGH |
| ¿HEAD alcanza? | **No.** HEAD sólo da `Content-Type`/`Content-Length`, jamás ancho/alto. Hace falta leer bytes de cabecera: `Range: bytes=0-65535` + `image-size` (0 dependencias). | HIGH |
| ¿Nuevo paquete o extensión de `packages/checks`? | **Ambos, divididos por naturaleza.** Los checks (que emiten `IssueDraft`) van dentro de `packages/checks/src/checks/social/`. El motor puro (extracción de tags, umbrales, generación de snippets, modelo de preview) va en un **`packages/meta-social` nuevo**, desacoplado de db/crawler en runtime — patrón `fingerprint`/`cms-adapters` verbatim. | HIGH |

## Standard Architecture

### System Overview — dónde entra lo nuevo (marcado con ★)

```
┌──────────────────────────────────────────────────────────────────────┐
│  apps/worker  (Railway/VPS, contenedor propio — Chromium permitido)  │
├──────────────────────────────────────────────────────────────────────┤
│  resolveCanonicalUrl → runCrawl (Crawlee CheerioCrawler)             │
│      └─ requestHandler: 1 sola descarga por URL                      │
│           · html, title, statusCode, redirectChain                   │
│           · responseHeaders + cookieNames        (v1.5, FPRINT-01)   │
│           · ★ ttfbMs, responseMs, htmlBytes      (v1.6, MISMO fetch) │
│                                ↓                                     │
│  buildLinkGraph → runRenderSample (muestra) → runAllChecks           │
│      └─ 1 solo cheerio.load($) por página, reusado por:              │
│           · pageChecks (tech / onpage / schema / aeo)                │
│           · ★ socialPageChecks          (nuevos, categoría "social") │
│           · computeSchemaGraph / flattenNodes                        │
│           · ★ extractSocialMeta($)  → Map<pageId, SocialMeta>        │
│      └─ networkChecks (fetch acotado, sólo worker)                   │
│           · brokenExternalLinks / brokenResources                    │
│           · ★ ogImageDimensionsCheck  (dedup por imagen + cap 150)   │
│                                ↓                                     │
│  runPerfSample (PSI, muestra) → scoreCategory/scoreOverall           │
└──────────────────────────────────────────────────────────────────────┘
                                 ↓ persiste
┌──────────────────────────────────────────────────────────────────────┐
│  Postgres (Prisma)                                                   │
│   Page:  html, responseHeaders, cookieNames, schemaGraph, schemaJson │
│          ★ ttfbMs, responseMs, htmlBytes, socialMeta (Json?)         │
│   Issue: … category ahora incluye ★ "social"                         │
│   Audit: stats, scores (★ byCategory.social), stack                  │
└──────────────────────────────────────────────────────────────────────┘
                                 ↓ lee
┌──────────────────────────────────────────────────────────────────────┐
│  packages/report-model — buildReportModel (single source of truth)   │
│   · toReportIssue + resolveCmsRecommendation        (v1.5)           │
│   · ★ buildMetaSnippet(socialMeta, checkId)  → issue.snippet         │
│   · ★ buildSocialPreview(pages)  → model.socialPreview               │
│   · ★ buildPagePerf(pages)       → model.pagePerf                    │
│   (todo resuelto EN LECTURA, nada derivado se persiste)              │
└──────────────────────────────────────────────────────────────────────┘
              ↓                                    ↓
┌───────────────────────────────┐   ┌──────────────────────────────────┐
│ apps/web (Vercel, sin Chromium)│   │ packages/export (PDF/MD/PPTX)   │
│  · ★ SocialPreviewPanel        │   │  · ★ CATEGORY_LABEL.social       │
│  · ★ PagePerfTable             │   │  · snippet llega gratis          │
│  · ★ CopySnippetButton         │   │                                  │
└───────────────────────────────┘   └──────────────────────────────────┘
```

### Component Responsibilities

| Componente | Estado | Responsabilidad |
|-----------|--------|-----------------|
| `packages/meta-social` | **NUEVO** | Motor puro: tipos `SocialMeta`, `extractSocialMeta($)`, umbrales de dimensiones/aspect ratio, `buildMetaSnippet()`. Única dep de runtime: `cheerio`. Sin `@auditor/db`, sin `@auditor/crawler`, sin `@auditor/checks`. |
| `packages/checks/src/checks/social/` | **NUEVO (dentro de paquete existente)** | `PageCheck[]` de tags (og/twitter/favicon/charset/viewport), `SiteCheck` agregado de performance por página, y `NetworkCheck` de dimensiones de `og:image`. Consume `@auditor/meta-social` para extraer y evaluar. |
| `packages/crawler/src/crawl.ts` | MODIFICADO | Captura `ttfbMs`/`responseMs` desde `response.timings` y `htmlBytes` desde `body`, y los persiste en el `page.upsert` que ya existe. Sin fetch adicional. |
| `packages/db` (schema) | MODIFICADO | 4 columnas nullable nuevas en `Page`: `ttfbMs Int?`, `responseMs Int?`, `htmlBytes Int?`, `socialMeta Json?`. Aditivo, sin backfill (mismo criterio que `Audit.stack` en v1.5). |
| `packages/scoring` | MODIFICADO | `Category` gana `"social"`; `CATEGORY_WEIGHTS` se rebalancea. **Es el cambio de mayor riesgo del milestone** (mueve el score de todas las auditorías existentes). |
| `packages/report-model` | MODIFICADO | `CATEGORY_ORDER` gana `"social"`; `ReportIssue` gana `snippet`; `ReportModel` gana `socialPreview?` y `pagePerf?` (opcionales → auditorías pre-v1.6 degradan ocultando el panel). |
| `apps/worker/src/index.ts` | MODIFICADO | Persiste `pageSocialMeta` dentro del `page.update` batch que ya existe para `schemaGraph`/`schemaJson`. Ninguna fase nueva en el pipeline. |
| `apps/web` + `packages/export` | MODIFICADO | Etiqueta de categoría nueva en los **dos** archivos de labels (están duplicados a propósito) + panel visual + snippet. |

## Decisión 1: response time / HTML size se capturan en el crawl

**Recomendación: capturar en `crawl.ts`, dentro del `requestHandler` que ya existe.**

El `CheerioCrawlingContext` de Crawlee 3.17 tipa `response` como `PlainResponse` de got 14 (verificado en `node_modules/.pnpm/@crawlee+http@3.17.0/.../http-crawler.d.ts:149` y `got@14.6.6/.../response.d.ts:68`). `PlainResponse.timings` trae `phases.firstByte` (TTFB) y `phases.total`. El tamaño de HTML sale de `body`, que ya se lee en `crawl.ts:114`.

```ts
// packages/crawler/src/crawl.ts — dentro del requestHandler existente
const timings = (response as { timings?: { phases?: { firstByte?: number; total?: number } } })?.timings;
const ttfbMs = timings?.phases?.firstByte != null ? Math.round(timings.phases.firstByte) : null;
const responseMs = timings?.phases?.total != null ? Math.round(timings.phases.total) : null;
const htmlBytes = html != null ? Buffer.byteLength(html, "utf-8") : null;
```

**Por qué no un paso aparte:** significaría 500 requests adicionales por auditoría (duplicar el volumen de red del producto), y mediría contra la caché ya calentada por el crawl — el número saldría sistemáticamente mejor que la realidad. Es el mismo razonamiento de FPRINT-01 en v1.5: la materia prima ya está en el fetch, capturarla ahí es gratis.

**Caveats que hay que escribir en el reporte:**
- La medición sale del worker, con hasta 5 requests concurrentes en vuelo (`DEFAULT_MAX_CONCURRENCY = 5`) y desde su ubicación de red. Es una **señal relativa entre páginas del mismo sitio**, no un número de laboratorio. Nunca presentarla como sustituto del TTFB de PSI.
- `htmlBytes` es el HTML **decodificado**. El header `content-length` (comprimido) es otro dato, más halagüeño; si se quiere mostrar transferencia, guardarlo aparte, no mezclarlos.
- El acceso a `timings` necesita guarda defensiva: hay rutas internas de `_parseResponse` que re-envuelven la respuesta como `IncomingMessage`. Si viene `undefined`, la columna queda `null` y el check degrada a "sin dato" — nunca falla la auditoría.

## Decisión 2: dimensiones de `og:image` — dedupe por imagen, no muestreo por página

**Recomendación: `NetworkCheck` que deduplica por URL absoluta de imagen, con cap y concurrencia acotada. NO muestrear páginas como PSI/render.**

Tres hechos que definen el diseño:

1. **HEAD no sirve.** Devuelve `Content-Type` y `Content-Length`, jamás ancho/alto. Para dimensiones hay que leer bytes de la cabecera del archivo.
2. **Un Range request de 64KB alcanza.** `Range: bytes=0-65535` + `image-size@2.0.2` (0 dependencias, exports duales ESM/CJS) resuelve JPEG/PNG/WebP/GIF/AVIF/SVG. La alternativa `probe-image-size@7.3.0` hace lo mismo pero arrastra `needle@^2` (cliente HTTP legacy) — no vale la pena en un repo que ya tiene su propio fetch con concurrencia acotada en `linkChecker.ts`.
3. **`og:image` es casi siempre constante por plantilla.** El costo real es `imágenes únicas`, no `páginas`. Un sitio de 500 URLs típicamente tiene entre 1 y 20 `og:image` distintos.

Por eso el muestreo tipo PSI (elegir 5-10 páginas) es la herramienta equivocada acá: descarta cobertura sin ahorrar nada real. El patrón correcto ya existe en el repo, en `brokenResources`: deduplicar el set, aplicar `MAX_URLS_PER_NETWORK_CHECK` (150) y `CONCURRENCY` (12).

```
500 páginas → extraer og:image → normalizar a absoluta → Set único
  → si |Set| > 150: probar las 150 primeras y reportar el cap (patrón existente)
  → probeImage(url): Range 0-65535, timeout 5s, abort si el server ignora Range
  → Map<imageUrl, {width, height, bytes, type} | error>
  → cada página hereda el veredicto de SU imagen
  → páginas cuya imagen quedó fuera del cap: sólo check de presencia, sin veredicto
    de dimensión (degradación limpia, igual que las páginas fuera de la muestra de render)
```

**Umbrales sugeridos** (consenso de industria 2026, MEDIUM confidence — conviene dejarlos como constantes calibrables, igual que `CATEGORY_WEIGHTS`):

| Condición | Severidad | Razón |
|-----------|-----------|-------|
| < 200×200 px | critical | Facebook y LinkedIn directamente no renderizan la card |
| < 600×315 px | warning | Se muestra como thumbnail chico, no como card grande |
| aspect ratio lejos de 1.91:1 | warning | Recorte impredecible entre plataformas |
| > 5 MB | warning | Excede el límite de LinkedIn y X (Facebook tolera 8 MB) |
| 1200×630, 1.91:1 | ok | Recomendación universal que sirve en FB, X, LinkedIn, Slack, Discord, WhatsApp |

**Seguridad (hilo directo con el `SECURITY.md` de v1.5):** la URL de `og:image` la controla el sitio auditado. Antes del fetch hay que validar esquema (`http`/`https` únicamente, nunca `file:`/`data:`/`gopher:`) y rechazar hosts que resuelvan a rangos privados. Es SSRF clásico. Los network checks existentes ya hacen fetch a URLs del sitio, así que conviene extraer un guard compartido en vez de escribir uno nuevo sólo acá.

## Decisión 3: dónde vive el código nuevo

**Recomendación: `packages/meta-social` (motor puro, nuevo) + `packages/checks/src/checks/social/` (los checks, dentro del paquete existente).**

El criterio que separa las dos cosas ya está establecido en el repo:

- `packages/checks` es donde vive **todo lo que produce un `IssueDraft`**. Tiene un registry (`pageChecks`/`siteChecks`/`networkChecks`), lo consume `runAllChecks`, y el worker lo cablea una sola vez. Meter los checks de meta tags en un paquete aparte obligaría a un segundo registry, un segundo cableado en el worker y plomería duplicada de `IssueDraft` a cambio de nada.
- `packages/fingerprint` y `packages/cms-adapters` son paquetes separados porque son **motores con modelo de dominio propio que se resuelven en lectura**, no productores de issues. El motor de meta/social tiene exactamente esa forma: extrae un modelo (`SocialMeta`), define umbrales, y genera snippets que `buildReportModel` resuelve al leer.

```
packages/meta-social/src/
├── types.ts              # SocialMeta, ImageProbe, MetaSnippet
├── extract.ts            # extractSocialMeta($): SocialMeta   ← única dep: cheerio
├── thresholds.ts         # dimensiones/ratio/peso, calibrables
├── snippets.ts           # buildMetaSnippet(meta, checkId): string | null
└── index.ts

packages/checks/src/checks/social/
├── index.ts              # socialPageChecks / socialSiteChecks / socialNetworkChecks
├── openGraphTags.ts      # SOCIAL-01  og:title/description/image/url
├── twitterCard.ts        # SOCIAL-02  twitter:card + campos
├── favicon.ts            # SOCIAL-03
├── charsetViewport.ts    # SOCIAL-04
├── ogImageDimensions.ts  # SOCIAL-05  NetworkCheck (dedupe + cap + Range)
├── probeImage.ts         # fetch Range + image-size, concurrencia acotada
└── pagePerformance.ts    # SOCIAL-06  SiteCheck agregado sobre ttfbMs/htmlBytes
```

`packages/checks` gana una dependencia sobre `@auditor/meta-social`. Es legítima: `checks` ya depende de `@auditor/crawler` y `@auditor/db`, y depender de un paquete puro no rompe ningún boundary. Lo importante es la dirección: `meta-social` **nunca** importa `checks`, `db` ni `crawler`.

### Cómo llega `SocialMeta` al reporte sin re-parsear HTML

Hay una regla explícita en el código (`crawl.ts:115`, "no HTML re-parse anywhere else — ARCH-03"). Re-parsear 500 páginas en `buildReportModel` para pintar el panel de preview la violaría y pagaría el costo en cada vista del reporte.

El patrón correcto ya existe: `runAllChecks` hace **un solo** `cheerio.load()` por página y de ahí saca `pageSchemaGraphs` y `pageSchemaEntities`, que devuelve en `RunAllChecksResult` y el worker persiste en un único `page.update` por página. `SocialMeta` sigue el mismo camino:

```ts
// packages/checks/src/registry.ts — dentro del loop de páginas que ya existe
const social = extractSocialMeta($);
if (social) pageSocialMeta.set(page.id, social);
// … y se devuelve junto a pageSchemaGraphs / pageSchemaEntities
```

```ts
// apps/worker/src/index.ts — dentro del batch de page.update que ya existe
if (social) data.socialMeta = social as unknown as Prisma.InputJsonValue;
```

`SocialMeta` es un objeto chico (~300 bytes: og:title, og:description, og:image, og:url, og:type, twitter:*, favicon, charset, viewport). Persistirlo para las 500 páginas es trivial al lado de `Page.html`, que ya se guarda entero.

### Muestra del panel de preview

`socialMeta` se persiste para todas las páginas, pero el panel no debe pintar 500 cards. Recomendación: `buildSocialPreview` elige home + una página por plantilla, reusando `classifyTemplate` de `report-model/src/template.ts` (ya existe, ya se usa para `issuesByTemplate`). Se resuelve en lectura, así que cambiar la selección después no requiere re-auditar.

## Decisión 4: el score nuevo — el punto de mayor riesgo

`Category` es una unión cerrada y `CATEGORY_WEIGHTS` suma 1.0. Agregar `"social"` toca, como mínimo:

| Archivo | Cambio |
|---------|--------|
| `packages/scoring/src/overallScore.ts:10` | `Category` gana `"social"` |
| `packages/scoring/src/overallScore.ts:23` | `CATEGORY_WEIGHTS` rebalanceado |
| `packages/report-model/src/build.ts:25` | `CATEGORY_ORDER` |
| `packages/export/src/labels.ts:10,12` | `CATEGORY_ORDER` + `CATEGORY_LABEL` |
| `apps/web/app/components/ui/labels.ts:10` | `CATEGORY_LABEL` (copia deliberada de la anterior) |
| `apps/web/app/audits/[id]/page.tsx:40` | `CATEGORY_ORDER` local (tercera copia) |

Hay **tres** definiciones de orden/etiquetas de categoría, duplicadas a propósito (para que `export` no dependa de `web`). Olvidar una es un error silencioso: TypeScript caza los `CATEGORY_LABEL` (son `Record<Category, string>` exhaustivos) pero **no** los `CATEGORY_ORDER`, que son arrays — ahí la categoría simplemente desaparece de la UI o del export sin error de compilación. Vale un test de guardarrail que afirme que los tres arrays tienen la misma longitud que las claves de `CATEGORY_WEIGHTS`.

**Peso sugerido:** `social: 0.10`, tomado de onpage/schema/aeo, dejando `tech: 0.30` y `perf: 0.30` intactos:

```
tech 0.30 · perf 0.30 · onpage 0.12 · schema 0.08 · aeo 0.10 · social 0.10
```

Esto mueve el score general de toda auditoría existente. Antes de mergear conviene correr el fixture de scoring y registrar el antes/después, como en v1.2 ("score de fixture estable").

### Trampa: dónde poner los issues de response time

Los issues de categoría `perf` se persisten pero **se excluyen del scoring por issues** (`apps/worker/src/index.ts:574`: `if (row.category === "perf") continue;`) — el score de `perf` viene de promedios de PSI. Entonces:

- Si los issues de response time se etiquetan `perf`, se muestran pero no afectan ningún score. Legítimo si se quiere informativo puro, pero raro dentro de un panel que sí tiene score propio.
- Si se etiquetan `social`, sí puntúan. **Pero** un check por página produce hasta 500 filas contra ~5 filas de checks de tags: el health-ratio de la categoría queda dominado por el response time y las meta tags dejan de importar.

**Recomendación:** emitir el performance por página como **issue agregado a nivel sitio** (`SiteCheck`, una fila del tipo "N de M páginas responden en más de X ms"), más filas por página sólo para los peores infractores. Hay precedente directo: DEPTH-03 hace exactamente eso con el porcentaje de páginas a más de 3 clics. Así la categoría queda balanceada, y el panel igual muestra la tabla completa por página leyendo `Page.ttfbMs` desde `report-model`, sin necesidad de una fila de `Issue` por página.

## Data Flow

### Flujo nuevo, extremo a extremo

```
1. CRAWL (worker, 1 fetch por URL — sin requests extra)
   requestHandler → response.timings.phases.{firstByte,total} + Buffer.byteLength(body)
   → Page.ttfbMs, Page.responseMs, Page.htmlBytes

2. CHECKS (worker, 1 cheerio.load por página — sin re-parse)
   runAllChecks
     ├─ socialPageChecks($)        → IssueDraft[] category "social"
     ├─ extractSocialMeta($)       → Map<pageId, SocialMeta>
     ├─ pagePerformanceCheck(ctx)  → 1 IssueDraft agregado + top infractores
     └─ ogImageDimensionsCheck     → dedupe imágenes → Range fetch → IssueDraft[]

3. PERSIST (worker, dentro de los writes que ya existen)
   Issue.createMany (con diffStatus, sin cambios)
   page.update batch → socialMeta (junto a schemaGraph/schemaJson)
   Audit.scores.byCategory.social

4. READ (report-model, sin recomputar nada)
   buildReportModel
     ├─ toReportIssue + resolveCmsRecommendation   (v1.5, sin cambios)
     ├─ buildMetaSnippet(socialMeta, checkId)      → ReportIssue.snippet
     ├─ buildSocialPreview(pages)                  → ReportModel.socialPreview
     └─ buildPagePerf(pages)                       → ReportModel.pagePerf

5. RENDER
   apps/web  → panel de preview + tabla de perf + botón copiar snippet
   packages/export → snippet y score de categoría llegan gratis (v1.5 lo probó:
                     0 commits en packages/export durante la Phase 27)
```

### Snippets y recomendaciones por CMS: independientes, no anidados

Son dos preguntas distintas y deben quedar en campos distintos de `ReportIssue`:

- `recommendation` (ya existe, resuelto por `cms-adapters`) → **dónde** configurarlo: "en WordPress con Yoast, pestaña Social del editor…"
- `snippet` (nuevo, resuelto por `meta-social`) → **qué HTML** debería quedar: `<meta property="og:image" content="…">`

Ninguno de los dos motores debe conocer al otro. Ambos se resuelven en `toReportIssue` con la misma guarda que ya existe: **severidad `ok` nunca pasa por ningún motor** (no se muestra un "fix" en un check que pasa — Pitfall 1 de v1.5).

## Scaling Considerations

| Escala | Ajuste |
|--------|--------|
| Sitio de 50 URLs | Todo directo. 1-3 imágenes OG únicas, dentro del cap sin recorte. |
| Sitio de 500 URLs (tope free) | El dedupe de imágenes es lo que sostiene el diseño: ~5-20 probes, no 500. `socialMeta` agrega ~150KB por auditoría en total. Timings y bytes son 3 enteros por fila. |
| Sitio con og:image único por página (e-commerce con foto de producto) | Peor caso: 500 imágenes únicas → recortado a 150 por el cap existente. El reporte debe decir "analizadas 150 de 500 imágenes", igual que hoy hacen los network checks. |

**Primer cuello de botella:** el probe de imágenes en sitios con OG por página. Mitigado por el cap. Si aparece en la práctica, la palanca es priorizar las imágenes de las páginas de la muestra de plantillas antes de recortar por orden de aparición.

**Segundo:** el peso de `Page.html` ya domina la tabla; nada de v1.6 lo mueve significativamente.

## Anti-Patterns

### Correr un pase de red aparte para medir response time
**Qué se hace mal:** un segundo fetch por página sólo para cronometrar.
**Por qué está mal:** duplica el volumen de red del producto y mide contra caché caliente, dando números sistemáticamente optimistas.
**En cambio:** leer `response.timings` del fetch que Crawlee ya hizo.

### Confiar en HEAD para dimensiones de imagen
**Qué se hace mal:** asumir que un HEAD barato responde ancho/alto.
**Por qué está mal:** HEAD no devuelve dimensiones nunca. Se termina o descargando la imagen completa (caro) o inventando el dato.
**En cambio:** Range request de 64KB + `image-size`, con dedupe por URL de imagen.

### Re-extraer meta tags en `buildReportModel`
**Qué se hace mal:** parsear `Page.html` en tiempo de lectura para pintar el preview.
**Por qué está mal:** viola ARCH-03 (un solo parse) y paga el costo en cada vista del reporte y en cada export.
**En cambio:** persistir `Page.socialMeta` durante el pase de checks, igual que `schemaGraph`/`schemaJson`.

### Un `Issue` de response time por cada una de las 500 páginas en la categoría nueva
**Qué se hace mal:** emitir una fila por página y dejar que el health-ratio las cuente.
**Por qué está mal:** 500 filas de perf ahogan las ~5 de meta tags; el score de "Meta Tags/Social" termina midiendo velocidad de servidor.
**En cambio:** un issue agregado a nivel sitio (precedente DEPTH-03) + los peores infractores, con la tabla completa alimentada desde `Page.ttfbMs` en `report-model`.

### Probar `og:image` sin validar esquema y host
**Qué se hace mal:** hacer fetch de la URL tal cual viene del HTML auditado.
**Por qué está mal:** SSRF. La URL la controla un tercero.
**En cambio:** aceptar sólo `http`/`https`, rechazar rangos privados, timeout acotado y tope de bytes. Conviene extraer el guard para compartirlo con los network checks existentes.

### Agregar la categoría en dos de los tres arrays de orden
**Qué se hace mal:** actualizar `CATEGORY_LABEL` (que TypeScript verifica) y olvidar algún `CATEGORY_ORDER` (que no verifica).
**Por qué está mal:** la categoría desaparece silenciosamente de la UI o de un export, sin error de compilación.
**En cambio:** test de guardarrail que compare las tres listas contra las claves de `CATEGORY_WEIGHTS`.

## Integration Points

### Internal Boundaries

| Boundary | Dirección | Notas |
|----------|-----------|-------|
| `meta-social` → nadie | — | Puro. Sólo `cheerio`. Nunca importa db/crawler/checks. Igual que `fingerprint`. |
| `checks` → `meta-social` | nueva dep | Legítima: `checks` ya depende de crawler y db. Mantiene la extracción en una sola fuente. |
| `report-model` → `meta-social` | nueva dep | Para `buildMetaSnippet`. Mismo patrón que `report-model` → `cms-adapters` en v1.5. |
| `crawler` → nada nuevo | — | Sólo lee campos de `response` que ya tiene. Sin dependencias nuevas. |
| `apps/web` → `meta-social` | transitiva vía `report-model` | Debe seguir siendo pura: **nada de `image-size` ni fetch en el módulo que `web` resuelve**. El probe vive en `checks/social/probeImage.ts`, que sólo el worker ejecuta. |

### Respeto del boundary Vercel/Chromium

v1.6 **no agrega Chromium en ningún punto.** No hace falta Playwright: los meta tags están en el HTML crudo (si un sitio los inyecta por JS, ya está roto para los crawlers sociales, que tampoco ejecutan JS — es un hallazgo, no un problema de medición).

`image-size` es JS puro sin dependencias, así que no rompería el bundle de Vercel aunque llegara ahí. Igual conviene mantenerlo del lado del worker por higiene: `scripts/assert-no-playwright-in-web.mjs` es el guardarrail que ya existe y conviene extenderlo para afirmar que `apps/web` no resuelve el módulo de probe.

### External Services

| Servicio | Patrón | Notas |
|----------|--------|-------|
| Imágenes OG del sitio auditado | `fetch` con `Range: bytes=0-65535`, timeout 5s, concurrencia 12, cap 150 | Servidores que ignoran `Range` devuelven el archivo completo: hay que abortar al superar el tope de bytes. |
| Ninguna API paga nueva | — | v1.6 no introduce dependencias de terceros de pago, coherente con la restricción del proyecto. |

## Orden de build sugerido para el roadmap

| # | Fase | Alcance | Por qué acá |
|---|------|---------|-------------|
| 1 | Motor puro `packages/meta-social` | tipos, `extractSocialMeta`, umbrales, `buildMetaSnippet` | Sin infra, 100% testeable con fixtures. Espeja la Phase 25 (fingerprint primero). Riesgo cero. |
| 2 | Métricas de crawl | migración `Page.ttfbMs/responseMs/htmlBytes` + captura en `crawl.ts` | Toca el crawler validado de v1.0 — va sola y temprano, con un smoke test de re-crawl. Aditiva y nullable. |
| 3 | Checks de social | `checks/social/*`, probe de imágenes, `pageSocialMeta` en `runAllChecks`, migración `Page.socialMeta`, persistencia en el worker | Necesita 1 (motor) y 2 (columnas de perf). Genera los issues pero **todavía sin categoría de score**. |
| 4 | Categoría de score + report-model | `Category` + pesos + los tres `CATEGORY_ORDER` + `ReportIssue.snippet` + `socialPreview`/`pagePerf` en el modelo | Único cambio que mueve el score de auditorías existentes. Va después de que los datos existan, con comparación de fixture antes/después. |
| 5 | UI + exports | panel de preview social, tabla de perf por página, botón copiar snippet, `CATEGORY_LABEL` en los dos archivos de labels | Puramente de presentación sobre un modelo ya estable. v1.5 mostró que los exports salen casi gratis si el modelo es la única fuente. |

**Dependencias del orden:** 1 y 2 son independientes entre sí (podrían paralelizarse) → 3 necesita ambas → 4 necesita 3 → 5 necesita 4. La regla es que la única fase que altera un número ya validado (el score general) llegue lo más tarde posible, con todo lo demás ya en su lugar.

## Confidence Assessment

| Área | Nivel | Razón |
|------|-------|-------|
| Puntos de integración en el repo | HIGH | Leídos directamente de `crawl.ts`, `registry.ts`, `build.ts`, `overallScore.ts`, `schema.prisma`, `apps/worker/src/index.ts`. |
| `response.timings` disponible en Crawlee | HIGH | Verificado en los `.d.ts` instalados (`@crawlee/http@3.17.0`, `got@14.6.6`). Falta confirmación en runtime. |
| Dedupe de imágenes OG como estrategia | HIGH | Se apoya en el patrón de cap/concurrencia que ya existe en `linkChecker.ts`. |
| `image-size` sobre `probe-image-size` | MEDIUM | Comparación de dependencias del registry npm; no probado todavía contra imágenes reales. |
| Umbrales de dimensiones OG | MEDIUM | Consenso de varias guías de industria 2026, no documentación de plataforma de primera mano. |
| Peso propuesto para la categoría | LOW | Punto de partida razonable, no un valor calibrado. Requiere validación con el fixture y criterio de Juan. |

## Preguntas abiertas

- **Peso exacto de la categoría nueva** — decisión de producto de Juan; el 0.10 propuesto es un punto de partida.
- **Nombre de la clave de categoría** — `"social"` es corto y consistente con `tech`/`onpage`/`schema`/`aeo`; la etiqueta visible sería "Meta Tags / Social". Confirmar antes de la fase 4: cambiarla después implica migrar `Issue.category` de auditorías ya corridas.
- **Charset/viewport ya existen en otro lado** — `viewport` ya se chequea en el catálogo técnico de v1.0. Hay que decidir si SOCIAL-04 lo reusa o si se mueve la responsabilidad, para no emitir dos issues por lo mismo (misma discusión que TECH-04 canonical en v1.5).
- **Confirmación en runtime de `response.timings`** — el tipo lo garantiza; una corrida real contra juan-tech.com lo cierra en 5 minutos durante la fase 2.

## Sources

- Código del repo: `packages/crawler/src/crawl.ts`, `packages/checks/src/registry.ts`, `packages/checks/src/checks/network/linkChecker.ts`, `packages/report-model/src/build.ts`, `packages/scoring/src/overallScore.ts`, `packages/db/prisma/schema.prisma`, `apps/worker/src/index.ts` — HIGH
- `node_modules/.pnpm/@crawlee+http@3.17.0/.../http-crawler.d.ts:149` (`response: PlainResponse`) y `got@14.6.6/.../response.d.ts:68` (`timings: Timings`) — HIGH
- [probe-image-size (nodeca)](https://github.com/nodeca/probe-image-size) e [image-size (npm)](https://www.npmjs.com/package/image-size) + metadata del registry npm (deps, exports, versiones) — MEDIUM/HIGH
- [OG Image Size Guide 2026 — screenhance](https://screenhance.com/blog/og-image-size-guide), [Open Graph Image Size reference](https://imagedimensions.com/guides/open-graph-image-size), [Krumzi OG sizes 2026](https://www.krumzi.com/blog/open-graph-image-sizes-for-social-media-the-complete-2026-guide) — MEDIUM (consenso entre fuentes independientes)
- `.planning/PROJECT.md` (Key Decisions de v1.2/v1.4/v1.5, que fijan los patrones reusados acá) — HIGH

---
*Architecture research for: auditoría de meta tags / Open Graph / social preview sobre pipeline existente*
*Researched: 2026-07-31*
