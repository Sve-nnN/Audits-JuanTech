# Phase 2 Plan: Motor de crawler

**Requirements:** CRAWL-01..08
**Mode:** mvp

## Tasks

1. **DB: expandir `Page`** — agregar columnas: `html String? @db.Text`, `finalUrl String?`, `redirectChain Json?`, `contentType String?`, `depth Int?`, `fromSitemap Boolean @default(false)`, `fetchedAt DateTime?`, `error String?`. Push a Neon. (CRAWL-05)
2. **`packages/crawler`** (`@auditor/crawler`):
   - `normalizeUrl.ts` — normaliza (protocolo, host lowercase, quita fragmento, ordena/limpia query, trailing slash consistente). Helper `sameRegistrableDomain`.
   - `robots.ts` — fetch + parse robots.txt (robots-parser), API `isAllowed(url, userAgent)`.
   - `sitemap.ts` — fetch sitemap.xml, soporta sitemap index anidado y .gz; devuelve lista de URLs. (CRAWL-01)
   - `crawl.ts` — `runCrawl({ auditId, startUrl, urlLimit, onProgress })` usando CheerioCrawler: siembra desde sitemap (o home fallback link-crawl si no hay sitemap, CRAWL-02); respeta robots (CRAWL-03); maxConcurrency + maxRequestsPerMinute conservador + user-agent propio (CRAWL-04); `maxRequestsPerCrawl = min(urlLimit,500)` (CRAWL-06); captura status/headers/redirects/html; persiste `Page`; `requestHandlerTimeoutSecs` + `maxRequestRetries` (CRAWL-08). Errores por URL se registran en Page.error sin abortar.
   - `index.ts` barrel.
3. **Worker integra crawler** — el processor de `apps/worker` deja de hacer no-op: carga el Audit, resuelve startUrl (Site.domain), corre `runCrawl`, actualiza `Audit.stats {discovered,crawled,total}` vía onProgress (throttled), marca done/failed. (CRAWL-07, CRAWL-08)
4. **Web: crear Site con URL real + exponer progreso** — `POST /api/audits` acepta `{ url }`, deriva domain, crea Site+Audit(urlLimit). `GET /api/audits/[id]` devuelve stats de progreso. Página muestra progreso (crawled/total) por polling.
5. **Verificación** — auditoría real contra juan-tech.com (urlLimit=30): confirmar discovery de sitemap, filas Page con statusCode, progreso, robots respetado, resiliencia ante 404. Segundo caso: sitio sin sitemap → fallback.

## Success Criteria (ROADMAP)
1. Sitio con sitemap (incl. index anidado) → todas sus URLs descubiertas y rastreadas.
2. Sitio sin sitemap → link-crawl desde home (fallback).
3. Nunca excede 500 URLs; nunca rastrea rutas bloqueadas por robots.txt.
4. Progreso (crawled/total) consultable desde la UI durante el crawl.
5. Una página lenta/rota no cuelga ni tumba el crawl (timeouts, reintentos, sin zombis).

## Verification Strategy
- Sin servicios: typecheck/build; unit tests de normalizeUrl, sitemap parse (fixture), robots parse.
- Con servicios (Neon+Upstash, ya conectados): crawl real acotado contra juan-tech.com + un sitio sin sitemap.
