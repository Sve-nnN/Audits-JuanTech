# Phase 3: SEO Técnico + On-Page - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Mode:** Autonomous (grey areas resueltos de research + reporte de referencia)

<domain>
## Phase Boundary

Cada página rastreada produce hallazgos precisos de SEO técnico y on-page, SIN depender de APIs externas. Cubre TECH-01..13 y ONPAGE-01..07. Consume el HTML/estado ya persistido en `Page` (Fase 2) + robots/sitemap del sitio. Persiste `Issue` por hallazgo. NO incluye scoring/reporte (Fase 6) — sólo generar los issues con severidad, valor medido, fuente, criterio y recomendación.
</domain>

<decisions>
## Implementation Decisions

### Diseño de checks
- **Arquitectura de checks:** `packages/checks` (`@auditor/checks`) con un registro de checks. Dos tipos: **page-level** (corren por página sobre su HTML/estado) y **site-level** (corren post-crawl sobre el conjunto: duplicados, huérfanas, hreflang reciprocity, sitemap, robots). Cada check devuelve `Issue[]` con `{ checkId, severity, measuredValue, source, criterion, recommendation, fingerprint }`.
- **Parsing:** Cheerio sobre `Page.html` (ya guardado). Sin red salvo verificación de enlaces/recursos rotos (TECH-12/13) que sí hace HEAD/GET.
- **Severidad:** 3 niveles `critical | warning | ok` (estándar Ahrefs/Semrush, ya en enum IssueSeverity).
- **Fingerprint:** `checkId + normalizedUrl` estable (para diffing en Fase 6). Site-level: `checkId + scope`.

### Grey areas resueltos
- **hreflang reciprocity (TECH-10):** reciprocidad **sobre el conjunto rastreado** (como el reporte de referencia: detecta return links faltantes y conflictos canonical-hreflang entre páginas crawleadas). No validación cross-domain externa (v2).
- **Duplicados/near-duplicate (TECH-08):** hash exacto (normalized text) para exactos + **SimHash** (64-bit, distancia Hamming) para near-duplicate. Umbral por defecto Hamming ≤ 3 (tuneable, marcado para validar empíricamente — pitfall del research).
- **Enlaces/recursos rotos (TECH-12/13):** HEAD con fallback GET, timeout corto, concurrencia limitada, sobre enlaces/recursos ÚNICOS (dedupe) para no explotar en red. Externos = otro host; recursos = img/script/link[rel=stylesheet].
- **Profundidad de clic/huérfanas (TECH-09):** depth ya capturado en crawl (BFS); huérfana = en sitemap pero no alcanzable por enlaces internos (o sin inlinks).

### Claude's Discretion
- Umbrales exactos on-page (title 30-60, meta desc 70-160, content length mínimo), copy de recomendaciones (humanizada, en español neutral).
- Estructura de columnas extra en `Issue` si hacen falta (source, criterion como campos).
</decisions>

<code_context>
## Existing Code Insights

- Fase 2: `Page` tiene html, statusCode, finalUrl, redirectChain, contentType, depth, fromSitemap, error. `Issue` model existe (minimal: checkId, severity, fingerprint, measuredValue, recommendation) — expandir con `source`, `criterion`, `title` si conviene.
- `packages/crawler` expone normalizeUrl, robots, sitemap — reutilizar.
- El worker corre runCrawl; tras crawl, debe correr la batería de checks (page-level durante o post, site-level post) y persistir Issues, antes de marcar done.
</code_context>

<specifics>
## Specific Ideas

- El **reporte de referencia** (juan-tech.com, en el prompt inicial) es el catálogo objetivo: cada check del reporte (robots.txt, sitemap, HTTP status, canonical, indexabilidad, redirects, 404 internos, viewport, duplicados, huérfanas, hreflang, mixed content, enlaces/recursos rotos + title/meta/H1/alt/OG/longitud/lang) debe existir con su "Valor medido / Fuente / Criterio / Recomendación".
- Verificación: correr checks sobre una auditoría real de juan-tech.com y confirmar que se generan Issues coherentes (ej. detectar los 404 internos, duplicados, hreflang faltantes que el reporte de referencia encontró).
</specifics>

<deferred>
## Deferred Ideas

- Scoring y armado del reporte visual → Fase 6.
- JSON-LD/AEO → Fase 4. Performance → Fase 5.
- Comparación HTML crudo vs render (Playwright) → v2.
</deferred>
