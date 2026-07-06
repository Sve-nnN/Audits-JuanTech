# Phase 6: Scoring, comparación de corridas y reporte - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Mode:** Autonomous. UI phase (reporte visual). Usuario es design-conscious → reporte limpio y profesional, estructura del reporte de referencia.

<domain>
## Phase Boundary

El usuario ve un reporte completo, priorizado y comparado contra su auditoría anterior del mismo sitio. Cubre SCORE-01..05, REPORT-01/02, DIFF-01/02. Consume Issues + PerfMetric + schemaGraph (fases 3-5). NO agrega nuevos checks. Cierra el producto de auditoría (falta sólo email/cuota en Fase 7).
</domain>

<decisions>
## Implementation Decisions

### Scoring (SCORE-01/02)
- **Score por categoría (0-100):** por cada categoría (Técnico, On-Page, Datos Estructurados, Rendimiento/CWV, AEO), derivar de sus issues: base 100, penalizar por severidad (critical pesa más que warning; ok no penaliza). Modelo tipo "porcentaje de checks pasados ponderado por severidad" (estilo Ahrefs/Semrush). Determinístico y explicable.
- **Score general (0-100):** promedio ponderado de las categorías. Pesos por defecto alineados al reporte de referencia (AEO peso bajo ~0.15 por impacto no confirmado; Técnico y Perf peso alto). Pesos como constantes tuneables. **Validar que el output sea coherente con el reporte de referencia (juan-tech.com ≈ 86/100).**
- **Estados:** Bueno (≥90 o ≥ umbral) / Necesita mejora / Crítico, como el reporte de referencia.
- **Perf score:** ya viene de PSI (ponderado móvil/desktop 70/30 como referencia).

### Severidad y tabla (SCORE-03/04/05)
- Severidad 3 niveles ya existe en Issues. Tabla de issues prioritarios ordenada por severidad (critical → warning), con checkId, categoría, valor medido, fuente, criterio, recomendación (ya en cada Issue).

### Reporte (REPORT-01/02)
- **REPORT-02:** cada auditoría tiene URL única (`/audits/[id]`) — parcialmente ya existe (rutas de páginas/grafo de Fase 4).
- **REPORT-01:** página de reporte que muestra: score general + estado, scores por categoría (tabla/cards), tabla de issues priorizados, detalle por issue expandible, resumen de rendimiento (PSI), y acceso al grafo de entidades por página. Estructura espejo del reporte de referencia (markdown del prompt inicial). Limpio, profesional, self-contained (CSP estricto: sin CDN).

### Diff (DIFF-01/02)
- **DIFF-01:** fingerprint estable por issue (`checkId + url/scope normalizado`) — ya existe en los checks. Verificar consistencia.
- **DIFF-02:** al completar una auditoría, comparar sus issues contra la auditoría anterior COMPLETADA del mismo sitio (por fingerprint): marcar cada issue como nuevo / persistente / resuelto (resuelto = estaba antes, ya no). Mostrar en el reporte ("qué cambió desde la última auditoría"). El worker o el endpoint del reporte computa el diff.

### Claude's Discretion
- Dónde computar el diff (worker post-audit persistiendo estado, o en el endpoint del reporte al vuelo comparando las 2 últimas). Preferible al vuelo en el endpoint (más simple, sin estado extra) o persistir `Issue.diffStatus`.
- Estética del reporte (colores por severidad, layout cards/tablas). Profesional, alineado a que Juan es design-conscious. Sin librerías externas (CSP).
- Persistir scores en `Audit` (columnas o Json) para historial.

<code_context>
## Existing Code Insights

- Issues con category/severity/fingerprint/measuredValue/source/criterion/recommendation. PerfMetric con métricas. Page.schemaGraph. Audit.stats con conteos.
- Web ya tiene `/audits/[id]/pages` y `/audits/[id]/pages/[pageId]` (grafo). Falta el reporte principal `/audits/[id]`.
- El worker computa todo post-crawl; puede computar scores + diff al final y persistir en Audit.
</code_context>

<specifics>
## Specific Ideas

- **Reporte de referencia (juan-tech.com) es el molde exacto:** Score General 86/100, tabla de scores por categoría, "Issues Prioritarios" tabla, "Detalle por Categoría" con Valor medido/Fuente/Criterio/Recomendación por issue. Replicar esa estructura en web.
- Verificación: auditoría real juan-tech.com → score general razonable (~80-90), scores por categoría coherentes, tabla priorizada correcta, reporte renderiza (HTTP 200). Segunda auditoría → diff marca resueltos/nuevos/persistentes. Unit tests del scoring (determinístico) y del diff.
</specifics>

<deferred>
## Deferred Ideas

- Email/cuota/verificación → Fase 7.
- Export PDF / compartible → v2 (ENRICH-02).
- Domain Rating como contexto → v2.
</deferred>
