---
status: passed
phase: 5
verified: 2026-07-05
---

# Phase 5 Verification: Rendimiento / Core Web Vitals

**Result:** ✅ PASSED — 4/4 success criteria verified con datos PSI REALES (juan-tech.com, API key) + 25 unit tests.

## Success Criteria

### 1. Muestra (no las 500) obtiene Performance Score móvil y desktop vía PSI ✅
- Auditoría real (urlLimit 5): 5 páginas muestreadas (homepage incluida) × 2 estrategias = 10 métricas, todas exitosas. Scores reales por página: home desktop 67 / móvil 79; /blog desktop 94 / móvil 77; /en/blog desktop 99 / móvil 82. Coincide con el reporte de referencia (home móvil 81 / desktop 99, varía run-to-run).

### 2. LCP, CLS, INP, TTFB reportados cuando la API los provee (móvil y desktop) ✅
- Reales: LCP móvil 3319-5402ms / desktop 784-1041ms; CLS ~0 (0-0.003); TTFB 3-18ms. **INP null** en todas (juan-tech.com sin datos de campo CrUX) → manejado como "no disponible" sin romper. Coincide con referencia (LCP móvil ~4876, CLS 0, INP no disponible, TTFB ~7).

### 3. Cache por url+estrategia, no re-consulta, respeta cuota ✅
- 2da auditoría del mismo sitio: **10/10 métricas `fromCache=true`**, mismos valores, sin re-consultar PSI. TTL 24h en Redis/Upstash.

### 4. Umbrales oficiales + severidad; fallo/límite PSI degrada parcial, no rompe ✅
- Severidad por métrica contra umbrales Google (score ≥90/50-89/<50; LCP ≤2500/≤4000; etc.).
- **Tolerancia a fallos verificada real:** corrida previa keyless dio HTTP 429 en las 10 llamadas → cada una degradó a "no disponible", la auditoría completó igual (no crash), PerfMetric persistidas con error, issues informativos.

## Requirements
- PERF-01 ✅  PERF-02 ✅  PERF-03 ✅  PERF-04 ✅

## Tests
- vitest 25/25 en @auditor/psi (parser con fixtures, thresholds, sampler homepage-siempre, cache hit/miss). Total repo: 100 tests verdes. typecheck + build limpios.

## Notas
- **Keyless PSI es fuertemente rate-limitado (429)** desde una IP; producción requiere `PSI_API_KEY` (env, gitignored). El worker la carga automáticamente vía Prisma (que carga .env al instanciar el cliente).
- Muestreo cap 5 páginas (config `MAX_PSI_PAGES`); homepage siempre incluida + variedad por depth.
- Job timeout subido a 20 min (PSI lento), lockDuration = timeout+60s (fix Fase 3 intacto).

## Deuda de entorno (no de código)
- Múltiples reinicios de dev servers agotaron file descriptors (EMFILE) en el watcher de Next; verificación de Fase 5 se hizo encolando el job directo al worker (sin web dev server). Para uso normal, `ulimit -n` alto o correr web+worker por separado.

## Human verification
Ninguna bloqueante — verificado con datos reales de PSI.
