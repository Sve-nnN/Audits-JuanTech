# Roadmap: Auditor Web (SEO/Técnico) — Lead Magnet para juan-tech.com

## Milestones

- ✅ **v1.0 MVP** — Phases 1-7 (shipped 2026-07-06)
- ✅ **v1.1 Overhaul de UI/UX y marca** — Phases 8-10 (shipped 2026-07-06)
- ✅ **v1.2 Detección de renderizado + exportación de reportes** — Phases 11-15 (shipped 2026-07-08)
- 🚧 **v1.3 Profundizar checks técnicos + visualización de arquitectura** — Phases 16-20 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-7) — SHIPPED 2026-07-06</summary>

Construido de adentro hacia afuera: esqueleto de datos + cola → motor de crawler → capas de checks (SEO técnico/on-page → datos estructurados/AEO → rendimiento/CWV) → scoring/diff/reporte → email/cuota como compuerta de lanzamiento.

- [x] Phase 1: Fundamentos — monorepo, esquema de datos y cola (1/1 plans) — completed 2026-07-05
- [x] Phase 2: Motor de crawler (1/1 plans) — completed 2026-07-05
- [x] Phase 3: SEO Técnico + On-Page (1/1 plans) — completed 2026-07-05
- [x] Phase 4: Datos Estructurados + AEO (1/1 plans) — completed 2026-07-05
- [x] Phase 5: Rendimiento / Core Web Vitals (1/1 plans) — completed 2026-07-05
- [x] Phase 6: Scoring, comparación de corridas y reporte (1/1 plans) — completed 2026-07-05
- [x] Phase 7: Verificación de email, cuota y compuerta de lanzamiento (1/1 plans) — completed 2026-07-06

Detalle completo: `.planning/v1.0-MILESTONE-SUMMARY.md`.

</details>

<details>
<summary>✅ v1.1 Overhaul de UI/UX y marca (Phases 8-10) — SHIPPED 2026-07-06</summary>

Overhaul UI-only de fundamentos hacia afuera: fuentes de marca + design system → librería de componentes → pantallas ensambladas con copy humanizado, motion y accesibilidad. No toca la lógica de v1.0.

- [x] Phase 8: Fundamentos de marca — fuentes y design system (5/5 plans) — completed 2026-07-06
- [x] Phase 9: Librería de componentes (6/6 plans) — completed 2026-07-06
- [x] Phase 10: Pantallas rediseñadas, copy, motion y accesibilidad (8/8 plans) — completed 2026-07-06

Detalle completo: `.planning/milestones/v1.1-ROADMAP.md`. Audit: `.planning/milestones/v1.1-MILESTONE-AUDIT.md`.

</details>

<details>
<summary>✅ v1.2 Detección de renderizado + exportación de reportes (Phases 11-15) — SHIPPED 2026-07-08</summary>

Aditivo sobre v1.0/v1.1 — el pipeline validado no se rompe. Secuencia de riesgo ascendente (según research SUMMARY): checks puros primero (canonical + headings, cero infra), luego el pase de render CSR/SSR (única pieza que toca worker + Docker) en aislamiento, después la fundación de export (lecturas puras de datos ya persistidos con libs JS puras, sin Chromium en Vercel), el botón de export como UI fina sobre la route, y por último la agrupación/indicadores del reporte (categoría REPORT nueva, fuera del sketch original de research).

- [x] Phase 11: Checks más profundos (canonical + headings) + fix dato CWV (4/4 plans) — completed 2026-07-07
- [x] Phase 12: Detección de renderizado CSR/SSR (3/3 plans) — completed 2026-07-07
- [x] Phase 13: Fundación de export + serializers (4/4 plans) — completed 2026-07-08
- [x] Phase 14: Botón Exportar (UI) (1/1 plan) — completed 2026-07-08
- [x] Phase 15: UX del reporte — agrupación e indicadores (3/3 plans) — completed 2026-07-08

Detalle completo: `.planning/milestones/v1.2-ROADMAP.md`. Audit: `.planning/milestones/v1.2-MILESTONE-AUDIT.md`.

</details>

### 🚧 v1.3 Profundizar checks técnicos + visualización de arquitectura (Phases 16-20) — IN PROGRESS

Aditivo sobre v1.0-v1.2 — cierra gaps encontrados vs. metodología SEO estándar (comparación contra las skills del diplomado "De Cero a SEO") y agrega visibilidad de arquitectura. Secuencia de riesgo ascendente según research: primero el fundamento compartido de grafo/BFS + check de profundidad (corrige la premisa original de que `Page.depth` sirve tal cual), luego dos checks aislados e independientes entre sí (schema-contenido, más riesgo de falso positivo; diagnósticos PSI, más disciplina de dónde extraer datos), después la agrupación por plantilla (decisión de UI compartida antes de construir sobre ella), y por último el visualizador de arquitectura (mayor superficie nueva, depende del grafo/BFS ya persistido en Phase 16).

- [ ] **Phase 16: Grafo de enlaces compartido + profundidad de clics real** (2 plans) - BFS único persistido en Audit.stats + check de profundidad de clics
- [ ] **Phase 17: Check schema-contenido mismatch** - JSON-LD sin contenido visible correspondiente, cruzado con muestra CSR/SSR
- [ ] **Phase 18: Diagnósticos de Lighthouse desde PSI** - diagnósticos curados extraídos de la respuesta PSI ya pagada
- [ ] **Phase 19: Agrupación por plantilla** - segundo eje de agrupación de issues (home/categoría/producto/artículo)
- [ ] **Phase 20: Visualizador de arquitectura** - árbol jerárquico SVG por profundidad, reusa el grafo de Phase 16

## Phase Details

### Phase 16: Grafo de enlaces compartido + profundidad de clics real
**Goal**: El auditor calcula la profundidad real de clics de cada página sobre un grafo de enlaces internos calculado una sola vez, y advierte cuando hay páginas demasiado profundas.
**Depends on**: Nada (primera fase de v1.3)
**Requirements**: DEPTH-01, DEPTH-02, DEPTH-03
**Success Criteria** (what must be TRUE):
  1. El worker calcula, sobre el grafo de enlaces internos (no sobre `Page.depth`), la profundidad real en clics de cada página vía BFS desde home, y persiste ese cómputo una sola vez por auditoría (en `Audit.stats`).
  2. El reporte muestra un issue de advertencia agregado con el porcentaje de páginas a más de 3 clics de home (no un issue por página individual).
  3. El módulo de grafo/BFS queda disponible como dato ya persistido para ser reusado sin recomputarse por el visualizador de arquitectura (Phase 20).
**Plans**: 2 plans
Plans:
- [ ] 16-01-PLAN.md — Paquete @auditor/graph: buildLinkGraph (BFS de profundidad desde home), TDD
- [ ] 16-02-PLAN.md — Check TECH-12 (issue agregado de profundidad) + wiring del worker, persistencia en Audit.stats.graph

### Phase 17: Check schema-contenido mismatch
**Goal**: El auditor advierte cuando una página declara datos estructurados de alto riesgo sin contenido visible correspondiente, evitando el riesgo de acción manual de Google.
**Depends on**: Nada (independiente, reusa `@auditor/render` de v1.2 ya existente)
**Requirements**: SCHEMA-06, SCHEMA-07
**Success Criteria** (what must be TRUE):
  1. El auditor detecta páginas con JSON-LD `FAQPage`, `HowTo`, `Product`+`AggregateRating` o `Review` sin contenido visible correspondiente en el HTML.
  2. El hallazgo se reporta siempre con severidad `warning` (nunca `critical` automático).
  3. El check no marca como mismatch páginas confirmadas como renderizadas por JS en la muestra CSR/SSR de v1.2, evitando falsos positivos.
**Plans**: TBD

### Phase 18: Diagnósticos de Lighthouse desde PSI
**Goal**: El reporte muestra diagnósticos de Lighthouse accionables (formatos de imagen, CSS/JS sin usar, render-blocking) sin costo extra de API.
**Depends on**: Nada (aislado en `packages/psi`)
**Requirements**: PERF-05, PERF-06
**Success Criteria** (what must be TRUE):
  1. El reporte muestra diagnósticos curados (WebP/AVIF, CSS sin usar, recursos que bloquean el renderizado, compresión de texto, CSS/JS sin minificar) extraídos de la respuesta PSI que el auditor ya obtiene, sin llamadas adicionales a la API.
  2. Cada diagnóstico aparece como issue con severidad `warning`/`ok` (nunca `critical`) y no duplica la señal ya cubierta por las métricas LCP/CLS/TTFB/INP existentes.
**Plans**: TBD

### Phase 19: Agrupación por plantilla
**Goal**: El usuario puede ver qué le pasa a una plantilla de página completa (ej. "producto"), no solo qué tipo de error se repite.
**Depends on**: Nada directamente (decisión de UI compartida antes del visualizador de Phase 20)
**Requirements**: TEMPLATE-01, TEMPLATE-02
**Success Criteria** (what must be TRUE):
  1. Cada página del sitio queda clasificada en una plantilla (home / categoría / producto / artículo / otras) mediante heurística de segmentos de URL, sin asumir un CMS específico.
  2. El reporte permite ver los issues agrupados por plantilla, como eje complementario a la agrupación por tipo de issue ya existente (v1.2).
**Plans**: TBD
**UI hint**: yes

### Phase 20: Visualizador de arquitectura
**Goal**: El usuario puede ver de un vistazo la arquitectura jerárquica de su sitio, con señales de profundidad, páginas huérfanas y plantilla por nodo.
**Depends on**: Phase 16 (grafo/BFS compartido y persistido)
**Requirements**: ARCH-01, ARCH-02, ARCH-03, ARCH-04
**Success Criteria** (what must be TRUE):
  1. El reporte incluye un árbol jerárquico en SVG puro, agrupado por nivel de profundidad (0/1/2/3+).
  2. Cada nodo del árbol muestra URL/título, profundidad, indicador de página huérfana e indicador de página a más de 3 clics.
  3. El árbol reusa el grafo/BFS ya calculado y persistido en Phase 16, sin volver a parsear el HTML de las páginas.
  4. Cuando la clasificación de plantilla (Phase 19) ya está disponible, el nodo también muestra la plantilla de esa página.
**Plans**: TBD
**UI hint**: yes

### 📋 Next (Planned)

Próximo trabajo previsto tras v1.3 (scope por definir vía `/gsd:new-milestone`):

- Deploy a producción: web → Vercel; worker → Railway/VPS; Resend con dominio verificado; revisión GDPR ligera.
- v2 monetización: planes de pago, auditorías/URLs ilimitadas, Stripe.
- v2 enriquecimiento: agrupación por plantilla del veredicto CSR/SSR (RENDER-04), re-crawl basado en render (RENDER-05), formatos extra de export DOCX/CSV (EXPORT-06), columna persistida `Page.renderVerdict` (REPORT-05), Domain Rating como contexto.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Fundamentos — monorepo, esquema de datos y cola | v1.0 | 1/1 | Complete ✅ | 2026-07-05 |
| 2. Motor de crawler | v1.0 | 1/1 | Complete ✅ | 2026-07-05 |
| 3. SEO Técnico + On-Page | v1.0 | 1/1 | Complete ✅ | 2026-07-05 |
| 4. Datos Estructurados + AEO | v1.0 | 1/1 | Complete ✅ | 2026-07-05 |
| 5. Rendimiento / Core Web Vitals | v1.0 | 1/1 | Complete ✅ | 2026-07-05 |
| 6. Scoring, comparación de corridas y reporte | v1.0 | 1/1 | Complete ✅ | 2026-07-05 |
| 7. Verificación de email, cuota y compuerta de lanzamiento | v1.0 | 1/1 | Complete ✅ | 2026-07-06 |
| 8. Fundamentos de marca — fuentes y design system | v1.1 | 5/5 | Complete ✅ | 2026-07-06 |
| 9. Librería de componentes | v1.1 | 6/6 | Complete ✅ | 2026-07-06 |
| 10. Pantallas rediseñadas, copy, motion y accesibilidad | v1.1 | 8/8 | Complete ✅ | 2026-07-06 |
| 11. Checks más profundos (canonical + headings) + fix dato CWV | v1.2 | 4/4 | Complete ✅ | 2026-07-07 |
| 12. Detección de renderizado CSR/SSR | v1.2 | 3/3 | Complete ✅ | 2026-07-07 |
| 13. Fundación de export + serializers | v1.2 | 4/4 | Complete ✅ | 2026-07-08 |
| 14. Botón Exportar (UI) | v1.2 | 1/1 | Complete ✅ | 2026-07-08 |
| 15. UX del reporte — agrupación e indicadores | v1.2 | 3/3 | Complete ✅ | 2026-07-08 |
| 16. Grafo de enlaces compartido + profundidad de clics real | v1.3 | 0/? | Not started | - |
| 17. Check schema-contenido mismatch | v1.3 | 0/? | Not started | - |
| 18. Diagnósticos de Lighthouse desde PSI | v1.3 | 0/? | Not started | - |
| 19. Agrupación por plantilla | v1.3 | 0/? | Not started | - |
| 20. Visualizador de arquitectura | v1.3 | 0/? | Not started | - |

---
*Roadmap created: 2026-07-05*
*Granularity: standard (7 phases v1.0 + 3 phases v1.1 + 5 phases v1.2 + 5 phases v1.3)*
*v1.0 MVP shipped: 2026-07-06 (phases 1-7)*
*v1.1 UI/UX shipped: 2026-07-06 (phases 8-10)*
*v1.2 render + exports shipped: 2026-07-08 (phases 11-15) — coverage 19/19 requirements*
*v1.3 roadmap created: 2026-07-08 (phases 16-20) — coverage 13/13 requirements*
