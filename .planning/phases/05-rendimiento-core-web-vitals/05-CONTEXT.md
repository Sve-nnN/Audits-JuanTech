# Phase 5: Rendimiento / Core Web Vitals - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Mode:** Autonomous (decisión de usuario: PSI keyless por ahora)

<domain>
## Phase Boundary

Cada auditoría incluye datos reales de rendimiento y Core Web Vitals sobre una MUESTRA de páginas, sin agotar la cuota de PageSpeed Insights. Cubre PERF-01..04. NO corre PSI en las 500 URLs. NO incluye Lighthouse local/unlighthouse (decisión: PSI muestreado; unlighthouse descartado). NO incluye scoring global (Fase 6).
</domain>

<decisions>
## Implementation Decisions

- **Fuente:** Google PageSpeed Insights API (Lighthouse lab + CrUX field). **Keyless por ahora** (cuota baja, ~1 req/s); key opcional vía env `PSI_API_KEY` (si está, se agrega a la request para cuota alta). Diseño listo para key sin refactor.
- **Muestreo (PERF-03):** seleccionar hasta `MAX_PSI_PAGES` (ej. 5) páginas representativas del crawl (homepage garantizada + variedad por depth/sección), NO las 500. Documentar en el reporte qué páginas se muestrearon.
- **Estrategias:** correr PSI para `mobile` y `desktop` por página muestreada.
- **Caché (PERF-03):** cachear resultado por `url + strategy` con TTL (Redis/Upstash ya disponible; o tabla DB). Evita re-consultar en corridas cercanas y respeta cuota. TTL ej. 24h.
- **Métricas (PERF-02):** Performance Score, LCP, CLS, INP, TTFB (móvil y desktop) cuando la API los provea. INP/CrUX puede faltar (sitios con poco tráfico) → reportar "no disponible" sin romper.
- **Umbrales (PERF-04):** comparar contra umbrales oficiales de Google (LCP ≤ 2500ms bueno / ≤4000 mejora / >4000 malo; INP ≤200/≤500; CLS ≤0.1/≤0.25; score ≥90/50-89/<50). Marcar severidad critical/warning/ok.
- **Tolerancia a fallos (PERF-04):** una falla/límite/timeout de PSI degrada el reporte parcialmente (marca la métrica "no disponible", no rompe la auditoría). Reintentos limitados con backoff.

### Claude's Discretion
- Ubicación de la caché (Redis vs tabla `PsiResult`). Redis/Upstash preferido (TTL nativo).
- Criterio exacto de selección de muestra.
- Persistencia de métricas: tabla `PerfMetric` o Json en Audit.
</decisions>

<code_context>
## Existing Code Insights

- Worker corre crawl + checks post-crawl. PSI se corre como paso adicional (sobre la muestra) tras el crawl. Debe respetar el job timeout (subir si hace falta) y el lock fix de Fase 3.
- `Issue` con category — usar `category:"perf"`. `Audit.stats` para conteos.
- Redis/Upstash disponible vía `@auditor/queue` connection (reutilizar para caché) o cliente propio.
</code_context>

<specifics>
## Specific Ideas

- Reporte de referencia (juan-tech.com): Perf 86/100 (móvil 81 / desktop 99, ponderado 70/30), LCP móvil 4876ms (crítico) / desktop 1001ms, CLS 0, INP "no disponible", TTFB ~5-7ms.
- Verificación: auditoría real juan-tech.com con muestra chica (2-3 páginas) → confirmar Performance Score móvil/desktop, LCP/CLS/TTFB, manejo de INP no disponible, severidad por umbral, y que un fallo de PSI no rompe la auditoría. Confirmar caché (segunda corrida no re-consulta).
</specifics>

<deferred>
## Deferred Ideas

- Lighthouse local / unlighthouse → descartado (v1 usa PSI). Reconsiderable si se agrega VPS.
- Ponderación del score perf en el score global → Fase 6.
- INP real requiere tráfico CrUX; sin datos de campo se reporta lab/no disponible.
</deferred>
