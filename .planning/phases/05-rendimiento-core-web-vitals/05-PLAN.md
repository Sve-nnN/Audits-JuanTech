# Phase 5 Plan: Rendimiento / Core Web Vitals

**Requirements:** PERF-01..04
**Mode:** mvp

## Tasks

1. **DB** — tabla/columna para métricas: `PerfMetric` (id, auditId, pageId?, url, strategy [mobile|desktop], performanceScore, lcpMs, cls, inpMs, ttfbMs, fromCache Bool, fetchedAt, error?) o `Audit`/`Page` Json. Push a Neon.
2. **`packages/psi`** (`@auditor/psi`):
   - `client.ts` — llama PSI API (`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=...&strategy=...&category=performance`), key opcional desde `PSI_API_KEY`. Parsea Performance Score (lighthouseResult.categories.performance.score*100), LCP/CLS/TTFB (audits), INP (CrUX loadingExperience/originLoadingExperience si existe). Reintentos limitados + timeout; devuelve `{ ok, metrics?, error? }`.
   - `cache.ts` — caché por `url+strategy` con TTL (Redis/Upstash, TTL 24h). get/set.
   - `sample.ts` — `selectSample(pages, max)`: homepage + representativas por depth/sección, hasta `MAX_PSI_PAGES` (5).
   - `thresholds.ts` — umbrales oficiales Google → severidad por métrica.
   - `index.ts` barrel.
3. **`packages/checks` familia `perf/`** o integración: convertir métricas PSI en `Issue` (category "perf"): Performance Score, LCP, CLS, INP, TTFB por página/estrategia con measuredValue/criterion/recommendation y severidad por umbral. INP no disponible → issue informativo, no rompe.
4. **Worker** — tras crawl+checks, seleccionar muestra, correr PSI (cache-first) móvil+desktop, persistir PerfMetric + Issues perf, actualizar Audit.stats. Fallo de PSI → métrica "no disponible", auditoría sigue. Subir job timeout si hace falta (PSI es lento) manteniendo lock fix.
5. **Web** — `GET /api/audits/[id]` incluye resumen perf (scores + métricas por estrategia). Preview; reporte completo Fase 6.
6. **Verificación** — auditoría real juan-tech.com muestra 2-3 páginas: confirmar Performance Score móvil/desktop, LCP/CLS/TTFB, INP no disponible manejado, severidad por umbral, tolerancia a fallo PSI, y caché (2da corrida usa cache). Unit tests: parser PSI (fixture JSON), thresholds, sampler, cache.

## Success Criteria (ROADMAP)
1. Muestra representativa (no las 500) obtiene Performance Score móvil y desktop vía PSI.
2. LCP, CLS, INP, TTFB reportados cuando la API los provee, móvil y desktop.
3. Resultados PSI cacheados por url+estrategia, no re-consulta en corridas próximas, respeta cuota.
4. Cada métrica comparada con umbrales oficiales + severidad; fallo/límite PSI degrada parcial, no rompe.

## Verification Strategy
- Unit: fixture JSON de respuesta PSI → parser; thresholds; sampler; cache hit/miss.
- Integración: auditoría real juan-tech.com (muestra chica, keyless); assertions sobre métricas + caché + tolerancia a fallo.
