# Roadmap: Auditor Web (SEO/Técnico) — Lead Magnet para juan-tech.com

## Milestones

- ✅ **v1.0 MVP** — Phases 1-7 (shipped 2026-07-06)
- ✅ **v1.1 Overhaul de UI/UX y marca** — Phases 8-10 (shipped 2026-07-06)
- ✅ **v1.2 Detección de renderizado + exportación de reportes** — Phases 11-15 (shipped 2026-07-08)
- ✅ **v1.3 Profundizar checks técnicos + visualización de arquitectura** — Phases 16-20 (shipped 2026-07-09)
- ✅ **v1.4 Visualización avanzada + resolución de URL** — Phases 21-24 (shipped 2026-07-10)
- ✅ **v1.5 Fingerprinting técnico + fixes personalizados por CMS** — Phases 25-27 (shipped 2026-07-25)
- ⚠️ **v1.6 Meta Tags / Social** — Phases 28-32 (shipped 2026-08-06, 2 fases con verificación humana diferida — ver audit)

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

<details>
<summary>✅ v1.3 Profundizar checks técnicos + visualización de arquitectura (Phases 16-20) — SHIPPED 2026-07-09</summary>

Aditivo sobre v1.0-v1.2 — cierra gaps encontrados vs. metodología SEO estándar (comparación contra las skills del diplomado "De Cero a SEO") y agrega visibilidad de arquitectura. Secuencia de riesgo ascendente según research: primero el fundamento compartido de grafo/BFS + check de profundidad (corrige la premisa original de que `Page.depth` sirve tal cual), luego dos checks aislados e independientes entre sí (schema-contenido, más riesgo de falso positivo; diagnósticos PSI, más disciplina de dónde extraer datos), después la agrupación por plantilla (decisión de UI compartida antes de construir sobre ella), y por último el visualizador de arquitectura (mayor superficie nueva, depende del grafo/BFS ya persistido en Phase 16).

- [x] **Phase 16: Grafo de enlaces compartido + profundidad de clics real** (2/2 plans) — completed 2026-07-08
- [x] **Phase 17: Check schema-contenido mismatch** (2/2 plans) — completed 2026-07-09
- [x] **Phase 18: Diagnósticos de Lighthouse desde PSI** (2/2 plans) — completed 2026-07-09
- [x] **Phase 19: Agrupación por plantilla** (2/2 plans) — completed 2026-07-09
- [x] **Phase 20: Visualizador de arquitectura** (3/3 plans) — completed 2026-07-09

Detalle completo: `.planning/MILESTONES.md`.

</details>

<details>
<summary>✅ v1.4 Visualización avanzada + resolución de URL (Phases 21-24) — SHIPPED 2026-07-10</summary>

Origen: feedback directo de Juan durante la validación visual de v1.3 (2026-07-09), con capturas de referencia de Octopus.do (árbol) y Classy Schema (grafo/validación JSON-LD). Milestone design-heavy: tres de las cuatro fases son visualizaciones que Juan iteró hasta que el look fue correcto. Secuencia de riesgo ascendente: primero el único bloque backend puro (resolución canónica de URL, sin UI, corrige aguas arriba la mitigación puntual de v1.3), luego el rework del árbol de arquitectura (superficie SVG conocida + jerarquía real desde edges ya persistidos), después el rework acotado del grafo JSON-LD radial (un solo componente), y por último la pieza más pesada (código + validación por propiedad contra schema.org, toca `packages/checks` + UI).

- [x] Phase 21: Resolución canónica de la URL de entrada — resuelve https/http + redirects del home antes de crawlear, origin único en todo el pipeline (backend, sin UI) (3/3 plans) — completed 2026-07-09
- [x] Phase 22: Árbol de arquitectura estilo octopus — dendrograma jerárquico + mapa navegable (zoom/pan/fullscreen/export), aprobado por Juan (3/3 plans) — completed 2026-07-09
- [x] Phase 23: Grafo JSON-LD con layout radial — árbol radial estilo Classy Schema (root al centro, anillos por profundidad, color por @type), aprobado por Juan (1/1 plans) — completed 2026-07-09
- [x] Phase 24: Código + validación JSON-LD estilo Classy Schema — JSON-LD formateado por entidad + validación por propiedad/tipo contra schema.org, aprobado por Juan (3/3 plans) — completed 2026-07-10

Detalle completo: `.planning/milestones/v1.4-ROADMAP.md`. Audit: `.planning/milestones/v1.4-MILESTONE-AUDIT.md`.

</details>

<details>
<summary>✅ v1.5 Fingerprinting técnico + fixes personalizados por CMS (Phases 25-27) — SHIPPED 2026-07-25</summary>

Aditivo sobre v1.0-v1.4 — no toca el pipeline de crawl/checks/scoring existente. Secuencia de riesgo ascendente: primero el contrato de datos completo del fingerprint (tipos con `confidence`, captura de headers/cookies sin requests extra, motor de detección por eje independiente), luego el wiring end-to-end mínimo (worker + tabla en el reporte), y por último el motor de recomendaciones por CMS (patrón adaptador + fallback en cadena), el diferenciador central del milestone.

- [x] Phase 25: Fingerprint de stack técnico — contrato de datos y motor de detección (4/4 plans) — completed 2026-07-21
- [x] Phase 26: Wiring en el worker + tabla de stack en el reporte (5/5 plans) — completed 2026-07-22
- [x] Phase 27: Motor de recomendaciones por CMS — patrón adaptador + fallback (3/3 plans) — completed 2026-07-25

Detalle completo: `.planning/milestones/v1.5-ROADMAP.md`. Audit: `.planning/milestones/v1.5-MILESTONE-AUDIT.md`.

</details>

<details>
<summary>⚠️ v1.6 Meta Tags / Social (Phases 28-32) — SHIPPED 2026-08-06 (gaps_found — 2 fases con verificación humana diferida)</summary>

Aditivo sobre v1.0-v1.5 — no toca el pipeline de crawl/checks/scoring existente salvo por el rebalanceo de pesos explícito de este mismo milestone. Secuencia de riesgo ascendente según research, con un reordenamiento pedido por Juan sobre la propuesta original: primero la única pieza que toca `crawl.ts` (performance por página, aislada porque ningún milestone anterior lo había modificado), luego la decisión de scoring (categoría "social" + retiro de ONPAGE-05) *antes* de escribir los checks nuevos, después los checks de meta/social en sí, luego la validación de red de `og:image`, y por último el panel de preview visual + snippets de fix.

- [ ] Phase 28: Performance por página — Response time + HTML size medidos en el crawl, con umbrales de severidad (2/3 plans) — código completo, verificación humana diferida (`/gsd-verify-work 28`)
- [x] Phase 29: Scoring — categoría Social + retiro de ONPAGE-05 (4/4 plans) — completed 2026-08-01
- [x] Phase 30: Checks de meta tags/social (6/6 plans) — completed 2026-08-03
- [x] Phase 31: Validación de og:image (5/5 plans) — completed 2026-08-03
- [ ] Phase 32: Panel de preview social + snippets de fix (4/4 plans) — 4/4 must-haves verificados por código, verificación visual/de red diferida (`/gsd-verify-work 32`)

Detalle completo: `.planning/milestones/v1.6-ROADMAP.md`. Audit: `.planning/milestones/v1.6-MILESTONE-AUDIT.md`.

</details>

## Next

Sin milestone en curso. Trabajo previsto:

- Resolver los 2 checkpoints de verificación humana diferidos de v1.6 (Fase 28, Fase 32) — `/gsd-verify-work 28`, `/gsd-verify-work 32`.
- Definir el próximo milestone con `/gsd-new-milestone` (deploy a producción, v2 monetización, o lo diferido explícitamente en v1.6.x/v1.7 — ver `.planning/BACKLOG.md` y `STATE.md` → Deferred Items).

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
| 16. Grafo de enlaces compartido + profundidad de clics real | v1.3 | 2/2 | Complete ✅ | 2026-07-08 |
| 17. Check schema-contenido mismatch | v1.3 | 2/2 | Complete ✅ | 2026-07-09 |
| 18. Diagnósticos de Lighthouse desde PSI | v1.3 | 2/2 | Complete ✅ | 2026-07-09 |
| 19. Agrupación por plantilla | v1.3 | 2/2 | Complete ✅ | 2026-07-09 |
| 20. Visualizador de arquitectura | v1.3 | 3/3 | Complete ✅ | 2026-07-09 |
| 21. Resolución canónica de la URL de entrada | v1.4 | 3/3 | Complete ✅ | 2026-07-09 |
| 22. Árbol de arquitectura estilo octopus | v1.4 | 3/3 | Complete ✅ | 2026-07-09 |
| 23. Grafo JSON-LD con layout radial | v1.4 | 1/1 | Complete ✅ | 2026-07-09 |
| 24. Código + validación JSON-LD estilo Classy Schema | v1.4 | 3/3 | Complete ✅ | 2026-07-10 |
| 25. Fingerprint de stack técnico — contrato de datos y motor de detección | v1.5 | 4/4 | Complete ✅ | 2026-07-21 |
| 26. Wiring en el worker + tabla de stack en el reporte | v1.5 | 5/5 | Complete ✅ | 2026-07-22 |
| 27. Motor de recomendaciones por CMS — patrón adaptador + fallback | v1.5 | 3/3 | Complete ✅ | 2026-07-25 |
| 28. Performance por página | v1.6 | 2/3 | Deferred ⚠️ (verificación humana) | — |
| 29. Scoring — categoría Social + retiro de ONPAGE-05 | v1.6 | 4/4 | Complete ✅ | 2026-08-01 |
| 30. Checks de meta tags/social | v1.6 | 6/6 | Complete ✅ | 2026-08-03 |
| 31. Validación de og:image | v1.6 | 5/5 | Complete ✅ | 2026-08-03 |
| 32. Panel de preview social + snippets de fix | v1.6 | 4/4 | Deferred ⚠️ (verificación humana) | — |

---
*Roadmap created: 2026-07-05*
*Granularity: standard (7 phases v1.0 + 3 phases v1.1 + 5 phases v1.2 + 5 phases v1.3 + 4 phases v1.4 + 3 phases v1.5 + 5 phases v1.6)*
*v1.0 MVP shipped: 2026-07-06 (phases 1-7)*
*v1.1 UI/UX shipped: 2026-07-06 (phases 8-10)*
*v1.2 render + exports shipped: 2026-07-08 (phases 11-15) — coverage 19/19 requirements*
*v1.3 checks + arquitectura shipped: 2026-07-09 (phases 16-20) — coverage 13/13 requirements*
*v1.4 visualización avanzada + resolución de URL shipped: 2026-07-10 (phases 21-24) — coverage 7/7 requirements*
*v1.5 fingerprinting + fixes por CMS shipped: 2026-07-25 (phases 25-27) — coverage 18/18 requirements*
*v1.6 Meta Tags / Social shipped: 2026-08-06 (phases 28-32) — coverage 21/24 requirements verified, 3/24 (PAGEPERF-01..03) con verificación humana diferida*
