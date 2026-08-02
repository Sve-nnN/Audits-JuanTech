# Phase 30: Checks de meta tags/social - Research

**Researched:** 2026-08-01
**Domain:** Extracción y validación de Open Graph / Twitter Card / charset sobre HTML ya parseado, dentro de un monorepo pnpm+Turborepo existente
**Confidence:** HIGH (arquitectura y contratos verificados contra el código real; estándares externos verificados contra fuente oficial)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Arquitectura del motor de extracción meta/social**

- Paquete nuevo `packages/meta-social` — motor puro de extracción (og:title/description/image/url/type, twitter:card, twitter:*, charset + su posición en el HTML crudo), sin dependencias de runtime salvo Cheerio. Mismo patrón desacoplado que `packages/fingerprint` y `packages/cms-adapters` (decisión ya registrada en research v1.6 / STATE.md).
- Expone una función pura tipo `extractMetaSocial($, html): MetaSocialData` que `packages/checks` consume para generar los 8 checks nuevos — el motor no conoce `Issue`/`PageCheck`, sólo devuelve datos extraídos.
- Testeado con fixtures HTML in-memory (mismo patrón que el resto del catálogo: `cheerio.load(html)` + assertions directas sobre el resultado de la función pura).
- Este mismo motor lo va a reusar Phase 32 (panel de preview + snippets) sin necesitar `@auditor/checks`/`@auditor/db` — motivo real de aislarlo en paquete propio en vez de meterlo directo en `packages/checks`.

**checkIds y estructura de checks**

- checkIds: `SOCIAL-01` a `SOCIAL-08`, match 1:1 con el requirement ID (sin colisión — confirmado que no existe ningún checkId `SOCIAL-*` en el catálogo actual). Fingerprint compuesto por subtipo donde aplique (ej. `SOCIAL-01:missing`, `SOCIAL-01:too-short`), mismo patrón que `TECH-04:cross-domain`. El test de Phase 29 (`packages/report-model/src/build.test.ts:221`) ya usa el formato `SOCIAL-01:og-title` — mantener consistencia con eso.
- Un `PageCheck` por archivo (mismo patrón "un archivo = un check" que `title.ts`/`metaDescription.ts`/`h1.ts`), no un check monolítico. Carpeta nueva `packages/checks/src/checks/social/`, paralela a `onpage/`/`tech/`/`schema/`/`aeo/`, con su propio `index.ts` (`socialPageChecks`) importado en `packages/checks/src/registry.ts`.
- SOCIAL-04 (og:url coherente con canonical) relee el canonical directo del `$` ya cargado (`$('link[rel="canonical"]').attr('href')`), sin depender del resultado de `TECH-04`/`canonicalCheck` — los `PageCheck` no comparten estado entre sí (`PageCheckCtx` sólo da `page`+`$`). Fallback a `page.finalUrl ?? page.url` si no hay canonical explícito, mismo patrón que `canonicalCheck`.

**Casos borde / anti-falso-positivo**

- SOCIAL-07: mapeo `twitter:title`↔`og:title`, `twitter:description`↔`og:description`, `twitter:image`↔`og:image`. `twitter:card` se evalúa siempre (no tiene equivalente OG). Los tres campos secundarios (`twitter:title/description/image`) se evalúan como error SÓLO cuando faltan tanto el `twitter:*` como su equivalente `og:*` — si el OG existe, no se penaliza la ausencia del `twitter:*` correspondiente.
- SOCIAL-06 (duplicados OG): agrupar `meta[property]` por su valor de `property`; marcar issue sólo cuando un grupo tiene >1 tag Y sus `content` difieren entre sí. Duplicados con el mismo valor exacto (redundantes pero sin ambigüedad) NO se marcan como error.
- SOCIAL-08 (charset en el primer 1KB): medir sobre el HTML crudo (`page.html`, no sobre `$` ya parseado, que pierde posición), buscando `<meta charset` o `<meta http-equiv="Content-Type" ... charset=` dentro de los primeros 1024 bytes REALES (`Buffer.byteLength`-acotado, no `.slice(0,1024)` por caracteres) — mismo rigor que Phase 28 aplicó a `htmlBytes` para no subestimar el corte si hay multibyte antes de la declaración de charset.
- SOCIAL-05 (og:type): sólo verifica presencia, sin validar el valor contra una lista de tipos válidos (`website`/`article`/etc.) — el requirement no lo pide.

### Claude's Discretion

- Nombre exacto del export del paquete (`extractMetaSocial` como punto de partida, ajustable) y forma exacta del tipo `MetaSocialData`.
- Redacción exacta de `title`/`criterion`/`recommendation` de cada uno de los 8 checks — seguir el tono ya validado (español neutro, sin voceo, imperativo impersonal, ver `title.ts`/`contentLength.ts` como referencia).

### Deferred Ideas (OUT OF SCOPE)

- Validación de valores específicos de `og:type` contra una lista cerrada (`website`, `article`, etc.) — fuera de scope, el requirement sólo pide presencia.
- Todos los `twitter:*` como obligatorios — explícitamente descartado en REQUIREMENTS.md (Out of Scope) por generar falsos positivos masivos.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SOCIAL-01 | og:title presente + longitud (10–60 chars) | Extractor unificado `property\|\|name` (§ Pitfall 1); patrón de check de longitud con 2 niveles verificado en `onpage/title.ts` (§ Code Examples) |
| SOCIAL-02 | og:description presente + longitud (55–200 chars) | Idem SOCIAL-01; referencia directa `onpage/metaDescription.ts` |
| SOCIAL-03 | og:image presente + URL absoluta HTTPS | Detección de relativa vía comparación crudo↔resuelto con `normalizeUrl` de `@auditor/crawler` (§ Code Examples); `ogp.me` confirma que la primera etiqueta gana en conflictos |
| SOCIAL-04 | og:url presente + coherente con canonical | `canonicalCheck` (`tech/canonical.ts`) da el patrón exacto de lectura + fallback + `normalizeUrl(href, url)` |
| SOCIAL-05 | og:type presente | Sólo presencia; `ogp.me` confirma que `og:type` es una de las 4 propiedades requeridas |
| SOCIAL-06 | tags OG duplicados (mismo property, valores distintos) | Extractor devuelve `Map<string, string[]>` (arrays, no colapsado); § Pitfall 2 documenta por qué agrupar por clave normalizada y no por `meta[property]` crudo |
| SOCIAL-07 | twitter:card presente + valor válido, resto anti-falso-positivo | Valores válidos verificados (`summary`, `summary_large_image`, `app`, `player`); fallback documentado de X a OG (§ Standard Stack / Sources) |
| SOCIAL-08 | charset declarado dentro del primer 1KB | Regla de 1024 bytes verificada contra HTML Standard y Lighthouse; `page.html` disponible en `PageCheckCtx` (verificado en código); § Pitfall 3 documenta el falso positivo de charset-por-header |
</phase_requirements>

## Summary

Esta fase no tiene incógnitas de stack: no instala ni una sola dependencia externa nueva. Todo lo que necesita ya está en el repo (Cheerio 1.2.0, vitest 4.1.9, el contrato `PageCheck`/`IssueDraft`, `pageFingerprint`, `normalizeUrl`). El riesgo real de la fase no es técnico sino de **fidelidad al HTML del mundo real**: los sitios que va a auditar el lead magnet son mayoritariamente WordPress con Yoast/RankMath, Shopify, Webflow y Wix, y esos emisores no respetan la especificación de Open Graph al pie de la letra. Un extractor escrito contra el spec (`meta[property]` para OG, `meta[name]` para Twitter) va a producir falsos positivos en una fracción grande del universo objetivo. Ese es el hallazgo dominante y ya estaba anticipado en la investigación de milestone (`.planning/research/PITFALLS.md`, Pitfall 5); esta investigación lo confirma contra las fuentes oficiales y contra el código retirado de ONPAGE-05, que hacía exactamente `$("meta[property]")`.

La verificación contra el código real confirma casi todas las decisiones de CONTEXT.md. `PageCheckCtx` entrega `{ page, $ }` donde `page` es la fila Prisma completa, y `Page.html` es una columna `String? @db.Text` que `runAllChecks` garantiza no vacía antes de correr cualquier `PageCheck` (`if (!page.html) continue`) — así que SOCIAL-08 sí puede medir sobre el HTML crudo tal como asume CONTEXT.md. El scaffolding de `packages/fingerprint`/`packages/cms-adapters` es idéntico y trivial de espejar: `main`/`types` apuntando a `src/index.ts`, sin script `build`, sin `vitest.config.ts`, dos scripts (`typecheck`, `test`). El guardarraíl de Success Criterion #5 tiene un patrón directo que copiar en `perf/checkIdCollision.test.ts`, que ya reconstruye fingerprints de un catálogo que no puede importar — exactamente la situación de ONPAGE-05, que fue borrado del árbol con `git rm` en Phase 29.

Hay tres puntos donde CONTEXT.md no coincide con el código y uno donde entra en tensión con la investigación de milestone ya aceptada. El más importante: CONTEXT.md pide "mantener consistencia" con `checkId: "SOCIAL-01:og-title"` del test de Phase 29, pero **ningún check de producción pone dos puntos en `checkId`** — el subtipo va sólo en el fingerprint (`headings.ts`, `canonicalDeep.ts`), y meter el subtipo en `checkId` rompería el lookup exact-match de `resolveCmsRecommendation` y fragmentaría `groupIssuesByType`. Los otros dos son SOCIAL-06 (agrupar por `meta[property]` crudo pierde justo el caso `property`/`name` contradictorio que la investigación exige cubrir con fixture) y SOCIAL-08 (charset declarado sólo por header HTTP es válido según spec y según Lighthouse, y el proyecto hoy descarta ese dato — falso positivo estructural que hay que documentar en el `criterion`).

**Primary recommendation:** Construir un único extractor en `packages/meta-social` que recorra `$("meta")` una sola vez, lea `property || name` normalizado a minúsculas, devuelva `Map<string, string[]>` sobre un `Map` (no objeto literal), y sea la única fuente de la que los 8 checks lean; los `checkId` quedan planos (`SOCIAL-01`..`SOCIAL-08`) y todo el subtipado vive en el fingerprint.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Extracción de meta tags del DOM | Motor puro (`packages/meta-social`) | — | Sin `IssueDraft`, sin `Page`, sin red. Phase 32 lo reusa desde `report-model`/`apps/web` sin arrastrar `@auditor/db` ni `@auditor/crawler` [VERIFIED: `.planning/research/ARCHITECTURE.md:315-319`] |
| Umbrales de longitud (10–60, 55–200) | Motor puro | Checks | Calibrables sin tocar la capa de issues; Phase 32 los necesita para pintar el preview con el mismo criterio |
| Producción de `IssueDraft` | `packages/checks/src/checks/social/` | — | `packages/checks` es el único lugar del repo que produce `IssueDraft` y el único que el worker cablea vía `runAllChecks` [VERIFIED: `packages/checks/src/registry.ts:54-85`] |
| Resolución de URL relativa/absoluta (SOCIAL-03/04) | `packages/checks` | — | `normalizeUrl` vive en `@auditor/crawler`; el motor puro NO puede depender de crawler, así que la normalización se hace en el check, no en el extractor [VERIFIED: `packages/checks/package.json` declara `@auditor/crawler`; `packages/fingerprint/package.json` sólo declara `cheerio`] |
| Medición de posición de charset en bytes (SOCIAL-08) | Motor puro | `packages/checks` | Es una función de `(html: string) => boolean`; sin dependencias. El check sólo la llama y decide severidad |
| Persistencia de issues | `apps/worker` | — | Sin cambios en esta fase: `issueDrafts` ya fluye por `Issue.createMany` [VERIFIED: `apps/worker/src/index.ts:464-541`] |
| Agregación y score de la categoría `social` | `packages/scoring` + `packages/report-model` | — | Ya listo desde Phase 29. Esta fase no toca ninguno de los dos [VERIFIED: `overallScore.ts:12,37`; `build.test.ts:217-236`] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `cheerio` | 1.2.0 (instalada; última publicada 1.2.0) | Parseo de HTML en el extractor puro | Ya es la dependencia de parseo de todo el repo (`@auditor/checks`, `@auditor/fingerprint`). El `$` llega ya cargado vía `PageCheckCtx`, así que el motor recibe el `CheerioAPI`, no el string [VERIFIED: npm registry `npm view cheerio version` → 1.2.0; `packages/fingerprint/package.json`] |
| `vitest` | ^4.1.9 (instalada; última publicada 4.1.10) | Test runner del paquete nuevo | Todos los paquetes usan `"test": "vitest run"` sin `vitest.config.ts` [VERIFIED: `packages/{fingerprint,cms-adapters,checks}/package.json`] |
| `typescript` | ^5.7.2 | — | Idéntico en los 3 paquetes de referencia [VERIFIED] |
| `@types/node` | ^22.10.0 | `Buffer` para SOCIAL-08 | `tsconfig.json` de los paquetes puros declara `"types": ["node"]` [VERIFIED: `packages/fingerprint/tsconfig.json`] |

**Dependencias externas nuevas: cero.** Esta fase no instala nada del registro público.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@auditor/crawler` → `normalizeUrl` | workspace | Resolver `og:image`/`og:url` contra la URL de la página y comparar con canonical | Sólo dentro de `packages/checks/src/checks/social/` — nunca dentro de `packages/meta-social` [VERIFIED: `packages/crawler/src/normalizeUrl.ts:40`] |
| `pageFingerprint` (`packages/checks/src/util.ts`) | interno | Construcción del fingerprint `checkId:url` | Todos los checks nuevos. Firma: `pageFingerprint(checkId: string, url: string) => \`${checkId}:${url}\`` [VERIFIED: `packages/checks/src/util.ts:19-21`] |
| `makePage` (`packages/checks/src/testUtils.ts`) | interno | Fixture de `Page` para tests de checks | Ya soporta `html`; no hace falta ampliarlo [VERIFIED: `packages/checks/src/testUtils.ts:4-22`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Paquete nuevo `packages/meta-social` | Módulo dentro de `packages/checks/src/checks/social/extract.ts` | Menos plomería (1 archivo vs. package.json+tsconfig+index). Pero Phase 32 necesita el motor desde `report-model`/`apps/web`, y importarlo desde `@auditor/checks` arrastra `@auditor/crawler`+`@auditor/db` al grafo de Vercel. Decisión ya lockeada en CONTEXT.md y coherente con `fingerprint`/`cms-adapters` — **no reabrir** |
| `Map<string, string[]>` como estructura de salida | `Record<string, string[]>` literal | El objeto literal con claves controladas por el sitio auditado es superficie de prototype pollution (`__proto__`, `constructor`). Si se usa objeto, debe ser `Object.create(null)` — es el mismo mitigante que `curateHeaders` ya aplica en v1.5. `Map` es más simple y no tiene el problema [VERIFIED: `packages/crawler/src/captureHeaders.ts:5-11`] |
| SOCIAL-08 como `PageCheck` | `SiteCheck` sobre el home, o issue agregado tipo DEPTH-03 | La investigación de milestone recomienda site-level para charset (Pitfall 4: "si el valor medido es idéntico en el 100% de las páginas de un sitio típico, es site-level"). Pero el ROADMAP dice literalmente "por página" y CONTEXT.md lo lockeó como page-check. Se respeta; ver § Common Pitfalls, Pitfall 4, para la consecuencia de conteo de filas |

**Installation:**

```bash
# Ninguna instalación desde el registro público.
# Sólo se declara la dependencia de workspace nueva y se re-linkea:
pnpm install
```

**Version verification:** ejecutado el 2026-08-01 contra el registro npm — `cheerio@1.2.0` (coincide con la instalada), `vitest@4.1.10` (instalada `^4.1.9`, dentro del rango).

## Package Legitimacy Audit

Esta fase **no instala ningún paquete externo nuevo**. Las dos únicas dependencias que declara `packages/meta-social` ya están resueltas en el lockfile del monorepo y verificadas en el registro:

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `cheerio` | npm | >14 años | ~10M/semana | github.com/cheeriojs/cheerio | OK | Aprobada — ya instalada en 3 paquetes del repo |
| `vitest` (dev) | npm | >4 años | ~10M/semana | github.com/vitest-dev/vitest | OK | Aprobada — ya instalada en todos los paquetes |
| `typescript` (dev) | npm | >13 años | ~80M/semana | github.com/microsoft/TypeScript | OK | Aprobada — ya instalada |
| `@types/node` (dev) | npm | >10 años | ~130M/semana | github.com/DefinitelyTyped/DefinitelyTyped | OK | Aprobada — ya instalada |

**Packages removed due to [SLOP] verdict:** ninguno.
**Packages flagged as suspicious [SUS]:** ninguno.

*Nota: los conteos de descargas y antigüedad son de conocimiento general del ecosistema [ASSUMED], pero la existencia y versión actual de `cheerio` y `vitest` sí se verificaron esta sesión contra el registro (`npm view`). Ninguno de los cuatro es un paquete nuevo introducido por esta fase, así que el vector de slopsquatting no aplica.*

## Architecture Patterns

### System Architecture Diagram

```
                    apps/worker  ──► runAllChecks({ pages, origin, ... })
                                            │
                                            │ (1 sola vez por página)
                                            ▼
                                    cheerio.load(page.html)  ── ARCH-03: sin segundo parseo
                                            │
                            ┌───────────────┴───────────────┐
                            │                               │
                            ▼                               ▼
                  for (check of pageChecks)          computeSchemaGraph($)
                            │                        extractJsonLdBlocks($)
        ┌───────────────────┴──────────────────┐
        │  onpage(7) tech(6) schema(5)         │
        │  aeo(2)  perf(2)   ► social(8) NUEVO │
        └───────────────────┬──────────────────┘
                            │
              ctx = { page, $ }   ◄── page.html disponible acá (columna Text, no vacía)
                            │
        ┌───────────────────┴───────────────────────────────┐
        │  packages/checks/src/checks/social/*.ts           │
        │                                                   │
        │   socialXX.run(ctx)                               │
        │        │                                          │
        │        ├─► extractMetaSocial($)  ────────────────►│──► @auditor/meta-social
        │        │        devuelve MetaSocialData           │     (PURO: sólo cheerio.
        │        │        (Map<clave, string[]>)            │      ni db, ni crawler,
        │        │                                          │      ni checks)
        │        ├─► hasCharsetInFirstKB(page.html) ───────►│
        │        │                                          │
        │        ├─► normalizeUrl(raw, url)  ──────────────►│──► @auditor/crawler
        │        │        (SOLO SOCIAL-03/04)               │
        │        │                                          │
        │        └─► pageFingerprint(`SOCIAL-0N:subtipo`, url)
        │                    │                              │
        └────────────────────┼──────────────────────────────┘
                             ▼
                      IssueDraft[]  { checkId: "SOCIAL-0N",
                                      category: "social",
                                      severity, fingerprint, pageId }
                             │
                             ▼
                   diffIssues(actual, anterior)  ── por fingerprint
                             │
                             ▼
                   prisma.issue.createMany
                             │
                             ▼
                   scoreCategory(social) ──► scoreOverall (peso 0.10, ya existe)
                             │
                             ▼
                   buildReportModel ──► issuesByCategory.social (ya listo, Phase 29)
```

### Recommended Project Structure

```
packages/meta-social/                 # NUEVO — motor puro
├── package.json                      # espejo exacto de packages/fingerprint
├── tsconfig.json                     # espejo exacto de packages/fingerprint
└── src/
    ├── types.ts                      # MetaSocialData, OgTag, TwitterTag
    ├── extract.ts                    # extractMetaSocial($): MetaSocialData
    ├── charset.ts                    # hasCharsetInFirstKB(html): boolean
    ├── thresholds.ts                 # OG_TITLE_MIN/MAX, OG_DESC_MIN/MAX, TWITTER_CARD_VALUES
    ├── extract.test.ts
    ├── charset.test.ts
    ├── __fixtures__/                 # HTML de Yoast, RankMath, Shopify, Webflow, Next Metadata
    └── index.ts                      # barrel de tipos + funciones

packages/checks/src/checks/social/    # NUEVO — los 8 checks
├── index.ts                          # socialPageChecks
├── ogTitle.ts                        # SOCIAL-01
├── ogDescription.ts                  # SOCIAL-02
├── ogImage.ts                        # SOCIAL-03
├── ogUrl.ts                          # SOCIAL-04
├── ogType.ts                         # SOCIAL-05
├── ogDuplicates.ts                   # SOCIAL-06
├── twitterCard.ts                    # SOCIAL-07
├── charset.ts                        # SOCIAL-08
├── *.test.ts                         # uno por check
└── social-guardrail.test.ts          # Success Criterion #5 (SOCIAL-09)
```

### Pattern 1: Paquete puro de workspace (espejo de `packages/fingerprint`)

**What:** Paquete TS sin build, resuelto directo desde el fuente.
**When to use:** Siempre que se cree un motor puro nuevo en este repo.

```json
// packages/meta-social/package.json — Source: packages/fingerprint/package.json (verbatim, cambiando el nombre)
{
  "name": "@auditor/meta-social",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": { "cheerio": "^1.2.0" },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "typescript": "^5.7.2",
    "vitest": "^4.1.9"
  }
}
```

```json
// packages/meta-social/tsconfig.json — Source: packages/fingerprint/tsconfig.json (verbatim)
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "lib": ["ES2022"], "types": ["node"] },
  "include": ["src"]
}
```

Notas verificadas: **no hay script `build`** (turbo `typecheck` declara `dependsOn: ["^build"]` y eso se resuelve a no-op para estos paquetes), **no hay `vitest.config.ts`** en ninguno de los tres paquetes de referencia, y **no hay `paths` en `tsconfig.base.json`** — la resolución es puramente por `node_modules` de pnpm workspace. [VERIFIED: lectura directa de los 3 `package.json`, `turbo.json` y `tsconfig.base.json`]

### Pattern 2: Extractor unificado `property || name`

**What:** Un solo recorrido de `$("meta")` que normaliza y agrupa.
**When to use:** Es la única puerta de entrada a los meta tags para los 8 checks. Ningún check debe hacer su propio `$('meta[...]')`.

```ts
// packages/meta-social/src/extract.ts
// Source: derivado de .planning/research/PITFALLS.md Pitfall 5 (v1.6) + ogp.me + X Cards docs
import type { CheerioAPI } from "cheerio";

export interface MetaSocialData {
  /** Clave normalizada (minúsculas, trim) → todos los `content` no vacíos, en orden de documento. */
  tags: Map<string, string[]>;
}

export function extractMetaSocial($: CheerioAPI): MetaSocialData {
  // Map, no objeto literal: las claves las controla el sitio auditado
  // (mismo riesgo de prototype pollution que curateHeaders mitiga en v1.5).
  const tags = new Map<string, string[]>();

  $("meta").each((_i, el) => {
    const $el = $(el);
    // property gana sobre name (spec de OG), pero se acepta cualquiera de los
    // dos para ambos vocabularios: Yoast/RankMath emiten property="twitter:card"
    // y varios themes emiten name="og:title".
    const rawKey = $el.attr("property") ?? $el.attr("name");
    if (!rawKey) return;
    const key = rawKey.trim().toLowerCase();
    if (!key.startsWith("og:") && !key.startsWith("twitter:")) return;

    const content = $el.attr("content")?.trim();
    // Etiqueta presente pero con content vacío = fallo, no aprobado.
    if (!content) return;

    const bucket = tags.get(key);
    if (bucket) bucket.push(content);
    else tags.set(key, [content]);
  });

  return { tags };
}

/** Primer valor de una clave (og:image múltiple: la primera es la que usan las plataformas). */
export function firstValue(data: MetaSocialData, key: string): string | undefined {
  return data.tags.get(key)?.[0];
}
```

### Pattern 3: Subtipado en el fingerprint, nunca en el `checkId`

**What:** El `checkId` queda plano; el subtipo se compone dentro del fingerprint.
**When to use:** Todo check que pueda emitir más de un hallazgo distinto sobre la misma página.

```ts
// Source: packages/checks/src/checks/tech/canonicalDeep.ts:68 (verbatim)
const fp = (subtype: string) => pageFingerprint(`${CHECK_ID}:${subtype}`, url);

// Source: packages/checks/src/checks/onpage/headings.ts:50-61 (patrón `push` con subtipo)
issues.push({
  checkId: CHECK_ID,                                  // ← plano: "ONPAGE-08"
  category: "onpage",
  title,                                              // ← lo que distingue el grupo en el reporte
  severity: "warning",
  fingerprint: pageFingerprint(`${CHECK_ID}:${subtype}`, url),  // ← subtipado acá
  pageId: page.id,
});
```

### Anti-Patterns to Avoid

- **`checkId` con dos puntos (`"SOCIAL-01:og-title"`):** ningún check de producción lo hace. Rompe el lookup exact-match de `resolveCmsRecommendation(stack, issue.checkId, ...)` para siempre (CMSFIX-08 de v1.7 ya no podría mapear), y fragmenta `groupIssuesByType`, que agrupa por `checkId + title`. Ver § Discrepancias con CONTEXT.md.
- **`$("meta[property]")` a secas:** es literalmente lo que hacía ONPAGE-05 y es la causa raíz del Pitfall 5. Pierde `name="og:title"` y no ve `twitter:card` estándar.
- **Colapsar `og:image` múltiple con `Map.set` en loop (último gana):** el protocolo dice que la primera etiqueta gana en conflictos. Colapsar al último valida la imagen equivocada. [CITED: ogp.me — "The first tag (from top to bottom) is given preference during conflicts"]
- **Comparar `Set.has("og:title")` sin normalizar a minúsculas:** `<meta property="OG:Title">` existe en producción.
- **Reimplementar la normalización de URL dentro de `packages/meta-social`:** obligaría a duplicar `normalizeUrl` o a que el paquete puro dependa de `@auditor/crawler`, rompiendo la regla de aislamiento registrada en STATE.md.
- **Escribir un `PageCheck` que lea `page.html` y vuelva a hacer `cheerio.load`:** viola la regla explícita ARCH-03 (`crawl.ts:115`, "no HTML re-parse anywhere else"). SOCIAL-08 lee `page.html` como *string* para medir bytes — eso no es un re-parseo y es legítimo.
- **Marcar la ausencia de `twitter:image`/`twitter:title`/`twitter:description` como error cuando el `og:*` equivalente existe:** X hace fallback a OG. Es el falso positivo que REQUIREMENTS.md excluye explícitamente.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fingerprint de issue de página | Template string a mano `` `${id}:${url}` `` | `pageFingerprint(checkId, url)` de `packages/checks/src/util.ts` | El guardarraíl de Success Criterion #5 debe assertar sobre la función real, no sobre una copia. Si el formato cambia, el test tiene que romperse |
| Resolución de URL relativa → absoluta | `new URL(href, base)` inline | `normalizeUrl(href, base)` de `@auditor/crawler` | Además de resolver, rechaza esquemas no-http(s) (devuelve `null`), baja el host a minúsculas, quita el hash, quita puertos default, ordena y limpia query params de tracking, y normaliza el trailing slash. Un `new URL` crudo compararía `og:url` contra canonical con criterios distintos a los que usa `canonicalCheck` |
| Fixture de `Page` para tests | Objeto literal con `as Page` | `makePage({ url, html })` de `packages/checks/src/testUtils.ts` | Ya rellena los 15 campos que Prisma exige y hace el cast en un solo lugar |
| Medir bytes de un string JS | `html.slice(0, 1024)` | `Buffer.byteLength` / `Buffer.from(html, "utf8").subarray(0, 1024)` | `.slice()` cuenta unidades UTF-16, no bytes. `packages/fingerprint/src/detectStack.ts:37-41` ya tiene la función de truncado por bytes escrita — copiar ese patrón |
| Validar categoría del issue | Runtime check propio | Literal `"social"` + el guard defensivo que Phase 29 ya puso en `scoreOverall` | El guard filtra categorías desconocidas para que un typo no vuelva `NaN` el score general (fix W-01 de Phase 29). Pero filtra, no corrige: el literal igual tiene que estar bien escrito |
| Comparar `og:url` contra canonical | Comparación de strings crudos | `normalizeUrl(a) === normalizeUrl(b)` | Es exactamente lo que hace `canonicalCheck:66-69`; usar otro criterio produciría dos veredictos contradictorios sobre la misma página |

**Key insight:** todo lo "difícil" de esta fase (queue, fingerprint, diff, scoring, persistencia, agregación al reporte) ya está construido y probado. El único código genuinamente nuevo es la extracción y los umbrales. Cualquier plan que empiece a tocar `registry.ts` más allá de un import y un spread, o `apps/worker`, o `packages/scoring`, se salió del carril.

## Runtime State Inventory

No aplica: esta fase es puramente aditiva de código. No renombra, no refactoriza y no migra. Para constancia explícita, categoría por categoría:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Ninguno. No se agrega ni se altera ninguna columna (`Page.socialMeta` NO se crea en esta fase — ver § Open Questions #2). Las filas `Issue` nuevas se escriben por el camino existente | Ninguna |
| Live service config | Ninguno — verificado: la fase no toca `apps/worker`, ni Railway, ni Redis, ni la cola | Ninguna |
| OS-registered state | Ninguno — verificado: sin cambios en scripts de arranque ni en `railway.json` | Ninguna |
| Secrets/env vars | Ninguno — verificado: la fase no lee ninguna variable de entorno nueva | Ninguna |
| Build artifacts | Un paquete de workspace nuevo obliga a `pnpm install` para crear el symlink en `node_modules` y el `.turbo` del paquete. Sin eso, `@auditor/checks` no resuelve `@auditor/meta-social` | `pnpm install` en la raíz antes del primer `pnpm test` |

## Common Pitfalls

### Pitfall 1: Selector que pierde la mitad de las etiquetas (`property` vs `name`)

**What goes wrong:** El check reporta "falta og:title" en sitios que sí lo tienen (emitido como `name=`), o "falta twitter:card" en sitios donde el validador de X sí muestra la card (emitido como `property=`).
**Why it happens:** Se implementa contra la especificación en lugar de contra el HTML real. La especificación de OG usa `property`; la de X usa `name`. En producción, Yoast, RankMath y muchos themes de WordPress mezclan los dos. ONPAGE-05 hacía `$("meta[property]")` y arrastraba exactamente este defecto.
**How to avoid:** Un único extractor compartido que lea `property || name`, normalice a minúsculas y haga trim (§ Pattern 2). Fixtures obligatorios: Yoast, RankMath, Shopify default, Webflow, Next.js Metadata API, y un caso con `property` y `name` duplicados y contradictorios.
**Warning signs:** Discrepancia entre lo que dice el reporte y lo que devuelve un validador externo sobre la misma URL. Tasa de "falta twitter:card" cercana al 100% en sitios WordPress.
[CITED: `.planning/research/PITFALLS.md` Pitfall 5] [VERIFIED: código retirado `git show cdf9fb1^:packages/checks/src/checks/onpage/openGraph.ts` — línea `$("meta[property]")`]

### Pitfall 2: SOCIAL-06 agrupando por `meta[property]` crudo

**What goes wrong:** El caso más interesante de duplicado contradictorio — `<meta property="og:title" content="A">` junto a `<meta name="og:title" content="B">` — queda invisible, porque el selector `meta[property]` sólo ve uno de los dos. El check pasa en verde sobre una página que sí tiene ambigüedad real.
**Why it happens:** CONTEXT.md describe la implementación como "agrupar `meta[property]` por su valor de `property`". Es una descripción del criterio de negocio (misma clave, valores distintos), pero leída literalmente como selector reintroduce el Pitfall 1 dentro del check que justamente existe para detectar contradicciones.
**How to avoid:** SOCIAL-06 agrupa sobre `MetaSocialData.tags` (la salida normalizada del extractor), no sobre un `$('meta[property]')` propio. La regla de negocio de CONTEXT.md se mantiene intacta: issue sólo si `values.length > 1 && new Set(values).size > 1`.
**Warning signs:** El fixture "property y name duplicados y contradictorios" que la investigación de milestone exige no se puede escribir de forma que falle el check.

### Pitfall 3: SOCIAL-08 marca falta de charset en sitios que sí lo declaran

**What goes wrong:** Un sitio que envía `Content-Type: text/html; charset=utf-8` en el header HTTP y no pone `<meta charset>` está **correctamente configurado** según el HTML Standard y pasa la auditoría de Lighthouse. SOCIAL-08, que sólo mira el HTML, lo marca como problema.
**Why it happens:** El proyecto descarta el dato hoy. `content-type` **no está** en `CURATED_HEADER_KEYS` (`packages/crawler/src/captureHeaders.ts:18-55`), y `Page.contentType` guarda `contentType?.type` — el MIME sin el parámetro `charset`, porque Crawlee separa `{ type, encoding }` (`packages/crawler/src/crawl.ts:138,153`). El BOM tampoco es observable: `page.html` es un string ya decodificado.
**How to avoid:** Tres opciones para el planner, en orden de preferencia:
1. Mantener SOCIAL-08 como `warning` (nunca `critical`) y declarar la limitación textualmente en `criterion` — "se evalúa la declaración en el HTML; un `charset` enviado sólo por header HTTP no es visible para esta auditoría". Es el camino de menor cambio y coherente con el ROADMAP, que dice "advierte".
2. Agregar `content-type` a `CURATED_HEADER_KEYS` para que el check pueda suprimir el falso positivo. Costo: toca `packages/crawler`, que esta fase no debería tocar, y el test de invariante del allowlist (`captureHeaders.test.ts:33-34`) exige que el allowlist sea superset de lo que leen las signatures — agregar una key es seguro en esa dirección, pero amplía el alcance de la fase.
3. Dejarlo como está sin documentar. **No recomendado**: es el tipo de falso positivo que erosiona la credibilidad del lead magnet, exactamente lo que REQUIREMENTS.md se propuso evitar en SOCIAL-07.
**Warning signs:** El check dispara en sitios servidos por Cloudflare/Vercel con HTML minificado sin `<meta charset>`.
[VERIFIED: HTML Standard vía Lighthouse docs — "A `Content-Type` HTTP response header including a `charset` directive matching a valid IANA name" es forma válida de declaración] [VERIFIED: `packages/crawler/src/captureHeaders.ts`, `crawl.ts:138`]

### Pitfall 4: Volumen de filas `Issue` por auditoría

**What goes wrong:** El catálogo de page-checks pasa de 22 a 30 (+36%). Sobre una auditoría de 500 páginas eso son ~4.000 filas `Issue` nuevas, todas en `category: "social"`, insertadas en el mismo `prisma.issue.createMany` de un solo llamado.
**Why it happens:** Los 8 checks son page-level por decisión de scope, y el catálogo existente emite fila `ok` explícita por página (patrón de `title.ts`, `metaDescription.ts`, `canonical.ts`, `htmlSize.ts`).
**How to avoid:** No es un blocker — hoy ya se insertan ~11.000 filas por auditoría de 500 páginas y funciona. Pero el planner debe tomar una **decisión explícita por check** sobre si emite fila `ok`, porque afecta directamente el score de la categoría (§ Pitfall 5). Precedente mixto en el repo: `title`/`metaDescription`/`canonical`/`htmlSize` emiten `ok`; `headings`/`canonicalDeep` emiten **sólo** filas de problema.
**Warning signs:** Tiempo de `Issue.createMany` medible en el log del worker; el reporte tarda notoriamente más en cargar.
[VERIFIED: conteo de barrels — onpage 7 + tech 6 + schema 5 + aeo 2 + perf 2 = 22 page-checks actuales]

### Pitfall 5: Dilución del health-ratio de la categoría `social`

**What goes wrong:** `scoreCategory` es un promedio plano donde `ok`=1, `warning`=0.5, `critical`=0. Si los 8 checks emiten `ok`, un sitio sin ninguna etiqueta OG saca: SOCIAL-01..05 y 07 en fallo, SOCIAL-06 y 08 en `ok` → piso de 25 (si los fallos son `critical`) o 62 (si son `warning`). Un sitio perfecto saca 100. Ese spread es aceptable, **pero sólo si SOCIAL-06 y SOCIAL-08 no son los únicos que casi siempre pasan**. Si además se decidiera emitir `ok` en subtipos, el denominador se llena de aprobados triviales y la categoría deja de discriminar.
**Why it happens:** Nadie revisa la distribución esperada de resultados antes de fijar el catálogo.
**How to avoid:** Antes de cerrar la fase, correr los 8 checks contra 4-6 fixtures de perfiles distintos (WordPress+Yoast, Shopify, Webflow, Next.js Metadata API, sitio sin OG) y verificar que el score de `social` cae en la banda 60-80 para un sitio promedio, no en 95+. La investigación de milestone deja registrado ese objetivo explícito.
**Warning signs:** `social` es la categoría con el score más alto del reporte en todos los sitios de prueba. La desviación entre un sitio bien optimizado y uno sin ninguna etiqueta OG es menor a 20 puntos.
[CITED: `.planning/research/PITFALLS.md` Pitfall 3] [VERIFIED: `packages/scoring/src/categoryScore.ts:20-24,44-51`]

### Pitfall 6: `og:image` relativa dada por buena

**What goes wrong:** `og:image="/img/og.png"` produce preview roto en Facebook y LinkedIn, porque esos crawlers traen la página desde sus propios servidores y no resuelven rutas relativas como un navegador. Un check que sólo verifique presencia lo aprueba.
**Why it happens:** Es lo natural de implementar y no se nota en desarrollo local.
**How to avoid:** Comparar el valor **crudo** contra el **resuelto**: si `raw !== normalizeUrl(raw, pageUrl)`, es relativa. Rechazar también protocol-relative (`//host/x.png`, detectable por prefijo de string) y `http:` en un sitio `https`. La investigación de milestone califica esto como "probablemente el hallazgo de mayor valor de todo el milestone".
**Warning signs:** Cero issues de SOCIAL-03 sobre un sitio WordPress cualquiera.
[CITED: `.planning/research/PITFALLS.md` Pitfall 6]

### Pitfall 7: Los 1024 bytes medidos sobre un string re-encodeado

**What goes wrong:** La regla del estándar es sobre los bytes **tal como se sirvieron**. `page.html` es un string JS que Crawlee ya decodificó (`packages/crawler/src/crawl.ts:115`: `typeof body === "string" ? body : body?.toString("utf-8")`). Re-encodearlo con `Buffer.byteLength(html, "utf8")` reproduce los bytes originales **sólo si el documento se sirvió en UTF-8**. Un documento ISO-8859-1 con acentos antes del `<meta charset>` da un offset distinto.
**Why it happens:** El dato de encoding original no se persiste (`contentType.encoding` de Crawlee se descarta; sólo se guarda `.type`).
**How to avoid:** Aceptar la limitación y documentarla en el docblock del módulo. En la práctica el sesgo es conservador (UTF-8 nunca produce menos bytes que Latin-1 para el mismo texto), así que el check puede reportar un falso positivo pero no un falso negativo — y de todas formas un documento no-UTF-8 sin `<meta charset>` temprano tiene un problema real.
**Warning signs:** Sitios legacy en español con acentos en el `<title>` antes del charset.

## Code Examples

### Check de presencia + longitud (referencia directa para SOCIAL-01 / SOCIAL-02)

```ts
// Source: packages/checks/src/checks/onpage/metaDescription.ts (verificado en el repo)
import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "ONPAGE-02";
const MIN_LENGTH = 70;
const MAX_LENGTH = 160;

export const metaDescriptionCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const content = $('meta[name="description"]').first().attr("content")?.trim() ?? "";
    const url = page.finalUrl ?? page.url;

    if (!content) {
      return [{
        checkId: CHECK_ID,
        category: "onpage",
        title: "Falta la meta description",
        severity: "warning",
        measuredValue: "sin meta description",
        source: url,
        criterion: "Toda página indexable debería tener meta description (70-160 caracteres)",
        recommendation: "Agrega una meta description de entre 70 y 160 caracteres…",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      }];
    }
    // … rama de longitud fuera de rango (warning) y rama final "ok" (severity: "ok",
    //   recommendation: "Sin acción necesaria.")
  },
};
```

Para SOCIAL-01/02 los umbrales cambian (10–60 y 55–200, distintos a propósito de ONPAGE-01/02) y el `$(...)` se reemplaza por `firstValue(data, "og:title")`.

### Lectura de canonical con fallback (referencia directa para SOCIAL-04)

```ts
// Source: packages/checks/src/checks/tech/canonical.ts:48-69 (verificado en el repo)
import { normalizeUrl } from "@auditor/crawler";

const url = page.finalUrl ?? page.url;
const href = $('link[rel="canonical"]').first().attr("href")?.trim();

const canonicalUrl = normalizeUrl(href, url) ?? href;   // resuelve relativa contra la página
const selfUrl = normalizeUrl(url) ?? url;

if (canonicalUrl !== selfUrl) { /* … */ }
```

Para SOCIAL-04 la comparación es `normalizeUrl(ogUrlRaw, url)` contra `normalizeUrl(canonicalHref ?? url, url)`. Ojo: `normalizeUrl` devuelve `null` para esquemas no-http(s), así que un `og:url="javascript:…"` cae en la rama de valor inválido, no en la de coherencia.

### Detección de valor relativo (referencia directa para SOCIAL-03)

```ts
// Patrón derivado de normalizeUrl (packages/crawler/src/normalizeUrl.ts:40-79)
const raw = firstValue(data, "og:image");                    // primera og:image, no la última
const resolved = raw ? normalizeUrl(raw, url) : null;

const isProtocolRelative = raw?.startsWith("//") ?? false;
const isRelative = raw != null && resolved != null && !raw.startsWith("http");
const isInsecure = resolved?.startsWith("http://") ?? false;
```

### Medición por bytes (referencia directa para SOCIAL-08)

```ts
// Source: patrón de packages/fingerprint/src/detectStack.ts:37-41 (truncado por bytes UTF-8)
const CHARSET_WINDOW_BYTES = 1024;

export function hasCharsetInFirstKB(html: string): boolean {
  const head = Buffer.from(html, "utf8").subarray(0, CHARSET_WINDOW_BYTES).toString("utf8");
  // <meta charset="…">  |  <meta http-equiv="Content-Type" content="text/html; charset=…">
  return /<meta[^>]+charset\s*=/i.test(head);
}
```

Nota: el regex debe estar acotado a la ventana ya recortada (nunca sobre `html` completo) y usar `[^>]` en lugar de `.*` para evitar backtracking catastrófico sobre HTML minificado sin saltos de línea.

### Guardarraíl de fingerprint contra un catálogo borrado del árbol (Success Criterion #5)

```ts
// Patrón: packages/checks/src/checks/perf/checkIdCollision.test.ts:101-106
// ONPAGE-05 fue borrado con `git rm` en Phase 29, así que NO se puede importar.
// Se reconstruye su fingerprint con el MISMO formato byte a byte, usando la
// función REAL (pageFingerprint), no una copia literal del template string.
const RETIRED_FINGERPRINT = pageFingerprint("ONPAGE-05", TEST_URL);

// Página con las 4 etiquetas OG básicas — el caso exacto donde ONPAGE-05
// emitía una fila `ok`. Es la fixture que el Success Criterion #5 nombra.
const html =
  '<html><head>' +
  '<meta property="og:title" content="Título de ejemplo suficientemente largo" />' +
  '<meta property="og:description" content="Descripción…" />' +
  '<meta property="og:image" content="https://example.com/og.png" />' +
  `<meta property="og:url" content="${TEST_URL}" />` +
  '</head><body><h1>Hola</h1></body></html>';

const page = makePage({ url: TEST_URL, html });
const $ = cheerio.load(html);
const socialFingerprints = socialPageChecks.flatMap((c) => c.run({ page, $ })).map((i) => i.fingerprint);

// (a) ninguno colisiona con el fingerprint del check retirado
expect(socialFingerprints).not.toContain(RETIRED_FINGERPRINT);
// (b) los 8 checks no colisionan entre sí sobre la misma página
expect(new Set(socialFingerprints).size).toBe(socialFingerprints.length);
// (c) no-colapso real vía diffIssues (patrón de phase11-guardrail.test.ts:52-57)
const diff = diffIssues([...drafts, retiredDraftSintetico], []);
expect(diff.statusByFingerprint.size).toBe(drafts.length + 1);
// (d) autoprueba de capacidad de detección: inyectar un fingerprint duplicado
//     sintético y exigir que la aserción de unicidad lo detecte
//     (patrón de checkIdCollision.test.ts:109-120 — datos sintéticos, nunca
//     mutando código de producción; decisión ya registrada en STATE.md/Phase 28)
```

## Discrepancias con CONTEXT.md

Tres puntos donde la asunción de CONTEXT.md no coincide con el código o con investigación ya aceptada. El planner debe resolverlos antes de escribir tareas.

### D-1 — `checkId` con subtipo (ALTO impacto)

**CONTEXT.md dice:** *"El test de Phase 29 (`packages/report-model/src/build.test.ts:221`) ya usa el formato `SOCIAL-01:og-title` — mantener consistencia con eso."*

**El código dice:** en `build.test.ts:221` esa cadena está en el campo **`checkId`** de un `Issue` sintético de prueba, no en un fingerprint. En producción **ningún** check pone dos puntos en `checkId`: `headings.ts:50-59` y `canonicalDeep.ts:68` mantienen `checkId: CHECK_ID` plano y componen el subtipo **sólo** dentro de `pageFingerprint(\`${CHECK_ID}:${subtype}\`, url)`. El único `checkId` con guion extra del catálogo es `"SD-04-legacy"`, y tampoco lleva dos puntos.

**Consecuencias de seguir la lectura literal:**
- `resolveCmsRecommendation(stack, issue.checkId, ...)` hace lookup **exact-match** contra el catálogo de `packages/cms-adapters` (`webflow.ts:38`: `catalog[checkId] ?? null`). Un `checkId` con subtipo nunca podría mapearse, y CMSFIX-08 (v1.7) quedaría bloqueado sin darse cuenta.
- `groupIssuesByType` agrupa por `\`${checkId}\x00${title}\`` (`packages/report-model/src/grouping.ts:36`). Meter el subtipo en `checkId` fragmenta los grupos dos veces (una por checkId, otra por title) sin ganancia.
- `PageCheck.checkId` es un campo único por objeto y `registry.test.ts:65-68` verifica que no haya duplicados. Con "un archivo = un check", un solo valor plano por archivo es lo natural.

**Recomendación:** `checkId: "SOCIAL-01"` … `"SOCIAL-08"` planos; subtipo sólo en el fingerprint. Interpretar el `"SOCIAL-01:og-title"` de `build.test.ts` como lo que es — un valor sintético de fixture, no un contrato. Requiere confirmación de Juan (contradice la letra de una decisión lockeada).

### D-2 — SOCIAL-06 agrupando por `meta[property]` (MEDIO impacto)

**CONTEXT.md dice:** *"agrupar `meta[property]` por su valor de `property`"*.

**Tensión:** leído como selector, reintroduce el Pitfall 5 de la investigación de milestone dentro del check que existe para detectar contradicciones. El fixture que la investigación exige ("un caso con `property` y `name` duplicados y contradictorios") sería inescribible.

**Recomendación:** conservar intacta la regla de negocio de CONTEXT.md (`>1 tag Y contents distintos`) pero aplicarla sobre `MetaSocialData.tags` (clave normalizada `property || name`), no sobre un `$('meta[property]')` propio.

### D-3 — SOCIAL-08 y el charset por header HTTP (MEDIO impacto)

**CONTEXT.md dice:** buscar `<meta charset` o `<meta http-equiv="Content-Type" … charset=` en los primeros 1024 bytes.

**El estándar dice:** también es declaración válida un header `Content-Type: text/html; charset=utf-8` o un BOM. Lighthouse acepta las tres.

**El código dice:** ninguna de las otras dos formas es observable hoy. `content-type` no está en `CURATED_HEADER_KEYS`; `Page.contentType` guarda el MIME sin el parámetro `charset`; y `page.html` es un string ya decodificado, sin BOM.

**Recomendación:** opción 1 del Pitfall 3 — severidad `warning` y limitación explícita en el `criterion`. No ampliar el alcance a `packages/crawler` en esta fase.

### Confirmaciones (asunciones de CONTEXT.md que SÍ se sostienen)

| Asunción de CONTEXT.md | Estado |
|---|---|
| `page.html` disponible dentro de un `PageCheck` | ✓ VERIFIED — `PageCheckCtx.page: Page`; `Page.html String? @db.Text`; `runAllChecks` filtra `if (!page.html) continue` antes de llamar cualquier check |
| Fingerprint subtipado "mismo patrón que `TECH-04:cross-domain`" | ✓ VERIFIED — `canonicalDeep.ts:68`, `headings.ts:59` |
| Los `PageCheck` no comparten estado; `PageCheckCtx` sólo da `page`+`$` | ✓ VERIFIED — `types.ts:40-43` |
| SOCIAL-04 puede releer canonical del `$` con fallback `page.finalUrl ?? page.url` | ✓ VERIFIED — es exactamente `canonical.ts:11-12,48` |
| No existe ningún `checkId` `SOCIAL-*` en el catálogo actual | ✓ VERIFIED — grep sobre `packages/**/src` |
| `packages/fingerprint`/`cms-adapters` como plantilla de paquete puro | ✓ VERIFIED — ambos `package.json`/`tsconfig.json` leídos; son idénticos entre sí salvo nombre y deps |
| `registry.ts` es el único punto de integración con el catálogo global | ✓ VERIFIED — un import + un spread en el array `pageChecks` (líneas 4-24). Además hace falta el re-export en `packages/checks/src/index.ts:12-17` para seguir el patrón de los otros 6 barrels |
| El pipeline de agregación ya recibe `category: "social"` sin cambios | ✓ VERIFIED — `overallScore.ts:12,37` (union + peso 0.10), `build.test.ts:217-236` (e2e hasta `issuesByCategory.social`) |
| `packages/checks` puede depender de `@auditor/meta-social` sin romper la frontera de Vercel | ✓ VERIFIED — `scripts/assert-no-playwright-in-web.mjs` sólo guarda `playwright`/`puppeteer`/`chromium`. Precedente: `@auditor/cms-adapters` y `@auditor/fingerprint` son paquetes raw-TS que `apps/web` alcanza transitivamente vía `@auditor/report-model` y **no** están en `transpilePackages` de `next.config.ts` — no hace falta tocarlo |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ONPAGE-05` — presencia de 4 tags OG, 1 fila por página, `category: "onpage"` | `SOCIAL-01..08` — 8 checks granulares con longitud, formato de URL, duplicados y Twitter Card, `category: "social"` con peso propio 0.10 | v1.6 Phase 29 (retiro) + Phase 30 (reemplazo) | Corte de versión: scores pre/post v1.6 no comparables. Documentado en `PROJECT.md:156` |
| Twitter Card Validator de X como referencia externa | Retirado por X; no hay API pública de validación | 2022-2023 | Sin oráculo externo automatizable. La verificación es contra fixtures y contra el spec, no contra un validador [CITED: REQUIREMENTS.md Out of Scope] |
| Charset dentro de los primeros **512** bytes (HTML5 temprano) | Primeros **1024** bytes | Cambio de spec ~2008-2009 | El límite correcto es 1024, tal como dice el ROADMAP |

**Deprecated/outdated:**
- `twitter:card` con valores `photo` / `gallery` / `product`: valores legacy retirados. Los válidos hoy son exactamente `summary`, `summary_large_image`, `app`, `player`. [ASSUMED — el retiro de los legacy es conocimiento de ecosistema; los 4 válidos sí están verificados]
- `$("meta[property]")` como forma de leer meta tags sociales: superado por el extractor unificado `property || name`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Los valores legacy de `twitter:card` (`photo`, `gallery`, `product`) están retirados y deben tratarse como inválidos | State of the Art / SOCIAL-07 | Un sitio antiguo con `twitter:card="photo"` se marca inválido cuando X podría seguir tolerándolo. Impacto bajo: es un falso positivo raro y la recomendación (migrar a `summary_large_image`) es correcta igual |
| A2 | Los conteos de descargas y antigüedad de la tabla de legitimidad de paquetes | Package Legitimacy Audit | Nulo — ninguno es un paquete nuevo; su existencia y versión sí se verificaron |
| A3 | La banda objetivo 60-80 para el score de la categoría `social` en un sitio promedio | Pitfall 5 | Si la banda real es otra, el catálogo queda mal calibrado. Mitigación: medir contra fixtures reales antes de cerrar la fase, no adivinar |
| A4 | Que el falso positivo de charset-por-header (Pitfall 3) es poco frecuente en el universo objetivo (WordPress/Shopify/Webflow, que sí emiten `<meta charset>`) | Pitfall 3 | Si es frecuente, SOCIAL-08 se vuelve ruido. Mitigación: la opción 1 (warning + criterio explícito) acota el daño sin ampliar el alcance |
| A5 | Que el sesgo de re-encoding UTF-8 (Pitfall 7) es conservador (sólo falsos positivos, nunca falsos negativos) | Pitfall 7 | Bajo: un documento con más bytes reales que los medidos requeriría un encoding más ancho que UTF-8 para el mismo texto, lo cual es marginal (UTF-16 servido como HTML es prácticamente inexistente) |

## Open Questions

1. **¿Los 8 checks emiten fila `ok` explícita?**
   - Lo que sabemos: el precedente del repo es mixto — `title`/`metaDescription`/`canonical`/`htmlSize` emiten `ok`; `headings`/`canonicalDeep` no. La decisión afecta directamente el score de la categoría y el conteo de filas.
   - Lo que no está claro: CONTEXT.md no lo decide.
   - Recomendación: emitir `ok` en los 8 (coherente con el health-ratio y con la mayoría del catálogo), y validar la banda de score contra fixtures reales antes de cerrar la fase (Pitfall 5). Si algún check resulta pasar >95% en todos los perfiles, convertirlo a "sólo filas de problema".

2. **¿`Page.socialMeta` se persiste en esta fase o en Phase 32?**
   - Lo que sabemos: STATE.md menciona `Page.socialMeta` como columna de v1.6, y la investigación de arquitectura propone devolverla desde `runAllChecks` junto a `pageSchemaGraphs`/`pageSchemaEntities` para que Phase 32 no re-parsee 500 páginas. La columna **no existe** hoy en `schema.prisma`.
   - Lo que no está claro: CONTEXT.md de Phase 30 no la menciona, y el ROADMAP de Phase 30 tampoco.
   - Recomendación: **no** persistirla en esta fase (mantener el alcance mínimo y evitar un `pnpm db:push` innecesario), pero diseñar `MetaSocialData` desde ahora como un objeto serializable a JSON plano, para que Phase 32 sólo tenga que agregar la columna y el `page.update` sin refactorizar el tipo. Confirmar con Juan.

3. **Severidad de cada uno de los 8 checks.**
   - Lo que sabemos: la investigación de milestone recomienda `critical` sólo para hechos verificables y estables (tag ausente, `content` vacío, `og:image` relativa, `og:image` 404). El resto, `warning`.
   - Lo que no está claro: CONTEXT.md no asigna severidades.
   - Recomendación: `critical` para ausencia de `og:title`/`og:image` y para `og:image` relativa/insegura; `warning` para todo lo demás (longitudes, `og:type`, duplicados, twitter:card, charset). Es discreción de Claude según CONTEXT.md, pero conviene registrarla como decisión en el plan.

4. **¿SOCIAL-06 cubre también duplicados de `twitter:*`?**
   - Lo que sabemos: el requirement dice literalmente "tags OG duplicados (mismo property, valores distintos)".
   - Recomendación: limitar a `og:*`, tal como dice el requirement. `twitter:*` duplicado queda fuera de alcance de v1.6.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | Todo | ✓ | >=20 (declarado en `engines`) | — |
| pnpm | Workspace linking del paquete nuevo | ✓ | 10.0.0 (`packageManager`) | — |
| turbo | `pnpm test` / `pnpm typecheck` en la raíz | ✓ | ^2.3.0 | `pnpm --filter <pkg> test` directo |
| vitest | Tests del paquete nuevo y de los checks | ✓ | 4.1.9 instalada | — |
| cheerio | Extractor | ✓ | 1.2.0 instalada | — |
| PostgreSQL | **No requerido** en esta fase | n/a | — | Sin cambios de schema; sin `pnpm db:push` |
| Red / APIs externas | **No requerido** en esta fase | n/a | — | Los 8 checks son puramente locales sobre HTML ya crawleado. La validación de red de `og:image` es Phase 31 |

**Missing dependencies with no fallback:** ninguna.
**Missing dependencies with fallback:** ninguna.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.9 |
| Config file | ninguno — los paquetes corren `vitest run` con defaults (verificado en `fingerprint`, `cms-adapters`, `checks`) |
| Quick run command | `pnpm --filter @auditor/checks test` y `pnpm --filter @auditor/meta-social test` |
| Full suite command | `pnpm test` (turbo, todos los paquetes) |

**Baseline medida el 2026-08-01:** `pnpm --filter @auditor/checks test` → **28 archivos, 152 tests, todos en verde, 2.12 s**. Cualquier plan de esta fase debe dejar ese número igual o mayor y siempre en verde.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| — | Extractor lee `property` y `name`, normaliza, agrupa en arrays | unit | `pnpm --filter @auditor/meta-social test` | ❌ Wave 0 |
| SOCIAL-01 | og:title ausente / 10-60 / fuera de rango | unit | `pnpm --filter @auditor/checks test` | ❌ Wave 0 |
| SOCIAL-02 | og:description ausente / 55-200 / fuera de rango | unit | idem | ❌ Wave 0 |
| SOCIAL-03 | og:image ausente / relativa / protocol-relative / http en sitio https / absoluta OK | unit | idem | ❌ Wave 0 |
| SOCIAL-04 | og:url ausente / difiere de canonical / coherente | unit | idem | ❌ Wave 0 |
| SOCIAL-05 | og:type ausente / presente | unit | idem | ❌ Wave 0 |
| SOCIAL-06 | duplicado con mismo valor (no issue) / con valores distintos (issue) / cruce `property`+`name` | unit | idem | ❌ Wave 0 |
| SOCIAL-07 | twitter:card ausente / inválido / válido; `twitter:image` ausente con `og:image` presente NO es issue; ausente sin og sí lo es | unit | idem | ❌ Wave 0 |
| SOCIAL-08 | charset en byte 100 (ok) / después del byte 1024 (issue) / ausente (issue) / multibyte antes de la declaración | unit | `pnpm --filter @auditor/meta-social test` + `@auditor/checks` | ❌ Wave 0 |
| SC#5 | cero colisión de fingerprint con `ONPAGE-05` sobre página con las 4 OG básicas, con autoprueba de detección | integration | `pnpm --filter @auditor/checks test` | ❌ Wave 0 |
| — | Registry: los 8 `SOCIAL-*` presentes en `pageChecks`, sin duplicados, `ONPAGE-05` sigue ausente | integration | idem (extender `registry.test.ts`) | ✅ existe, ampliar |
| — | Sin colisión de checkId contra el catálogo de `@auditor/psi` | integration | idem (`checkIdCollision.test.ts` ya cubre todo `pageChecks`) | ✅ pasa automáticamente al registrar |

### Sampling Rate

- **Per task commit:** `pnpm --filter @auditor/meta-social test && pnpm --filter @auditor/checks test`
- **Per wave merge:** `pnpm typecheck && pnpm test`
- **Phase gate:** `pnpm test` completo en verde antes de `/gsd-verify-work`, más `pnpm assert:web-boundary` (barato y prueba que el paquete nuevo no ensució el grafo de Vercel)

### Wave 0 Gaps

- [ ] `packages/meta-social/package.json` + `tsconfig.json` + `src/index.ts` — scaffolding del paquete (sin él no hay dónde poner tests)
- [ ] `pnpm install` en la raíz para linkear `@auditor/meta-social` en `node_modules` de `@auditor/checks`
- [ ] `packages/meta-social/src/__fixtures__/` — HTML de Yoast, RankMath, Shopify, Webflow, Next.js Metadata API y el caso `property`/`name` contradictorio (bloquean los tests de SOCIAL-06 y SOCIAL-07)
- [ ] `packages/checks/src/checks/social/index.ts` — barrel vacío inicial (`socialPageChecks: PageCheck[] = []`) para que `registry.ts` compile antes de que existan los 8 checks

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Sin superficie: código de análisis offline sobre HTML ya persistido |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | **sí** | Todo el contenido de los meta tags lo controla el sitio auditado. Claves de tag → `Map` (nunca objeto literal). Valores de URL → `normalizeUrl`, que rechaza esquemas no-http(s) devolviendo `null`. Regex de charset → acotada a la ventana de 1024 bytes ya recortada y con clases negadas (`[^>]`), nunca `.*` |
| V6 Cryptography | no | Sin criptografía en esta fase |

### Known Threat Patterns for `packages/meta-social` + `packages/checks`

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prototype pollution vía clave de meta tag (`<meta property="__proto__">`) | Tampering | `Map<string, string[]>`, no objeto literal. Si se usara objeto: `Object.create(null)`, mismo mitigante que `curateHeaders` (v1.5, T-25-02/03) |
| ReDoS en el regex de charset sobre HTML minificado sin saltos de línea | DoS | Aplicar el regex **después** de recortar a 1024 bytes; usar `[^>]+` en lugar de `.*`; sin cuantificadores anidados |
| Esquema peligroso en `og:url`/`og:image` (`javascript:`, `data:`, `file:`) persistido y renderizado luego como `href`/`src` | XSS (diferido a Phase 32) | `normalizeUrl` ya devuelve `null` para todo lo que no sea `http:`/`https:` (`normalizeUrl.ts:48-50`). El valor persistido en `measuredValue` es texto, no atributo — pero Phase 32 debe re-validar antes de renderizarlo |
| HTML gigante causando presión de memoria al hacer `Buffer.from(html, "utf8")` | DoS | El crawl ya acota indirectamente por el límite de tamaño de string de Node; `packages/fingerprint` además trunca a 256 KB antes de parsear. Para SOCIAL-08 basta recortar sin materializar el buffer completo si el HTML es grande — o aceptar el costo, que es el mismo que `htmlBytes` de Phase 28 ya paga |

## Project Constraints (from CLAUDE.md)

| Directive | Cómo aplica a esta fase |
|-----------|--------------------------|
| Frontend Next.js en Vercel; el crawl y el trabajo pesado en el worker | ✓ Se respeta: los 8 checks corren dentro de `runAllChecks`, que sólo ejecuta el worker. Nada nuevo llega a Vercel |
| `packages/fingerprint` y `packages/cms-adapters` desacoplados de `@auditor/db`/`@auditor/crawler`/`@auditor/checks`; el nuevo `packages/meta-social` sigue el mismo patrón, sin dependencias de runtime salvo Cheerio | ✓ Restricción dura. `normalizeUrl` (de `@auditor/crawler`) **no** puede entrar a `meta-social`; se usa desde `packages/checks` |
| `buildReportModel` es la única fuente de verdad para reporte web + los 3 exports | ✓ Sin cambios en esta fase: los issues llegan por el camino existente |
| `packages/db` es schema-first (`pnpm db:push`); correr `db:push` cuando se escribe una columna nueva | ✓ No aplica: esta fase no agrega columnas (ver Open Question #2) |
| Nunca poner Playwright/Chromium en el grafo de `apps/web` | ✓ El paquete nuevo sólo depende de `cheerio`. Verificar con `pnpm assert:web-boundary` |
| Flujo GSD: discuss → planner → plan-checker → executor → code-review + verify → fix → commit | ✓ Esta fase está en la etapa de research previa al planner |
| Español neutro, sin voceo, imperativo impersonal en toda la copy de usuario | ✓ Aplica a los 8 `title`/`criterion`/`recommendation`. Referencias de tono: `title.ts`, `contentLength.ts`, `htmlSize.ts` |

## Sources

### Primary (HIGH confidence)

- Código del repo, leído directamente esta sesión: `packages/checks/src/types.ts`, `util.ts`, `registry.ts`, `registry.test.ts`, `testUtils.ts`, `validate.ts`, `checks/onpage/{title,metaDescription,headings}.ts`, `checks/tech/{canonical,index}.ts`, `checks/perf/{htmlSize,checkIdCollision.test,index}.ts`, `checks/schema/{schemaValidate,index}.ts`, `checks/aeo/index.ts`, `checks/phase11-guardrail.test.ts`
- `packages/scoring/src/{overallScore,categoryScore}.ts`, `packages/report-model/src/{grouping,build.test}.ts`, `packages/crawler/src/{crawl,normalizeUrl,captureHeaders,pageMetrics}.ts`, `packages/fingerprint/src/{index,detectStack}.ts`, `packages/cms-adapters/src/{types,webflow,resolveCmsRecommendation}.ts`, `apps/worker/src/index.ts:455-545`, `packages/db/prisma/schema.prisma`
- `git show cdf9fb1^:packages/checks/src/checks/onpage/openGraph.ts` — fuente completo del ONPAGE-05 retirado
- Configuración: `package.json` (raíz), `turbo.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `apps/web/package.json`, `apps/web/next.config.ts`, `scripts/assert-no-playwright-in-web.mjs`
- Ejecución de suite: `pnpm --filter @auditor/checks test` → 28 archivos / 152 tests en verde (2026-08-01)
- Registro npm (`npm view`, 2026-08-01): `cheerio@1.2.0`, `vitest@4.1.10`
- [The Open Graph protocol](https://ogp.me/) — 4 propiedades requeridas (`og:title`, `og:type`, `og:image`, `og:url`), atributo `property`, y regla de precedencia de la primera etiqueta en conflictos
- [Lighthouse — Charset declaration is missing or occurs too late in the HTML](https://developer.chrome.com/docs/lighthouse/best-practices/charset) — límite de 1024 bytes y las tres formas válidas de declaración (meta, header `Content-Type`, BOM)
- `.planning/research/{ARCHITECTURE,PITFALLS,SUMMARY,STACK,FEATURES}.md` — investigación de milestone v1.6 ya aceptada
- `.planning/phases/29-*/29-VERIFICATION.md` — W-06 (deferral explícito del guardarraíl a Phase 30)

### Secondary (MEDIUM confidence)

- [HTML Standard — Edition for Web Developers](https://html.spec.whatwg.org/dev/semantics.html) — regla de los 1024 bytes (confirmada de forma independiente por la doc de Lighthouse arriba)
- [Rocket Validator — A "charset" attribute on a "meta" element found after the first 1024 bytes](https://rocketvalidator.com/html-validation/a-charset-attribute-on-a-meta-element-found-after-the-first-1024-bytes) — corroboración del límite exacto
- [W3C — Declaring character encodings in HTML](https://www.w3.org/International/articles/spec-summaries/encoding)
- [Summary Card with Large Image — X/Twitter Developer Platform](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/summary-card-with-large-image) — tipos de card
- [Getting started with Cards — X/Twitter Developer Platform](https://developer.twitter.com/en/docs/twitter-for-websites/cards/guides/getting-started) — fallback a Open Graph cuando falta el `twitter:*` equivalente

### Tertiary (LOW confidence)

- [OGPreview — Twitter Card Requirements & Best Practices](https://ogpreview.io/guide/twitter) y [thatdevpro — Twitter Card Meta Tags](https://www.thatdevpro.com/reference/html-twitter-cards/) — usados sólo para corroborar los 4 valores válidos de `twitter:card`, ya confirmados por la doc oficial. El retiro de los valores legacy (`photo`/`gallery`/`product`) queda como [ASSUMED]

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — cero dependencias externas nuevas; el scaffolding se copia verbatim de dos paquetes existentes leídos en esta sesión
- Architecture: **HIGH** — todos los contratos (`PageCheckCtx`, `IssueDraft`, `pageFingerprint`, barrel + registry, `Page.html`) verificados leyendo el código, no asumidos
- Pitfalls: **HIGH** — los 3 pitfalls críticos (selector `property`/`name`, charset por header, `og:image` relativa) están corroborados contra fuente oficial y contra el código real del check retirado
- Discrepancias con CONTEXT.md: **HIGH** — las 3 se sostienen sobre lectura directa de archivos citados con número de línea
- Calibración del score de la categoría: **MEDIUM** — la banda objetivo 60-80 es una estimación de la investigación de milestone, no una medición

**Research date:** 2026-08-01
**Valid until:** 2026-08-31 (30 días — el dominio es estable: la especificación de Open Graph no cambia desde hace años, el límite de 1024 bytes es del 2009, y no hay dependencias de versión que se muevan)
