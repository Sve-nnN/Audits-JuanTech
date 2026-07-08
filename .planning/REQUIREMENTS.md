# Requirements: Auditor Web (SEO/Técnico) — Milestone v1.3

**Defined:** 2026-07-08
**Core Value:** Cualquier persona ingresa una URL y recibe una auditoría completa, precisa y accionable de su web (errores reales priorizados por severidad), a cambio de su email verificado.

Milestone v1.3 = **Profundizar checks técnicos + visualización de arquitectura**. Origen: comparación de los checks ya implementados (v1.0-v1.2) contra la librería de skills del diplomado "De Cero a SEO" (`/Users/juan/Documents/Codigo/Arianna/SEO-Skills`). REQ-IDs con prefijos nuevos; numeración de fases continúa desde la 16.

## v1.3 Requirements

### Grafo de enlaces compartido + profundidad de clics

- [x] **DEPTH-01**: El auditor calcula la profundidad real de cada página (clics desde home) mediante un BFS propio sobre el grafo de enlaces internos (no lee `Page.depth`, que queda en 0 en crawls sembrados por sitemap).
- [ ] **DEPTH-02**: El reporte marca como advertencia el porcentaje de páginas a más de 3 clics de la home (issue agregado, no uno por página).
- [x] **DEPTH-03**: El BFS/grafo de enlaces internos se calcula una sola vez y lo reusan tanto el check de profundidad como el visualizador de arquitectura (DEPTH-04..ARCH-04) — nunca se recalcula por separado en cada carga del reporte.

### Diagnósticos de Lighthouse (PSI)

- [ ] **PERF-05**: El auditor extrae de la respuesta de PageSpeed Insights ya pagada (sin llamadas extra) los diagnósticos: uso de formatos de imagen modernos (WebP/AVIF), CSS sin usar, recursos que bloquean el renderizado, compresión de texto, y CSS/JS sin minificar.
- [ ] **PERF-06**: Cada diagnóstico se reporta como issue nuevo (`PERF-0x`) con severidad `warning`/`ok` derivada del propio score de Lighthouse para ese audit — nunca `critical`, y sin duplicar señal ya cubierta por PERF-01/02 (LCP/CLS/TTFB/INP).

### Agrupación por plantilla

- [ ] **TEMPLATE-01**: El auditor clasifica cada página en una plantilla (home / categoría / producto / artículo / otras) mediante heurística de segmentos de URL, sin asumir un CMS específico.
- [ ] **TEMPLATE-02**: El reporte agrupa issues por plantilla como eje complementario a la agrupación por tipo de issue (v1.2, Phase 15) — el usuario puede ver "qué le pasa a la plantilla de producto" además de "qué tipo de error se repite".

### Schema-contenido mismatch

- [ ] **SCHEMA-06**: El auditor detecta cuando una página declara JSON-LD `FAQPage`, `HowTo`, `Product`+`AggregateRating` o `Review` sin contenido visible correspondiente en el HTML (riesgo real de acción manual de Google por "datos estructurados engañosos").
- [ ] **SCHEMA-07**: El hallazgo se reporta con severidad `warning` por defecto (nunca `critical` automático dado el riesgo heurístico de falso positivo) y cruza con la muestra CSR/SSR de v1.2 (`@auditor/render`) para suprimir falsos positivos en páginas confirmadas como renderizadas por JS.

### Visualizador de arquitectura

- [ ] **ARCH-01**: El reporte incluye un árbol jerárquico de la arquitectura del sitio, agrupado por nivel de profundidad (0/1/2/3+), renderizado en SVG puro (mismo patrón que `EntityGraphSvg.tsx`, cero dependencias nuevas) — no un grafo interactivo con edges persistidas.
- [ ] **ARCH-02**: Cada nodo del árbol muestra: URL/título, profundidad, indicador de página huérfana, e indicador de página a más de 3 clics.
- [ ] **ARCH-03**: El árbol reusa el BFS/grafo calculado para DEPTH-01 (DEPTH-03) — no vuelve a parsear el HTML de las 500 páginas por separado.
- [ ] **ARCH-04**: El nodo del árbol muestra la plantilla clasificada (TEMPLATE-01) cuando esa feature ya esté disponible en el reporte.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Grafo interactivo completo (force-directed, edges persistidas, drag/zoom) | Requiere migración de storage y es caro de computar/renderizar a 500 URLs; el árbol por profundidad cubre el mismo insight sin ese costo (decisión LOCKED del milestone). |
| Los 40+ audits de Lighthouse sin curar | Ahogaría a una audiencia lead-magnet en detalles que no puede accionar; se cura a 5-7 audit IDs de mayor impacto. |
| Clasificación de plantilla específica de CMS (WordPress post types, Shopify collections) | Este es un auditor genérico sin conocimiento del CMS del sitio auditado; una heurística por patrón de URL con bucket "otras" es suficiente y no genera falsa confianza. |
| Schema-contenido mismatch como falla dura del score (`critical` automático) | Detección heurística con riesgo real de falso positivo (contenido renderizado por JS, contenido parcial); igual precedente que CSR/SSR en v1.2 (informational, no penaliza el score). |
| Umbral de profundidad configurable por sitio | Sin demanda de usuario todavía; 3 clics es el estándar de la industria (Semrush, Screaming Frog, Sitebulb). |
| Backfill de auditorías previas a v1.3 con las nuevas features | Las nuevas features aplican solo a auditorías corridas después del deploy de v1.3; no se recalculan auditorías históricas. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEPTH-01 | Phase 16 | Complete |
| DEPTH-02 | Phase 16 | Pending |
| DEPTH-03 | Phase 16 | Complete |
| PERF-05 | Phase 18 | Pending |
| PERF-06 | Phase 18 | Pending |
| TEMPLATE-01 | Phase 19 | Pending |
| TEMPLATE-02 | Phase 19 | Pending |
| SCHEMA-06 | Phase 17 | Pending |
| SCHEMA-07 | Phase 17 | Pending |
| ARCH-01 | Phase 20 | Pending |
| ARCH-02 | Phase 20 | Pending |
| ARCH-03 | Phase 20 | Pending |
| ARCH-04 | Phase 20 | Pending |

**Coverage:**

- v1.3 requirements: 13 total
- Mapped to phases: 13/13
- Unmapped: 0

---
*Requirements defined: 2026-07-08*
