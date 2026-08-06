# Phase 31: Validación de og:image - Research

**Researched:** 2026-08-03
**Domain:** Verificación HTTP de imágenes remotas (fetch parcial con Range), lectura de dimensiones desde buffer, defensa SSRF en un `NetworkCheck`
**Confidence:** HIGH (forma real del código, API de `image-size`, umbrales de plataforma) / MEDIUM (bytes necesarios por formato, límites de peso por plataforma)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Fetcher dedupeado (IMG-01)**

- Nuevo `NetworkCheck` (`imgSocialCheck` o similar) en `packages/checks/src/checks/network/`, mismo patrón async/`SiteCheckCtx` que `brokenResourcesCheck`/`brokenExternalLinks`.
- Dedupe por URL de imagen (no por página): una misma og:image repetida en decenas de páginas se verifica una sola vez — mismo patrón de `Map<string, string>` (url normalizada → página de origen) que ya usa `brokenResourcesCheck`.
- Reusa `checkOne`/`checkLinks` de `packages/checks/src/checks/network/linkChecker.ts` para la alcanzabilidad (HEAD→GET fallback, timeout, concurrencia) — no reinventar el fetcher.
- Comparte el cap `MAX_URLS_PER_NETWORK_CHECK` (150) ya existente, con el mismo issue "ok" informativo de "verificación limitada" cuando se excede el cap (patrón ya usado en `brokenResourcesCheck`).

**Dimensiones y peso**

- `image-size@2.0.2` como dependencia NUEVA y DIRECTA de `packages/checks` (o de un paquete nuevo, a decidir en planning) — no reusar la versión `1.2.1` ya presente como transitiva en el lockfile (viene de Next.js internamente, no es una dependencia nuestra y no debe tratarse como tal).
- Las dimensiones se miden con un GET con `Range` request parcial (no descargar el archivo completo) — `image-size` soporta detectar dimensiones desde un buffer parcial para los formatos comunes (JPEG/PNG/WebP/GIF).
- El peso (bytes) se obtiene del header `Content-Length` de la misma respuesta HEAD/GET ya hecha para alcanzabilidad — sin request adicional dedicado sólo a medir peso. Si el servidor no expone `Content-Length` (chunked/sin header), omitir la evaluación de peso para esa imagen en vez de forzar una descarga completa sólo para medirlo.

**checkId, categoría y casos borde**

- checkId nuevo: `IMG-01` (plano, sin subtipo en el campo — igual patrón que Phase 30) para el check completo de validación de imagen (alcanzabilidad + dimensiones + peso, con severidad variable por tipo de problema vía fingerprint con subtipo, ej. `IMG-01:unreachable`, `IMG-01:too-small`, `IMG-01:too-large`). No hay colisión: `IMG-01..04` en REQUIREMENTS.md son IDs de requirement, no checkIds ya usados en el catálogo — confirmado por grep.
- Categoría: `"social"` (no `"tech"`, aunque el patrón técnico del fetcher es idéntico a `TECH-13`) — la validación de og:image es parte de la experiencia de compartir, coherente con el resto de checks de Phase 30.
- Severidad:
  - Error: dimensiones <200×200px, o peso >5MB, o imagen no alcanzable (4xx/5xx o content-type no es imagen).
  - Warning: dimensiones entre 200×200 y 600×315px o ratio lejos de 1.91:1, o peso entre 1MB y 5MB.
- Página sin og:image (SOCIAL-03 de Phase 30 ya marca esa ausencia): este check se omite completamente para esa página — no duplica la señal de "falta og:image", sólo valida la imagen cuando SÍ existe una URL.

### Claude's Discretion

- Nombre exacto del archivo/función del check y de cualquier módulo intermedio de "image fetch" si el planner decide separar la lógica de fetch+parse de dimensiones del `NetworkCheck` en sí (ej. utilidad reusable para Phase 32).
- Redacción exacta de `title`/`criterion`/`recommendation` de las distintas ramas de severidad.
- Estructura exacta del subtipo de fingerprint (ej. `IMG-01:unreachable` vs. `IMG-01:not-image` para content-type inválido) — el requirement no distingue explícitamente esos casos, así que el desglose fino queda a criterio del planner mientras cubra las 4 dimensiones (alcanzable/dimensiones/peso/tipo).

### Deferred Ideas (OUT OF SCOPE)

- IMG-05 (favicon alcanzable) — explícitamente diferido a v1.6.x/v1.7 en REQUIREMENTS.md, no se toca en esta fase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md:24-27) | Research Support |
|----|-------------|------------------|
| IMG-01 | fetcher de imágenes dedupeado por URL (HEAD + GET parcial), mismo patrón que `brokenResourcesCheck` (TECH-13) | Patrón de dedupe/cap/concurrencia documentado línea por línea en `## Architecture Patterns → Pattern 1`. **Bloqueante:** `checkLinks` no devuelve headers ni body, así que el patrón se REPLICA pero no se REUSA tal cual — ver Mismatch M-02. |
| IMG-02 | og:image alcanzable — sin 4xx/5xx, content-type es imagen | Clasificación de status + regla anti-falso-positivo de content-type en `Pattern 3` y `Pitfall 6`. |
| IMG-03 | dimensiones — error si <200×200; warning si 200×200–600×315 o ratio lejos de 1.91:1 | API exacta de `image-size@2.0.2` verificada contra el fuente (`Pattern 4`); umbrales confirmados contra la doc oficial de Facebook (`State of the Art`). |
| IMG-04 | peso — error sobre 5MB; warning entre 1MB y 5MB | Origen del tamaño total según status 206 vs 200 (`Pitfall 2`); el umbral de 5MB corresponde a X/LinkedIn, no a Facebook (8MB) — ver `State of the Art`. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directivas accionables que el planner debe respetar:

1. **Flujo GSD obligatorio.** Prohibido editar archivos fuera de un comando GSD (`/gsd:execute-phase` para trabajo planificado). El plan debe asumir ejecución por fase, no edición directa.
2. **Frontera Vercel/worker.** `apps/web` (Vercel) nunca debe resolver Playwright/Crawlee. `packages/checks` ES dependencia real de `apps/web` (`apps/web/package.json:14`, `next.config.ts:34` la lista en `transpilePackages`), así que **toda dependencia nueva agregada a `packages/checks` entra al grafo que Vercel resuelve**. `image-size` es JS puro sin binarios nativos y su entrada principal no toca `fs` (el acceso a disco vive en el subpath `image-size/fromFile`), así que es segura — pero el plan debe correr `pnpm assert:web-boundary` como verificación.
3. **No hand-rollear crypto, colas ni parsers.** Consistente con la decisión de usar `image-size` en vez de escribir un parser de headers propio.
4. **Sin llamadas de red en `PageCheck`.** El contrato `PageCheck.run` es síncrono (`packages/checks/src/types.ts:69-72`); toda red va por `NetworkCheck` (`types.ts:80-83`). Phase 30 honró esta prohibición explícitamente (`30-VERIFICATION.md:128`).
5. **Español neutro, sin voceo, en todo el copy de usuario** (`title`/`criterion`/`recommendation`). Los checks existentes mezclan tuteo ("Corrige…", "Agrega…") y algún voceo residual ("Confirmá el enlace" en `brokenExternalLinks.ts:89`). El copy nuevo debe usar tuteo neutro, como el resto de Phase 30.
6. **Deliverables escritos humanizados** — sin tells de escritura de IA, sin em/en dashes en el copy de producto.

---

## Summary

Esta fase es, en lo estructural, un clon de `brokenResourcesCheck` (TECH-13): recorrer `pages`, extraer una URL por página, deduplicar en un `Map`, capar a 150, verificar con concurrencia acotada, y emitir un `IssueDraft` por URL con problema más un issue informativo si se capó. Ese esqueleto existe, está probado y se puede copiar casi literal. Lo que **no** existe es la capa de transporte que esta fase necesita: `checkLinks` devuelve `{ url, ok, status }` y nada más — ni `content-type`, ni `content-length`, ni bytes del body. IMG-02, IMG-03 e IMG-04 necesitan las tres cosas. Por eso la decisión de CONTEXT.md de "reusar `checkOne`/`checkLinks` tal cual" no es realizable sin cambiar el contrato: hay que construir un módulo de sondeo de imagen propio (una función `probeImage(url)`) y, opcionalmente, extraer de `linkChecker.ts` el runner de concurrencia para que los dos lo compartan. Además `checkOne` ni siquiera está exportado.

El resto del terreno es sólido y verificado. `image-size@2.0.2` expone `imageSize(input: Uint8Array): ISizeCalculationResult` de forma síncrona, es dual ESM/CJS, no tiene dependencias nativas, tiene 35M descargas semanales y su entrada principal no toca el filesystem — es exactamente la herramienta para leer dimensiones desde un buffer parcial. Los umbrales del requirement coinciden con la documentación oficial de Facebook (mínimo 200×200, umbral de miniatura chica en 600×315, recomendado 1200×630, ratio 1.91:1); el techo de peso de 5MB corresponde a X y LinkedIn, no a Facebook, que admite hasta 8MB. Un solo GET con `Range: bytes=0-65535` por imagen única resuelve las cuatro señales a la vez (status, content-type, tamaño total y dimensiones) sin descargar el archivo completo, siempre que el body se lea por streaming y se cancele al llegar al límite.

El hallazgo de mayor impacto está fuera del terreno técnico obvio: **Phase 30 dejó declarada, y sin cruzar, una defensa SSRF que esta fase hereda** (`30-03-SUMMARY.md:267`). El valor de `og:image` lo controla íntegramente el sitio auditado, y el worker corre en el mismo contenedor/red que Redis y Postgres, así que una og:image apuntando a `http://127.0.0.1:6379` o a `http://169.254.169.254/` convierte al auditor en un oráculo de red interna. Los checks de red actuales (TECH-12/TECH-13) tienen la misma exposición hoy y ninguna defensa. Esto no está en las decisiones bloqueadas de CONTEXT.md y requiere una decisión explícita antes de planificar.

**Primary recommendation:** Construir `packages/checks/src/checks/network/imageProbe.ts` (un GET con `Range: bytes=0-65535`, lectura por streaming con corte a 64 KiB, validación de destino previa contra IPs privadas, `redirect: "manual"` con tope de 3 saltos) + `ogImageCheck.ts` (el `NetworkCheck` con el dedupe/cap/emisión calcado de `brokenResources.ts`), agregando `image-size@2.0.2` como dependencia directa de `packages/checks` y extrayendo el runner de concurrencia de `linkChecker.ts` a un helper compartido.

---

## Mismatches vs CONTEXT.md

Cada asunción de CONTEXT.md verificada contra el código real. Las que no coinciden están marcadas y deben resolverse antes de planificar.

| # | Asunción de CONTEXT.md | Realidad verificada | Severidad |
|---|------------------------|---------------------|-----------|
| **M-01** | "`image-size@1.2.1` YA está en el lockfile pero como dependencia TRANSITIVA (**probablemente de Next.js**)" | Es transitiva de **`pptxgenjs@4.0.1`**, declarada en `packages/export/package.json:19`. Ver `pnpm-lock.yaml:5380` (`pptxgenjs@4.0.1 → image-size: 1.2.1`). Next.js no la trae. La conclusión operativa de CONTEXT (agregar 2.0.2 como dep directa) sigue siendo correcta, pero el diagnóstico del origen era erróneo. | Bajo (cosmético) |
| **M-02** | "Reusa `checkOne`/`checkLinks` de `linkChecker.ts` para la alcanzabilidad — no reinventar el fetcher" | **No es realizable tal cual.** (a) `checkOne` NO está exportado (`linkChecker.ts:16`, declarada `async function`, sin `export`). (b) `LinkCheckResult` (`linkChecker.ts:11-13`) sólo lleva `url`/`ok`/`status`/`reason`: **no expone headers ni body**, así que no puede alimentar IMG-02 (content-type), IMG-03 (bytes) ni IMG-04 (Content-Length). (c) `REQUEST_TIMEOUT_MS` y `CONCURRENCY` tampoco están exportados (`linkChecker.ts:1-2`); lo único exportado además de `checkLinks` es `MAX_URLS_PER_NETWORK_CHECK` (`:9`). | **Alto — bloquea el diseño** |
| **M-03** | "El peso se obtiene del `Content-Length` de la misma respuesta HEAD/GET ya hecha para alcanzabilidad" | Correcto en intención, pero **incompleto**: si el servidor honra el `Range` y responde `206`, el `Content-Length` es el tamaño del **fragmento** (64 KiB), no del archivo. El tamaño total sólo está en `Content-Range: bytes 0-65535/1234567`. Usar `Content-Length` sin distinguir 206 de 200 mide 65536 bytes para toda imagen y nunca dispara IMG-04. | **Alto — defecto silencioso** |
| **M-04** | "`image-size` soporta detectar dimensiones desde un buffer parcial para los formatos comunes (JPEG/PNG/WebP/GIF)" | Correcto para PNG (24 bytes), GIF (10 bytes), WebP y BMP. **Para JPEG es condicional**: el marcador SOF está después de los segmentos JFIF/EXIF/ICC y una miniatura EXIF o un perfil ICC lo empujan decenas de KB adentro. Si queda fuera del buffer, el handler lanza `TypeError('Corrupt JPG, exceeded buffer limits')` (`lib/types/jpg.ts`, función `validateInput`). Hay que capturarlo y degradar, no propagarlo. | Medio |
| **M-05** | "Página sin og:image: el check se omite completamente" | Correcto y sin fricción: `firstValue(extractMetaSocial($), "og:image")` devuelve `undefined` (`packages/meta-social/src/extract.ts:69-71`) y `normalizeUrl` devuelve `null` para `data:`/`javascript:`/esquemas no http(s) (`packages/crawler/src/normalizeUrl.ts:48-50`), así que los `data:` URIs quedan filtrados sin código extra. | — (confirmado) |
| **M-06** | "`packages/meta-social` expone la extracción de og:image por página… posible necesidad de exponer un helper adicional" | **No hace falta ningún export nuevo.** `packages/meta-social/src/index.ts:3` ya exporta `extractMetaSocial` y `firstValue`, y `packages/checks` ya declara `@auditor/meta-social` como dependencia (`packages/checks/package.json`). El `NetworkCheck` sólo necesita hacer `cheerio.load(page.html)` él mismo, exactamente como `brokenResources.ts:24`. | — (confirmado) |
| **M-07** | "No hay colisión: ningún checkId `IMG-*` existe hoy" | Confirmado. `grep -rn '"IMG-0\|'"'"'IMG-0' packages apps --include="*.ts" --include="*.tsx"` devuelve cero resultados. También está libre en el catálogo de PSI (`packages/psi/src/issues.ts`, que sólo usa `PERF-*`). | — (confirmado) |
| **M-08** | (no mencionado en CONTEXT) | **Phase 30 declaró explícitamente que Phase 31 debe traer defensa SSRF propia**: "Debe traer su propia defensa (lista de destinos permitidos, rechazo de direcciones privadas y de bucle local, límite de redirecciones y de tiempo)" — `30-03-SUMMARY.md:267`. CONTEXT.md no lo recoge. | **Alto — alcance faltante** |
| **M-09** | (no mencionado en CONTEXT) | **Dilución de score.** El score de la categoría `social` es una tasa de aprobación sobre todas las filas (`packages/scoring/src/categoryScore.ts:40-47`). Los 8 checks de Phase 30 emiten ~1 fila por página, así que un sitio de 200 páginas produce ~1600 filas `social`. Un `IMG-01` deduplicado emite ~1 fila. Una og:image rota en todo el sitio mueve el score de la categoría en ~0.06 puntos: **redondea a cero impacto**. Ver `Pitfall 1`. | **Alto — decisión de producto** |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Extracción de la URL de og:image por página | Worker / motor puro (`@auditor/meta-social`) | — | `extractMetaSocial` ya es la única puerta de lectura de meta social y unifica `property`+`name` (`extract.ts:44-53`). Re-implementar la lectura acá reintroduciría el defecto de ONPAGE-05. |
| Resolución a URL absoluta + dedupe | Worker / `@auditor/checks` | `@auditor/crawler` (`normalizeUrl`) | Misma función que usa `brokenResources.ts:29` y `ogImage.ts:73`, así que la clave de dedupe es byte-idéntica a la que ya usa el catálogo. |
| Sondeo HTTP de la imagen (status, headers, bytes de cabecera) | Worker / `@auditor/checks` (`NetworkCheck`) | — | `NetworkCheck.run` es async y recibe el set completo (`types.ts:80-83`). Vercel nunca ejecuta esto (`registry.ts:80-84` corre sólo en el worker vía `apps/worker/src/index.ts:430`). |
| Parseo de dimensiones desde buffer | Worker / `image-size` | — | Librería pura, síncrona, sobre `Uint8Array`. Nunca hand-roll. |
| Defensa SSRF del destino | Worker / `@auditor/checks` (helper compartido) | — | La URL la controla el sitio auditado; el worker vive en la misma red que Redis/Postgres. Debe validarse antes de abrir la conexión y en cada redirección. |
| Score y agrupación de la fila resultante | `@auditor/scoring` + `@auditor/report-model` | — | Sin cambios: `social` ya es categoría de primera clase (`overallScore.ts:12,37`). |
| Render en el reporte | `apps/web` | — | **Phase 32**, fuera de alcance. Esta fase sólo persiste `IssueDraft`. |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `image-size` | `2.0.2` | Leer `width`/`height` desde un buffer parcial de imagen | Estándar de facto del ecosistema Node para esto. 35.5M descargas semanales, MIT, repo `github.com/image-size/image-size`, publicada 2025-04-02, sin `postinstall`, sin dependencias nativas. En v2 la entrada principal es puramente en memoria (`imageSize(input: Uint8Array)`), y todo el acceso a disco quedó aislado en el subpath `image-size/fromFile` — perfecto para no arrastrar `fs` al grafo de `apps/web`. [VERIFIED: npm registry + fuente en GitHub] |
| `fetch` global (undici, Node ≥20) | built-in | Sondeo HTTP con `Range`, streaming y abort | Ya es lo que usan `linkChecker.ts:21`, `llmsTxt.ts:18` y `psi/src/client.ts`. No agregar `undici`, `node-fetch` ni `axios`. [VERIFIED: codebase] |
| `cheerio` | `^1.2.0` (ya presente) | Parseo del HTML por página dentro del `NetworkCheck` | Ya es dependencia de `packages/checks`; `brokenResources.ts:24` hace exactamente este `cheerio.load(page.html)`. [VERIFIED: package.json] |
| `@auditor/meta-social` | `workspace:*` (ya presente) | `extractMetaSocial` + `firstValue` para leer `og:image` | Ya declarada en `packages/checks/package.json`. Sin export nuevo necesario. [VERIFIED: codebase] |
| `@auditor/crawler` | `workspace:*` (ya presente) | `normalizeUrl` para resolver y deduplicar | [VERIFIED: codebase] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:dns/promises` | built-in | `lookup(hostname, { all: true })` para validar el destino antes de conectar (defensa SSRF) | Sólo si se acepta el alcance SSRF (M-08). Sin dependencia externa. |
| `node:net` | built-in | `isIP()` para clasificar la respuesta DNS | Ídem. |
| `vitest` | `^4.1.9` (ya presente) | Suite de tests | Ya es la herramienta del monorepo. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `image-size@2.0.2` | `image-dimensions` (sindresorhus) | API de streams (`imageDimensionsFromStream`) más elegante para este caso, pero soporta 6 formatos (JPEG/PNG/GIF/WebP/AVIF/HEIF) contra ~20 de `image-size`, y es ESM-only. `image-size` cubre más formatos raros que un WordPress viejo puede servir. CONTEXT ya bloqueó `image-size`. |
| `image-size@2.0.2` | `sharp` | Descartado: dependencia binaria nativa pesada, y agregarla a `packages/checks` la metería en el grafo de `apps/web`. Aparece en `pnpm.onlyBuiltDependencies` del root pero **ningún paquete del repo la declara** — es residuo transitivo. |
| Parser propio de headers | — | Descartado: ver `Don't Hand-Roll`. |
| Nueva librería HTTP (`undici` explícito) | — | Descartado: `undici.Agent` con `connect` custom sería la forma más limpia de aplicar la validación de IP, pero agrega una dependencia directa que hoy no existe y que entraría al grafo de Vercel. El pre-chequeo DNS + `redirect: "manual"` logra el 90% sin dependencia nueva. |

**Installation:**
```bash
pnpm --filter @auditor/checks add image-size@2.0.2
```

**Version verification (ejecutada en esta sesión):**
```
$ npm view image-size version         → 2.0.2
$ npm view image-size time.modified   → 2025-04-02T14:30:29.879Z
$ npm view image-size dist-tags       → { latest: "2.0.2", legacy: "1.2.1" }
$ npm view image-size license         → MIT
```

---

## Package Legitimacy Audit

Salida literal de `gsd-tools query package-legitimacy check --ecosystem npm image-size`:

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `image-size` | npm | publicada 2025-04-02 (≈16 meses) | 35 550 069 / semana | `git://github.com/image-size/image-size.git` | **OK** | Aprobada |

- `deprecated: false`, `postinstall: null` (verificado por el seam; sin script de post-instalación).
- Descubierta vía **Context7** (`/image-size/image-size`) y confirmada contra el fuente oficial en GitHub, además del registro npm → califica como `[VERIFIED: npm registry]`.

**Packages removed due to [SLOP] verdict:** ninguno.
**Packages flagged as suspicious [SUS]:** ninguno.

> Nota de higiene: el lockfile ya contiene `image-size@1.2.1` como transitiva de `pptxgenjs@4.0.1` (`packages/export/package.json:19`). pnpm resolverá las dos versiones en paralelo sin conflicto (`node_modules/.pnpm/image-size@1.2.1` y `image-size@2.0.2` coexisten). No hay que tocar `packages/export`.

---

## Architecture Patterns

### System Architecture Diagram

```
apps/worker/src/index.ts:430
        │  runAllChecks({ pages, origin, robotsTxt, sitemapUrls, ... })
        ▼
packages/checks/src/registry.ts:80-84
        │  for (const check of networkChecks) issues.push(...await check.run(siteCtx))
        │  (secuencial, un NetworkCheck por vez — no hay paralelismo entre checks)
        ▼
┌──────────────────────── ogImageCheck.run({ pages, origin }) ─────────────────────────┐
│                                                                                      │
│  (1) RECOLECCIÓN                                                                     │
│      for (page of pages)                                                             │
│        page.html? ──no──▶ skip                                                       │
│           │sí                                                                        │
│           ▼                                                                          │
│        cheerio.load(page.html) ──▶ extractMetaSocial($) ──▶ firstValue(d,"og:image") │
│           │                                    (@auditor/meta-social)                │
│           ├── undefined ──▶ skip (SOCIAL-03 ya cubre la ausencia)                     │
│           ▼                                                                          │
│        normalizeUrl(value, page.finalUrl ?? page.url)   (@auditor/crawler)           │
│           ├── null ──▶ skip (data:, javascript:, no parseable — SOCIAL-03 ya lo marca)│
│           ▼                                                                          │
│        Map<urlNormalizada, páginaOrigen>   ◀── DEDUPE (una entrada por imagen única) │
│                                                                                      │
│  (2) CAP                                                                             │
│      allUrls = [...map.keys()]                                                       │
│      urls    = allUrls.slice(0, MAX_URLS_PER_NETWORK_CHECK)   // 150                 │
│      allUrls.length > urls.length ──▶ IssueDraft severity:"ok" "verificación limitada"│
│                                                                                      │
│  (3) SONDEO  (concurrencia acotada, ~12 en vuelo)                                    │
│      probeImage(url) ──▶ [guard SSRF: DNS lookup + rechazo de rangos privados]       │
│                     ──▶ GET  Range: bytes=0-65535   redirect:"manual" (≤3 saltos)    │
│                     ──▶ AbortController (5 s)                                        │
│                     ──▶ res.body.getReader() ──▶ acumular ≤64 KiB ──▶ reader.cancel()│
│                     ──▶ { status, contentType, totalBytes, headBytes }                │
│                              │            │            │                             │
│                              │            │            └─ 206 → Content-Range .../N   │
│                              │            │               200 → Content-Length        │
│                              │            │               ninguno → null (omitir peso)│
│                              │            └─ res.headers.get("content-type")          │
│                              └─ imageSize(headBytes) → {width,height,type} | throw    │
│                                          (image-size@2.0.2, síncrono)                 │
│                                                                                      │
│  (4) CLASIFICACIÓN → IssueDraft[]                                                    │
│      inalcanzable / no-imagen  ──▶ critical   scope "og-image-unreachable:<url>"     │
│      <200×200                  ──▶ critical   scope "og-image-too-small:<url>"       │
│      200×200..600×315 ó ratio  ──▶ warning    scope "og-image-suboptimal:<url>"      │
│      >5MB                      ──▶ critical   scope "og-image-too-large:<url>"       │
│      1..5MB                    ──▶ warning    scope "og-image-heavy:<url>"           │
│      dimensiones ilegibles     ──▶ ok         scope "og-image-undetermined:<url>"    │
│      fingerprint = siteFingerprint("IMG-01", scope)  →  "IMG-01:<scope>"              │
└──────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
apps/worker/src/index.ts:465-478   draft ──▶ fila Issue (pageId ?? null, scope ?? null)
        ▼
diffIssues (@auditor/scoring)  ──▶  Issue.createMany  ──▶  scoreCategory("social")
        ▼
packages/report-model/src/build.ts:141  issueUrl({source,scope}) = source.split(" ")[0]
        ▼
apps/web  (Phase 32 pinta el panel; esta fase sólo persiste)
```

### Component Responsibilities

| Archivo (propuesto) | Responsabilidad | Modelo a copiar |
|---------------------|-----------------|-----------------|
| `packages/checks/src/checks/network/imageProbe.ts` | `probeImage(url): Promise<ImageProbeResult>` — un GET con Range, guard SSRF, lectura por streaming con corte, extracción de headers, llamada a `imageSize`. Exporta también los umbrales. | `linkChecker.ts` (estructura), `llmsTxt.ts:13-26` (timeout con AbortController) |
| `packages/checks/src/checks/network/ogImage.ts` | El `NetworkCheck` `ogImageNetworkCheck` — recolección, dedupe, cap, clasificación, emisión de `IssueDraft[]`. | `brokenResources.ts` casi literal |
| `packages/checks/src/checks/network/index.ts` | Agregar la entrada al array `networkChecks` (línea 5) y al bloque de re-export (línea 7). | ya existente |
| `packages/checks/src/checks/network/concurrency.ts` *(opcional)* | Extraer el runner `worker()`/`Promise.all` de `linkChecker.ts:39-55` a un `mapWithConcurrency<T,R>` reusable. | refactor puro, sin cambio de comportamiento |

### Recommended Project Structure

```
packages/checks/src/checks/network/
├── index.ts                 # + ogImageNetworkCheck en networkChecks
├── linkChecker.ts           # sin cambios funcionales (opcional: extraer runner)
├── brokenExternalLinks.ts   # sin cambios
├── brokenResources.ts       # sin cambios
├── imageProbe.ts            # NUEVO — transporte + parseo de dimensiones
├── imageProbe.test.ts       # NUEVO — vi.stubGlobal("fetch", …)
├── ogImage.ts               # NUEVO — el NetworkCheck (IMG-01..04)
└── ogImage.test.ts          # NUEVO — vi.mock("./imageProbe")
```

> Nota de nombres: ya existe `packages/checks/src/checks/social/ogImage.ts` (SOCIAL-03). Dos archivos `ogImage.ts` en carpetas distintas compilan bien pero confunden en búsquedas y en los imports del barrel. Recomendación: nombrar el nuevo `ogImageNetwork.ts` o `socialImage.ts`. Queda en la discreción del planner (CONTEXT lo permite explícitamente).

---

### Pattern 1: `NetworkCheck` con dedupe + cap + emisión (el molde de TECH-13)

**What:** Estructura exacta que replica `brokenResourcesCheck`.
**When to use:** Siempre en esta fase — es el criterio de aceptación #1 del ROADMAP.

Anatomía verificada de `packages/checks/src/checks/network/brokenResources.ts`:

| Línea | Elemento | Detalle |
|-------|----------|---------|
| `:7` | `const CHECK_ID = "TECH-13"` | constante de módulo, un único literal |
| `:16-17` | `export const brokenResourcesCheck: NetworkCheck = { checkId: CHECK_ID, async run({ pages }) {` | destructuring del `SiteCheckCtx` |
| `:19` | `const resources = new Map<string, string>()` | *url normalizada → página de origen* |
| `:22` | `if (!page.html) continue` | páginas fallidas se saltan |
| `:23` | `const baseUrl = page.finalUrl ?? page.url` | base para resolver relativas |
| `:24` | `const $ = cheerio.load(page.html)` | re-parseo propio (el `NetworkCheck` no recibe `$`) |
| `:29` | `const normalized = normalizeUrl(value, baseUrl)` | resolución + normalización |
| `:31` | `if (!resources.has(normalized)) resources.set(normalized, baseUrl)` | primera página vista gana |
| `:36` | `if (resources.size === 0) return []` | salida temprana |
| `:38-39` | `allUrls` → `.slice(0, MAX_URLS_PER_NETWORK_CHECK)` | cap a 150 |
| `:44-57` | issue `severity: "ok"` cuando se capó | `measuredValue: "Se verificaron N de M recursos únicos"`, `scope: "resources-capped"` |
| `:58-59` | `for (const result of results) { if (result.ok) continue; }` | **no emite fila de aprobado por recurso** |
| `:61` | `const scope = \`resource:${result.url}\`` | subtipo + URL dentro del scope |
| `:68` | `source: \`${result.url} (referenciado desde ${sourcePage})\`` | formato que `issueUrl` sabe leer |
| `:71` | `fingerprint: siteFingerprint(CHECK_ID, scope)` | `"TECH-13:resource:<url>"` |

**Diferencia obligatoria para IMG-01:** `brokenResources` emite fila **sólo** para lo roto. IMG-03/IMG-04 exigen filas de warning para imágenes que sí cargan (dimensiones subóptimas, peso intermedio), así que el `continue` de `:59` no aplica: hay que clasificar todo resultado, no sólo los `!ok`.

---

### Pattern 2: Fingerprint con subtipo dentro del `scope`

**What:** `siteFingerprint(checkId, scope)` produce literalmente `` `${checkId}:${scope}` `` (`packages/checks/src/util.ts:24-26`). Para que dos hallazgos distintos sobre la misma imagen no colapsen, el subtipo va **dentro** del `scope`, no en el `checkId`.

**Precedentes verificados en el repo:** `TECH-04:cross-domain`, `ONPAGE-08:skip`, `ONPAGE-08:empty` (`packages/checks/src/checks/phase11-guardrail.test.ts:38-45`); `TECH-13:resource:<url>` (`brokenResources.ts:61`); `TECH-12:external-link-unverifiable:<url>` (`brokenExternalLinks.ts:80`).

**Forma recomendada:**
```
scope       = "og-image-too-small:https://cdn.ejemplo.com/og.png"
fingerprint = "IMG-01:og-image-too-small:https://cdn.ejemplo.com/og.png"
```

**Por qué importa:** no hay constraint único sobre `Issue.fingerprint` en la base (`packages/db/prisma/schema.prisma:142-164` — sólo índices en `auditId` y `pageId`). Un fingerprint repetido no da error: colapsa filas en el `Map` de `diffIssues` y corrompe los contadores `new`/`persistent` en silencio. Es exactamente el defecto que blindan `social-guardrail.test.ts` y `checkIdCollision.test.ts`.

**Riesgo de auto-colisión:** una misma imagen puede disparar varias ramas a la vez (por ejemplo pesa 6MB **y** mide 150×150). Con subtipos distintos los fingerprints son distintos y no colapsan — pero producen **dos filas sobre la misma imagen**. Decidir si eso es deseable (más señal) o ruidoso (elegir sólo la rama más severa) es decisión del planner; el requirement no lo especifica. Recomendación: emitir todas las ramas que apliquen, coherente con SOCIAL-06/SOCIAL-07 de Phase 30, que ya son checks multi-hallazgo.

---

### Pattern 3: Un solo GET con `Range` que resuelve las cuatro señales

**What:** Sustituye al par HEAD+GET. Una única petición por imagen única devuelve status (IMG-02), `content-type` (IMG-02), tamaño total (IMG-04) y bytes de cabecera (IMG-03).

**Por qué un solo request y no HEAD+GET:** el requirement IMG-01 dice literalmente "(HEAD + GET parcial)", pero el objetivo declarado del ROADMAP es "sin sobrecargar el sitio auditado con requests repetidos". Un HEAD previo no aporta nada que el GET con Range no traiga y duplica la carga sobre el sitio. **Recomendación: un GET con Range como camino principal**, y HEAD sólo como *fallback* cuando el GET falle con un status que sugiera rechazo del método (405/501) — que es la misma lógica invertida del `HEAD→GET` de `linkChecker.ts:17-34`. El planner debe registrar esta desviación de la letra del requirement de forma explícita.

**Rangos de status a clasificar** (reusar el criterio anti-falso-positivo ya establecido en `brokenExternalLinks.ts:17-27`):

| Status | Significado | Severidad recomendada |
|--------|-------------|-----------------------|
| `200` | servidor ignoró el Range, body completo | ok — cortar el stream a 64 KiB |
| `206` | Partial Content | ok — camino feliz |
| `301/302/307/308` | redirección | seguir hasta 3 saltos, revalidando destino |
| `401/402/403/405/406/429`, `≥520`, `999` | bloqueo anti-bot / auth / paywall | **`ok` informativo, nunca error** — mismo criterio que `isBlockedStatus` |
| `404/410` y resto de 4xx | imagen inexistente | critical (IMG-02) |
| `5xx` (<520) | error del servidor | critical (IMG-02) |
| timeout / DNS / TLS | inalcanzable | critical (IMG-02) |

> Que las plataformas sociales sí rendericen una imagen que responde 403 a un bot es dudoso, pero el proyecto tiene una regla anti-falso-positivo establecida y documentada; el planner debe decidir si un 403 sobre una **imagen** (a diferencia de un enlace externo) merece warning en vez de `ok`. Recomendación: warning con copy de "no verificable automáticamente", porque una og:image que rechaza bots también rechaza al crawler de Facebook — el impacto real es distinto al de un enlace.

---

### Pattern 4: Lectura de dimensiones con `image-size@2.0.2`

**API exacta**, verificada contra el fuente (`lib/index.ts`, `lib/lookup.ts` del repo oficial):

```ts
// lib/index.ts (v2.0.2)
export { types } from './types'
export { imageSize, imageSize as default, disableTypes } from './lookup'
```

```ts
// lib/lookup.ts (v2.0.2) — firma real
export function imageSize(input: Uint8Array): ISizeCalculationResult
```

```ts
// lib/types/interface.ts
export interface ISize {
  width: number
  height: number
  orientation?: number
  type?: string
}
export type ISizeCalculationResult = { images?: ISize[] } & ISize
```

Hechos operativos verificados:

1. **Named export `imageSize`** (y también default). Usar el named: `import { imageSize } from "image-size"`.
2. **Sólo acepta `Uint8Array`** en v2. Desapareció la sobrecarga con `string` (filepath) y el callback que tenía v1 (`node_modules/.pnpm/image-size@1.2.1/.../dist/index.d.ts` los declaraba). El acceso a disco vive ahora en `image-size/fromFile`. **Consecuencia útil:** la entrada principal no importa `node:fs`, así que es segura para el grafo de `apps/web`.
3. **Es síncrona y lanza `TypeError`** — nunca devuelve `null`:
   - `` throw new TypeError(`unsupported file type: ${type}`) `` cuando el detector no reconoce el formato o el handler devuelve `undefined`.
   - `` throw new TypeError(`disabled file type: ${type}`) `` si se usó `disableTypes`.
   - Los handlers individuales lanzan lo suyo: `TypeError('Corrupt JPG, exceeded buffer limits')` (`lib/types/jpg.ts`), `TypeError('Invalid PNG')` (`lib/types/png.ts`, dentro de `validate`, o sea que **el propio `detector` puede lanzar**).
   → **Todo `imageSize(...)` va dentro de un `try/catch` amplio.**
4. **Formatos con múltiples imágenes** (ICO/CUR/HEIF): `size.images[]` presente y `width`/`height` ya reasignados a la imagen de mayor área (`lookup.ts`). No hace falta lógica propia.
5. **Dual ESM/CJS** vía `exports` map (`import` → `dist/index.mjs`, `require` → `dist/index.cjs`), `engines.node >= 16`. El monorepo es `"type": "module"` con Node 24 → resuelve la rama ESM sin fricción.
6. **`Buffer` es subclase de `Uint8Array`**, así que un `Buffer.concat([...chunks])` se pasa directo sin conversión.

**Bytes mínimos por formato** (leídos de los handlers oficiales):

| Formato | Bytes necesarios | Evidencia |
|---------|------------------|-----------|
| GIF | **10** | `lib/types/gif.ts`: magic `GIF8[79]a` en 0-5, `width = readUInt16LE(input, 6)`, `height = readUInt16LE(input, 8)` |
| PNG | **24** | `lib/types/png.ts`: firma 0-7, chunk `IHDR` en 12-15, `width = readUInt32BE(input, 16)`, `height = readUInt32BE(input, 20)` |
| BMP | ~26 | estructura fija de cabecera |
| WebP | ~30 | cabeceras VP8/VP8L/VP8X dentro de los primeros bytes |
| AVIF/HEIC | < 1 KB típico | estructura de boxes ISOBMFF al inicio |
| **JPEG** | **variable — decenas de KB** | el SOF va después de JFIF/EXIF/ICC; una miniatura EXIF o un perfil ICC lo empujan lejos. v1 leía hasta 512 KB del archivo (`MaxInputSize = 512 * 1024`) |
| SVG | root `<svg>` (usualmente < 1 KB) | `lib/types/svg.ts`: regex sobre el elemento raíz; **rechaza porcentajes** (`[^%]+?` en los regex de width/height), cae a `viewBox` |
| TIFF | puede requerir el archivo entero | el IFD puede estar al final |

**Decisión recomendada: pedir los primeros 64 KiB (`Range: bytes=0-65535`).** Cubre todo salvo JPEGs con metadata anormalmente grande y TIFF (que ninguna plataforma social renderiza igual). Si `imageSize` lanza, **no reintentar con un rango mayor** (duplicaría la carga sobre el sitio auditado): emitir una fila `severity: "ok"` de "no se pudieron determinar las dimensiones", coherente con la disciplina anti-falso-positivo del proyecto. Costo máximo: 150 × 64 KiB ≈ 9.6 MB por auditoría.

---

### Anti-Patterns to Avoid

- **`await res.arrayBuffer()` sobre la respuesta de la imagen.** Si el servidor ignora el `Range` y responde 200, descarga el archivo completo — justo lo que la fase existe para evitar. Usar `res.body.getReader()` y cortar.
- **Usar `Content-Length` como tamaño total sin mirar el status.** En un 206 es el tamaño del fragmento. Ver `Pitfall 2`.
- **Emitir fila de "falta og:image".** SOCIAL-03 (`packages/checks/src/checks/social/ogImage.ts:31-47`) ya emite `critical` para eso. Duplicar la señal degrada el reporte y el score.
- **Emitir fila para og:image relativa / sin protocolo / sobre HTTP.** SOCIAL-03 ya cubre las cuatro variantes de formato (`ogImage.ts:52-133`). IMG-01 valida el **destino**, no el formato del valor.
- **Declarar constantes de umbral propias dentro del check.** `packages/meta-social/src/thresholds.ts` es el hogar único de los umbrales de la categoría social, y su docblock lo dice explícitamente ("Phase 32 reusa estos umbrales para pintar el panel con exactamente el mismo criterio"). Los umbrales de IMG (200×200, 600×315, 1.91:1, 1MB, 5MB) **deben vivir ahí**, no en el archivo del check. `MAX_MEASURED_VALUE_CHARS = 80` también se importa de ahí para recortar la URL en `measuredValue`.
- **`redirect: "follow"` sin tope.** Es lo que hace `linkChecker.ts:21`, y el default de undici son 20 saltos. Para un destino controlado por el sitio auditado eso es una cadena de redirecciones arbitraria hacia cualquier lado.
- **Reordenar/normalizar la query string de URLs de CDN firmadas.** `normalizeUrl` ordena los parámetros (`normalizeUrl.ts:70`) y elimina `ref` (`:15`). Para URLs firmadas por path (Cloudinary, imgix) no afecta; para firmas por query podría invalidarlas. `brokenResources.ts:29` ya asume este riesgo hoy, así que mantener paridad es lo correcto — pero conviene **guardar la URL original junto a la normalizada** y **fetchear la original**, usando la normalizada sólo como clave de dedupe. Es una mejora barata sobre el precedente.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Leer `width`/`height` de una imagen | Parser de firmas y offsets por formato | `image-size@2.0.2` | ~20 formatos, cada uno con casos borde reales (PNG "fried" de Apple con chunk `CgBI` en otro offset, JPEG con EXIF/ICC previos al SOF, HEIF multi-imagen, SVG con unidades `cm`/`pt`/`em`). El repo ya tiene todo eso resuelto y probado. |
| Resolver una URL relativa contra la página y normalizarla | `new URL(value, base)` a mano | `normalizeUrl` de `@auditor/crawler` | Ya rechaza esquemas no-http(s) (`:48-50`), quita el fragment, normaliza puerto por defecto, quita tracking params y unifica trailing slash. Usar otra cosa rompe la paridad de clave de dedupe con TECH-13 y con SOCIAL-03. |
| Leer `og:image` del HTML | `$('meta[property="og:image"]').attr("content")` | `extractMetaSocial` + `firstValue` | El extractor lee la **unión** de `property` y `name` (`extract.ts:44-53`) porque los emisores reales mezclan los dos vocabularios. Leer un solo atributo es exactamente el defecto por el que se retiró ONPAGE-05. |
| Concurrencia acotada | `Promise.all` sobre todo el array | Runner de `linkChecker.ts:39-55` (extraerlo) | Ya está probado en producción con 150 URLs y evita abrir 150 sockets contra el sitio auditado a la vez. |
| Timeout de fetch | `Promise.race` con `setTimeout` | `AbortController` + `clearTimeout` en `finally` | Patrón ya establecido en `linkChecker.ts:18-20,26` y `llmsTxt.ts:14-25`. `Promise.race` deja el socket abierto. |
| Detectar IPs privadas para el guard SSRF | Regex sobre el hostname | `dns.promises.lookup(host, {all:true})` + `net.isIP` + tabla de rangos | Una regex sobre el hostname no ve `http://ejemplo.com/` cuyo DNS resuelve a `127.0.0.1` — que es precisamente el ataque. |

**Key insight:** el 80% de esta fase ya está escrito en el repo; el trabajo real es de **transporte** (fetch parcial correcto) y de **clasificación** (mapear señales a severidades sin generar falsos positivos). Toda línea que reimplemente algo de la columna izquierda es deuda.

---

## Common Pitfalls

### Pitfall 1: La fila deduplicada no mueve el score de la categoría

**What goes wrong:** una og:image rota en todo el sitio produce **una** fila `critical`, y el score de `social` prácticamente no se mueve.
**Why it happens:** `scoreCategory` (`packages/scoring/src/categoryScore.ts:40-47`) es una tasa de aprobación: `100 × Σ health / n`. Los 8 checks de Phase 30 emiten aproximadamente una fila por página cada uno (varios emiten fila `ok` explícita de aprobado). Un sitio de 200 páginas genera ~1600 filas `social`. Una sola fila `critical` mueve el score de 100 a 99.94 → **redondea a 100**.
**Cómo evitarlo — tres opciones para el planner:**

| Opción | Descripción | Costo | Efecto en el score |
|--------|-------------|-------|--------------------|
| **A — fan-out de filas** | Dedupe del **fetch** (una petición por imagen única, cumple IMG-01 y el SC#1 del ROADMAP), pero **una fila por página afectada**: `Map<string, string[]>` (url → todas las páginas), `pageId` seteado, `pageFingerprint(CHECK_ID, pageUrl)`. | Ninguno en red; N filas en base. | Proporcional y correcto. La imagen compartida rota de un sitio de 200 páginas produce 200 filas → el score cae de verdad. |
| **B — aceptar el ruido bajo** | Una fila site-level por imagen (lo que dice CONTEXT.md hoy). | Mínimo. | ≈ cero. El hallazgo existe en el reporte pero no puntúa. |
| **C — fila site-level + peso** | Mantener site-level y ajustar el modelo de scoring. | Toca `@auditor/scoring`, fuera del alcance de la fase. | Requiere fase propia. |

**Recomendación:** **Opción A.** El SC#1 del ROADMAP habla de que la imagen "se verifica una sola vez" — habla del **fetch**, no de la emisión de filas. La opción A cumple la letra y el espíritu de IMG-01 y arregla la proporcionalidad de score y de UI de una vez. Además hace que la fila caiga en la vista por página del reporte, que es donde el usuario la va a buscar. **Contradice parcialmente la redacción de CONTEXT.md ("dedupe por URL de imagen, no por página" y "`Map<string,string>`"), así que necesita confirmación del usuario antes de planificar.**
**Warning signs:** el harness de calibración `packages/checks/src/checks/social/social-calibration.test.ts` mide bandas de score de la categoría social con `includeNetworkChecks: false` (línea 142), así que **no va a detectar esta dilución**. Si se elige la opción A, ese harness sigue en verde; si se elige B, conviene documentar el efecto en el SUMMARY.

---

### Pitfall 2: `Content-Length` en una respuesta 206 es el tamaño del fragmento

**What goes wrong:** IMG-04 nunca dispara. Toda imagen mide "65536 bytes".
**Why it happens:** en un `206 Partial Content`, `Content-Length` describe el body devuelto (los 64 KiB pedidos). El tamaño total sólo aparece en `Content-Range: bytes 0-65535/1234567`.
**How to avoid:**
```ts
function totalBytes(res: Response): number | null {
  if (res.status === 206) {
    const range = res.headers.get("content-range");          // "bytes 0-65535/1234567"
    const total = range?.split("/")[1];
    if (total && total !== "*") {
      const n = Number(total);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
  const len = res.headers.get("content-length");             // 200 → tamaño completo
  if (!len) return null;                                     // chunked → omitir peso (CONTEXT)
  const n = Number(len);
  return Number.isFinite(n) ? n : null;
}
```
**Warning signs:** todos los `measuredValue` de peso muestran exactamente 64 KB.

---

### Pitfall 3: El servidor ignora el `Range` y manda el archivo completo

**What goes wrong:** una og:image de 8MB se descarga entera; con 150 imágenes, la auditoría se cuelga y satura al sitio auditado.
**Why it happens:** RFC 7233 permite explícitamente ignorar el header `Range` y responder `200` con el recurso completo; muchos CDNs y servidores lo hacen. `Accept-Ranges: none` significa lo mismo.
**How to avoid:** no llamar nunca a `res.arrayBuffer()`. Leer por streaming y cancelar:
```ts
async function readUpTo(res: Response, maxBytes: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    // Cierra la conexión aunque el servidor tuviera 8MB más para mandar.
    await reader.cancel().catch(() => {});
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.byteLength; }
  return out.subarray(0, Math.min(total, maxBytes));
}
```
**Warning signs:** el paso de red de la auditoría tarda minutos; el uso de memoria del worker sube.
**Nota:** un `Range` que empieza en 0 sobre un recurso no vacío siempre es satisfacible, así que **416 no es un resultado esperado**; si aparece, tratarlo como fallback a GET sin Range con el mismo corte de streaming.

---

### Pitfall 4: SSRF — la og:image la elige el sitio auditado

**What goes wrong:** un sitio auditado declara `<meta property="og:image" content="http://127.0.0.1:6379/">` o `http://169.254.169.254/latest/meta-data/` y el worker abre la conexión desde dentro de la red privada, donde viven Redis y Postgres. El `measuredValue`/`source` del issue devuelve status, content-type y tamaño → **oráculo de SSRF ciego** que se persiste y se muestra en el reporte.
**Why it happens:** `normalizeUrl` sólo filtra el esquema (`normalizeUrl.ts:48-50`), no el destino. `linkChecker.ts:21` usa `redirect: "follow"` sin tope. Phase 30 lo dejó anotado explícitamente como frontera que Phase 31 hereda (`30-03-SUMMARY.md:267`).
**How to avoid:**
1. Resolver DNS antes de conectar (`dns.promises.lookup(hostname, { all: true })`) y rechazar si **alguna** dirección cae en: `127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16` (metadata de nube), `100.64/10` (CGNAT), `0.0.0.0/8`, `::1`, `fc00::/7`, `fe80::/10`, `::ffff:0:0/96` mapeadas a las anteriores.
2. `redirect: "manual"` y bucle propio con tope de 3 saltos, **revalidando el destino en cada salto** (una redirección a `127.0.0.1` es el bypass clásico).
3. Timeout duro (5s, igual que `REQUEST_TIMEOUT_MS`).
4. Corte de bytes (64 KiB).
5. No incluir el body en ningún campo persistido.

**Riesgo residual aceptado:** DNS rebinding (TOCTOU entre el `lookup` y la conexión real de undici) no queda cubierto sin un `Agent` de undici con `connect` custom. Aceptable en ASVS L1; documentarlo.
**Warning signs:** ninguno en runtime — por eso hay que decidirlo por diseño, no por observación.
**Alcance:** el mismo helper debería aplicarse a TECH-12/TECH-13, que tienen la exposición idéntica hoy. Extenderlo a esos dos checks **excede el alcance de esta fase** y debería ir a `## Open Questions`.

---

### Pitfall 5: SVG es un caso especial doble

**What goes wrong:** una og:image SVG se marca como "dimensiones ilegibles" (ruido) o, peor, pasa como válida cuando ninguna plataforma la va a renderizar.
**Why it happens:** dos cosas distintas se cruzan. (a) `image-size` **sí** soporta SVG, pero sólo con `width`/`height` en unidades absolutas o con `viewBox`; con `width="100%"` los regex de `lib/types/svg.ts` (`[^%]+?`) no matchean y `calculate` cae a `viewBox` o falla. (b) **Ninguna plataforma social renderiza SVG como og:image** — Facebook, X y LinkedIn lo ignoran o no generan preview.
**How to avoid:** rama dedicada. Si `content-type` es `image/svg+xml` (o `imageSize` reporta `type === "svg"`), emitir un hallazgo propio de **formato no soportado por las plataformas** (recomendación: rasterizar a PNG/JPEG a 1200×630) en vez de una fila de dimensiones. Severidad: `critical` es defendible (el preview no se genera); `warning` es el piso.
**Warning signs:** sitios hechos en Next.js/Astro con logo SVG como og:image por defecto.

---

### Pitfall 6: `content-type` mentiroso (falso positivo de IMG-02)

**What goes wrong:** se marca "no es una imagen" una imagen perfectamente válida.
**Why it happens:** muchos servidores mal configurados devuelven `application/octet-stream`, `binary/octet-stream` o `text/plain` para archivos de imagen; los endpoints de transformación (`/_next/image`, Cloudinary) a veces devuelven `content-type` genérico o vacío.
**How to avoid:** regla de dos señales — marcar "no es una imagen" **sólo si `content-type` no empieza con `image/` Y además `imageSize()` lanzó** sobre los bytes. Si `imageSize` parseó bien, los bytes mandan sobre el header. Al revés también: `content-type: image/*` con bytes ilegibles → "dimensiones indeterminadas" (`ok`), no "no es imagen".
**Warning signs:** el reporte marca como rotas las imágenes de un CDN concreto y todas de golpe.

---

### Pitfall 7: Tercer parseo de cheerio sobre las 500 páginas

**What goes wrong:** el paso `analyzing` de la auditoría se alarga notoriamente.
**Why it happens:** `registry.ts:65` ya hace `cheerio.load(page.html)` una vez por página para los `PageCheck`. `brokenExternalLinks.ts:38` lo hace de nuevo. `brokenResources.ts:24` una tercera. El nuevo `NetworkCheck` sería la cuarta pasada completa sobre hasta 500 documentos HTML.
**How to avoid:** aceptar el costo por paridad de patrón (es lo que hacen los dos checks existentes) y **medirlo** en la verificación. Alternativa fuera de alcance: extender `SiteCheckCtx` con un `Map<pageId, CheerioAPI>` precomputado — toca `registry.ts` y los tres `NetworkCheck`, así que es refactor propio. Un atajo de regex para extraer sólo `og:image` **no** es aceptable: rompe la paridad con `extractMetaSocial` (unión `property`+`name`) y reintroduce el defecto de ONPAGE-05.
**Warning signs:** el tiempo de `analyzing` crece con la cantidad de páginas más que linealmente.

---

### Pitfall 8: URL de imagen en el campo `url` del reporte

**What goes wrong:** el reporte clasifica la URL de la imagen como si fuera una plantilla de página.
**Why it happens:** `packages/report-model/src/build.ts:103-108` deriva `ReportIssue.url` de `source.split(" ")[0]`, y `build.ts:256-257` alimenta `classifyTemplate(reportIssue.url)` con eso. Con el formato de `brokenResources.ts:68` (`"<urlRecurso> (referenciado desde <urlPagina>)"`), el `url` del issue termina siendo la URL de la imagen.
**How to avoid:** es el comportamiento existente de TECH-13 y no rompe nada (la UI lo renderiza como enlace externo, `IssueTypeGroup.tsx` `urlCell` sólo exige `^https?://`). Mantener el mismo formato de `source` por consistencia y documentarlo. Si se elige la **opción A** del Pitfall 1 (fila por página), poner la URL de la **página** primero en `source` y la de la imagen en `measuredValue` es más correcto para el reporte.

---

### Pitfall 9: Texto controlado por el sitio auditado en campos persistidos

**What goes wrong:** una URL de og:image de 10 KB se persiste 500 veces; o texto hostil llega al panel de Phase 32.
**Why it happens:** el valor de `og:image` lo controla íntegramente el sitio auditado. Phase 30 mitigó esto (T-30-06) con `MAX_MEASURED_VALUE_CHARS = 80` y un helper `cap()` local (`packages/checks/src/checks/social/ogImage.ts:16`).
**How to avoid:** importar `MAX_MEASURED_VALUE_CHARS` de `@auditor/meta-social` y recortar toda URL antes de meterla en `measuredValue`. Ojo: **el `scope`/`fingerprint` NO se debe recortar** — recortarlo haría colisionar dos imágenes cuyo prefijo de 80 caracteres coincide (típico en CDNs con paths largos). `brokenResources.ts:61` no recorta el scope; mantener eso.
**Nota de traspaso:** Phase 32 hereda de Phase 30 la obligación de revalidar `measuredValue` antes de usarlo como `src` o `href` (`30-03-SUMMARY.md:269`). Esta fase agrega un consumidor más a esa obligación.

---

## Code Examples

### Ejemplo 1: firma del módulo de sondeo (contrato para el planner)

```ts
// packages/checks/src/checks/network/imageProbe.ts
// Fuente del patrón de timeout: packages/checks/src/checks/network/linkChecker.ts:18-27

/** Tamaño del fragmento pedido: cubre PNG(24B)/GIF(10B)/WebP/AVIF y la gran mayoría de JPEG. */
export const IMAGE_HEAD_BYTES = 64 * 1024;

export type ImageProbeResult =
  | {
      ok: true;
      url: string;
      status: number;
      contentType: string | null;
      /** Tamaño total del archivo, o null si el servidor no lo expone (chunked). */
      totalBytes: number | null;
      /** Dimensiones, o null si el buffer parcial no alcanzó / formato no soportado. */
      dimensions: { width: number; height: number; type?: string } | null;
    }
  | { ok: false; url: string; status: number | null; reason: string };

export async function probeImage(url: string): Promise<ImageProbeResult>;
```

### Ejemplo 2: uso de `image-size` sobre el buffer parcial

```ts
// Fuente: https://github.com/image-size/image-size (lib/lookup.ts, v2.0.2)
import { imageSize } from "image-size";

function readDimensions(head: Uint8Array) {
  if (head.byteLength === 0) return null;
  try {
    // `imageSize` es SÍNCRONA y LANZA TypeError; nunca devuelve null.
    // Casos conocidos: "unsupported file type: undefined" (detector no reconoce),
    // "Corrupt JPG, exceeded buffer limits" (SOF fuera del fragmento),
    // "Invalid PNG" (lanzado desde el propio validate del detector).
    const { width, height, type } = imageSize(head);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    return { width, height, type };
  } catch {
    return null; // → fila informativa "dimensiones indeterminadas", nunca un error
  }
}
```

### Ejemplo 3: recolección + dedupe (calcado de `brokenResources.ts:19-36`)

```ts
// Fuente: packages/checks/src/checks/network/brokenResources.ts:18-36
import * as cheerio from "cheerio";
import { normalizeUrl } from "@auditor/crawler";
import { extractMetaSocial, firstValue } from "@auditor/meta-social";

const images = new Map<string, string>(); // url normalizada -> primera página que la declara

for (const page of pages) {
  if (!page.html) continue;
  const baseUrl = page.finalUrl ?? page.url;
  const $ = cheerio.load(page.html);
  const raw = firstValue(extractMetaSocial($), "og:image");
  if (!raw) continue;                        // SOCIAL-03 ya reporta la ausencia
  const normalized = normalizeUrl(raw, baseUrl);
  if (!normalized) continue;                 // data:/javascript:/no parseable → SOCIAL-03
  if (!images.has(normalized)) images.set(normalized, baseUrl);
}
```

### Ejemplo 4: issue informativo de cap (copiar la forma exacta de `brokenResources.ts:44-57`)

```ts
// Fuente: packages/checks/src/checks/network/brokenResources.ts:44-57
if (allUrls.length > urls.length) {
  issues.push({
    checkId: CHECK_ID,
    category: "social",                       // ← "social", no "tech" (decisión bloqueada)
    title: "Verificación de imágenes sociales limitada",
    severity: "ok",
    measuredValue: `Se verificaron ${urls.length} de ${allUrls.length} imágenes únicas`,
    source: origin,
    criterion:
      "En el plan gratuito se verifica una muestra de imágenes sociales para acotar el tiempo de auditoría",
    recommendation:
      "Sin acción necesaria. El resto de las imágenes se verificarán en próximas auditorías o en un plan superior.",
    fingerprint: siteFingerprint(CHECK_ID, "og-images-capped"),
    scope: "og-images-capped",
  });
}
```

### Ejemplo 5: patrones de test verificados en el repo

```ts
// Patrón A — mockear el módulo de red y probar sólo la CLASIFICACIÓN.
// Fuente: packages/checks/src/checks/network/brokenExternalLinks.test.ts:7-15
vi.mock("./imageProbe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./imageProbe")>();
  return { ...actual, probeImage: vi.fn() };
});
import { probeImage } from "./imageProbe";
const mocked = vi.mocked(probeImage);
```

```ts
// Patrón B — stubear el fetch global y probar el TRANSPORTE.
// Fuente: packages/psi/src/client.test.ts:7-12
vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse));
afterEach(() => vi.unstubAllGlobals());
```

```ts
// Fixtures binarios mínimos, construidos en el propio test (sin archivos en disco).
// Offsets verificados contra lib/types/png.ts y lib/types/gif.ts de image-size 2.0.2.
function pngHeader(width: number, height: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // firma
  b.set([0x00, 0x00, 0x00, 0x0d], 8);                          // longitud del chunk IHDR
  b.set([0x49, 0x48, 0x44, 0x52], 12);                         // "IHDR"
  new DataView(b.buffer).setUint32(16, width, false);           // width  BE
  new DataView(b.buffer).setUint32(20, height, false);          // height BE
  return b;
}

function gifHeader(width: number, height: number): Uint8Array {
  const b = new Uint8Array(10);
  b.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0);              // "GIF89a"
  new DataView(b.buffer).setUint16(6, width, true);             // width  LE
  new DataView(b.buffer).setUint16(8, height, true);            // height LE
  return b;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `image-size` v1: `imageSize(path \| Buffer)` con sobrecarga de callback, `disableFS`, lectura de hasta 512 KB del archivo | v2: `imageSize(input: Uint8Array)` puramente en memoria; el acceso a disco vive en el subpath `image-size/fromFile` (`imageSizeFromFile`, async) | v2.0.0 (2025) | La entrada principal ya no importa `node:fs`, así que es segura para un paquete que `apps/web` resuelve. `disableFS` desapareció; quedan `disableTypes` y `types`. |
| X/Twitter Card Validator como oráculo automatizable | Retirado por X; no hay validador público automatizable | 2023-2024 | Ya asumido por Phase 30 (`thresholds.ts`, asunción A1). Los umbrales de esta fase se validan contra documentación, no contra una API. |
| Facebook Sharing Debugger vía Graph API | Requiere auth y tiene rate limits agresivos | — | Descartado explícitamente en REQUIREMENTS.md:78. |

**Umbrales oficiales de plataforma (base para el copy del check):**

| Plataforma | Mínimo | Umbral de miniatura chica | Recomendado | Ratio | Peso máximo |
|------------|--------|---------------------------|-------------|-------|-------------|
| Facebook / Open Graph | 200×200 (por debajo se ignora la imagen) | 600×315 | 1200×630 | 1.91:1 | **8 MB** |
| X (summary_large_image) | 300×157 | — | 1200×628 | 1.91:1 | **5 MB** |
| LinkedIn | — | — | 1200×627 | 1.91:1 | **5 MB** |

Los umbrales de IMG-03 (200×200 y 600×315) coinciden **exactamente** con la documentación oficial de Facebook. El umbral de error de IMG-04 (5 MB) corresponde a **X y LinkedIn**, no a Facebook. El copy de la recomendación debe decir "5 MB" citando el límite más estricto entre plataformas, no atribuírselo a Facebook.

**Deprecado / a evitar:**
- SVG como og:image: ninguna plataforma mayor lo renderiza.
- WebP y GIF como og:image: soporte irregular entre plataformas. Fuera del alcance de IMG-01..04, pero candidato natural para una fase futura.

---

## Runtime State Inventory

No aplica: esta fase es greenfield aditiva (un check nuevo, una dependencia nueva). No renombra, no migra ni refactoriza estado existente.

- **Datos almacenados:** ninguno modificado. Se agregan filas `Issue` nuevas con `checkId = "IMG-01"`; no hay migración de esquema (`packages/db/prisma/schema.prisma:142-164` ya tiene `checkId`, `scope`, `pageId` como columnas genéricas).
- **Config de servicio vivo:** ninguna. El check corre dentro del proceso worker existente.
- **Estado registrado en el SO:** ninguno.
- **Secrets / env vars:** ninguna nueva. `image-size` no requiere configuración.
- **Artefactos de build:** `pnpm install` tras agregar la dependencia; el Dockerfile del worker no cambia (JS puro, sin binarios).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `fetch` global, streams, `dns/promises` | ✓ | v24.13.0 (engines: `>=20`) | — |
| pnpm | instalación de `image-size` | ✓ | 10.0.0 | — |
| `image-size@2.0.2` | IMG-03 | ✗ (a instalar) | 2.0.2 en el registro | Ninguno viable; ver `Don't Hand-Roll` |
| vitest | suite de tests | ✓ | ^4.1.9 en `packages/checks` | — |
| turbo | `pnpm test` / `pnpm typecheck` | ✓ | ^2.3.0 | — |
| Acceso saliente HTTP/HTTPS desde el worker | IMG-01..04 | ✓ | ya lo usan TECH-12/TECH-13/AEO-02 | — |

**Missing dependencies with no fallback:** ninguna (sólo falta instalar `image-size`, que es un `pnpm add`).
**Missing dependencies with fallback:** ninguna.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest `^4.1.9` (declarado en `packages/checks/package.json` como devDependency) |
| Config file | **ninguno** en `packages/checks` — corre con los defaults de vitest. Sólo `packages/export`, `packages/report-model` y `apps/web` tienen `vitest.config.ts`. |
| Quick run command | `pnpm --filter @auditor/checks test` |
| Full suite command | `pnpm test` (turbo, todos los paquetes) |
| Mocking de red | **Sin msw ni nock en el repo.** Dos patrones establecidos: `vi.mock("<módulo>")` (`brokenExternalLinks.test.ts:7-15`) y `vi.stubGlobal("fetch", …)` (`psi/src/client.test.ts:7-12`). |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMG-01 | Una misma og:image en N páginas produce **una sola** llamada a `probeImage` | unit | `pnpm --filter @auditor/checks exec vitest run src/checks/network/ogImage.test.ts -t "dedup"` | ❌ Wave 0 |
| IMG-01 | Por encima de 150 imágenes únicas se emite la fila `ok` de cap y se sondean sólo 150 | unit | ídem, `-t "cap"` | ❌ Wave 0 |
| IMG-01 | Página sin og:image no produce ninguna fila ni ninguna llamada de red | unit | ídem, `-t "sin og:image"` | ❌ Wave 0 |
| IMG-02 | 404/410/5xx → `critical`; 401/403/429/999 → `ok` informativo | unit | ídem, `-t "alcanzabilidad"` | ❌ Wave 0 |
| IMG-02 | `content-type` no-imagen **y** bytes ilegibles → `critical`; `content-type` genérico con bytes parseables → NO se marca | unit | ídem, `-t "content-type"` | ❌ Wave 0 |
| IMG-03 | 150×150 → `critical`; 400×300 → `warning`; 1200×630 → sin fila de problema | unit | ídem, `-t "dimensiones"` | ❌ Wave 0 |
| IMG-03 | Ratio lejos de 1.91:1 (ej. 1200×1200) → `warning` | unit | ídem, `-t "ratio"` | ❌ Wave 0 |
| IMG-04 | 6 MB → `critical`; 2 MB → `warning`; 400 KB → sin fila; sin `Content-Length` → sin evaluación de peso | unit | ídem, `-t "peso"` | ❌ Wave 0 |
| IMG-01..04 | `probeImage` corta la lectura a 64 KiB aunque el servidor responda 200 con body grande | unit (transporte) | `… vitest run src/checks/network/imageProbe.test.ts -t "corta"` | ❌ Wave 0 |
| IMG-04 | `probeImage` deriva el tamaño total de `Content-Range` en un 206 y de `Content-Length` en un 200 | unit (transporte) | ídem, `-t "tamaño total"` | ❌ Wave 0 |
| IMG-03 | `imageSize` sobre header PNG de 24 B y GIF de 10 B devuelve dimensiones; sobre buffer truncado no propaga la excepción | unit (transporte) | ídem, `-t "dimensiones desde buffer"` | ❌ Wave 0 |
| Integración | `IMG-01` está registrado en `networkChecks` y `runAllChecks({ includeNetworkChecks: true })` lo ejecuta | integración | `… vitest run src/registry.test.ts` (ampliar) | ✅ existe, ampliar |
| Guardarraíl | Ningún fingerprint de `IMG-01` colisiona con `SOCIAL-01..08` ni con el resto del catálogo sobre el mismo sitio | guardarraíl | `… vitest run src/checks/social/social-guardrail.test.ts` (ampliar) | ✅ existe, ampliar |
| Guardarraíl | `IMG-01` no colisiona con el catálogo de PSI | guardarraíl | `… vitest run src/checks/perf/checkIdCollision.test.ts` | ✅ existe, cubre por construcción |
| Frontera | `image-size` no arrastra Playwright/Chromium al grafo de `apps/web` | frontera | `pnpm assert:web-boundary` | ✅ existe |

### Sampling Rate

- **Per task commit:** `pnpm --filter @auditor/checks test`
- **Per wave merge:** `pnpm test && pnpm typecheck && pnpm assert:web-boundary`
- **Phase gate:** suite completa en verde antes de `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/checks/src/checks/network/imageProbe.test.ts` — cubre el transporte (IMG-01..04)
- [ ] `packages/checks/src/checks/network/ogImage.test.ts` — cubre la clasificación (IMG-01..04)
- [ ] Instalación de la dependencia: `pnpm --filter @auditor/checks add image-size@2.0.2`
- [ ] Ampliar `packages/checks/src/registry.test.ts` con un caso de red (hoy todos usan `includeNetworkChecks: false`) — requiere mockear `probeImage` a nivel de módulo o stubear el `fetch` global
- [ ] Ampliar `packages/checks/src/checks/social/social-guardrail.test.ts` para incluir la fila de `IMG-01` en la comparación de fingerprints de la categoría `social` (hoy corre con `includeNetworkChecks: false`, línea 111)

> **Ojo con el guardarraíl social:** `social-guardrail.test.ts:118-126` afirma `distinctCheckIds.size === SOCIAL_CHECK_ID_COUNT` (8). Ese aserto corre con `includeNetworkChecks: false`, así que **no se rompe** al agregar IMG-01. Si el planner decide activar la red en ese archivo, la constante debe subir a 9 y el harness necesita un mock de `probeImage`.

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: "high"` (`.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | El check no autentica nada |
| V3 Session Management | no | Sin sesión |
| V4 Access Control | no | Corre en el worker, sin actor |
| **V5 Input Validation / Sanitization** | **sí** | Toda entrada (URL de og:image, `content-type`, `Content-Range`, `Content-Length`, bytes del body) la controla el sitio auditado. Validar esquema (`normalizeUrl`), destino (guard de IP), longitud (`MAX_MEASURED_VALUE_CHARS`), numéricos (`Number.isFinite` sobre headers) y bytes (`try/catch` alrededor de `imageSize`). **SSRF cae acá (V5.2.6 en ASVS 4.0.3, nivel L1)** [ASSUMED: numeración exacta de la sección] |
| V6 Cryptography | no | Sin crypto propia |
| V7 Error Handling / Logging | sí | Ningún body ni header del destino debe llegar a logs sin recortar; el mensaje de error del `TypeError` de `image-size` no debe persistirse crudo en `measuredValue` |
| V12 Files and Resources | sí | Límite duro de bytes leídos (64 KiB) y de tiempo (5 s) por recurso remoto |
| V13 API / Web Service | no | No expone API nueva |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **SSRF vía `og:image`** apuntando a loopback / RFC1918 / `169.254.169.254` / servicios internos del contenedor (Redis en `:6379`, Postgres en `:5432`) | Information Disclosure / Elevation of Privilege | Pre-chequeo DNS + rechazo de rangos privados, `redirect: "manual"` con revalidación por salto, tope de 3 saltos, timeout 5 s, corte de body a 64 KiB, no persistir el body |
| **SSRF por redirección** (destino público que redirige a interno) | Information Disclosure | Revalidar el destino en **cada** salto, no sólo en la URL inicial |
| **DoS por descarga** (og:image de 500 MB o endpoint infinito/chunked) | Denial of Service | Corte por streaming a 64 KiB + timeout + cap de 150 URLs |
| **DoS por zip-bomb de metadata** (JPEG con perfil ICC gigante que empuja el SOF) | Denial of Service | `imageSize` sólo mira el buffer que le pasamos; nunca reintentar con un rango mayor |
| **Amplificación contra el sitio auditado** (500 peticiones por la misma imagen) | Denial of Service | El dedupe de IMG-01 es, además de una optimización, un control de seguridad |
| **Texto hostil persistido y luego renderizado** (URL con payload que Phase 32 pinta en el panel) | Tampering | `cap(MAX_MEASURED_VALUE_CHARS)` en `measuredValue`; React escapa por defecto; `IssueTypeGroup.tsx` ya exige `^https?://` antes de crear un `<a href>` (salvaguarda T-15-02) |
| **DNS rebinding** (TOCTOU entre el `lookup` y la conexión de undici) | Information Disclosure | No mitigable sin un `Agent` de undici con `connect` custom. **Riesgo residual aceptado y documentado** en L1 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 64 KiB es suficiente para leer el SOF de la gran mayoría de JPEG reales del universo WordPress/Shopify | Pattern 4, Pitfall 3 | Si es bajo, muchas imágenes caen en la rama informativa "dimensiones indeterminadas" e IMG-03 queda mudo sobre JPEG. Mitigación barata: registrar la tasa de indeterminadas en la verificación y subir el rango si supera ~10%. |
| A2 | Un `403` sobre una og:image debe tratarse distinto que un `403` sobre un enlace externo (donde `isBlockedStatus` lo degrada a informativo) | Pattern 3 | Si se replica `isBlockedStatus` tal cual, una og:image detrás de un WAF que también bloquea al crawler de Facebook se reporta como "sin problema" cuando el preview sí está roto. |
| A3 | La numeración ASVS de SSRF es V5.2.6 en 4.0.3, nivel L1 | Security Domain | Sólo afecta la trazabilidad del informe de seguridad, no el control en sí. |
| A4 | Ninguna plataforma social renderiza SVG como og:image | Pitfall 5, State of the Art | Verificado sólo por fuentes secundarias coincidentes, no por documentación oficial de plataforma. Si alguna lo soportara, la rama de SVG generaría un falso positivo. |
| A5 | El límite de 5 MB del requirement viene de X/LinkedIn y no de Facebook (8 MB) | State of the Art | Sólo afecta la redacción del `criterion`/`recommendation`, no el umbral. |
| A6 | Los umbrales de IMG deben vivir en `packages/meta-social/src/thresholds.ts` junto con los de Phase 30 | Anti-Patterns | Si Phase 32 no los reusa, la elección es indiferente. Si los reusa (lo probable, por el docblock del archivo), tenerlos en el check obligaría a duplicarlos. |
| A7 | Emitir varias filas para una misma imagen que dispara varias ramas (pequeña **y** pesada) es preferible a elegir sólo la más severa | Pattern 2 | Si genera ruido en el reporte, la corrección es trivial (quedarse con la peor), pero cambia los fingerprints emitidos. |

---

## Open Questions (RESOLVED)

> **Estado:** las seis preguntas quedaron resueltas por el orquestador de `/gsd-plan-phase` el 2026-08-03, tomando en cada caso la opción recomendada por la investigación. No hubo usuario humano en esa corrida. Cada pregunta lleva su disposición anotada abajo; ninguna sigue abierta ni requiere confirmación para ejecutar. Si Juan quiere revertir alguna, el punto de entrada es el `checkpoint:decision` de `31-01-PLAN.md` (Tarea 1) para la Q1, y una replanificación para el resto.

1. **¿Fila por imagen (site-level) o fila por página afectada?** — bloqueante para el planner
   - **RESUELTA → opción A (fan-out por página).** Dedupe del *fetch* (una sonda de red por URL única, cumple IMG-01 y el SC#1) + emisión de una fila por página afectada con su `pageId`. Se desvía de la letra de `31-CONTEXT.md` sólo en la emisión, no en el fetch; la desviación está registrada en el `<source_audit>` de `31-01-PLAN.md`.
   - Lo que sabemos: CONTEXT.md dice "dedupe por URL de imagen (no por página)" con `Map<string,string>`; el SC#1 del ROADMAP dice que la imagen "se verifica una sola vez" (habla del fetch). `scoreCategory` es una tasa de aprobación, así que una fila única entre ~1600 no mueve el score (Pitfall 1).
   - Lo que no está claro: si "dedupe" en CONTEXT.md se refería a las peticiones (que es lo que el requirement pide) o también a la emisión de filas.
   - Recomendación: **opción A** (dedupe del fetch + fan-out de filas por página con `pageId`). Cumple IMG-01 y el SC#1, arregla el score y la UI. **Requiere confirmación del usuario** porque contradice la letra de CONTEXT.md.

2. **¿Entra la defensa SSRF en el alcance de esta fase, y se extiende a TECH-12/TECH-13?** — bloqueante
   - **RESUELTA → sí a ambas.** Guard en helper compartido (`ssrfGuard.ts`), aplicado a los tres `NetworkCheck` dentro de esta fase (IMG-01 nuevo + TECH-12 + TECH-13). Motivo: `security_block_on: "high"` y la herencia ya declarada en `30-03-SUMMARY.md:267`. El riesgo residual (los saltos de redirección de TECH-12/13 quedan sin cubrir) está declarado en `31-03-PLAN.md`.
   - Lo que sabemos: Phase 30 la declaró explícitamente como herencia de Phase 31 (`30-03-SUMMARY.md:267`). `security_enforcement: true` con `block_on: "high"`, y SSRF hacia la red del worker (Redis/Postgres) califica como high.
   - Lo que no está claro: CONTEXT.md no la menciona; y TECH-12/TECH-13 tienen la misma exposición hoy sin defensa, así que "arreglar sólo el nuevo" deja el agujero abierto por otros dos caminos.
   - Recomendación: implementar el guard en un helper compartido dentro de esta fase y aplicarlo a los tres `NetworkCheck` a la vez. Si el usuario prefiere acotar, aplicarlo sólo a IMG-01 y abrir una deuda explícita para TECH-12/13 en REQUIREMENTS.md.

3. **¿HEAD + GET (letra del requirement) o un solo GET con Range (intención del ROADMAP)?**
   - **RESUELTA → un solo GET con `Range`.** Ante 405/501 se reintenta con un `GET` sin cabecera `Range` (el plan sustituyó el fallback a HEAD por este, porque un 405 sobre GET no se arregla con HEAD y un 501 es rechazo del `Range`). Desviación de la letra de IMG-01 registrada en el `<source_audit>` de `31-01-PLAN.md`.
   - Lo que sabemos: IMG-01 dice literalmente "(HEAD + GET parcial)"; el goal dice "sin sobrecargar el sitio auditado con requests repetidos". Un GET con Range devuelve todo lo que el HEAD daría.
   - Recomendación: un solo GET con Range; HEAD sólo como fallback ante 405/501. Documentar la desviación en el plan.

4. **¿Qué severidad para una og:image en SVG?**
   - **RESUELTA → `critical`** (tramo error), porque ninguna plataforma social la renderiza y el preview simplemente no se genera.
   - Lo que sabemos: ninguna plataforma la renderiza (A4); `image-size` a veces sí puede leer sus dimensiones, lo que la haría "pasar" el check de dimensiones.
   - Recomendación: rama propia con `critical` (el preview simplemente no se genera). Si se prefiere ser conservador, `warning`.

5. **¿Nombre del archivo del check?** (discreción de Claude según CONTEXT)
   - **RESUELTA → `packages/checks/src/checks/network/ogImageNetwork.ts`.**
   - Ya existe `packages/checks/src/checks/social/ogImage.ts` (SOCIAL-03). Recomendación: `packages/checks/src/checks/network/ogImageNetwork.ts` para evitar dos `ogImage.ts`.

6. **RESUELTA → deuda registrada, fuera de alcance de esta fase.** Herencia no reclamada de Phase 30: `30-VERIFICATION.md:163` señala que `ONPAGE-05` sigue ocupando un slot en el catálogo de 10 checkIds de `packages/cms-adapters`, y que `SOCIAL-01..08` caen al texto genérico de recomendación. `IMG-01` también caerá al genérico (`resolveCmsRecommendation` devuelve `null` para checkIds fuera del catálogo, sin lanzar — `coverage.test.ts:113-114`). No es un bug nuevo, pero suma un checkId más al conjunto sin copy por CMS.

---

## Sources

### Primary (HIGH confidence)

- Código del repositorio, leído en esta sesión: `packages/checks/src/checks/network/{linkChecker,brokenResources,brokenExternalLinks,index}.ts`, `packages/checks/src/{types,util,registry,validate,testUtils}.ts`, `packages/checks/src/checks/social/{ogImage,index}.ts`, `packages/meta-social/src/{index,types,extract,thresholds}.ts`, `packages/crawler/src/normalizeUrl.ts`, `packages/scoring/src/{overallScore,categoryScore}.ts`, `packages/report-model/src/{build,grouping,model}.ts`, `packages/db/prisma/schema.prisma`, `apps/worker/src/index.ts`, `apps/web/{package.json,next.config.ts}`, `scripts/assert-no-playwright-in-web.mjs`, `pnpm-lock.yaml`, `package.json`, `turbo.json`, `.planning/config.json`.
- Tests existentes leídos: `brokenExternalLinks.test.ts`, `registry.test.ts`, `social-guardrail.test.ts`, `social-calibration.test.ts` (parcial), `checkIdCollision.test.ts`, `phase11-guardrail.test.ts`, `psi/src/client.test.ts` (parcial), `cms-adapters/src/coverage.test.ts` (parcial).
- [github.com/image-size/image-size — `lib/index.ts`, `lib/lookup.ts`, `lib/types/{jpg,png,gif,svg}.ts`](https://github.com/image-size/image-size) — API exacta, mensajes de error, offsets por formato.
- `npm view image-size …` y `gsd-tools query package-legitimacy check` — versión 2.0.2, fecha, descargas, licencia, ausencia de `postinstall`.
- Context7 `/image-size/image-size` — forma del export, interfaz `ISize`/`ISizeCalculationResult`, limitaciones declaradas.
- [developers.facebook.com/docs/sharing/webmasters/images](https://developers.facebook.com/docs/sharing/webmasters/images/) — 200×200 mínimo, 600×315, 1200×630, ratio 1.91:1, 8 MB máximo.
- Documentos de planificación: `.planning/{REQUIREMENTS,ROADMAP,config.json}`, `.planning/phases/30-checks-de-meta-tags-social/{30-03-SUMMARY,30-VERIFICATION}.md`.

### Secondary (MEDIUM confidence)

- [MDN — HTTP range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests) y [RFC 7233](https://httpwg.org/specs/rfc7233.html) — el servidor puede ignorar `Range` y responder 200; semántica de `Content-Range`.
- [github.com/sindresorhus/image-dimensions](https://github.com/sindresorhus/image-dimensions) — confirmación de que basta leer "unos pocos bytes" y de la alternativa por streams.
- Búsqueda web sobre límites de X/LinkedIn (5 MB, 300×157, formatos) — múltiples fuentes independientes coincidentes; la documentación oficial de X devolvió 402 y no pudo verificarse directamente.
- Búsqueda web sobre soporte de SVG en previews sociales — varias fuentes coincidentes, sin documentación oficial de plataforma.

### Tertiary (LOW confidence)

- Numeración exacta de la sección ASVS para SSRF (A3).

---

## Metadata

**Confidence breakdown:**

- Forma real del código y rutas/líneas: **HIGH** — todo leído directamente del árbol de trabajo en esta sesión.
- API de `image-size@2.0.2`: **HIGH** — firma, exports, mensajes de error y offsets leídos del fuente oficial, cruzados con Context7 y con el registro npm.
- Umbrales de dimensión (200×200 / 600×315 / 1200×630 / 1.91:1): **HIGH** — documentación oficial de Facebook.
- Umbral de peso (5 MB) y atribución de plataforma: **MEDIUM** — fuentes secundarias coincidentes; la doc oficial de X no fue accesible.
- Bytes necesarios por formato: **MEDIUM/HIGH** — PNG y GIF verificados byte a byte contra el fuente; el 64 KiB para JPEG es una recomendación práctica (A1).
- Necesidad y forma del guard SSRF: **HIGH** en cuanto a que la exposición existe y Phase 30 la declaró; **MEDIUM** en cuanto a la implementación óptima sin agregar `undici` como dependencia.
- Soporte de SVG en plataformas: **MEDIUM** — sin fuente oficial.

**Research date:** 2026-08-03
**Valid until:** 2026-09-02 (30 días — `image-size` es estable; los umbrales de plataforma cambian con poca frecuencia. Revalidar antes si Phase 30 se recalibra o si `packages/checks/src/checks/network/linkChecker.ts` cambia de contrato.)
