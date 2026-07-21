# Phase 25: Fingerprint de stack técnico — contrato de datos y motor de detección - Research

**Researched:** 2026-07-21
**Domain:** Passive technology fingerprinting (CMS/builder/CDN/hosting/JS framework/analytics) desde datos ya capturados en el crawl — motor de reglas puro sobre TypeScript, sin librería externa de firmas
**Confidence:** HIGH (arquitectura y patrones del repo verificados en código; firmas de detección MEDIUM, calibrar contra sitios reales)

## Summary

Esta fase entrega dos cosas separables: (1) el **contrato de datos** (`DetectedStack` + `AxisResult` + tipos de input) y (2) el **motor de detección** (`detectStack`, función pura) empaquetados en un `packages/fingerprint` nuevo, más los cambios mínimos de captura en el crawler (`Page.responseHeaders` + `Page.cookieNames`). No hay wiring en el worker ni UI — eso es Phase 26. El motor consume headers curados, nombres de cookie, HTML (`Page.html`) y paths conocidos que **ya están disponibles** dentro del `requestHandler` de `CheerioCrawler`, sin ningún request adicional.

El enfoque técnico es un **registry de signatures por eje** (`{ id, axis, test(input), strength }`) evaluado sobre el agregado de todas las páginas del audit, con resolución de confianza por **reglas explícitas** (no puntaje 0-100): la confianza sube a "alto" solo con 2+ señales fuertes coincidentes o 1 señal inequívoca. Los ejes se deciden de forma independiente (nunca winner-take-all) y cualquier eje sin señal suficiente devuelve `value: null` / `confidence: "no-detectado"` — el requisito central FPRINT-08 de nunca forzar una respuesta. La industria de fingerprinting converge en exactamente este patrón multi-señal con confianza derivada del número de señales independientes que apuntan al mismo vendor [CITED: barrion.io/tools/waf-checker].

**Primary recommendation:** Crear `packages/fingerprint` como paquete puro (patrón `@auditor/graph`/`@auditor/scoring`), dependiendo solo de `cheerio` para el matching de HTML. Definir primero los tipos del contrato (`DetectedStack`, `AxisResult`, `Confidence`, `Signal`, `PageFingerprintInput`), luego el registry de signatures por eje, luego el resolvedor de confianza. Capturar headers curados + nombres de cookie en el `requestHandler` existente del crawler y persistirlos en dos columnas Json/String[] aditivas siguiendo el patrón ya usado por `Page.schemaGraph`/`Page.schemaJson`. Todas las firmas deben ser multi-señal y validadas contra 2-3 sitios reales por builder durante la ejecución.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Captura de headers HTTP curados (FPRINT-01) | Crawler (`packages/crawler`) | DB (`Page.responseHeaders`) | Único punto del pipeline donde `response.headers` existe sin request extra — dentro del `requestHandler` |
| Captura de nombres de cookie (FPRINT-01) | Crawler (`packages/crawler`) | DB (`Page.cookieNames`) | `Set-Cookie` solo está en la respuesta cruda del crawl; parsear a nombres ahí mismo |
| Contrato de datos `DetectedStack` (FPRINT-02..08) | Fingerprint (`packages/fingerprint`) | — | Tipos puros, sin I/O; consumidos por worker (26) y adapters CMS (27) |
| Motor de detección `detectStack` (FPRINT-02..08) | Fingerprint (`packages/fingerprint`) | — | Función pura sobre input agregado; sin dependencia de DB/crawler en runtime |
| Persistencia de columnas nuevas | DB (`packages/db`, schema-first) | — | `pnpm db:push` contra Neon; patrón Json aditivo ya establecido |
| Wiring post-crawl + UI de reporte | Worker + web (Phase 26) | — | **Fuera de scope de esta fase** — no tocar |

**Nota clave de tiers:** el motor de fingerprint NO debe importar `@auditor/db`, `@auditor/crawler` ni `@auditor/checks` en runtime (solo tipos, y preferiblemente ni eso — definir su propio `PageFingerprintInput`). El worker (Phase 26) hará el mapeo `Page[] → PageFingerprintInput[]`. Esto preserva el desacople decidido en STATE.md.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Captura de headers y cookies**
- Persistir una lista **curada** de headers HTTP relevantes a fingerprinting (server, x-powered-by, via, cf-ray, x-generator, link, set-cookie, x-drupal-*, x-shopify-*, etc.), no el objeto completo de headers crudo.
- Capturar por página (no solo home) — sin costo extra, ya estamos dentro del `requestHandler` del crawler.
- Cookies: solo **nombres** de cookie (no valores/expiry/domain/flags), parseados del header `Set-Cookie`, por FPRINT-01.
- Persistencia: columnas nuevas `Page.responseHeaders` (Json, headers curados) + `Page.cookieNames` (String[]), no una tabla separada.

**Motor de detección — arquitectura y señales**
- Patrón de reglas: registry de "signatures" por eje, forma `{ id, axis, test(input), weight }`, evaluado sobre el **agregado de todas las páginas** del audit (headers + cookies + HTML markers + paths conocidos), no regex sueltos sin estructura.
- Multi-señal → confianza vía **reglas explícitas** (no puntaje numérico 0-100): alto = 2+ señales fuertes coincidentes o 1 señal inequívoca; medio = 1 señal fuerte sola; bajo = señal débil/indirecta; no-detectado = 0 señales.
- Fuente de HTML para matching: `Page.html` ya persistido, prioriza home page, con fallback a cualquier página si home falló/vacía.
- Independencia entre ejes: nunca winner-take-all — decisión previa ya fijada en STATE.md, se mantiene.

**Detección de builder WordPress**
- Marcadores por builder (multi-señal, nunca un solo header):
  - Elementor: clases `elementor-*`/`data-elementor-*`, paths `/wp-content/plugins/elementor/`.
  - WPBakery: clases `wpb_*`/`vc_row`, path `js_composer`.
  - Divi: clases `et_pb_*`, tema/path `Divi`/`et-builder`.
  - Gutenberg: regla **POSITIVA** explícita (`wp-block-*`, comentarios `<!-- wp:paragraph -->`) — nunca default implícito.
- Empate entre builders con confianza alta: gana el de mayor conteo de marcadores; empate real → "no detectado con certeza" (no prioridad fija arbitraria).
- QA contra sitios reales: durante ejecución, buscar 2-3 sitios públicos conocidos por builder (showcases Elementor/Divi/WPBakery) para validar contra fixtures sintéticos.
- CMS=WordPress sin ningún builder matcheando: builder = "no detectado con certeza", incluso con CMS claro. Nunca asumir Gutenberg sin marcador positivo (FPRINT-08, success criteria #2 del ROADMAP).

**Estructura del paquete `packages/fingerprint`**
- Paquete nuevo `packages/fingerprint`, desacoplado en runtime de `@auditor/db`/`@auditor/crawler`/`@auditor/checks`.
- API pública: función pura `detectStack(input: { pages: PageFingerprintInput[] }): DetectedStack`, sin I/O propio.
- Forma de `DetectedStack`: objeto por eje — `{ cms, builder, cdn, hosting, jsFramework, analytics }`. Cada eje (salvo `analytics`) es `AxisResult = { value, confidence, signals[] }`. `analytics` es un **array** de `AxisResult` porque pueden coexistir varias herramientas (GA4 + GTM + Meta Pixel simultáneamente).
- Testing: fixtures HTML/headers sintéticos por firma + tests unitarios por eje, sumado a QA manual contra sitios reales.

### Claude's Discretion
Ninguna decisión quedó en discreción total de Claude — las 4 áreas se resolvieron con "Aceptar todo" sobre las propuestas recomendadas.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. (Adicional, del REQUIREMENTS v2: detección de plugins SEO WP, builders extra Beaver/Oxygen/Bricks, historial de stack, confianza cuantitativa en UI — todo v2, no tocar.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FPRINT-01 | Captura headers HTTP relevantes + cookies (nombres, no valores) por página, sin requests adicionales | `requestHandler` de `CheerioCrawler` ya expone `ctx.response.headers` (incluye `set-cookie` como `string[]`) y `ctx.body`/`ctx.$` antes del `prisma.page.upsert`. Ver "Pattern 1" y "Captura en el crawler". |
| FPRINT-02 | Detecta CMS (WordPress/Shopify/Webflow/Wix/Squarespace/no-detectado) con confianza | Registry de signatures por eje `cms`. Firmas concretas en "Signatures por eje". Confianza vía reglas explícitas. |
| FPRINT-03 | Si CMS=WordPress, detecta builder (Elementor/WPBakery/Divi/Gutenberg) | Sub-detección `builder` con marcadores multi-señal; Gutenberg requiere marcador positivo; empate → no-detectado. Ver "Detección de builder WordPress". |
| FPRINT-04 | Detecta CDN/proxy (Cloudflare/Fastly/Akamai) cuando hay señal | Firmas de header verificadas: `cf-ray`+`server: cloudflare`, `x-served-by`+`x-fastly-*`, `x-akamai-*`. Ver "Signatures por eje". |
| FPRINT-05 | Detecta hosting/origen cuando hay señal (reconociendo que CDN puede ocultarla) | Firmas `server`/`x-powered-by`/cookies de plataforma; pitfall documentado: CDN delante enmascara origen → devolver no-detectado, no adivinar. |
| FPRINT-06 | Detecta framework JS (React/Next.js/Vue/Nuxt) cuando hay señal | Firmas HTML/header: `__NEXT_DATA__`, `x-powered-by: Next.js`, `/_next/`, `/_nuxt/`, `data-reactroot`, `data-v-` (Vue). Ver "Signatures por eje". |
| FPRINT-07 | Detecta analytics/tag manager (GA4/GTM/Meta Pixel) | Firmas HTML: `googletagmanager.com/gtag/js`, `gtm.js`/`GTM-`, `fbevents.js`/`fbq(`. `analytics` es array (coexisten). |
| FPRINT-08 | Confianza baja o sin señal → "no detectado con certeza", nunca forzar respuesta | Resolvedor de confianza con umbral explícito; `value: null` + `confidence: "no-detectado"` cuando 0 señales. Es el invariante central del motor. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `cheerio` | ^1.2.0 (ya en repo) | Parseo/matching de HTML markers (clases, comentarios, script tags, paths) | Ya es el parser del proyecto; `@auditor/graph` lo usa igual como dep directa. `detectStack` recibe HTML string y lo parsea con `cheerio.load()` para matchear marcadores de builder/framework de forma robusta (no regex frágil sobre HTML). [VERIFIED: packages/graph/package.json depende de `cheerio@^1.2.0`] |
| TypeScript | ^5.7.2 (ya en repo) | Contrato de datos tipado (`DetectedStack`, `AxisResult`, discriminated unions de confianza) | El contrato tipado es el entregable de mayor valor de la fase — lo consumen worker (26) y adapters (27). [VERIFIED: root package.json] |
| Vitest | ^4.1.9 (ya en repo) | Tests unitarios por eje + fixtures sintéticos | Framework de test estándar del monorepo; cada paquete corre `vitest run`. [VERIFIED: packages/scoring/package.json, packages/graph/package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (ninguna nueva) | — | — | El motor es puro TS + cheerio. Parseo de nombres de cookie desde `Set-Cookie` se hace con un split simple (`cookie.split(";")[0].split("=")[0].trim()`), no necesita `set-cookie-parser` — solo se quieren nombres, no valores/atributos. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Motor de firmas propio | `wappalyzer-core` / dataset `enthec/webappanalyzer` | **RECHAZADO en REQUIREMENTS/STATE**: deprecado, sin mantenimiento, licencia GPL-3.0 incompatible con vendorizar. No usar. |
| Motor de firmas propio | APIs pagas (Wappalyzer API, BuiltWith API) | **RECHAZADO**: costo por request no encaja con auditoría gratis a 500 URLs; requisito explícito de Juan de fingerprint propio. |
| Split manual de `Set-Cookie` | `set-cookie-parser` (npm) | Innecesario: solo se necesitan nombres de cookie, no atributos. Añadir dep externa para un `split` es sobre-ingeniería. Si se quisiera robustez extra ante cookies con `=` en valores, el nombre siempre es lo anterior al primer `=`, que el split cubre. |

**Installation:**
```bash
# No hay instalación de paquetes externos nuevos.
# El paquete nuevo se crea dentro del monorepo:
#   packages/fingerprint/{package.json, tsconfig.json, src/}
# Su package.json declara dependencia workspace de cheerio (misma versión que el repo)
# y devDependencies estándar (@types/node, typescript, vitest) — copiar de packages/graph.
```

**Version verification:** No aplica registro npm — no se instalan paquetes externos. Las versiones de `cheerio`, `typescript`, `vitest` se heredan de las ya fijadas en el repo (verificadas en `packages/graph/package.json` y `packages/scoring/package.json`).

## Package Legitimacy Audit

**No se instalan paquetes externos nuevos en esta fase.** El motor de fingerprint es código propio (patrón registry) que depende únicamente de `cheerio`, ya presente y en uso en el monorepo (`@auditor/graph`, `@auditor/checks`). No hay superficie de slopsquatting ni de postinstall malicioso.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
CRAWL (ya existe, packages/crawler/src/crawl.ts)
  │
  ▼
requestHandler(ctx)  ── ctx.response.headers ─┐   (FPRINT-01 capture point)
  │                  ── ctx.$ / ctx.body ─────┤
  │                                            │
  ├─ [NUEVO] curateHeaders(response.headers) ──┤─→ responseHeaders (Json curado)
  ├─ [NUEVO] parseCookieNames(set-cookie)   ───┘─→ cookieNames (String[])
  │
  ▼
prisma.page.upsert({ ...existente, responseHeaders, cookieNames })   ← DB (Page)
  │
  ▼  (Phase 26 wiring — NO en esta fase)
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  │
  ▼
detectStack({ pages: PageFingerprintInput[] })   ← packages/fingerprint (función pura)
  │
  ├─ para cada eje: correr signatures del registry sobre el input AGREGADO
  │     signatures = [{ id, axis, test(input) → boolean|matchCount, strength }]
  │
  ├─ recolectar señales que matchearon por eje  →  Signal[]
  │
  ├─ resolveConfidence(signals) → { value, confidence, signals }   (reglas explícitas)
  │     · builder: sub-resolución especial (empate → no-detectado)
  │     · analytics: NO colapsar — devolver AxisResult[] (coexisten)
  │
  ▼
DetectedStack = { cms, builder, cdn, hosting, jsFramework, analytics }
```

**Entrada:** headers curados + nombres de cookie + `Page.html` (home primero, fallback a cualquier página), todo agregado del set de páginas del audit.
**Salida:** un objeto por eje, cada eje con `value`/`confidence`/`signals`, `analytics` como array.

### Recommended Project Structure
```
packages/fingerprint/
├── package.json          # @auditor/fingerprint, dep: cheerio; mismo shape que packages/graph
├── tsconfig.json         # extends ../../tsconfig.base.json
└── src/
    ├── index.ts          # export detectStack + todos los tipos públicos
    ├── types.ts          # DetectedStack, AxisResult, Confidence, Signal, PageFingerprintInput, Axis
    ├── detectStack.ts    # función pura orquestadora + resolveConfidence
    ├── signatures/
    │   ├── cms.ts        # signatures eje cms (WordPress, Shopify, Webflow, Wix, Squarespace)
    │   ├── builder.ts    # signatures eje builder (Elementor, WPBakery, Divi, Gutenberg)
    │   ├── cdn.ts        # signatures eje cdn (Cloudflare, Fastly, Akamai)
    │   ├── hosting.ts    # signatures eje hosting (Vercel, Netlify, WP Engine, etc.)
    │   ├── jsFramework.ts # signatures eje jsFramework (Next.js, React, Vue, Nuxt)
    │   └── analytics.ts  # signatures eje analytics (GA4, GTM, Meta Pixel)
    ├── signatures/registry.ts   # agrega todas las signatures por eje
    └── __fixtures__/     # HTML/headers sintéticos por firma para tests
        ├── wordpress-elementor.ts
        ├── shopify.ts
        └── ...
```

### Pattern 1: Captura de headers/cookies en el crawler existente
**What:** Añadir dos líneas de derivación + dos campos al `upsert` dentro del `requestHandler` ya existente, sin cambiar la firma del crawl ni agregar requests.
**When to use:** FPRINT-01. Es el único punto del pipeline donde estos datos existen sin request extra [VERIFIED: packages/crawler/src/crawl.ts líneas 99-139].
**Example:**
```typescript
// packages/crawler/src/crawl.ts, dentro de requestHandler(ctx), antes del upsert.
// response.headers es el objeto de got-scraping: keys en minúscula, set-cookie como string[].

// Lista CURADA (no todo el objeto crudo) — decisión de CONTEXT.
const CURATED_HEADER_KEYS = [
  "server", "x-powered-by", "via", "x-generator",
  "cf-ray", "cf-cache-status", "x-served-by", "x-cache",
  "x-akamai-transformed", "x-amz-cf-id", "x-amz-cf-pop",
  "x-drupal-cache", "x-drupal-dynamic-cache",
  "x-shopify-stage", "x-sorting-hat-shopid", "x-shardid",
  "x-wix-request-id", "x-hs-hub-id", "link", "x-nextjs-cache",
] as const;

function curateHeaders(headers: Record<string, string | string[] | undefined>) {
  const out: Record<string, string> = {};
  for (const key of CURATED_HEADER_KEYS) {
    const v = headers[key];
    if (v == null) continue;
    out[key] = Array.isArray(v) ? v.join(", ") : v;
  }
  return out;
}

// Solo NOMBRES de cookie (FPRINT-01) — nunca valores/atributos.
function parseCookieNames(setCookie: string | string[] | undefined): string[] {
  if (!setCookie) return [];
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  const names = arr
    .map((c) => c.split(";")[0].split("=")[0].trim())
    .filter(Boolean);
  return Array.from(new Set(names)); // dedup por página
}

const responseHeaders = curateHeaders(response?.headers ?? {});
const cookieNames = parseCookieNames(response?.headers?.["set-cookie"]);
// ...luego en el upsert create/update: responseHeaders (Json), cookieNames (String[])
```

### Pattern 2: Signature registry por eje
**What:** Cada firma es un objeto declarativo `{ id, axis, value, test(input), strength }`. `test` recibe el input agregado y devuelve si matcheó (y opcionalmente cuántos marcadores, útil para el desempate de builders).
**When to use:** Todos los ejes. Reemplaza regex sueltos por estructura testeable — decisión de CONTEXT.
**Example:**
```typescript
// packages/fingerprint/src/types.ts
export type Axis = "cms" | "builder" | "cdn" | "hosting" | "jsFramework" | "analytics";
export type Confidence = "alto" | "medio" | "bajo" | "no-detectado";
export type SignalStrength = "fuerte" | "debil";

export interface Signal {
  id: string;          // id de la firma que matcheó
  axis: Axis;
  strength: SignalStrength;
  evidence: string;    // qué marcó, p.ej. "header cf-ray present" — para debug/UI de Phase 26
}

export interface AxisResult {
  value: string | null;            // "WordPress", "Cloudflare", ... o null
  confidence: Confidence;
  signals: Signal[];               // señales que soportan este value
}

export interface DetectedStack {
  cms: AxisResult;
  builder: AxisResult;             // relevante solo si cms === WordPress; si no, no-detectado
  cdn: AxisResult;
  hosting: AxisResult;
  jsFramework: AxisResult;
  analytics: AxisResult[];         // ARRAY: coexisten GA4 + GTM + Meta Pixel
}

// Input desacoplado: NO importa el tipo Page de Prisma.
export interface PageFingerprintInput {
  url: string;
  isHome: boolean;                 // el worker marca la home (o la primera sitemap url)
  html: string | null;
  responseHeaders: Record<string, string>;
  cookieNames: string[];
}

export interface Signature {
  id: string;
  axis: Axis;
  value: string;                   // qué tecnología representa esta firma
  strength: SignalStrength;
  // recibe el input agregado ya normalizado; devuelve nº de páginas/marcadores que matchean (0 = no match)
  test(ctx: AggregatedInput): number;
}
```

### Pattern 3: Resolución de confianza por reglas explícitas
**What:** A partir de las señales que matchearon para un `value`, derivar la confianza sin puntaje numérico.
**When to use:** FPRINT-02, FPRINT-08. Es la regla de CONTEXT literal.
**Example:**
```typescript
// packages/fingerprint/src/detectStack.ts
function resolveConfidence(signals: Signal[]): Confidence {
  const strong = signals.filter((s) => s.strength === "fuerte").length;
  const weak = signals.filter((s) => s.strength === "debil").length;
  if (strong >= 2) return "alto";            // 2+ señales fuertes coincidentes
  if (strong === 1 && isUnequivocal(signals)) return "alto"; // 1 señal inequívoca
  if (strong === 1) return "medio";          // 1 señal fuerte sola
  if (weak >= 1) return "bajo";              // señal débil/indirecta
  return "no-detectado";                      // 0 señales → NUNCA forzar (FPRINT-08)
}
// isUnequivocal: firmas marcadas como inequívocas (p.ej. cookie `_shopify_s`, header `x-shopify-stage`)
```

### Anti-Patterns to Avoid
- **Default implícito de Gutenberg:** nunca asumir "WordPress sin builder detectado ⇒ Gutenberg". Gutenberg necesita marcador POSITIVO propio (`wp-block-*`, `<!-- wp:...`). Sin él, builder = no-detectado aunque el CMS sea WordPress claro. (FPRINT-08, success criteria #2 del ROADMAP.)
- **Winner-take-all entre ejes:** cada eje se resuelve independiente. Un sitio puede ser WordPress (cms) detrás de Cloudflare (cdn) con React (jsFramework) — los tres coexisten, no compiten.
- **Colapsar analytics a un valor:** `analytics` es array. Un sitio con GA4 + GTM + Meta Pixel debe reportar los tres.
- **Regex directo sobre HTML crudo para marcadores estructurales:** parsear con cheerio (`$('[class*="elementor-"]')`, `$('script#__NEXT_DATA__')`) es más robusto que regex frágil. Reservar regex solo para marcadores de comentario (`<!-- wp:`) o paths dentro de atributos.
- **Subir a "alto" con un solo header ambiguo:** un `server: nginx` solo no es "alto" para nada — es señal débil de hosting a lo sumo. La regla de 2+ fuertes / 1 inequívoca lo previene.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parseo de HTML markers | Regex ad-hoc sobre el string HTML | `cheerio.load(html)` + selectores | Robustez ante atributos multi-clase, orden, comillas; ya es el parser del repo |
| Motor de firmas completo | Reimplementar Wappalyzer/BuiltWith (cientos de categorías) | Registry propio acotado a 6 ejes | Scope creep enorme prohibido por REQUIREMENTS "Out of Scope" |
| Confianza cuantitativa | Sistema de scoring 0-100 con pesos calibrados | Reglas explícitas alto/medio/bajo/no-detectado | Decisión de CONTEXT; evita falsa precisión y retrabajo de calibración |
| Dedup/normalización de headers | Manejar mayúsculas/minúsculas por tu cuenta | got-scraping ya entrega header keys en minúscula | Menos superficie de bug; asumir lowercase e igual normalizar defensivamente en `detectStack` |

**Key insight:** El valor de esta fase NO está en cubrir muchas tecnologías, sino en un contrato de datos limpio y una regla de confianza que **nunca miente**. Un fingerprint que dice "no detectado con certeza" es correcto; uno que fuerza "Gutenberg" o "nginx" sin señal daña la credibilidad del lead magnet (REQUIREMENTS "Out of Scope": afirmar CMS con 100% de certeza siempre está explícitamente prohibido).

## Signatures por eje (calibrar contra sitios reales durante ejecución)

> Confianza de las firmas: **MEDIUM** — agregado de fuentes de comunidad/documentación, no verificadas contra sitios reales en esta sesión. La QA manual contra 2-3 sitios por builder cierra el blocker de STATE.md. Marcar `[fuerte]`/`[debil]` según inequivocidad.

### CMS (FPRINT-02)
| Tecnología | Señales fuertes | Señales débiles |
|-----------|-----------------|-----------------|
| WordPress | HTML: `/wp-content/`, `/wp-includes/` en paths de assets; `<meta name="generator" content="WordPress...">`; cookie `wordpress_logged_in_*` | header `link` con `rel="https://api.w.org/"` |
| Shopify | header `x-shopify-stage` / `x-sorting-hat-shopid` / `x-shardid`; cookie `_shopify_s` / `_shopify_y`; HTML `cdn.shopify.com` [CITED: elsner.com shopify detection] | `Powered by Shopify` en HTML |
| Webflow | `<meta name="generator" content="Webflow">`; HTML `assets.website-files.com` / `.webflow.io`; atributos `data-wf-page`/`data-wf-site` | — |
| Wix | HTML `wixstatic.com` / `parastorage.com`; header `x-wix-request-id`; `<meta name="generator" content="Wix.com Website Builder">` | — |
| Squarespace | cookie `squarespace-refresh`; `<meta name="generator" content="Squarespace">`; HTML `static1.squarespace.com` / `squarespace-cdn.com` | — |

[VERIFIED: WebSearch — cookie names _shopify_s, squarespace-refresh, wp-content confirmados como señales estándar en múltiples fuentes de detección CMS] [CITED: detectzestack.com/blog/detect-what-cms-website-uses]

### Builder WordPress (FPRINT-03) — ver sección dedicada abajo

### CDN/proxy (FPRINT-04)
| Tecnología | Señales fuertes |
|-----------|-----------------|
| Cloudflare | header `cf-ray` presente **+** `server: cloudflare`; `cf-cache-status` [VERIFIED: WebSearch — cf-ray siempre presente, server: cloudflare] |
| Fastly | header `x-served-by` con nodo cache **+** `x-cache`/`x-cache-hits`; a veces `via: ... varnish` [CITED: webreveal.io CDN detection] |
| Akamai | headers `x-akamai-*` (p.ej. `x-akamai-transformed`, `x-akamai-request-id`); `x-check-cacheable` [CITED: barrion.io waf-checker] |
| CloudFront (AWS) | headers `x-amz-cf-id` + `x-amz-cf-pop`; `via: ... cloudfront` |

[CITED: barrion.io/tools/waf-checker — CF-Ray, X-Served-By, X-Akamai-*, X-Amz-Cf-Id como marcadores vendor-específicos; confianza derivada de nº de señales independientes al mismo vendor]

### Hosting/origen (FPRINT-05)
| Tecnología | Señales fuertes | Nota |
|-----------|-----------------|------|
| Vercel | header `server: Vercel` / `x-vercel-*`; `x-vercel-id` | — |
| Netlify | header `server: Netlify`; `x-nf-request-id` | — |
| WP Engine | header `x-powered-by`/cookie `wpengine`; `x-wpe-*` | — |
| Nginx/Apache origen | header `server: nginx`/`server: Apache` | **débil** — genérico; casi nunca sube a alto |

**Pitfall crítico (FPRINT-05):** cuando hay CDN delante (Cloudflare reescribe `server: cloudflare`), el header de origen se pierde. En ese caso hosting debe devolver `no-detectado`, NO adivinar. CONTEXT/REQUIREMENTS lo reconocen explícitamente.

### JS Framework (FPRINT-06)
| Tecnología | Señales fuertes |
|-----------|-----------------|
| Next.js | HTML `<script id="__NEXT_DATA__">`; assets bajo `/_next/static/`; header `x-powered-by: Next.js` / `x-nextjs-cache` [CITED: detectzestack.com detect-javascript-framework] |
| Nuxt | HTML paths `/_nuxt/`; `<script>window.__NUXT__` [CITED: detectzestack.com] |
| React (sin meta-framework) | atributo `data-reactroot` (SSR legacy); `id="root"` + bundles React; **débil** en apps modernas que no dejan marca [CITED: detectzestack.com detect-react-website] |
| Vue | atributos `data-v-*` en el DOM SSR; `id="app"` + `__vue__` | 

**Nota (FPRINT-06):** frameworks CSR modernos suelen no dejar marcador claro en el HTML crudo del CheerioCrawler (no ejecuta JS). Muchos sitios Next.js SSR que quitan `__NEXT_DATA__` o sirven HTML estático no serán detectables — devolver no-detectado es correcto, no forzar [CITED: webreveal.io detect-javascript-framework]. El crawler del proyecto es Cheerio (HTML crudo), no Playwright, así que esta limitación es esperada y aceptable para esta fase.

### Analytics (FPRINT-07) — array, coexisten
| Tecnología | Señales fuertes |
|-----------|-----------------|
| GA4 (gtag) | HTML `googletagmanager.com/gtag/js?id=G-`; llamada `gtag(` |
| Google Tag Manager | HTML `googletagmanager.com/gtm.js`; `GTM-` en script; `dataLayer` |
| Meta Pixel | HTML `connect.facebook.net/.../fbevents.js`; `fbq('init'` [CITED: analyticsmania.com facebook-pixel-gtm] |

[VERIFIED: WebSearch — gtag.js/GTM-/fbevents.js/fbq confirmados como firmas HTML estándar de estas herramientas]

## Detección de builder WordPress (FPRINT-03)

Solo relevante cuando `cms.value === "WordPress"`. Multi-señal, nunca un solo header.

| Builder | Marcadores (todos [fuerte] si multi-match) |
|---------|--------------------------------------------|
| Elementor | clases `elementor-*` / atributos `data-elementor-*`; path `/wp-content/plugins/elementor/` en assets |
| WPBakery | clases `wpb_*` / `vc_row`; path `js_composer` |
| Divi | clases `et_pb_*`; tema/path `Divi` / `et-builder` |
| Gutenberg | **regla POSITIVA**: clases `wp-block-*`; comentarios `<!-- wp:paragraph -->` / `<!-- wp:` |

**Desempate:** contar marcadores por builder. Gana el de mayor conteo. Empate real con confianza alta en dos builders → `value: null`, `confidence: "no-detectado"` (no prioridad fija arbitraria). Diseñar `Signature.test()` para que devuelva el **conteo** de marcadores, no solo boolean, para poder desempatar.

**Regla dura:** WordPress detectado + ningún builder matchea → builder = no-detectado. **Nunca** default a Gutenberg sin marcador positivo.

**QA de ejecución (cierra blocker STATE.md):** durante la fase, buscar 2-3 sitios públicos por builder:
- Elementor: showcases en elementor.com/showcase o sitios conocidos.
- Divi: elegantthemes.com/gallery.
- WPBakery: sitios con `js_composer` visible.
Validar que las firmas matchean en HTML real, no solo en fixtures sintéticos. Se PUEDE usar WebFetch para traer el HTML de 1-2 sitios reales por builder y confirmar los marcadores durante la implementación/tests.

## Runtime State Inventory

No aplica — esta fase es greenfield (paquete nuevo + columnas aditivas), no un rename/refactor/migración. Las dos columnas nuevas (`Page.responseHeaders`, `Page.cookieNames`) son aditivas y nullable/default-empty; los audits previos simplemente no las tienen pobladas (comportamiento idéntico al patrón `schemaGraph`/`schemaJson`). No hay estado runtime externo que renombrar.

## Common Pitfalls

### Pitfall 1: CDN enmascara el header de origen (hosting)
**What goes wrong:** Un sitio detrás de Cloudflare devuelve `server: cloudflare`, ocultando si el origen es nginx/Apache/LiteSpeed.
**Why it happens:** El proxy reescribe el header `server` de respuesta.
**How to avoid:** Aceptar que hosting puede quedar `no-detectado` cuando hay CDN fuerte detectado. No inferir origen desde el CDN. (FPRINT-05 lo reconoce explícitamente.)
**Warning signs:** `cdn.confidence === "alto"` + `hosting` con solo un `server` genérico.

### Pitfall 2: ReDoS sobre HTML controlado por el atacante (SEGURIDAD)
**What goes wrong:** Las firmas corren sobre HTML de sitios arbitrarios (input no confiable). Un regex mal formado (backtracking catastrófico) sobre HTML adversario puede colgar el worker.
**Why it happens:** El HTML crawleado es 100% controlado por terceros; `detectStack` es una función que procesa untrusted input.
**How to avoid:** Preferir cheerio/selectores e `includes()` de strings sobre regex. Donde se use regex, mantenerlo lineal (sin cuantificadores anidados `(a+)+`); anclar y acotar. Cap del tamaño de HTML procesado por página (p.ej. truncar a N KB) antes de correr firmas — el HTML ya está persistido, pero el matching no necesita megabytes.
**Warning signs:** Regex con `.*.*`, grupos con `+`/`*` anidados, alternancias amplias sin anclaje.

### Pitfall 3: `Set-Cookie` como array vs string
**What goes wrong:** En Node/got-scraping, `response.headers["set-cookie"]` es normalmente `string[]` (una entrada por cookie), pero código defensivo debe tolerar `string` único.
**Why it happens:** La spec HTTP permite múltiples `Set-Cookie`; Node los agrupa en array solo para este header.
**How to avoid:** `Array.isArray(setCookie) ? setCookie : [setCookie]` antes de mapear a nombres (ver Pattern 1).
**Warning signs:** `cookieNames` vacío en sitios que claramente setean cookies.

### Pitfall 4: Home page falló o vino vacía
**What goes wrong:** Priorizar HTML de home, pero la home puede haber devuelto 5xx/vacío.
**Why it happens:** Crawl real: la home a veces falla mientras subpáginas responden.
**How to avoid:** Fallback explícito a cualquier página con HTML no vacío si la home falló (decisión de CONTEXT). Los headers/cookies igual se agregan de TODAS las páginas, no solo home.
**Warning signs:** `cms.confidence === "no-detectado"` en un sitio obvio porque solo se miró la home.

### Pitfall 5: Header key casing
**What goes wrong:** Asumir `CF-Ray` en vez de `cf-ray`.
**Why it happens:** HTTP headers son case-insensitive; got-scraping los entrega en minúscula, pero un fixture escrito a mano puede diferir.
**How to avoid:** Normalizar todas las keys a minúscula al construir el `AggregatedInput` dentro de `detectStack`, y escribir fixtures en minúscula.
**Warning signs:** Firma de CDN no matchea en tests con fixtures cased.

## Code Examples

### detectStack — esqueleto de la orquestación
```typescript
// packages/fingerprint/src/detectStack.ts
import { load } from "cheerio";
import { registry } from "./signatures/registry";
import type { DetectedStack, PageFingerprintInput, AxisResult, Signal, Axis } from "./types";

export function detectStack(input: { pages: PageFingerprintInput[] }): DetectedStack {
  const agg = aggregate(input.pages); // normaliza headers lowercase, une cookieNames, elige HTML (home→fallback), pre-parsea cheerio

  const cms = resolveAxis("cms", agg);
  const cmsIsWordPress = cms.value === "WordPress";
  const builder = cmsIsWordPress ? resolveBuilder(agg) : emptyAxis();

  return {
    cms,
    builder,
    cdn: resolveAxis("cdn", agg),
    hosting: resolveAxis("hosting", agg),
    jsFramework: resolveAxis("jsFramework", agg),
    analytics: resolveAnalytics(agg), // devuelve AxisResult[]
  };
}

function resolveAxis(axis: Axis, agg: AggregatedInput): AxisResult {
  const matched: Signal[] = [];
  for (const sig of registry[axis]) {
    const count = sig.test(agg);
    if (count > 0) matched.push({ id: sig.id, axis, strength: sig.strength, evidence: `${sig.id} x${count}` });
  }
  // agrupar por value candidato, elegir el value con más señales fuertes, resolver confianza
  return pickBestValue(matched, registry[axis]);
}

function emptyAxis(): AxisResult {
  return { value: null, confidence: "no-detectado", signals: [] };
}
```

### Fixture sintético (test por firma)
```typescript
// packages/fingerprint/src/__fixtures__/shopify.ts
export const shopifyPage: PageFingerprintInput = {
  url: "https://example.com/",
  isHome: true,
  html: `<html><head><script src="https://cdn.shopify.com/s/files/app.js"></script></head><body>Powered by Shopify</body></html>`,
  responseHeaders: { "x-shopify-stage": "production", "x-sorting-hat-shopid": "12345" },
  cookieNames: ["_shopify_s", "_shopify_y"],
};
// test: detectStack({ pages: [shopifyPage] }).cms → { value: "Shopify", confidence: "alto", ... }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `wappalyzer-core` como librería vendorizada | Motor propio de firmas | Wappalyzer core cerró open-source / licencia GPL restrictiva (~2023-2024) | Confirma la decisión de REQUIREMENTS de no depender de él |
| Detección por single-header | Multi-señal con confianza por nº de señales independientes | Práctica estándar 2026 en detección WAF/CDN | Refuerza la regla de confianza de CONTEXT |
| `meta generator` como fuente principal | Múltiples señales (cookies, paths, headers, clases) porque Shopify/Wix/Squarespace no ponen generator fiable | — | Por eso las firmas CMS combinan cookie+path+header, no solo generator [CITED: webreveal.io what-cms] |

**Deprecated/outdated:**
- `wappalyzer-core` / dataset `enthec/webappanalyzer`: deprecado/GPL — no usar.
- Detección de framework JS por ejecución de JS en el DOM: no aplica aquí (CheerioCrawler no ejecuta JS); aceptamos cobertura parcial en jsFramework.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | got-scraping entrega `response.headers` con keys en minúscula y `set-cookie` como `string[]` | Pattern 1 / Pitfall 3/5 | Bajo — se normaliza defensivamente igual; test de captura lo confirma en ejecución |
| A2 | Firmas específicas de builder (clases `elementor-*`, `et_pb_*`, `wpb_*`, `wp-block-*`) matchean en HTML real | Detección builder | Medio — mitigado por QA obligatoria contra 2-3 sitios reales por builder |
| A3 | Firmas de CDN/hosting (headers `cf-ray`, `x-served-by`, `x-akamai-*`, `x-amz-cf-*`) siguen vigentes | Signatures CDN/hosting | Bajo-medio — cross-check con múltiples fuentes 2026; validar contra un audit real |
| A4 | `x-powered-by: Next.js` sigue emitiéndose por defecto en despliegues Next 16 | Signatures jsFramework | Medio — muchos sitios lo desactivan; por eso `__NEXT_DATA__`/`/_next/` son las señales primarias, el header es secundario |
| A5 | Solo se necesitan nombres de cookie (no atributos) → split simple basta | Standard Stack / Pattern 1 | Bajo — es literal la decisión de CONTEXT (FPRINT-01) |

## Open Questions

1. **¿La home siempre está marcable como `isHome` en el input?**
   - What we know: el crawler siembra desde sitemap; la primera URL o `normalizedStartUrl` es la home.
   - What's unclear: en crawls sitemap-seeded, `Page` no distingue home explícitamente hoy.
   - Recommendation: el worker (Phase 26) marca `isHome` comparando `Page.url`/`finalUrl` contra `Audit.resolvedUrl`. Para esta fase, el contrato `PageFingerprintInput.isHome` lo deja explícito; los tests fijan la home a mano. No bloquea Phase 25.

2. **¿Truncar HTML antes de matchear?**
   - What we know: `Page.html` puede ser grande; el matching no necesita todo.
   - What's unclear: umbral óptimo.
   - Recommendation: truncar a ~256 KB por página en `aggregate()` (mitiga ReDoS y memoria). Ajustable; documentar la constante.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | Build/test del paquete | ✓ (asumido) | >=20 (engines) | — |
| pnpm | Monorepo | ✓ | 10.0.0 | — |
| Vitest | Tests del paquete | ✓ | ^4.1.9 (en repo) | — |
| Neon Postgres | `pnpm db:push` de columnas nuevas | ✓ (asumido, usado en fases previas) | 16/17 | — |
| cheerio | Matching HTML | ✓ (en repo) | ^1.2.0 | — |

**Missing dependencies with no fallback:** ninguna identificada — la fase es código + un `db:push` contra la Neon ya en uso.
**Missing dependencies with fallback:** ninguna.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.9 |
| Config file | none — cada paquete corre `vitest run` sin config custom (patrón de `packages/scoring`, `packages/graph`) |
| Quick run command | `pnpm --filter @auditor/fingerprint test` |
| Full suite command | `pnpm test` (turbo run test en todos los paquetes) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FPRINT-01 | curateHeaders devuelve solo keys curadas; parseCookieNames extrae solo nombres, tolera array/string | unit | `pnpm --filter @auditor/crawler test` | ❌ Wave 0 (nuevo test en crawler) |
| FPRINT-02 | detectStack detecta cada CMS con confianza correcta desde fixture | unit | `pnpm --filter @auditor/fingerprint test` | ❌ Wave 0 |
| FPRINT-03 | builder correcto por fixture; empate → no-detectado; WP sin builder → no-detectado | unit | `pnpm --filter @auditor/fingerprint test` | ❌ Wave 0 |
| FPRINT-04 | CDN detectado desde headers (Cloudflare/Fastly/Akamai) | unit | `pnpm --filter @auditor/fingerprint test` | ❌ Wave 0 |
| FPRINT-05 | hosting no-detectado cuando CDN enmascara origen | unit | `pnpm --filter @auditor/fingerprint test` | ❌ Wave 0 |
| FPRINT-06 | framework JS detectado desde marcadores HTML | unit | `pnpm --filter @auditor/fingerprint test` | ❌ Wave 0 |
| FPRINT-07 | analytics devuelve array con GA4+GTM+Meta coexistiendo | unit | `pnpm --filter @auditor/fingerprint test` | ❌ Wave 0 |
| FPRINT-08 | 0 señales → value:null, confidence:"no-detectado"; nunca Gutenberg default | unit | `pnpm --filter @auditor/fingerprint test` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @auditor/fingerprint test` (o el paquete tocado)
- **Per wave merge:** `pnpm test` + `pnpm typecheck`
- **Phase gate:** suite completa verde + QA manual de builder contra 2-3 sitios reales antes de `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/fingerprint/package.json` + `tsconfig.json` — scaffold del paquete (copiar de `packages/graph`)
- [ ] `packages/fingerprint/src/__fixtures__/*.ts` — fixtures sintéticos por firma (uno por CMS/builder/CDN/framework/analytics)
- [ ] `packages/fingerprint/src/*.test.ts` — tests por eje
- [ ] Test de captura en `packages/crawler` para `curateHeaders`/`parseCookieNames`
- [ ] `pnpm db:push` tras añadir `Page.responseHeaders`/`Page.cookieNames` al schema

## Security Domain

`security_enforcement: true`, ASVS level 1, block_on: high.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Sin auth en esta fase |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | **yes** | El HTML/headers/cookies vienen de sitios arbitrarios (untrusted). Procesar con parseo seguro (cheerio), truncar tamaño, regex lineal sin backtracking catastrófico. No `eval`/no ejecución de scripts del sitio. |
| V6 Cryptography | no | No se maneja crypto ni secretos |

### Known Threat Patterns for este stack (motor puro sobre input no confiable)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| ReDoS en firmas regex sobre HTML adversario | Denial of Service | Preferir cheerio/`includes()`; regex lineal anclado; cap de tamaño de HTML (~256 KB/página) antes de matchear |
| Consumo de memoria por HTML gigante | Denial of Service | Truncar HTML en `aggregate()`; no cargar todo el set en un solo string |
| Inyección vía valores de header/cookie que luego se muestran (Phase 26 UI) | XSS (diferido a 26) | En esta fase: `evidence`/`value` son strings controlados por el motor (no reflejan valores crudos del sitio). Nombres de cookie sí vienen del sitio — la UI de Phase 26 debe escaparlos; anotar para 26. No persistir valores de cookie (solo nombres) reduce superficie. |

**Nota:** el motor NO ejecuta JavaScript del sitio (CheerioCrawler es HTML crudo), lo que elimina la clase de amenaza más grande (ejecución de código de terceros). El riesgo residual principal es DoS por regex/memoria, mitigable con las medidas anteriores.

## Sources

### Primary (HIGH confidence)
- `packages/crawler/src/crawl.ts` (repo) — punto de captura `requestHandler`, `response.headers`, `ctx.$`/`ctx.body` disponibles antes del upsert
- `packages/db/prisma/schema.prisma` (repo) — modelo `Page` (patrón Json aditivo `schemaGraph`/`schemaJson`), modelo `Audit`
- `packages/scoring`, `packages/graph` (repo) — patrón de paquete puro desacoplado (package.json/tsconfig/index shape)
- `packages/checks/src/types.ts` + `registry.ts` (repo) — patrón registry (`{ checkId, run(ctx) }`) análogo al de signatures

### Secondary (MEDIUM confidence)
- [barrion.io WAF checker](https://barrion.io/tools/waf-checker) — marcadores CF-Ray/X-Served-By/X-Akamai/X-Amz-Cf-Id; confianza por nº de señales independientes
- [webreveal.io — detect CDN](https://webreveal.io/blog/how-to-detect-website-cdn.html) y [detect JS framework](https://webreveal.io/blog/how-to-detect-javascript-framework.html)
- [detectzestack.com — detect CMS](https://detectzestack.com/blog/detect-what-cms-website-uses) y [detect JS framework](https://detectzestack.com/blog/detect-javascript-framework-website)
- [elsner.com — Shopify detection](https://www.elsner.com/shopify-ecommerce-platform-detection-methods/)
- [analyticsmania.com — Meta Pixel signatures](https://www.analyticsmania.com/post/facebook-pixel-with-google-tag-manager/)

### Tertiary (LOW confidence)
- Firmas específicas de builder WP (clases/paths) — agregado de fuentes de comunidad; **requieren QA manual contra sitios reales durante ejecución** (blocker STATE.md).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no hay paquetes externos nuevos; patrón de paquete puro verificado en el repo
- Architecture: HIGH — puntos de integración y patrón registry confirmados en código existente
- Contrato de datos: HIGH — deriva directo de decisiones locked en CONTEXT
- Firmas de detección: MEDIUM — cross-check de múltiples fuentes 2026; builder WP LOW hasta QA real

**Research date:** 2026-07-21
**Valid until:** 2026-08-20 (30 días — firmas de CDN/plataforma son razonablemente estables; revalidar builder WP contra sitios reales en ejecución)
