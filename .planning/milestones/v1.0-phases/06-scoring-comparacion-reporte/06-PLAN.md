# Phase 6 Plan: Scoring, comparación de corridas y reporte

**Requirements:** SCORE-01..05, REPORT-01/02, DIFF-01/02
**Mode:** mvp · UI phase

## Tasks

1. **DB** — persistir scoring + diff: `Audit.scores Json?` (overall + por categoría + estado), y para diff `Issue.diffStatus String?` ('new'|'persistent'|'resolved') o computar al vuelo. Push a Neon.
2. **`packages/scoring`** (`@auditor/scoring`):
   - `categoryScore.ts` — dado los issues de una categoría, score 0-100 (base 100, penalización ponderada por severidad; determinístico) + estado (bueno/necesita mejora/crítico).
   - `overallScore.ts` — promedio ponderado de categorías. `CATEGORY_WEIGHTS` tuneable (AEO ~0.15, Técnico/Perf alto). Perf score desde PerfMetric (móvil/desktop 70/30).
   - `diff.ts` — dado issues actuales + issues de la auditoría previa (por fingerprint), devuelve por issue `new|persistent|resolved` + set de resueltos.
   - `index.ts` + tests.
3. **Worker** — al completar: computar category scores + overall, persistir en `Audit.scores`; computar diff vs auditoría previa completada del mismo sitio, persistir `diffStatus`. Mantener idempotencia.
4. **Web — reporte `/audits/[id]`** (REPORT-01/02):
   - Score general + estado (grande, color por estado), scores por categoría (cards/tabla).
   - Tabla de issues prioritarios ordenada por severidad, con badges de diff (nuevo/persistente/resuelto).
   - Detalle por categoría/issue (valor medido, fuente, criterio, recomendación), expandible.
   - Resumen de rendimiento (PSI móvil/desktop + CWV).
   - Links al grafo de entidades por página (Fase 4).
   - Self-contained (CSP: sin CDN, estilos inline/module). Limpio y profesional (Juan design-conscious). Estructura espejo del reporte de referencia.
   - Home (`/`): form de URL → lanza auditoría → redirige/polling al reporte.
5. **API** — `GET /api/audits/[id]` incluye scores + diff resumen. Endpoint del reporte lee todo.
6. **Verificación** — auditoría real juan-tech.com: score general ~80-90 coherente con referencia (86), scores por categoría razonables, tabla priorizada correcta, reporte HTTP 200 con secciones. 2da auditoría → diff marca resueltos/nuevos/persistentes. Unit tests scoring + diff.

## Success Criteria (ROADMAP)
1. Score general + scores por categoría con estado (Bueno/Necesita mejora/Crítico).
2. Tabla de issues priorizados por severidad; cada issue con valor medido, fuente, criterio, recomendación.
3. Cada auditoría con URL única para consultar su reporte.
4. 2da auditoría del mismo sitio → marca issues nuevos/persistentes/resueltos vs corrida anterior.

## Verification Strategy
- Unit: categoryScore determinístico (fixtures de issues), overall weighting, diff (previo vs actual).
- Integración: auditoría real juan-tech.com → validar score coherente con referencia + reporte render + 2da corrida diff.
