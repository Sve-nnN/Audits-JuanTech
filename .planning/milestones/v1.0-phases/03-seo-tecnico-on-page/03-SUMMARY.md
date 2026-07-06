---
phase: 03
plan: 03
subsystem: seo-checks
tags: [checks, seo-tecnico, on-page, worker, cheerio, simhash]
requires: [phase-2-crawler, phase-2-page-model]
provides: [issue-generation, tech-checks, onpage-checks, network-checks]
affects: [apps/worker, apps/web, packages/db]
tech-stack:
  added:
    - "@auditor/checks (new workspace package)"
  patterns:
    - "PageCheck / SiteCheck / NetworkCheck registry pattern, Cheerio over stored Page.html"
    - "64-bit SimHash + Hamming distance for near-duplicate detection"
key-files:
  created:
    - packages/checks/src/types.ts
    - packages/checks/src/simhash.ts
    - packages/checks/src/util.ts
    - packages/checks/src/registry.ts
    - packages/checks/src/index.ts
    - packages/checks/src/checks/onpage/*.ts (title, metaDescription, h1, altText, openGraph, contentLength, lang)
    - packages/checks/src/checks/tech/*.ts (httpStatus, canonical, indexability, redirects, viewport, mixedContent, robotsTxt, sitemap, duplicateContent, orphanPages, hreflang)
    - packages/checks/src/checks/network/*.ts (linkChecker, brokenExternalLinks, brokenResources)
    - packages/checks/src/*.test.ts + checks/**/*.test.ts (32 tests)
  modified:
    - packages/db/prisma/schema.prisma (Issue model expanded)
    - apps/worker/src/index.ts (run checks post-crawl, persist Issues, update stats)
    - apps/worker/package.json (added @auditor/checks dependency)
    - apps/web/app/api/audits/[id]/route.ts (issuesByCategory in response)
decisions:
  - "SimHash Hamming threshold set to 3 (of 64 bits) as a named tunable constant (SIMHASH_HAMMING_THRESHOLD in simhash.ts) — flagged for empirical validation against real sites per 03-CONTEXT.md pitfall note."
  - "Orphan-page and hreflang-reciprocity checks parse each crawled page's stored HTML for internal links (rather than relying on crawl-time link discovery, which only runs when NOT seeded from a sitemap) so they work regardless of crawl seeding mode."
  - "Indexability (TECH-05) only inspects <meta name=\"robots\">; the X-Robots-Tag HTTP header is not persisted on Page in Phase 2, so header-based noindex is not detected yet (documented limitation, not a stub)."
metrics:
  duration: "~1 session"
  completed: "2026-07-05"
---

# Phase 3 Plan 3: SEO Técnico + On-Page Summary

Framework de checks (`@auditor/checks`) que corre 24 checks (7 on-page, 11 técnicos de página/sitio, 2 de red) sobre el HTML ya persistido por el crawler y genera `Issue` con severidad, valor medido, fuente, criterio y recomendación en español neutral.

## What Was Built

### 1. `Issue` model expandido (`packages/db/prisma/schema.prisma`)
Se agregaron `category`, `title`, `source`, `criterion`, `scope` (para issues de sitio, sin `pageId`). Aplicado a Neon con `prisma db push` + `generate`.

### 2. Paquete `@auditor/checks`
- **Tipos** (`src/types.ts`): `IssueDraft`, `PageCheckCtx` (página Prisma + CheerioAPI), `SiteCheckCtx` (todas las páginas + origin + robotsTxt + sitemapUrls), interfaces `PageCheck`/`SiteCheck`/`NetworkCheck`.
- **On-page** (`src/checks/onpage/`):
  - `title.ts` (ONPAGE-01): presencia, longitud 30-60, detecta títulos genéricos ("Home", "Untitled", etc).
  - `metaDescription.ts` (ONPAGE-02): presencia, longitud 70-160.
  - `h1.ts` (ONPAGE-03): presencia y unicidad (exactamente 1 H1).
  - `altText.ts` (ONPAGE-04): cobertura de `alt` en `<img>`, crítico si cobertura < 50%.
  - `openGraph.ts` (ONPAGE-05): presencia de og:title/description/image/url.
  - `contentLength.ts` (ONPAGE-06): conteo de palabras del body visible, umbral 300 palabras.
  - `lang.ts` (ONPAGE-07): atributo `lang` en `<html>`, valida formato BCP 47.
- **Técnico página** (`src/checks/tech/`):
  - `httpStatus.ts` (TECH-03): flags 4xx/5xx internos desde `Page.statusCode`.
  - `canonical.ts` (TECH-04): presencia, unicidad, auto-referencia (resuelto contra `@auditor/crawler`'s `normalizeUrl`).
  - `indexability.ts` (TECH-05): noindex vía meta robots (ver limitación de header abajo).
  - `redirects.ts` (TECH-06): cadena de redirects desde `Page.redirectChain`.
  - `viewport.ts` (TECH-07): meta viewport.
  - `mixedContent.ts` (TECH-11): recursos `http://` en páginas `https://`.
- **Técnico sitio** (`src/checks/tech/`):
  - `robotsTxt.ts` (TECH-01), `sitemap.ts` (TECH-02): accesibilidad/contenido y conteo de URLs.
  - `duplicateContent.ts` (TECH-08) + `simhash.ts`: hash exacto de texto normalizado para duplicados exactos; SimHash 64-bit + distancia Hamming (umbral tuneable, ver decisión) para near-duplicates. Ignora páginas con < 50 palabras (ruido).
  - `orphanPages.ts` (TECH-09): URLs en sitemap sin ningún `<a href>` interno apuntándolas en el HTML crawleado.
  - `hreflang.ts` (TECH-10): reciprocidad de hreflang entre páginas del set crawleado + conflicto canonical-hreflang (cuando el target de un hreflang tiene canonical hacia otra URL).
- **Red** (`src/checks/network/`): `linkChecker.ts` (HEAD→GET fallback, timeout 8s, concurrencia 5), `brokenExternalLinks.ts` (TECH-12), `brokenResources.ts` (TECH-13, img/script/link[rel=stylesheet]). Deduplican por URL única antes de golpear la red.
- **Registry** (`src/registry.ts`): `pageChecks`, `siteChecks`, `networkChecks` arrays + `runAllChecks({ pages, origin, robotsTxt, sitemapUrls, includeNetworkChecks? })` que corre todo y devuelve `IssueDraft[]`.

### 3. Worker (`apps/worker/src/index.ts`)
Tras `runCrawl`, dentro del mismo `withTimeout` (10 min): carga todas las `Page` del audit, fetch de robots.txt crudo + `discoverSitemapUrls` (reutilizado de `@auditor/crawler`), corre `runAllChecks`, borra Issues previas del audit (`deleteMany`) y las recrea (`createMany`) — idempotente ante re-runs. `Audit.stats` ahora incluye `issues: { critical, warning, ok, total }` junto a los campos de progreso existentes.

### 4. Web (`apps/web/app/api/audits/[id]/route.ts`)
`GET /api/audits/[id]` agrega `issuesByCategory: Record<string, {critical, warning, ok, total}>` vía `prisma.issue.groupBy`. Preview only — el reporte completo es Fase 6.

## How to Run a Live Audit for Verification

1. Asegúrate de tener `.env` con `DATABASE_URL` (Neon) y `REDIS_URL` (Upstash) reales.
2. Levanta el worker: `pnpm --filter @auditor/worker dev`.
3. Encola un audit para `juan-tech.com` (vía la API existente de Fase 1/2, o directamente insertando un `Audit` con `Site.domain = "juan-tech.com"` y `urlLimit` ~40, luego encolando el job `AUDIT_QUEUE` con ese `auditId`).
4. Cuando `Audit.status` pase a `done`, consulta `GET /api/audits/{id}` para ver `issuesByCategory`, o `prisma.issue.findMany({ where: { auditId } })` para el detalle completo (checkId, category, severity, measuredValue, source, criterion, recommendation).
5. Confirma coherencia con el reporte de referencia: 404 internos (TECH-03), duplicados/hreflang si aplica, on-page presente/ausente por página.

## Deviations from Plan

### Auto-fixed / documented limitations

**1. [Rule 2 — documented limitation] Indexabilidad (TECH-05) sólo vía meta robots, no X-Robots-Tag header**
- El modelo `Page` de Fase 2 no persiste headers HTTP (sólo `statusCode`, `contentType`, `html`). Detectar `X-Robots-Tag: noindex` requeriría un cambio de schema/crawler fuera del alcance de esta fase (Rule 4 — decisión arquitectónica, no aplicada automáticamente). Documentado como limitación conocida; el check funciona correctamente sobre `<meta name="robots">`.

**2. [Rule 1 — diseño] Orphan pages y hreflang reciprocity parsean HTML directamente en el check, no dependen de link-crawl**
- El crawler (`crawl.ts`) sólo extrae y sigue enlaces internos cuando NO se sembró desde sitemap. Como la mayoría de auditorías reales sí tienen sitemap, depender del grafo de enlaces del crawler habría dejado estos dos checks sin datos casi siempre. En su lugar, ambos checks parsean el `Page.html` ya almacenado de cada página crawleada con Cheerio para construir su propio grafo de enlaces internos / hreflang, funcionando independientemente del modo de siembra.

Ninguna otra desviación arquitectónica. El resto del plan se ejecutó según lo escrito.

## SimHash Threshold Note

`SIMHASH_HAMMING_THRESHOLD = 3` (de 64 bits) en `packages/checks/src/simhash.ts`. Es un valor conservador de partida (~95% de similitud de bits). **Debe validarse empíricamente** corriendo la auditoría real sobre juan-tech.com y comparando los near-duplicates detectados contra el reporte de referencia; si genera demasiados falsos positivos/negativos, ajustar la constante (está aislada y documentada para eso).

## Known Stubs

Ninguno. Todos los checks producen Issues reales basados en datos persistidos o en fetches en vivo (checks de red).

## Self-Check: PASSED

Archivos verificados en disco:
- packages/checks/package.json — FOUND
- packages/checks/src/index.ts — FOUND
- packages/checks/src/registry.ts — FOUND
- packages/checks/src/simhash.ts — FOUND
- packages/checks/src/checks/onpage/title.ts — FOUND
- packages/checks/src/checks/tech/hreflang.ts — FOUND
- packages/checks/src/checks/network/brokenExternalLinks.ts — FOUND
- apps/worker/src/index.ts (modified) — FOUND
- apps/web/app/api/audits/[id]/route.ts (modified) — FOUND

Comandos verificados:
- `pnpm -r typecheck` — Done (all 6 relevant packages)
- `pnpm -r build` — Done (web + worker)
- `pnpm --filter @auditor/checks test` — 9 test files, 32 tests passed
- `prisma db push` — synced against Neon
