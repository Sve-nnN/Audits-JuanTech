---
status: passed
phase: 6
verified: 2026-07-05
---

# Phase 6 Verification: Scoring, comparación de corridas y reporte

**Result:** ✅ PASSED — 4/4 success criteria verified con auditorías reales (juan-tech.com) + 125 unit tests. Un bug de scoring encontrado y arreglado.

## Success Criteria

### 1. Score general + scores por categoría con estado ✅
- Auditoría real juan-tech.com (30 URLs): **overall 91 (Bueno)**, coherente con el reporte de referencia (86, Bueno). Por categoría: SEO Técnico 98, Rendimiento 76, On-Page 92, Datos Estructurados 98, AEO 100, cada uno con estado (good/needs_improvement/critical). Diferencias con la referencia explicadas por scope de crawl (30 vs 193 URLs) y cambios del sitio (agregó llms.txt).

### 2. Tabla de issues priorizados; cada issue con valor medido/fuente/criterio/recomendación ✅
- Reporte renderiza tabla de issues prioritarios ordenada por severidad. Detalle por categoría con "Valor medido" (1274 ocurrencias) y "Recomendación" (1272) por issue. Estructura espejo del reporte de referencia.

### 3. URL única por auditoría ✅
- `/audits/[id]` (REPORT-02): HTTP 200, reporte completo (score general, cards por categoría, tabla priorizada, detalle, resumen de rendimiento, link al grafo de entidades). Self-contained (CSS Modules, sin CDN — CSP-safe).

### 4. 2da auditoría → nuevos/persistentes/resueltos vs corrida anterior ✅
- Dos auditorías del mismo scope (30 URLs): **new=0, persistent=636, resolved=0** (correcto: nada cambió = todo persiste).
- Auditoría 30-URL vs previa 5-URL: correctamente marcó new/resolved (fingerprints de páginas fuera del nuevo muestreo → resolved). DIFF-01 (fingerprint estable checkId+url/scope) + DIFF-02 verificados.

## Bug encontrado y arreglado (commit posterior a 3cd91c9)
- **Scoring escalaba con tamaño del sitio → onpage=0, overall 64:** el modelo era `100 - Σ(penalty por issue)`. En 30 páginas, onpage acumuló 6 crit×15 + 23 warn×5 = 205 → clamp a 0. Cualquier sitio multi-página tanqueaba. Fix: **pass-rate ponderado por severidad** (ok=1, warning=0.5, critical=0) promediado sobre los check results — tamaño-independiente, estilo Ahrefs/Semrush. overall 64 → 91.

## Requirements
- SCORE-01..05 ✅  REPORT-01/02 ✅  DIFF-01/02 ✅

## Tests
- vitest 125 totales verdes (25 scoring incl determinismo/size-independence/thresholds, + crawler/checks/psi). typecheck + build limpios (8 paquetes).

## Notas
- Pesos de categoría tuneables (`CATEGORY_WEIGHTS`: tech 0.30, perf 0.30, onpage 0.15, schema 0.10, aeo 0.15). Perf desde PSI (móvil 70/desktop 30).
- El reporte es grande (5.4MB con 636 issues en 30 páginas) — futura paginación/lazy para sitios de 500 URLs (deuda, no bloqueante v1).

## Human verification
Recomendable (no bloqueante): abrir `/audits/[id]` en el browser para revisar la estética del reporte (Juan design-conscious). Funcionalmente verificado (HTTP 200 + todas las secciones presentes).
