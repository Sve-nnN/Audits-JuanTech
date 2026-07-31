# Phase 28: Performance por página - Research

**Researched:** 2026-07-31
**Domain:** Instrumentación de crawler HTTP (got/Crawlee timings) + checks de umbral por página + migración aditiva de schema Prisma
**Confidence:** HIGH (todo verificado contra el código real del repo y contra ejecución en vivo del crawler)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Captura de métricas en el crawl**

- Persistir sólo `responseMs` (tiempo total) + `htmlBytes` — sin `ttfbMs`, se mantiene el scope exacto de PAGEPERF-01/02.
- `responseMs` sale de `response.timings.phases.total` (got-scraping, ya expuesto por `CheerioCrawler`, cero requests extra).
- `htmlBytes` sale de `Buffer.byteLength(html, 'utf-8')` sobre el string ya cargado en memoria en `requestHandler` — no usar el header `content-length` (poco confiable con compresión/chunked).
- Páginas que caen en `failedRequestHandler` (sin `response`/`html`): `responseMs`/`htmlBytes` quedan `null`, sin tocar el manejo de `Page.error` ya existente.

**Checks nuevos (severity/category/registry)**

- Categoría: reusar `"perf"` (ya existe en `Category` de `packages/scoring`, mismo peso que CWV) — cero cambios de `CATEGORY_WEIGHTS` en esta fase.
- checkIds: `PERF-07` (tiempo de respuesta) y `PERF-08` (tamaño HTML), continuando la numeración de PERF-05/06 (PSI) aunque vivan en paquete distinto (`packages/checks`, no `packages/psi`).
- Dos `PageCheck` independientes (uno por métrica), mismo patrón que el resto del catálogo (1 checkId = 1 criterio con su propio umbral) — no un check combinado.
- Página sin dato (`responseMs`/`htmlBytes` en `null`): omitir el check para esa página, sin emitir issue — mismo patrón que checks que ya hacen guard sobre `page.html` en `registry.ts`.

**Umbrales, formato y persistencia**

- Comparación estrictamente mayor que (`> 600`, `> 1500`, `> 100 * 1024`, `> 300 * 1024`), tal como redacta PAGEPERF-03 — el valor límite exacto cuenta como "ok".
- `measuredValue` de HTML size en KB redondeado (`Math.round(bytes / 1024)`), coherente con los umbrales ya expresados en KB en REQUIREMENTS.md.
- Los dos checks van dentro de `packages/checks/src/registry.ts` (carpeta nueva `checks/perf/`) como `PageCheck` normales — los datos ya están en `page.responseMs`/`page.htmlBytes` gracias al crawl, sin llamada externa (a diferencia de PERF-05/06 que sí dependen de la respuesta de PSI).
- Migración Prisma: columnas `Int?` nullable en `Page` — auditorías previas a esta fase quedan con `null`, sin backfill obligatorio.

### Claude's Discretion

- Nombres exactos de archivo/función dentro de `checks/perf/` (ej. `responseTime.ts`, `htmlSize.ts`) y redacción exacta de `title`/`criterion`/`recommendation` — seguir el tono ya validado del proyecto (español neutro, sin voceo, imperativo impersonal — ver `contentLengthCheck` como referencia) y el `fingerprint` (`pageFingerprint(checkId, url)`).
- Nombres exactos de las columnas Prisma (`responseMs`, `htmlBytes` como punto de partida, ajustable si colisiona con convención existente al escribir el schema).

### Deferred Ideas (OUT OF SCOPE)

- `ttfbMs` (tiempo al primer byte) como columna adicional — evaluado y descartado para esta fase por exceder el scope literal de PAGEPERF-01 (sólo "tiempo de respuesta"); si se quiere en el futuro, viene gratis del mismo `response.timings` ya disponible.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAGEPERF-01 | Response time por página medido en el crawl (instrumentar `crawl.ts`), sin requests extra | Verificado en ejecución real: `response.timings.phases.total` está disponible dentro del `requestHandler` de `CheerioCrawler` sin configuración extra (ver **Code Examples § 1** y **Pitfall 3**). Punto de inserción exacto: `packages/crawler/src/crawl.ts:119` (`prisma.page.upsert`). Advertencia de validez de la métrica en **Pitfall 3**. |
| PAGEPERF-02 | HTML size por página, persistido en `Page` (migración Prisma) | `Buffer.byteLength(html, 'utf-8')` sobre el string ya materializado en `crawl.ts:114`. Migración aditiva a `model Page` (`packages/db/prisma/schema.prisma:107-136`). Semántica exacta (descomprimido) documentada en **Pitfall 4**. |
| PAGEPERF-03 | Umbrales — response time warning >600ms / error >1500ms; HTML size warning >100KB / error >300KB | Dos `PageCheck` nuevos en `packages/checks/src/checks/perf/`. **Bloqueante de checkId documentado en Pitfall 1.** Calibración empírica de los umbrales en **Pitfall 2** — la evidencia contradice la especificación y requiere decisión de Juan. Mapeo de vocabulario "error" → `critical` en **Pitfall 5**. |
</phase_requirements>

---

## Summary

Esta fase es técnicamente de bajo riesgo de implementación y **alto riesgo de calibración**. La captura de datos es trivial y está confirmada por ejecución real: `response.timings.phases.total` y `Buffer.byteLength(html)` están ambos disponibles dentro del `requestHandler` que ya existe, en el mismo punto donde se hace el `prisma.page.upsert`, sin un solo request adicional y sin instalar nada. El schema gana dos columnas `Int?` aditivas y el registry gana dos `PageCheck` que siguen el patrón exacto de `contentLengthCheck`. No hay dependencias nuevas, no hay decisiones de arquitectura pendientes, y la superficie tocada (crawler + schema + checks) no cruza el guardarraíl de Playwright/Vercel.

Dicho eso, la investigación encontró **tres problemas concretos que el plan debe resolver antes de escribir código**, dos de ellos capaces de degradar el producto en producción:

1. **Los checkIds `PERF-07` y `PERF-08` ya están en uso.** Están definidos en `packages/psi/src/issues.ts` (`DIAGNOSTIC_SPECS`) como "Recursos que bloquean el renderizado" y "Compresión de texto", y generan fingerprints con el mismo formato exacto (`${checkId}:${url}`) que `pageFingerprint`. Usar esos IDs produce colisión de fingerprints en las páginas de la muestra PSI, lo que colapsa filas en `diffIssues` — exactamente el defecto contra el que el proyecto ya tiene un test guardarraíl dedicado.
2. **Los umbrales, tal como están especificados, disparan en casi todo.** Medición en vivo sobre 10 sitios reales: con `htmlBytes` descomprimido, 10/10 superan el warning de 100KB y 5/10 superan el error de 300KB (incluida juan-tech.com). Con `phases.total`, 15/16 páginas medidas en dos sitios reales superan los 600ms. Como el catálogo emite una fila por página, una auditoría de 500 URLs puede generar ~1000 filas de severidad no-ok en categoría `perf`, y como la tabla de prioridades del reporte está capada a 60 filas, esas issues pueden desplazar por completo a los hallazgos reales de `tech`/`schema`.
3. **`phases.total` no mide sólo al servidor auditado.** Incluye la fase `wait` (adquisición de socket), que en el crawler propio se infla por `maxConcurrency: 5`. Datos medidos: `wordpress.org/` marcó `total=1640ms` (sería `critical`) con `wait=1152ms` y `firstByte=271ms` — un falso positivo puro causado por nuestra propia concurrencia. La investigación previa del milestone ya había señalado este riesgo (`.planning/research/PITFALLS.md:364`).

**Primary recommendation:** Implementar la captura tal como está lockeada (es correcta y verificada), pero llevar a decisión de Juan tres puntos antes de ejecutar: (a) renombrar los checkIds a `PERF-10`/`PERF-11` — no negociable, los actuales colisionan; (b) usar `phases.firstByte` en vez de `phases.total` como fuente de `responseMs`, o restar explícitamente `wait`; (c) recalibrar los umbrales de tamaño, o emitir sólo filas de problema (sin fila "ok") para no inundar la tabla de prioridades.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Medición de tiempo de respuesta por página | Crawler worker (`packages/crawler`) | — | El único punto del sistema donde existe el objeto `response` de got con sus timings es el `requestHandler` de `CheerioCrawler`. Medirlo en cualquier otra capa exigiría un request adicional, lo que viola PAGEPERF-01 explícitamente. |
| Medición de tamaño de HTML | Crawler worker (`packages/crawler`) | — | El string `html` ya está materializado en `crawl.ts:114` para persistirse en `Page.html`. Calcular bytes ahí es O(n) sobre memoria ya caliente; hacerlo en el reporte re-leería 500 blobs de Postgres. |
| Persistencia de las métricas | Database (`packages/db`, `model Page`) | — | PAGEPERF-02 dice literalmente "persistido en `Page`". `PerfMetric` es la tabla de la muestra PSI (mobile/desktop) y tiene una cardinalidad distinta (por página × estrategia, sólo 5 páginas); mezclar ahí rompería su semántica. |
| Evaluación de umbrales y emisión de issues | Check engine (`packages/checks`) | Scoring (`packages/scoring`) | Los checks son funciones puras sobre `PageCheckCtx`. Los datos ya vienen persistidos, así que no hay I/O. Scoring es tier secundario sólo en tanto que la categoría `perf` está deliberadamente excluida del cálculo por Issues (`apps/worker/src/index.ts:574`). |
| Presentación de las issues nuevas | Web (`apps/web` vía `packages/report-model`) | — | **Cero código nuevo.** El reporte agrupa por `category` de forma data-driven (`CATEGORY_ORDER` en `packages/report-model/src/build.ts:25` ya incluye `"perf"`) y no tiene catálogo por `checkId`. Las issues nuevas aparecen solas. Confirmado: no hay `apps/web/src`, no hay mapeo `checkId → label` en el frontend. |
| Orquestación del pipeline | Worker (`apps/worker`) | — | **Cero código nuevo.** `runAllChecks` ya itera `pageChecks`; agregar el array `perfPageChecks` al registry es suficiente. |

---

## Project Constraints (from CLAUDE.md)

Directivas accionables extraídas de `./CLAUDE.md` que aplican a esta fase:

| Directiva | Impacto en Phase 28 |
|-----------|---------------------|
| El crawl corre en worker de fondo, nunca en Vercel/serverless | Respetado — la captura vive en `packages/crawler`, consumido por `apps/worker`. Cero cambio en `apps/web`. |
| `packages/checks` y `packages/crawler` no deben arrastrar Playwright/Chromium al bundle de web | Respetado — los checks nuevos son funciones puras sobre `Page` + Cheerio. No agregan ninguna dependencia. `pnpm assert:web-boundary` debe seguir pasando (ver **Validation Architecture**). |
| No hand-roll de cosas ya resueltas por librerías | Respetado — se usan los timings de got en vez de un cronómetro manual (ver **Don't Hand-Roll**). |
| Auditoría gratuita hasta 500 URLs sin timeouts | Riesgo bajo pero real: `Buffer.byteLength` sobre 500 HTML es despreciable; la única presión es el volumen de filas `Issue` (ver **Pitfall 6**). |
| Los deliverables escritos deben estar humanizados, español neutro, sin voceo | Aplica a `title`/`criterion`/`recommendation` de los checks nuevos. **Ojo:** las recomendaciones existentes de `packages/psi/src/issues.ts` usan voceo rioplatense ("Serví las imágenes", "Activá compresión", "Minificá"); las de `packages/checks` usan imperativo neutro ("Amplía el contenido"). Seguir el estilo de `packages/checks`, no el de `packages/psi`. |
| GSD workflow: no editar archivos fuera de un comando GSD | Aplica al ejecutor, no al research. |

---

## Standard Stack

### Core

Esta fase **no introduce ninguna dependencia nueva**. Todo lo necesario ya está instalado y en uso en el repo.

| Library | Version (instalada) | Purpose | Why Standard |
|---------|---------------------|---------|--------------|
| `@crawlee/cheerio` | 3.17.0 | Provee el `CheerioCrawlingContext` con `response` tipado como `PlainResponse` de got | Ya es el motor de crawl del proyecto desde Phase 2. `[VERIFIED: node_modules/.pnpm listado + packages/crawler/package.json]` |
| `got` (transitiva vía `got-scraping@4.2.1` ← `@crawlee/http@3.17.0`) | 14.6.6 | Origen de `response.timings.phases` | No se instala ni se importa directamente; se consume a través del tipo del contexto de Crawlee. `[VERIFIED: node_modules/.pnpm/got@14.6.6 + ejecución en vivo]` |
| `@prisma/client` / `prisma` | 6.19.3 | Migración aditiva de `model Page` + regeneración de tipos | Ya es el ORM del proyecto. **Nota:** `CLAUDE.md` menciona "Prisma 7.x" en el stack recomendado, pero la versión realmente instalada y en uso es **6.19.3**. No cambiar esto en esta fase. `[VERIFIED: node_modules/.pnpm listado]` |
| `node:buffer` (`Buffer.byteLength`) | Node 24.13.0 / engines `>=20` | Cálculo de bytes de HTML | API nativa de Node, cero dependencias. `[VERIFIED: node --version]` |
| `vitest` | 4.1.9 | Tests unitarios de los checks nuevos | Runner ya configurado en `packages/checks` y `packages/crawler`. `[VERIFIED: package.json de ambos paquetes]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `packages/checks/src/util.ts` → `pageFingerprint` | interna | Construir el fingerprint `${checkId}:${url}` | Obligatorio para los dos checks nuevos — mantiene la estabilidad de diff entre corridas. |
| `packages/checks/src/testUtils.ts` → `makePage` | interna | Fixture mínima de `Page` para tests | **Requiere modificación** — ver **Pitfall 7**. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `response.timings.phases.total` | `response.timings.phases.firstByte` | `firstByte` mide TTFB puro (`timings.response - timings.upload`) y excluye la fase `wait` de adquisición de socket, que en nuestro crawler está contaminada por `maxConcurrency: 5`. **Recomendado por la evidencia** — ver **Pitfall 3**. Costo: se aparta de la letra de CONTEXT.md. |
| `response.timings.phases.total` | `total - (wait ?? 0)` | Compromiso: conserva DNS+TCP+TLS+servidor+download pero descuenta el encolado propio. Más fiel a "tiempo de respuesta" que `firstByte` (que excluye download) y menos sesgado que `total`. |
| `response.timings.phases.total` | `performance.now()` alrededor del handler | Rechazado. Mide tiempo de cola de Crawlee + parseo de Cheerio, no la transacción HTTP. Ya está descartado en la investigación previa del milestone (`.planning/research/STACK.md:141`). |
| `Buffer.byteLength(html)` (descomprimido) | `zlib.gzipSync(html).length` (comprimido) | Gzip es lo que realmente viaja por la red y es lo que los umbrales tipo Screaming Frog implican. Costo: ~10-20ms por página sobre 500 páginas = 5-10s adicionales por auditoría, y sigue sin ser el gzip real del servidor (nivel/algoritmo pueden diferir; muchos servidores usan brotli). Ver **Pitfall 4** para los datos comparativos. |
| `Buffer.byteLength(html)` | Header `content-length` | Ya descartado en CONTEXT.md, y confirmado empíricamente: en la corrida de prueba, `content-length` vino `undefined` en 2/2 respuestas porque got descomprime y borra los headers de encoding. `[VERIFIED: ejecución en vivo]` |
| Columna nueva en `model Page` | Columna en `model PerfMetric` | `PerfMetric` es por (página × estrategia PSI) y sólo existe para ~5 páginas de la muestra. PAGEPERF-02 pide explícitamente `Page`. Decisión ya lockeada y correcta. |

**Installation:**

```bash
# Ninguna. Esta fase no instala paquetes.
# Único comando de infraestructura requerido tras editar el schema:
pnpm db:push        # requiere conectividad a Postgres — ver Environment Availability
pnpm db:generate    # regenera los tipos del cliente (funciona offline)
```

**Version verification:** No aplica — no hay paquetes nuevos que verificar contra el registry.

---

## Package Legitimacy Audit

**No aplica a esta fase.** Phase 28 no instala ningún paquete externo, ni de producción ni de desarrollo. Toda la funcionalidad se construye sobre dependencias ya presentes en el lockfile y ya en uso en producción desde milestones anteriores (`@crawlee/cheerio`, `got` transitiva, `@prisma/client`, `vitest`, `node:buffer`).

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

Si durante la planeación aparece la opción de comprimir con gzip para el tamaño de HTML (ver **Alternatives Considered**), la implementación debe usar `node:zlib` (módulo nativo de Node), nunca un paquete de npm.

---

## Architecture Patterns

### System Architecture Diagram

```
                            apps/worker  processAuditJob()
                                    │
                                    ▼
                        resolveCanonicalUrl(domain)
                                    │
                                    ▼
        ┌───────────────────────────────────────────────────────────┐
        │  runCrawl()   ·  packages/crawler/src/crawl.ts            │
        │                                                            │
        │   sitemap/robots seeds ──▶ CheerioCrawler request queue    │
        │                                    │                       │
        │                     ┌──────────────┴──────────────┐        │
        │                     ▼                             ▼        │
        │            requestHandler(ctx)          failedRequestHandler│
        │                     │                             │        │
        │      ctx.response ──┤                             │        │
        │        · statusCode │                             │        │
        │        · headers    │  ★ responseMs =             │        │
        │        · timings ───┼──── timings.phases.total    │        │
        │      ctx.body ──────┤  ★ htmlBytes =              │        │
        │        · html str   │──── Buffer.byteLength(html) │        │
        │                     ▼                             ▼        │
        │            prisma.page.upsert()          prisma.page.upsert│
        │              (create + update)             responseMs=null │
        │                                            htmlBytes=null  │
        └───────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        Postgres · model Page
                        ★ responseMs Int?  ★ htmlBytes Int?
                                    │
                                    ▼
        ┌───────────────────────────────────────────────────────────┐
        │  runAllChecks()  ·  packages/checks/src/registry.ts        │
        │                                                            │
        │   for (page of pages)                                      │
        │      if (!page.html) continue   ◀── páginas fallidas se    │
        │              │                       saltan ENTERAS         │
        │              ▼                                             │
        │      $ = cheerio.load(page.html)                           │
        │              │                                             │
        │      for (check of pageChecks)  ── check.run({ page, $ })  │
        │          · onPageChecks                                    │
        │          · techPageChecks                                  │
        │          · schemaPageChecks                                │
        │          · aeoPageChecks                                   │
        │       ★  · perfPageChecks  (NUEVO)                         │
        │              │        · responseTime  → guard null → skip  │
        │              │        · htmlSize      → guard null → skip  │
        │              ▼                                             │
        │        IssueDraft[]  category:"perf"                       │
        └───────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                 worker: normaliza drafts → diffIssues(fingerprint)
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        Issue.createMany()              scoring por categoría
        (todas las filas)               ── if category==="perf" → SKIP
                                        (perf se puntúa desde PerfMetric/PSI)
                                    │
                                    ▼
                     buildReportModel()  ·  packages/report-model
                       · priorityIssues  → slice(0, 60)  ⚠ cuello
                       · issuesByCategory["perf"] → acordeón
                                    │
                                    ▼
                             apps/web report UI
                             (cero código nuevo)
```

### Recommended Project Structure

```
packages/crawler/src/
├── crawl.ts                      # MODIFICADO: 2 campos nuevos en el upsert
└── pageMetrics.ts                # NUEVO (recomendado): helper puro + testeable
                                  #   extractPageMetrics(response, html) →
                                  #   { responseMs, htmlBytes }

packages/db/prisma/
└── schema.prisma                 # MODIFICADO: model Page +2 columnas Int?

packages/checks/src/
├── checks/perf/                  # NUEVO directorio
│   ├── index.ts                  # export const perfPageChecks: PageCheck[]
│   ├── responseTime.ts           # PERF-10 (ver Pitfall 1)
│   ├── responseTime.test.ts
│   ├── htmlSize.ts               # PERF-11 (ver Pitfall 1)
│   └── htmlSize.test.ts
├── registry.ts                   # MODIFICADO: import + spread en pageChecks
├── index.ts                      # MODIFICADO: export * from "./checks/perf"
└── testUtils.ts                  # MODIFICADO: makePage acepta los 2 campos
```

### Pattern 1: Captura aditiva en el `requestHandler` (patrón FPRINT-01)

**What:** Derivar el dato nuevo de material que ya está en el contexto y agregarlo a los objetos `create`/`update` del `upsert` que ya existe. No agregar un paso nuevo al pipeline, no agregar un request, no re-parsear HTML.

**When to use:** Siempre que un dato nuevo sea derivable de `ctx.response` o `ctx.body`.

**Precedente exacto en el repo:** `packages/crawler/src/crawl.ts:110-116` hace exactamente esto para `responseHeaders` y `cookieNames` (FPRINT-01, Phase 25), y `crawl.ts` línea del `title` (Phase 20) hace lo mismo con `$`.

**Example:**

```typescript
// packages/crawler/src/crawl.ts — dentro de requestHandler, ~línea 114
// Source: patrón ya establecido en el propio archivo (commit 124234f, FPRINT-01)

const html = typeof body === "string" ? body : body?.toString("utf-8");

// ★ PAGEPERF-01/02: material de la MISMA respuesta ya cargada — cero requests
//   extra, mismo principio que responseHeaders/cookieNames arriba.
const responseMs = response?.timings?.phases?.total ?? null;
const htmlBytes = html != null ? Buffer.byteLength(html, "utf-8") : null;

await prisma.page.upsert({
  where: { auditId_url: { auditId, url } },
  create: { /* …campos existentes… */, responseMs, htmlBytes },
  update: { /* …campos existentes… */, responseMs, htmlBytes },
});
```

**Nota crítica sobre el `update`:** `crawl.ts` línea 147 ya pone `error: null` en la rama `update` para limpiar un error previo. Los dos campos nuevos deben ir en **ambas** ramas; si sólo se ponen en `create`, un re-crawl que haga `update` sobre una fila existente dejaría valores rancios de la corrida anterior.

### Pattern 2: `PageCheck` con umbral de dos niveles + guard de dato ausente

**What:** Función pura `run(ctx) → IssueDraft[]` que lee un campo ya persistido de `page`, compara contra dos umbrales y devuelve exactamente una fila.

**When to use:** Es el patrón de todo el catálogo de `packages/checks`.

**Example:** ver **Code Examples § 2**.

### Pattern 3: Registro en el barrel + registry (tres archivos, sin excepción)

Agregar un grupo de checks nuevo requiere tocar exactamente tres puntos, siguiendo el patrón literal de `onpage`/`tech`/`aeo`:

```typescript
// 1. packages/checks/src/checks/perf/index.ts
import type { PageCheck } from "../../types";
import { responseTimeCheck } from "./responseTime";
import { htmlSizeCheck } from "./htmlSize";

export const perfPageChecks: PageCheck[] = [responseTimeCheck, htmlSizeCheck];
export { responseTimeCheck, htmlSizeCheck };

// 2. packages/checks/src/registry.ts
import { perfPageChecks } from "./checks/perf";

export const pageChecks: PageCheck[] = [
  ...onPageChecks,
  ...techPageChecks,
  ...schemaPageChecks,
  ...aeoPageChecks,
  ...perfPageChecks,   // ★
];

// 3. packages/checks/src/index.ts
export * from "./checks/perf";
```

### Anti-Patterns to Avoid

- **Cronometrar con `Date.now()` alrededor del `requestHandler`:** mide encolado de Crawlee y parseo de Cheerio, no la transacción HTTP. Los timings de got ya desglosan las fases correctamente.
- **Meter las dos métricas en un solo check combinado:** rompe la convención "1 checkId = 1 criterio" de todo el catálogo y hace imposible que un usuario resuelva un problema y vea el otro seguir marcado. Ya lockeado como dos checks separados en CONTEXT.md.
- **Escribir los campos sólo en la rama `create` del upsert:** ver Pattern 1.
- **Añadir un `PageCheck` que asume que `page.html` puede ser null:** `runAllChecks` ya filtra (`registry.ts:60`) — el check nunca corre sobre páginas sin HTML. El guard que sí hace falta es sobre `responseMs`/`htmlBytes`, no sobre `html`.
- **Modificar `CATEGORY_WEIGHTS` o el cálculo de scoring:** ya lockeado como fuera de scope; además el worker excluye explícitamente `perf` del scoring por Issues (`apps/worker/src/index.ts:574`).
- **Añadir un panel de UI:** el reporte ya renderiza las issues nuevas sin código adicional. El roadmap marca esta fase como `UI: no`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Medir el tiempo de una petición HTTP | Un `Date.now()` de inicio/fin alrededor del handler | `response.timings.phases` de got (ya presente) | got desglosa `wait`/`dns`/`tcp`/`tls`/`firstByte`/`download`/`total` usando `http-timer` sobre los eventos reales del socket. Un cronómetro manual mezcla tiempo de cola de Crawlee, back-pressure del autoscaled pool y parseo de Cheerio en un solo número opaco. |
| Contar bytes de un string UTF-8 | `html.length` | `Buffer.byteLength(html, "utf-8")` | `String.length` cuenta unidades UTF-16, no bytes. Medido en vivo: `github.com` dio `strLen=591675` vs `byteLength=591772` — 97 bytes de diferencia por caracteres no-ASCII. En sitios en español la brecha es mayor (acentos, ñ). `[VERIFIED: ejecución en vivo]` |
| Obtener el tamaño transferido | Parsear `content-length` | Medir el body ya descomprimido | Confirmado en ejecución: got descomprime y el header no llega al handler (`content-encoding` y `content-length` vinieron `undefined` en 2/2 respuestas). Ya descartado en CONTEXT.md por la razón correcta. |
| Estabilidad de fingerprints entre corridas | Concatenar strings a mano | `pageFingerprint(checkId, url)` de `packages/checks/src/util.ts` | Un fingerprint mal formado rompe el diff `new`/`persistent`/`resolved` de forma silenciosa (las issues aparecen como "nuevas" en cada corrida). |
| Idempotencia de re-corridas | Borrar/insertar a mano en el check | El worker ya hace `prisma.issue.deleteMany({ where: { auditId } })` antes del `createMany` | Ya resuelto en `apps/worker/src/index.ts`. Los checks sólo devuelven drafts. |
| Comprimir HTML si se decide medir tamaño transferido | Implementar deflate | `node:zlib` (`gzipSync`) | Módulo nativo. Nunca un paquete de npm para esto. |

**Key insight:** El valor de esta fase está enteramente en *dónde* se toma la medición (dentro del request que ya ocurre) y en *contra qué* se compara (los umbrales). El código de medición en sí es de cinco líneas. Todo el esfuerzo de planeación debe ir a los tres puntos de decisión de la sección **Common Pitfalls**, no a la mecánica.

---

## Runtime State Inventory

Esta fase **no es** un rename/refactor/migración de datos, pero sí agrega columnas a una tabla en producción, así que el inventario aplica parcialmente.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `model Page` en Postgres (`shared-postgres`, tenant `auditor`) gana 2 columnas nullable. Las filas de auditorías anteriores quedan con `NULL`. **Sin backfill por diseño** (lockeado en CONTEXT.md, mismo criterio que `Audit.stack` en v1.5). | `pnpm db:push` contra la base configurada. Sin script de migración de datos. |
| Live service config | **Nada.** No hay configuración de servicio externo que contenga estos nombres de campo. Verificado: `grep -rn "responseMs\|htmlBytes"` en todo el repo (excluyendo node_modules) devuelve cero coincidencias — no hay nada que actualizar en n8n, Datadog, Railway ni Vercel. | Ninguna. |
| OS-registered state | **Nada.** No hay tareas programadas, unidades systemd ni procesos pm2 que referencien estos campos. | Ninguna. |
| Secrets/env vars | **Nada.** No se agregan ni renombran variables de entorno. `DATABASE_URL` ya existe y no cambia. | Ninguna. |
| Build artifacts | Cliente Prisma generado en `node_modules/.prisma/client` — se regenera con `pnpm db:generate`. Sin este paso, `PageCheckCtx.page` no expone los campos nuevos y el typecheck de `packages/checks` falla. | `pnpm db:generate` (funciona offline, no necesita la base). |

**La pregunta canónica:** después de editar `schema.prisma`, ¿qué queda desincronizado? Dos cosas, y ambas necesitan comando explícito: (1) el cliente TypeScript generado — `pnpm db:generate`; (2) la tabla física en Postgres — `pnpm db:push`. La segunda **no se puede ejecutar desde este entorno** (ver **Environment Availability**).

---

## Common Pitfalls

### Pitfall 1: `PERF-07` y `PERF-08` ya están asignados — colisión de fingerprint

**Severidad: BLOQUEANTE. Contradice una decisión lockeada de CONTEXT.md.**

**What goes wrong:** CONTEXT.md especifica `PERF-07` (tiempo de respuesta) y `PERF-08` (tamaño HTML) razonando que "continúan la numeración de PERF-05/06 (PSI)". Pero PERF-05 a PERF-09 **ya existen todos** en `packages/psi/src/issues.ts`, en la constante `DIAGNOSTIC_SPECS`:

| checkId | Título actual | Fuente |
|---------|---------------|--------|
| PERF-05 | Formatos de imagen modernos (WebP/AVIF) | `packages/psi/src/issues.ts:231` |
| PERF-06 | CSS sin usar | `packages/psi/src/issues.ts:239` |
| **PERF-07** | **Recursos que bloquean el renderizado** | `packages/psi/src/issues.ts:247` |
| **PERF-08** | **Compresión de texto** | `packages/psi/src/issues.ts:255` |
| PERF-09 | CSS/JS sin minificar | `packages/psi/src/issues.ts:263` |

**Why it happens:** El razonamiento de CONTEXT.md fue correcto en su premisa ("PERF-05/06 son de PSI") pero incompleto — no se verificó hasta dónde llegaba la serie. La constante `DIAGNOSTIC_SPECS` fue añadida en Phase 18 y no está documentada en REQUIREMENTS.md de v1.6.

**El daño concreto — colisión de fingerprint:**

`packages/psi/src/issues.ts:320` construye el fingerprint como `` `${spec.checkId}:${url}` `` con `url = page.finalUrl ?? page.url`. `packages/checks/src/util.ts` construye `pageFingerprint(checkId, url)` como `` `${checkId}:${url}` `` — **formato byte-idéntico**. Los checks nuevos usarían el mismo `page.finalUrl ?? page.url`. Por lo tanto, para cualquiera de las hasta 5 páginas de la muestra PSI (`MAX_PSI_PAGES = 5`), se emitirían dos `IssueDraft` distintos con el mismo fingerprint, p.ej. `PERF-07:https://example.com/`.

Consecuencias en cadena, todas verificadas en el código:
1. `diffIssues` guarda en un `Map<string, "new"|"persistent">` (`packages/scoring/src/diff.ts`). Dos filas con el mismo fingerprint colapsan a una sola entrada — el `diffStatus` de una sobrescribe al de la otra.
2. `diffResult.newCount`/`persistentCount` se calculan sobre los valores del Map, así que los contadores del reporte quedan mal por construcción.
3. Se persisten **dos filas `Issue`** con el mismo `fingerprint`, distinto `title` y distinto `checkId`... no, mismo `checkId`. El usuario ve dos issues llamadas "PERF-07" con títulos contradictorios ("Recursos que bloquean el renderizado" y "Tiempo de respuesta alto") sobre la misma URL. No hay constraint único en `Issue.fingerprint` (verificado en `schema.prisma:158-160`, sólo hay índices en `auditId` y `pageId`), así que no falla — **falla en silencio**.
4. Viola directamente el guardarraíl que el propio proyecto escribió: `packages/checks/src/checks/phase11-guardrail.test.ts` existe precisamente para probar "no-colapso de fingerprints".

**How to avoid:** Usar checkIds libres. Inventario completo verificado del catálogo actual: `AEO-01..04`, `ONPAGE-01..08`, `PERF-01`, `PERF-02-{LCP,CLS,TTFB,INP}`, `PERF-05..09`, `RENDER-01`, `SD-01..07`, `TECH-01..14`, `TECH-99`.

**Recomendación:** `PERF-10` (tiempo de respuesta) y `PERF-11` (tamaño HTML). Continúan la serie sin colisión y mantienen la coherencia de categoría `perf`. Evitar `PERF-03`/`PERF-04`: aunque no se usan como checkId, sí existen como IDs de requirement de v1.0 (muestreo y timeout de PSI, referenciados en los comentarios y tests de `packages/psi`) y reutilizarlos como checkId generaría confusión documental.

**Warning signs:** Un test que verifique unicidad de fingerprints sobre el conjunto (checks + PSI) de una misma página lo detecta. Ver **Validation Architecture § Wave 0**.

---

### Pitfall 2: Los umbrales especificados disparan en prácticamente todo

**Severidad: ALTA. Requiere decisión explícita de Juan antes de ejecutar.**

**What goes wrong:** Con los umbrales exactos de PAGEPERF-03 aplicados a las métricas exactas lockeadas en CONTEXT.md, casi ninguna página real pasa como "ok".

**Evidencia — tamaño de HTML descomprimido, 10 sitios reales `[VERIFIED: fetch en vivo, 2026-07-31]`:**

| Sitio | HTML crudo | gzip | Veredicto con umbral lockeado (>100KB warn / >300KB error) |
|-------|-----------:|-----:|------------------------------------------------------------|
| juan-tech.com | 271 KB | 39 KB | **warning** |
| aprendoclub.com | 117 KB | 21 KB | **warning** |
| wikipedia.org | 118 KB | 30 KB | **warning** |
| developer.mozilla.org | 118 KB | 16 KB | **warning** |
| nextjs.org | 309 KB | 41 KB | **critical** |
| shopify.com | 440 KB | 88 KB | **critical** |
| wordpress.org | 155 KB | 31 KB | **warning** |
| stripe.com | 635 KB | 159 KB | **critical** |
| vercel.com | 574 KB | 79 KB | **critical** |
| bbc.com | 595 KB | 87 KB | **critical** |

**10/10 no pasan. 5/10 son `critical`. El propio sitio del producto (juan-tech.com) sale marcado.**

**Evidencia — tiempo de respuesta, medido con el crawler real `[VERIFIED: CheerioCrawler en vivo, maxConcurrency 5]`:**

| Sitio | Páginas | >600ms (warning) | >1500ms (critical) |
|-------|--------:|-----------------:|-------------------:|
| juan-tech.com | 8 | 8/8 | 5/8 |
| wordpress.org | 8 | 7/8 | 2/8 |

**Why it happens:** Los umbrales de PAGEPERF-03 parecen tomados del universo de métricas *transferidas/comprimidas* y de *TTFB*, no de HTML crudo ni de tiempo total de transacción:

- Los 600ms coinciden exactamente con el umbral de **Screaming Frog "Document Request Latency"**, que se dispara "cuando el navegador tuvo que esperar más de 600ms a que el servidor respondiera al request del documento principal" — es decir, **TTFB**, no tiempo total. `[CITED: screamingfrog.co.uk/seo-spider/issues/pagespeed/document-request-latency/]`
- Para tamaño de documento, Screaming Frog usa **2MB**, no 100/300KB, y observa que la mediana de un archivo HTML ronda los **30KB** (tamaño de transferencia, o sea comprimido). `[CITED: screamingfrog.co.uk/seo-spider/issues/validation/html-document-over-2mb/]` — nuestros datos de gzip (16-159KB, mediana ~35KB) son consistentes con esa mediana; nuestros datos crudos (117-635KB) no.

**El daño concreto — inundación de la tabla de prioridades:**

`packages/report-model/src/build.ts:23` fija `MAX_PRIORITY_ROWS = 60`, y la consulta ordena por `[{ severity: "asc" }, { category: "asc" }]`. El enum `IssueSeverity` está declarado `critical, warning, ok`, así que `asc` pone `critical` primero; luego el orden alfabético de categoría es `aeo < onpage < perf < schema < tech`. Con 500 páginas y un `critical` de tamaño de HTML por página, se generan 500 filas críticas en categoría `perf` que **desplazan por completo** a los hallazgos críticos de `schema` y `tech` de la tabla de 60 filas. El reporte pasaría de "acá están tus 60 problemas más graves" a "acá están 60 páginas que pesan mucho".

El score general **no** se ve afectado (el worker excluye `perf` del scoring por Issues, `apps/worker/src/index.ts:574`), lo que hace el problema más insidioso: el número se ve bien y el reporte se ve roto.

**How to avoid — opciones para llevar a Juan:**

| Opción | Cambio | Efecto |
|--------|--------|--------|
| **A. Recalibrar umbrales de tamaño** | Warning >300KB / error >1MB sobre HTML crudo | Con la muestra: 5/10 warning, 0/10 critical. Señal utilizable. Requiere modificar PAGEPERF-03 en REQUIREMENTS.md. |
| **B. Medir gzip y conservar los umbrales** | `zlib.gzipSync(html).length` en el crawler | Con la muestra: 1/10 warning (stripe.com, 159KB), 0/10 critical. Señal excelente y umbrales intactos. Costo: 5-10s por auditoría de 500 páginas; y no es el gzip real del servidor (que puede usar brotli). |
| **C. No emitir fila "ok"** | El check devuelve `[]` cuando pasa (patrón de `canonicalDeep`, `headingsCheck`, `depthCheck`, `orphanPages`, `duplicateContent`, `hreflang`) | Mitiga el volumen total de filas pero **no** el problema de la tabla de prioridades, que sólo lista `critical`+`warning`. Sigue siendo deseable por volumen. |
| **D. Agregar por sitio en vez de por página** | Una issue de nivel sitio con "N de M páginas superan el umbral" | Elimina la inundación de raíz. Pero contradice PAGEPERF-02 ("por página") y exigiría un `SiteCheck`, no un `PageCheck`. Cambio de scope. |
| **E. Enviar tal cual está especificado** | Cero cambios | Válido si Juan acepta conscientemente que el reporte marque casi toda página. **No recomendado.** |

**Warning signs:** Correr los checks contra una auditoría real y contar `severity != "ok"` sobre el total de páginas. Si la proporción supera ~30%, el check es ruido y no señal.

---

### Pitfall 3: `phases.total` incluye el encolado de sockets del propio crawler

**Severidad: ALTA. La métrica, tal como está lockeada, atribuye al sitio auditado latencia que genera nuestro propio crawler.**

**What goes wrong:** `timings.phases.total` se define como `(end ?? error ?? abort) - start`, e incluye la fase `wait` = `socket - start`, o sea el tiempo que el request pasó esperando que el agente HTTP le asignara un socket. Con `maxConcurrency: 5` (`packages/crawler/src/crawl.ts:9`) y varios requests simultáneos al mismo host, ese encolado es nuestro, no del servidor auditado.

**Evidencia medida `[VERIFIED: CheerioCrawler en vivo con la misma configuración de crawl.ts]`:**

```
### juan-tech.com — primer lote de 5 concurrentes vs. segundo lote
  total=3074  wait=581   firstByte=2241  download=252
  total=3126  wait=581   firstByte=2268  download=277
  total=3296  wait=581   firstByte=2665  download=50
  total=3321  wait=746   firstByte=2404  download=170
  total=4161  wait=581   firstByte=2776  download=804
  total=1505  wait=0     firstByte=1361  download=144   ← conexión reusada
  total=1571  wait=0     firstByte=1434  download=137   ← conexión reusada
  total=1705  wait=0     firstByte=1434  download=271   ← conexión reusada

### wordpress.org
  total=1640  wait=1152  firstByte=271   download=217   ← home
  total=582   wait=0     firstByte=411   download=171
  total=695   wait=0     firstByte=630   download=65
  total=2015  wait=0     firstByte=1848  download=167
```

El caso `wordpress.org/` es el ejemplo canónico: `total=1640ms` lo marcaría **critical**, pero el servidor respondió el primer byte en **271ms**. Los 1152ms de `wait` son puro encolado de socket de nuestro crawler. Es un falso positivo del 100%.

Nótese además el patrón sistemático en juan-tech.com: los primeros 5 requests (el lote concurrente inicial) llevan `wait≈581ms` y los siguientes `wait=0` gracias al keep-alive. Es decir, **las primeras N páginas de cada auditoría reciben una penalización artificial** que las páginas posteriores no reciben. La métrica no es comparable entre páginas de la misma auditoría.

**Why it happens:** got expone `timings` mediante `get timings() { return this._request?.timings; }` (verificado en `got/dist/source/core/index.js:1321`), donde `_request` es el `ClientRequest` actual. `http-timer` arranca el cronómetro al crear el `ClientRequest`, y `start` se marca antes de que el socket esté disponible. La investigación previa del propio milestone ya lo había advertido: *"Medir sólo la transacción HTTP, no el tiempo en cola ni el parseo… Usar los timings del request HTTP; descartar reintentos"* (`.planning/research/PITFALLS.md:197,364`) y *"un cronómetro manual… mide tiempo de cola del pool de Crawlee"* (`.planning/research/STACK.md:141`).

**Efecto secundario en redirects:** got reinicia el cronómetro en cada salto. En `_makeRequest()` tras un redirect, `this._request` se reemplaza y `timer()` arranca de nuevo (verificado en el fuente de got, sección de manejo de redirect). Por lo tanto `phases.total` mide **sólo el último salto** de la cadena, no la cadena completa. Medido en vivo: `http://github.com/` → `https://github.com/` reportó `total=2140ms` con `redirectUrls=["https://github.com/"]`. Esto en realidad favorece la validez de la métrica (no penaliza al sitio por el redirect), pero debe documentarse para que nadie lo interprete como "tiempo total que espera un usuario".

**Efecto en reintentos:** `maxRequestRetries: 2`. Crawlee reintenta creando un request nuevo; el `response` que llega al handler es el del intento final. Los timings son del intento exitoso, no acumulados. Correcto por defecto, sin acción necesaria.

**How to avoid — opciones:**

| Opción | Fuente de `responseMs` | Efecto sobre los datos medidos |
|--------|------------------------|--------------------------------|
| **A (recomendada)** | `phases.firstByte` | wordpress.org home: 271ms → **ok** (falso positivo eliminado). juan-tech: 1361-2776ms → sigue **critical** (verdadero positivo conservado). Es exactamente lo que mide el umbral de 600ms de Screaming Frog. Contra: CONTEXT.md difirió `ttfbMs`; habría que aclarar que no se agrega columna nueva, sólo cambia la fuente de la existente. |
| **B** | `total - (wait ?? 0)` | Conserva DNS+TCP+TLS+servidor+download; descuenta sólo el encolado propio. Más cercano a "tiempo de respuesta" completo. wordpress.org home: 1640-1152 = 488ms → **ok**. |
| **C** | `phases.total` tal cual | Lockeado en CONTEXT.md. Métrica sesgada por nuestra propia concurrencia y no comparable entre páginas de la misma corrida. |
| **D** | `phases.total` + bajar `maxConcurrency` | Reduce el sesgo pero alarga las auditorías. No recomendado — degrada un parámetro validado para arreglar una métrica. |

**Contexto adicional obligatorio para el copy:** sea cual sea la fuente elegida, la recomendación/criterio del check debe decir explícitamente que es "medido durante el rastreo desde nuestro servidor", no un tiempo de usuario real. Ya está señalado en `.planning/research/STACK.md:71`: sin esa aclaración, el reporte se contradice con los TTFB de campo (CrUX) que ya publica `packages/psi` en la misma categoría `perf`.

**Warning signs:** Que la primera página de cada auditoría salga sistemáticamente peor que el resto del mismo sitio.

---

### Pitfall 4: `htmlBytes` mide HTML descomprimido, no bytes transferidos

**What goes wrong:** `Buffer.byteLength(html, 'utf-8')` mide el HTML ya descomprimido por got. Lo que realmente viaja por la red es entre 4x y 8x menor. La brecha medida en la muestra de 10 sitios va de 3.6x (wikipedia) a 7.4x (developer.mozilla.org), con mediana ~5x.

**Why it happens:** got descomprime transparentemente y elimina `content-encoding`/`content-length` de los headers que llegan al handler (confirmado en ejecución: ambos `undefined` en 2/2 respuestas). No hay forma de recuperar los bytes transferidos desde `ctx.response` sin instrumentar el stream a más bajo nivel.

**How to avoid:** No hay bug que arreglar — la decisión de medir descomprimido es defendible ("el peso del documento que el navegador tiene que parsear") y está lockeada. Lo que **sí** hace falta es:
1. Que el `criterion` del check diga explícitamente "tamaño del HTML sin comprimir", para que un usuario que compare contra las DevTools (que muestran transferido) no crea que el reporte está mal.
2. Que los umbrales se calibren para esa unidad — ver **Pitfall 2**.

**Warning signs:** Un usuario reporta "mi página pesa 39KB según DevTools, ¿por qué me dice 271KB?".

---

### Pitfall 5: "error" en REQUIREMENTS.md no es un valor válido de severidad

**What goes wrong:** PAGEPERF-03 y el enunciado de la fase dicen "severidad error". El enum real es `IssueSeverity { critical, warning, ok }` (`packages/db/prisma/schema.prisma:20-24`) y el tipo TypeScript es `IssueSeverityValue = "critical" | "warning" | "ok"` (`packages/checks/src/types.ts`). No existe `"error"`.

**Why it happens:** Vocabulario natural del requirement, no del schema. CONTEXT.md ya lo tradujo correctamente ("warning/critical"), pero el enunciado de la fase que llega al planner sigue diciendo "error".

**How to avoid:** Mapear `error → "critical"` de forma explícita en el plan. Es un mapeo directo, sin ambigüedad.

**Warning signs:** Prisma rechaza el `createMany` en runtime con un error de enum inválido — falla ruidosamente, no en silencio. Riesgo bajo pero trivialmente evitable.

---

### Pitfall 6: El guard de `page.html` en `runAllChecks` cambia el universo de páginas evaluadas

**What goes wrong:** `packages/checks/src/registry.ts:60` hace `if (!page.html) continue;` **antes** de correr cualquier `PageCheck`. Consecuencias:

1. Las páginas que cayeron en `failedRequestHandler` (que persisten `Page.error` y no persisten `html`) **nunca** llegan a los checks. Los checks nuevos jamás verán una fila con `responseMs === null` originada en un fallo de red.
2. El guard `!page.html` es *falsy*, no `!= null`: una página con `html === ""` (respuesta 204, o un 4xx con cuerpo vacío) también se salta entera.
3. Por lo tanto el guard de null que pide CONTEXT.md (`responseMs`/`htmlBytes` en null → omitir) sólo se activa en un caso realista: **auditorías anteriores a esta fase re-procesadas**, o una respuesta donde got no pobló `timings.phases.total`.

**Why it happens:** Diseño intencional del registry — todos los `PageCheck` reciben `$` ya cargado y asumen HTML presente.

**How to avoid:** Implementar el guard igual (es correcto y barato), pero el plan debe saber que **no se puede testear vía `runAllChecks`** con una página fallida; hay que testear el check directamente con `makePage({ html: "<html></html>", responseMs: null })`. Documentarlo en el test para que un futuro lector no crea que el guard es código muerto.

**Volumen de filas:** actualmente ~14 `PageCheck` emiten una fila "ok" por página; sobre 500 páginas eso ya son ~7000 filas `Issue` por auditoría. Sumar dos checks más añade ~1000 filas (+14%). Es asumible para `createMany`, pero refuerza la opción C de **Pitfall 2** (no emitir "ok").

**Warning signs:** Un test que espera un issue sobre una página fallida y recibe `[]`.

---

### Pitfall 7: `makePage` no hace spread de `overrides` — los campos nuevos deben añadirse a mano

**What goes wrong:** `packages/checks/src/testUtils.ts` construye la fixture enumerando campo por campo (`id`, `auditId`, `url`, `statusCode`, `html`, `finalUrl`, `redirectChain`, `contentType`, `depth`, `fromSitemap`, `fetchedAt`, `error`, `createdAt`) y cierra con `as Page`. **No hay `...overrides`.** Por eso ya faltan `schemaGraph`, `schemaJson`, `responseHeaders` y `cookieNames`.

Resultado: `makePage({ url: "…", responseMs: 800 })` **typechequea sin error** (porque `overrides` es `Partial<Page>`) pero devuelve un objeto donde `responseMs` es `undefined`. Un test escrito así pasa por el guard de null y devuelve `[]`, y el desarrollador ve un test que "falla misteriosamente".

**Why it happens:** El cast `as Page` suprime el error de campos faltantes y el picking explícito no propaga overrides desconocidos.

**How to avoid:** Añadir explícitamente en `makePage`:

```typescript
responseMs: overrides.responseMs ?? null,
htmlBytes: overrides.htmlBytes ?? null,
```

Esto es un cambio obligatorio, no opcional. Debe ser una tarea explícita del plan.

**Warning signs:** Un test de umbral que devuelve array vacío cuando debería devolver un issue.

---

### Pitfall 8: `pnpm db:push` no se puede ejecutar desde el entorno de desarrollo actual

**What goes wrong:** El `DATABASE_URL` configurado apunta a `shared-postgres:5432` — un hostname de red Docker interna. Verificado en vivo: `prisma.audit.count()` falla con `Can't reach database server at shared-postgres:5432`.

**Why it happens:** Migración de Neon a instancia propia durante el deploy de producción (2026-07-24, documentado en STATE.md). El hostname sólo resuelve dentro de la red del contenedor.

**How to avoid:**
- `pnpm db:generate` **sí** funciona offline (genera tipos desde `schema.prisma`, no toca la base). Todo el trabajo de tipos y typecheck se puede completar sin conectividad.
- `pnpm db:push` requiere que Juan lo corra desde un entorno con acceso a la red de `shared-postgres`, o con un túnel/port-forward activo.
- Consecuencia directa: el **Success Criterion #3** (smoke test de re-crawl contra un sitio real) tampoco se puede automatizar aquí — requiere base de datos + red. El plan debe modelarlo como un `checkpoint:human-verify` con el comando exacto, siguiendo el precedente de `apps/worker/scripts/verify-stack.mts` y `verify-cms-fix.mts` (que se documentan como "correr manualmente con red").

**Warning signs:** `P1001` en cualquier comando que toque la base.

---

## Code Examples

### 1. Captura en el crawler (patrón verificado en ejecución)

```typescript
// packages/crawler/src/crawl.ts — dentro de requestHandler
// Source: patrón establecido por FPRINT-01 (commit 124234f) en el mismo archivo.
// Verificado en ejecución en vivo con CheerioCrawler 3.17.0 / got 14.6.6.

async requestHandler(ctx: CheerioCrawlingContext) {
  const { request, response, body, contentType, $ } = ctx;
  // …código existente…
  const html = typeof body === "string" ? body : body?.toString("utf-8");

  // ★ PAGEPERF-01: tiempo de respuesta del MISMO request que ya se hizo.
  //   Optional chaining en toda la cadena: `phases.total` está declarado
  //   `total?: number` en got/dist/source/core/utils/timer.d.ts, y `timings`
  //   es `undefined` si got no llegó a crear el ClientRequest.
  const responseMs = response?.timings?.phases?.total ?? null;

  // ★ PAGEPERF-02: bytes UTF-8 del HTML ya materializado en memoria.
  //   NO usar html.length (unidades UTF-16, no bytes).
  const htmlBytes = html != null ? Buffer.byteLength(html, "utf-8") : null;

  await prisma.page.upsert({
    where: { auditId_url: { auditId, url } },
    create: { /* …existentes… */ responseMs, htmlBytes },
    update: { /* …existentes… */ responseMs, htmlBytes },  // ← ambas ramas
  });
}
```

**Typecheck confirmado:** `const total: number | undefined = response?.timings?.phases?.total;` compila limpio bajo el `tsconfig` de `packages/crawler` (`tsc --noEmit` → exit 0). `[VERIFIED: ejecución de tsc en este repo]`

**Runtime confirmado:** salida real del probe sobre `https://example.com/`:
```
has timings: true
timings.phases: {"wait":709,"firstByte":344,"download":14,"total":1067}
typeof phases.total: number
byteLength: 559   strLen: 559
content-encoding: undefined   content-length: undefined
```

### 2. Check de umbral de dos niveles (patrón `contentLengthCheck`)

```typescript
// packages/checks/src/checks/perf/responseTime.ts
// Source: packages/checks/src/checks/onpage/contentLength.ts (patrón del catálogo)

import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "PERF-10";              // ← NO PERF-07, ver Pitfall 1
const WARN_MS = 600;
const CRITICAL_MS = 1500;

/** PERF-10: tiempo de respuesta del servidor medido durante el rastreo. */
export const responseTimeCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page }) {
    // Guard de dato ausente: auditorías anteriores a v1.6 o respuestas sin
    // timings. Se omite la página por completo, sin emitir issue (CONTEXT.md).
    if (page.responseMs == null) return [];

    const url = page.finalUrl ?? page.url;
    const ms = page.responseMs;
    // Comparación estrictamente mayor: el valor límite exacto cuenta como ok.
    const severity = ms > CRITICAL_MS ? "critical" : ms > WARN_MS ? "warning" : "ok";

    return [
      {
        checkId: CHECK_ID,
        category: "perf",
        title: severity === "ok" ? "Tiempo de respuesta correcto" : "Tiempo de respuesta alto",
        severity,
        measuredValue: `${ms} ms`,
        source: url,
        criterion: `Óptimo hasta ${WARN_MS} ms; crítico sobre ${CRITICAL_MS} ms (medido durante el rastreo)`,
        recommendation: severity === "ok" ? "Sin acción necesaria." : "…",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
```

**Nota sobre la fila "ok":** el ejemplo la emite siguiendo `contentLengthCheck` (14 de los checks existentes lo hacen). Si se adopta la opción C de **Pitfall 2**, cambiar a `if (severity === "ok") return [];` — patrón de `canonicalDeep`, `headingsCheck`, `depthCheck`, `orphanPages`, `duplicateContent`, `hreflang`.

### 3. Migración de schema (aditiva, patrón v1.5)

```prisma
// packages/db/prisma/schema.prisma — model Page (líneas 107-136)
model Page {
  // …campos existentes…
  /** Nombres de cookie (no valores) parseados de Set-Cookie — Phase 25 (FPRINT-01). */
  cookieNames String[]
  /** Tiempo de respuesta del request de crawl en ms (got timings) — Phase 28 (PAGEPERF-01). Null en páginas fallidas y en audits pre-v1.6 (sin backfill). */
  responseMs  Int?
  /** Tamaño del HTML sin comprimir en bytes (Buffer.byteLength UTF-8) — Phase 28 (PAGEPERF-02). Null en páginas fallidas y en audits pre-v1.6 (sin backfill). */
  htmlBytes   Int?

  issues      Issue[]
  perfMetrics PerfMetric[]

  @@unique([auditId, url])
}
```

Sin `@@index` nuevo: ningún query filtra ni ordena por estas columnas. `buildReportModel` no las lee (las issues ya llevan el valor en `measuredValue`).

**Colisión de nombres verificada:** `grep -rn "responseMs\|htmlBytes"` sobre todo el repo (sin node_modules) devuelve **cero** coincidencias. `ttfbMs` sí existe pero sólo en `model PerfMetric` y en `packages/psi` — no hay conflicto en `Page`. `[VERIFIED: grep en el repo]`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cronometrar manualmente el fetch | Leer `response.timings.phases` de got/`http-timer` | got 9+ (2018), estable hasta 14.x | Desglose por fase gratis. Ninguna razón para cronometrar a mano en 2026. |
| "Tamaño de página" como un solo número | Distinguir HTML transferido (comprimido) vs. documento parseado (descomprimido) | Adopción generalizada de brotli/gzip | Los umbrales de la industria (Screaming Frog 2MB, mediana ~30KB) están expresados en tamaño **transferido**. Aplicar esos números a bytes descomprimidos es una comparación de peras con manzanas — ver **Pitfall 2**. |
| Tiempo de respuesta = "el sitio es lento" | TTFB (server response time) como métrica separada de la latencia de red | Core Web Vitals / Lighthouse `server-response-time` | El umbral de 600ms es de TTFB. El proyecto ya lo tiene en `PerfMetric.ttfbMs` para la muestra PSI; esta fase lo extiende a las 500 páginas — razón adicional para preferir `phases.firstByte` (**Pitfall 3**). |

**Deprecated/outdated:** Nada aplicable. La API de timings de got no cambió entre v11 y v14 (la documentación oficial de got para `stream.timings` sigue describiendo el mismo shape). `[CITED: github.com/sindresorhus/got/blob/main/documentation/3-streams.md]`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `PERF-10`/`PERF-11` son los siguientes IDs libres apropiados y no chocan con nada planificado para Phases 29-32 | Pitfall 1 | Bajo. El inventario de checkIds actuales se verificó exhaustivamente por grep; el riesgo residual es que un milestone futuro quiera esos números. Mitigable revisando el ROADMAP de v1.6 al planear. |
| A2 | Los umbrales de PAGEPERF-03 se derivaron de referencias de la industria expresadas en unidades distintas (TTFB, tamaño transferido), no de una calibración deliberada contra HTML descomprimido | Pitfall 2 | Medio. Si Juan los eligió a propósito para HTML crudo, la opción E (dejar como está) es la correcta y el resto de opciones sobra. **Requiere confirmación explícita de Juan.** |
| A3 | La tabla de prioridades del reporte es el lugar donde el usuario espera ver "los problemas más graves", y llenarla de issues de tamaño de HTML degrada el producto | Pitfall 2 | Medio. Es un juicio de producto, no un hecho técnico. El hecho técnico verificado es el cap de 60 filas y el orden de la consulta. |
| A4 | La muestra de 10 sitios y 16 páginas es representativa del universo de sitios que audita esta herramienta | Pitfall 2/3 | Medio. La muestra incluye sitios grandes (bbc, stripe, vercel) que sesgan hacia arriba, pero también incluye los dos sitios que el proyecto usa como referencia real (juan-tech.com y aprendoclub.com) y ambos superan el umbral de warning. |
| A5 | Las mediciones de latencia hechas desde esta máquina (macOS local, red doméstica) son cualitativamente comparables a las del worker en Railway | Pitfall 3 | Medio-alto. Los valores absolutos casi seguro difieren. Lo que **no** depende del entorno es el hallazgo estructural: `phases.total` incluye `wait`, y `wait` se infla con `maxConcurrency: 5`. Eso es propiedad del código, no de la red. |
| A6 | No hay planes de agregar un panel de UI de performance por página en Phase 32 que dependa de estos campos | Architectural Responsibility Map | Bajo. El roadmap marca Phase 28 como `UI: no` y Phase 32 como panel de preview social. |

---

## Open Questions

1. **¿Se aceptan `PERF-10`/`PERF-11` en lugar de los `PERF-07`/`PERF-08` lockeados?**
   - Lo que sabemos: `PERF-07`/`PERF-08` están ocupados y su uso produce colisión de fingerprint con consecuencias verificadas.
   - Lo que no está claro: si Juan prefiere otro esquema (p.ej. `PAGEPERF-01`/`PAGEPERF-02` como checkId, o renombrar los diagnósticos de PSI).
   - Recomendación: `PERF-10`/`PERF-11`. Renombrar los IDs de PSI está descartado — rompería el diff histórico de todas las auditorías existentes (los fingerprints persistidos dejarían de coincidir y todo aparecería como "resuelto" + "nuevo").

2. **¿Se recalibran los umbrales o se acepta que casi toda página quede marcada?**
   - Lo que sabemos: los datos empíricos de las 5 opciones (A-E) están en **Pitfall 2**.
   - Lo que no está claro: la intención original detrás de los números de PAGEPERF-03.
   - Recomendación: opción B (medir gzip, conservar umbrales) si se acepta el costo de 5-10s por auditoría; opción A (recalibrar a >300KB/>1MB crudo) si no. En cualquier caso, sumar la opción C (no emitir fila "ok") para contener el volumen.

3. **¿`responseMs` sale de `phases.total` o de `phases.firstByte`?**
   - Lo que sabemos: `total` incluye encolado propio y produce falsos positivos demostrados; `firstByte` es lo que mide el umbral de 600ms de la industria.
   - Lo que no está claro: si el objetivo declarado de PAGEPERF-01 ("tiempo de respuesta") pretendía incluir la descarga del documento.
   - Recomendación: `phases.firstByte`, manteniendo el nombre de columna `responseMs` (no es una columna `ttfbMs` nueva, así que no reabre el diferido de CONTEXT.md). Alternativa de compromiso: `total - (wait ?? 0)`.

4. **¿Cómo se verifica el Success Criterion #3 (re-crawl real sin regresiones)?**
   - Lo que sabemos: la base de datos no es alcanzable desde el entorno de desarrollo; el precedente del proyecto son scripts `.mts` corridos manualmente por Juan.
   - Recomendación: incluir en el plan un script `apps/worker/scripts/verify-pageperf.mts` (siguiendo el molde de `verify-stack.mts`) que lea las `Page` de un audit ya crawleado e imprima la distribución de `responseMs`/`htmlBytes` y cuántas páginas caerían en cada severidad. Ese script también resuelve empíricamente la pregunta 2 con datos del sitio real de Juan, en vez de con mi muestra.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Todo | ✓ | v24.13.0 (engines pide >=20) | — |
| pnpm | Monorepo | ✓ | 10.0.0 | — |
| `@crawlee/cheerio` + `crawlee` | Captura de timings | ✓ | 3.17.0 | — |
| `got` (transitiva) | `response.timings` | ✓ | 14.6.6 vía got-scraping 4.2.1 | — |
| `prisma` CLI (`db:generate`) | Regenerar tipos del cliente | ✓ | 6.19.3 (offline OK) | — |
| `prisma` CLI (`db:push`) | Crear las columnas en Postgres | **✗** | — | **Sin fallback.** Requiere que Juan lo corra con acceso a la red de `shared-postgres`. |
| Postgres (`shared-postgres:5432`) | `db:push` + smoke test de re-crawl | **✗** | — | **Sin fallback.** Error verificado: `Can't reach database server at shared-postgres:5432`. |
| Red saliente HTTP/HTTPS | Smoke test de crawl real (SC#3) | ✓ | — | — |
| `vitest` | Tests unitarios de los checks | ✓ | 4.1.9 | — |

**Missing dependencies with no fallback:**
- Acceso a Postgres. Bloquea `pnpm db:push` y cualquier verificación contra datos reales. El plan debe estructurar estos pasos como `checkpoint:human-verify` con el comando exacto, nunca como tareas automatizadas que "fallarían" en CI.

**Missing dependencies with fallback:** ninguna.

**Nota importante:** la ausencia de base de datos **no** bloquea el desarrollo. `pnpm db:generate` produce los tipos desde el schema sin tocar la base, así que `packages/checks` puede typechequear y todos los tests unitarios de los checks corren offline con `makePage`. Sólo la persistencia real y el smoke test end-to-end requieren la base.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | Ninguno en `packages/checks` ni `packages/crawler` (defaults de Vitest; los `*.test.ts` viven junto al código). `apps/web/vitest.config.ts` existe pero no aplica a esta fase. |
| Quick run command | `pnpm --filter @auditor/checks test` |
| Full suite command | `pnpm test` (turbo, todos los paquetes) |

**Baseline verde confirmado antes de tocar nada `[VERIFIED: ejecución en este repo]`:**
- `@auditor/checks`: 24 archivos, 121 tests, todos pasan
- `@auditor/crawler`: 4 archivos, 33 tests, todos pasan
- `@auditor/scoring`: 3 archivos, 25 tests, todos pasan

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAGEPERF-01 | `extractPageMetrics` deriva `responseMs` de `timings.phases.total` y devuelve `null` cuando `timings` falta | unit | `pnpm --filter @auditor/crawler exec vitest run src/pageMetrics.test.ts` | ❌ Wave 0 |
| PAGEPERF-01 | El crawl real persiste `responseMs` no-null en una página alcanzable | manual (requiere red + DB) | `pnpm --filter @auditor/worker exec tsx scripts/verify-pageperf.mts <auditId>` | ❌ Wave 0 |
| PAGEPERF-02 | `Buffer.byteLength` ≠ `String.length` para contenido no-ASCII; `null` cuando `html` es `undefined` | unit | `pnpm --filter @auditor/crawler exec vitest run src/pageMetrics.test.ts` | ❌ Wave 0 |
| PAGEPERF-02 | Las columnas existen en el cliente Prisma generado y `PageCheckCtx.page` las expone | typecheck | `pnpm --filter @auditor/checks typecheck` | ✓ (script ya existe) |
| PAGEPERF-03 | Response time: 600 → ok, 601 → warning, 1500 → warning, 1501 → critical (bordes exactos, comparación estricta) | unit | `pnpm --filter @auditor/checks exec vitest run src/checks/perf/responseTime.test.ts` | ❌ Wave 0 |
| PAGEPERF-03 | HTML size: 102400 → ok, 102401 → warning, 307200 → warning, 307201 → critical | unit | `pnpm --filter @auditor/checks exec vitest run src/checks/perf/htmlSize.test.ts` | ❌ Wave 0 |
| PAGEPERF-03 | `measuredValue` de tamaño en KB redondeado (`Math.round(bytes/1024)`) | unit | idem | ❌ Wave 0 |
| PAGEPERF-03 | `responseMs`/`htmlBytes` en `null` → el check devuelve `[]` (sin issue) | unit | idem | ❌ Wave 0 |
| PAGEPERF-03 | Los dos checks están registrados en `pageChecks` y `runAllChecks` los ejecuta | unit | `pnpm --filter @auditor/checks exec vitest run src/registry.test.ts` | ❌ Wave 0 |
| **Guardarraíl (Pitfall 1)** | Ningún checkId de `packages/checks` colisiona con los de `packages/psi`; los fingerprints de la unión sobre una misma página son únicos | unit | `pnpm --filter @auditor/checks exec vitest run src/checks/perf/checkIdCollision.test.ts` | ❌ Wave 0 |
| **Guardarraíl (CLAUDE.md)** | Playwright/Chromium no alcanzan el bundle de web | integration | `pnpm assert:web-boundary` | ✓ (`scripts/assert-no-playwright-in-web.mjs`) |
| **SC#3** | Re-crawl de un sitio ya auditado completa sin timeouts ni regresiones | manual (requiere red + DB) | `checkpoint:human-verify` — comando exacto en el plan | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @auditor/checks test && pnpm --filter @auditor/crawler test` (~4s combinados)
- **Per wave merge:** `pnpm typecheck && pnpm test && pnpm assert:web-boundary`
- **Phase gate:** suite completa verde + los dos `checkpoint:human-verify` (db:push y smoke test de re-crawl) resueltos por Juan antes de `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/crawler/src/pageMetrics.ts` — extraer la derivación de métricas a un helper puro. **Necesario porque `crawl.ts` no tiene ningún test** (los 4 archivos de test de `packages/crawler` cubren `sitemap`, `normalizeUrl`, `resolveCanonicalUrl` y `captureHeaders`, todos helpers puros). Sin este helper, PAGEPERF-01/02 no tienen forma de verificarse automáticamente. Es el mismo patrón que `captureHeaders.ts`, que ya extrajo la lógica de FPRINT-01 fuera del handler precisamente para poder testearla.
- [ ] `packages/crawler/src/pageMetrics.test.ts` — cubre PAGEPERF-01 y PAGEPERF-02
- [ ] `packages/checks/src/checks/perf/responseTime.test.ts` — cubre PAGEPERF-03 (bordes de umbral + guard de null)
- [ ] `packages/checks/src/checks/perf/htmlSize.test.ts` — cubre PAGEPERF-03 (bordes de umbral + formato KB + guard de null)
- [ ] `packages/checks/src/checks/perf/checkIdCollision.test.ts` — guardarraíl contra el Pitfall 1
- [ ] `packages/checks/src/registry.test.ts` — **no existe hoy** ningún test que verifique el contenido del registry; si el plan lo omite, un check registrado a medias pasa desapercibido
- [ ] Modificar `packages/checks/src/testUtils.ts` → `makePage` (ver **Pitfall 7**) — prerequisito de todos los tests de checks
- [ ] `apps/worker/scripts/verify-pageperf.mts` — script de verificación manual contra datos reales, molde de `verify-stack.mts`

Instalación de framework: no aplica, Vitest ya está en ambos paquetes.

---

## Security Domain

### Applicable ASVS Categories

`security_enforcement: true`, `security_asvs_level: 1` en `.planning/config.json`.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Esta fase no toca el flujo de verificación de email ni la cuota. Sin cambios en `packages/quota` ni `packages/email`. |
| V3 Session Management | no | Sin sesiones involucradas. |
| V4 Access Control | no | Sin endpoints nuevos ni cambios de autorización. Las issues nuevas se leen por el mismo path autorizado que las existentes. |
| V5 Input Validation | **sí (indirecto)** | El HTML del sitio auditado es input no confiable, pero esta fase sólo lo **mide** (`Buffer.byteLength`), nunca lo interpreta ni lo renderiza. Los valores persistidos son enteros derivados, no strings del sitio. El `measuredValue` que llega al reporte es una plantilla nuestra (`` `${ms} ms` ``), no contenido del sitio. Riesgo de inyección: nulo. |
| V6 Cryptography | no | Sin criptografía. `pageFingerprint` es concatenación de strings para diffing, explícitamente no un control de seguridad. |
| V7 Error Handling & Logging | **sí** | Las columnas nuevas no deben aparecer en logs con datos que permitan fingerprinting del cliente. No aplica: son dos enteros. `Page.error` no se toca. |
| V12 Files & Resources | **sí (marginal)** | Ver "Consumo de memoria" abajo. |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Sitio auditado hostil devuelve un HTML gigante (decompression bomb) para agotar memoria del worker | Denial of Service | **Ya mitigado antes de esta fase:** `packages/crawler/src/crawl.ts` ya persiste `Page.html` completo en Postgres, así que el HTML ya está íntegro en memoria hoy. `Buffer.byteLength` es O(n) sin asignar copia. Esta fase **no aumenta** la superficie. Riesgo preexistente, fuera de scope. |
| Sitio hostil retiene la conexión indefinidamente para colgar el crawl | Denial of Service | Ya mitigado: `requestHandlerTimeoutSecs: 30` y `maxRequestRetries: 2` en `crawl.ts`. La página cae en `failedRequestHandler` con `responseMs`/`htmlBytes` en `null`, exactamente el caso que el guard maneja. |
| Almacenar datos que permitan perfilar la infraestructura del sitio auditado más allá de lo declarado | Information Disclosure | No aplica: `responseMs` y `htmlBytes` son métricas públicamente observables por cualquiera que visite el sitio. Sin PII. |
| Enteros fuera de rango rompiendo la columna `Int` de Postgres | Tampering / DoS | `Int` de Postgres es de 32 bits (máx 2.147.483.647). `htmlBytes` tendría que superar 2GB de HTML para desbordar — imposible dado que Node ya habría fallado antes por el límite de tamaño de string. `responseMs` está capado de facto por el timeout de 30s. **Riesgo despreciable, pero conviene un comentario en el schema** para que nadie cambie el tipo asumiendo `BigInt`. |

**Conclusión de seguridad:** Esta fase es de riesgo de seguridad efectivamente nulo. No agrega endpoints, no agrega dependencias, no procesa input no confiable de forma nueva, y persiste únicamente dos enteros derivados. No requiere tareas de seguridad dedicadas en el plan.

---

## Sources

### Primary (HIGH confidence)

- **Código del repo, lectura directa:**
  - `packages/crawler/src/crawl.ts` (punto de captura, líneas 114-150; concurrencia línea 9; retries línea 13)
  - `packages/db/prisma/schema.prisma` (`model Page` 107-136; `IssueSeverity` 20-24; `model Issue` 138-160; `model PerfMetric` 166-190)
  - `packages/checks/src/registry.ts` (guard `!page.html` línea 60; composición de `pageChecks` 17-22)
  - `packages/checks/src/types.ts`, `util.ts`, `testUtils.ts`
  - `packages/checks/src/checks/onpage/contentLength.ts` (patrón de referencia)
  - `packages/checks/src/checks/phase11-guardrail.test.ts` (guardarraíl de fingerprints)
  - `packages/psi/src/issues.ts` (`DIAGNOSTIC_SPECS`, PERF-05..09, líneas 229-321)
  - `packages/scoring/src/overallScore.ts`, `categoryScore.ts`, `diff.ts`
  - `packages/report-model/src/build.ts` (`MAX_PRIORITY_ROWS` línea 23; `CATEGORY_ORDER` línea 25; consultas 207-220)
  - `apps/worker/src/index.ts` (exclusión de `perf` del scoring, línea 574)
  - `scripts/assert-no-playwright-in-web.mjs`
- **Ejecución en vivo en este repo (2026-07-31):**
  - Probe de `CheerioCrawler` confirmando `response.timings.phases.total` como `number`, `redirectUrls`, ausencia de `content-length`/`content-encoding`, y `Buffer.byteLength` vs `String.length`
  - Medición de fases (`wait`/`firstByte`/`download`/`total`) sobre 16 páginas de juan-tech.com y wordpress.org con la configuración real del crawler
  - Muestra de tamaños de HTML crudo vs gzip sobre 10 sitios reales
  - `tsc --noEmit` sobre `packages/crawler` con acceso a `response?.timings?.phases?.total` → exit 0
  - `pnpm test` sobre checks/crawler/scoring → 179 tests verdes (baseline)
  - `prisma validate` → schema válido; `prisma.audit.count()` → `Can't reach database server at shared-postgres:5432`
- **Definiciones de tipos en `node_modules` (lectura directa):**
  - `@crawlee/http@3.17.0/internals/http-crawler.d.ts:149` → `response: PlainResponse`
  - `got@14.6.6/dist/source/core/response.d.ts:55-68` → `timings: Timings` + documentación de las fases
  - `got@14.6.6/dist/source/core/utils/timer.d.ts` → `phases.total?: number` (opcional)
  - `got@14.6.6/dist/source/core/index.js:1321` → `get timings() { return this._request?.timings; }` (reinicio en redirects)
- **Investigación previa del propio milestone v1.6:**
  - `.planning/research/STACK.md:60-90, 141, 182` — captura de métricas, advertencia sobre cronómetros manuales
  - `.planning/research/PITFALLS.md:197, 364` — "medir sólo la transacción HTTP, no el tiempo en cola"
  - `.planning/research/ARCHITECTURE.md:11, 28, 74-85` — decisión de medir dentro del crawl

### Secondary (MEDIUM confidence)

- Documentación oficial de got sobre `stream.timings`, `timings.phases` y manejo de redirects, vía Context7 (`/sindresorhus/got`) — confirma el shape de `phases` y el comportamiento de reinicio en redirect, coherente con la lectura del fuente instalado.

### Tertiary (LOW confidence)

- WebSearch sobre umbrales de la industria → Screaming Frog "Document Request Latency" (600ms, sobre respuesta del servidor) y "HTML Document Over 2MB" (mediana ~30KB transferidos). Fuentes: [screamingfrog.co.uk/seo-spider/issues/pagespeed/document-request-latency](https://www.screamingfrog.co.uk/seo-spider/issues/pagespeed/document-request-latency/), [screamingfrog.co.uk/seo-spider/issues/validation/html-document-over-2mb](https://www.screamingfrog.co.uk/seo-spider/issues/validation/html-document-over-2mb/). Marcado LOW por venir de búsqueda; sin embargo el hallazgo que importa (que 600ms es un umbral de TTFB y no de tiempo total) está corroborado independientemente por la definición de `server-response-time` de Lighthouse ya usada en `packages/psi/src/parser.ts:56`.

---

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH — no hay paquetes nuevos; todas las versiones se leyeron del lockfile instalado y se ejecutaron en vivo.
- **Disponibilidad de la métrica (PAGEPERF-01/02):** HIGH — verificada por ejecución real del crawler, por lectura de los `.d.ts` instalados y por `tsc --noEmit`.
- **Architecture / puntos de integración:** HIGH — cada archivo y número de línea se leyó directamente; los patrones se derivan de código ya en producción (FPRINT-01, ONPAGE-06).
- **Pitfall 1 (colisión de checkId):** HIGH — colisión verificada línea por línea en `packages/psi/src/issues.ts` y en el formato de fingerprint de ambos lados.
- **Pitfall 3 (sesgo de `phases.total`):** HIGH para el mecanismo (leído en el fuente de got y observado en vivo con la config real del crawler); MEDIUM para las magnitudes absolutas, que dependen de la red desde la que se mide.
- **Pitfall 2 (calibración de umbrales):** MEDIUM-HIGH — la evidencia empírica es sólida (10 sitios, 16 páginas, incluidos los dos sitios de referencia del proyecto) pero la muestra es pequeña y el juicio de "esto es demasiado ruido" es de producto, no técnico. **Requiere confirmación de Juan.**
- **Environment availability:** HIGH — probado por ejecución (la base falla con error concreto y reproducible).
- **Security:** HIGH — superficie efectivamente nula, razonada sobre el código real.

**Research date:** 2026-07-31
**Valid until:** 2026-08-30 (30 días — stack estable, sin dependencias nuevas; lo único que podría invalidarse antes es el inventario de checkIds si Phases 29-32 reservan números)
