# Phase 3 Plan: SEO Técnico + On-Page

**Requirements:** TECH-01..13, ONPAGE-01..07
**Mode:** mvp

## Tasks

1. **DB: expandir `Issue`** — agregar `source String?`, `criterion String?`, `title String?`, `category String` (tech|onpage|...), `scope String?` (para site-level). Push a Neon.
2. **`packages/checks`** (`@auditor/checks`) — framework + checks:
   - Tipos: `PageCheck` (recibe página + Cheerio $), `SiteCheck` (recibe todas las páginas + site meta). Cada uno retorna `IssueDraft[]`.
   - Registry que corre todos y agrega resultados.
   - **Page-level (ONPAGE + parte TECH):** title (01), meta desc (02), H1 (03), alt text (04), OG (05), content length (06), lang (07); canonical (TECH-04), indexabilidad meta robots/X-Robots (TECH-05), viewport (TECH-07), redirect chain desde Page.redirectChain (TECH-06), HTTP status/404 internos desde Page.statusCode (TECH-03), mixed content (TECH-11).
   - **Site-level (TECH):** robots.txt accesible/contenido (01), sitemap presente+conteo (02), duplicados exactos + near-duplicate SimMHash (08), profundidad/huérfanas (09), hreflang reciprocity + conflicto canonical (10).
   - **Network checks (TECH-12/13):** enlaces externos rotos + recursos rotos (img/css/js), HEAD→GET, dedupe, timeout, concurrencia baja.
   - Cada Issue: checkId, category, severity, title, measuredValue, source, criterion, recommendation (ES neutral, humanizada), fingerprint estable.
3. **Worker: correr checks post-crawl** — tras runCrawl, cargar todas las Pages del audit, correr page-checks + site-checks + network-checks, persistir Issues (borrar/re-crear por audit para idempotencia), luego marcar done. Actualizar Audit.stats con conteo de issues por severidad.
4. **Web:** `GET /api/audits/[id]` incluye conteo de issues por categoría/severidad (preview; el reporte completo es Fase 6).
5. **Verificación** — auditoría real juan-tech.com (urlLimit ~40): confirmar que se generan Issues de las categorías esperadas (404 internos, duplicados, hreflang, on-page presentes/ausentes) coherentes con el reporte de referencia. Tests unit de checks con fixtures HTML.

## Success Criteria (ROADMAP)
1. Cada página reporta HTTP, canonical, indexabilidad, redirects; 4xx/5xx internos marcados.
2. Duplicados/near-duplicate, huérfanas, hreflang, mixed content detectados a nivel sitio.
3. Enlaces externos rotos y recursos rotos reportados.
4. Title, meta desc, H1, alt, OG, longitud y lang evaluados por página.

## Verification Strategy
- Unit: fixtures HTML por check (title/meta/H1/canonical/hreflang/duplicados/simhash).
- Integración: crawl+checks real acotado sobre juan-tech.com; assertions sobre issues generados por categoría.
