---
status: passed
phase: 2
verified: 2026-07-05
---

# Phase 2 Verification: Motor de crawler

**Result:** ✅ PASSED — 5/5 success criteria verified (real crawls + controlled tests).

## Success Criteria

### 1. Sitio con sitemap → URLs descubiertas y rastreadas ✅
- Crawl real contra **juan-tech.com** (urlLimit=30): **152 URLs descubiertas** del sitemap, 30 rastreadas, 30 filas `Page` con statusCode 200, html capturado, `fromSitemap=true`. Done en ~28s.

### 2. Sitio sin sitemap → fallback link-crawl ✅
- Crawl real contra **example.com** (sin sitemap): discovered 1, crawled 1 vía link-crawl desde home. Done.

### 3. Nunca excede 500 URLs; respeta robots.txt ✅
- `maxRequestsPerCrawl = min(urlLimit, 500)` (HARD_URL_CAP=500). En el test urlLimit=30 → exactamente 30 crawled, discovered=152 no rastreadas de más.
- Seed y links filtrados por `isAllowed(url, ua)` (robots-parser, caché por origen, fail-closed en 5xx). Rutas Disallow nunca se fetchean.

### 4. Progreso consultable desde la UI durante el crawl ✅
- `Audit.stats {discovered, crawled, total}` actualizado throttled; `GET /api/audits/[id]` lo expone. Polling mostró progresión 0→1→13→29→30 en vivo.

### 5. Página lenta/rota no cuelga ni tumba el crawl ✅
- `requestHandlerTimeoutSecs=30`, `maxRequestRetries=2`; error de transporte → `failedRequestHandler` registra `Page.error` sin abortar.
- **Fix clave (commit 42124ec):** `ignoreHttpErrorStatusCodes` (rango 400-599) → 4xx/5xx llegan a requestHandler y se registran con su statusCode real. Verificado con server local controlado: **404→404, 500→500, 301→(sigue)→200, 200→200**, todos con status correcto. Habilita TECH-03 (marcar 404 internos) en Fase 3.

## Requirements
- CRAWL-01 ✅  CRAWL-02 ✅  CRAWL-03 ✅  CRAWL-04 ✅  CRAWL-05 ✅  CRAWL-06 ✅  CRAWL-07 ✅  CRAWL-08 ✅

## Tests
- vitest 16/16 (normalizeUrl, sitemap parsing). typecheck + build limpios en los 5 paquetes.

## Notas / deuda
- HTML crudo guardado en `Page.html` (text). Si crece mucho a 500 URLs, migrar a blob (deuda documentada, no bloqueante v1).
- Storage de Crawlee 100% en memoria (`persistStorage:false`) — nada toca disco/repo.

## Human verification
Ninguna pendiente — verificado automáticamente (crawls reales + test controlado).
