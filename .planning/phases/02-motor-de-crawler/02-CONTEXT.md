# Phase 2: Motor de crawler - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Mode:** Autonomous (grey areas resolved from research + Phase 1 decisions)

<domain>
## Phase Boundary

Dado cualquier sitio, el sistema descubre y rastrea de forma confiable hasta 500 páginas, respetando robots.txt y sin ser bloqueado. Cubre CRAWL-01..08. Produce filas `Page` persistidas y progreso consultable. NO incluye checks SEO/on-page/schema/perf (fases 3-5) — sólo descubrimiento, fetch, parse y persistencia del HTML/estado base.
</domain>

<decisions>
## Implementation Decisions

### Del research (ARCHITECTURE/STACK/PITFALLS)
- **Motor:** Crawlee (`@crawlee/cheerio` — CheerioCrawler) para el pase HTTP completo. Chrome/Playwright NO en esta fase.
- **Discovery:** parsear `sitemap.xml` (incluye sitemap index anidado y .gz) primero; fallback a link-crawl desde la home siguiendo enlaces internos same-registrable-domain.
- **robots.txt:** parser propio o `robots-parser`; respetar Disallow para el user-agent del bot. Rutas bloqueadas NO se rastrean (anti-feature explícito).
- **Rate limiting:** concurrencia conservadora por dominio (maxConcurrency bajo, ~2-5) + `maxRequestsPerMinute`; Crawlee AutoscaledPool. User-agent identificable propio (ej. `AuditorBot/1.0 (+https://juan-tech.com)`).
- **Límite:** `maxRequestsPerCrawl = min(urlLimit, 500)`; nunca exceder.
- **Extracción:** Cheerio; capturar status HTTP, headers relevantes, cadena de redirects (seguir y registrar), URL final canónica de fetch. Guardar el HTML crudo o los campos necesarios en `Page` (decidir: guardar html en columna text o sólo derivados — para fases de checks conviene tener el HTML; guardar en `Page.html` text, nullable).
- **Progreso:** actualizar `Audit.stats` (JSON: `{ discovered, crawled, total }`) periódicamente; expuesto por `GET /api/audits/[id]`.
- **Resiliencia:** timeout por request (`requestHandlerTimeoutSecs`), reintentos (`maxRequestRetries`), y el job BullMQ ya tiene timeout/stalled de Fase 1. Una URL rota no tumba el crawl.

### Claude's Discretion
- Estructura de `packages/crawler` vs meterlo en `apps/worker`. Recomendado: `packages/crawler` (reutilizable, testeable) consumido por el worker.
- Esquema exacto de columnas nuevas en `Page` (html, finalUrl, redirectChain Json, contentType, fetchedAt, depth, fromSitemap Boolean).
- Almacenamiento de HTML: en DB (text) para MVP; migrar a blob si pesa.
- Normalización de URL (trailing slash, fragmentos #, query params) — implementar helper `normalizeUrl`.

### Grey area flag (del STATE, Phase 3 pero afecta modelo)
- hreflang reciprocity se resuelve en Fase 3; acá sólo se captura el HTML para permitirlo.
</decisions>

<code_context>
## Existing Code Insights

- Fase 1 lista: `packages/db` (Prisma/Neon), `packages/queue` (BullMQ/Upstash), `apps/worker` (Worker sobre AUDIT_QUEUE que hoy hace no-op). El crawler reemplaza el no-op: el processor del worker ahora corre el crawl real para el `auditId`.
- Modelo `Page` existe (minimal: auditId, url, statusCode). Se expande en esta fase.
- `Audit.stats Json?` ya existe para progreso.
</code_context>

<specifics>
## Specific Ideas

- Target de prueba real: **juan-tech.com** (tiene sitemap ~158 URLs según reporte de referencia). Ideal para verificar discovery + crawl + límite + progreso.
- Verificación: correr una auditoría real contra juan-tech.com (con urlLimit bajo, ej. 30, para no tardar/abusar), confirmar: URLs descubiertas del sitemap, filas Page creadas con statusCode, progreso en Audit.stats, respeto de robots.txt, y que una URL 404 no rompe el crawl. Segundo test: un sitio sin sitemap → fallback link-crawl.
</specifics>

<deferred>
## Deferred Ideas

- Checks SEO/on-page/schema/AEO/perf → fases 3-5.
- Playwright/JS-render sampling → v2 (ENRICH-01).
- Almacenamiento en blob del HTML si crece → optimización posterior.
</deferred>
