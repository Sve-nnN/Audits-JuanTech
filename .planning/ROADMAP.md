# Roadmap: Auditor Web (SEO/Técnico) — Lead Magnet para juan-tech.com

## Milestones

- ✅ **v1.0 MVP** — Phases 1-7 (shipped 2026-07-06)
- ✅ **v1.1 Overhaul de UI/UX y marca** — Phases 8-10 (shipped 2026-07-06)
- ✅ **v1.2 Detección de renderizado + exportación de reportes** — Phases 11-15 (shipped 2026-07-08)
- ✅ **v1.3 Profundizar checks técnicos + visualización de arquitectura** — Phases 16-20 (shipped 2026-07-09)
- ✅ **v1.4 Visualización avanzada + resolución de URL** — Phases 21-24 (shipped 2026-07-10)
- 🚧 **v1.5 Fingerprinting técnico + fixes personalizados por CMS** — Phases 25-27 (in progress)

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

### Phase 16: Grafo de enlaces compartido + profundidad de clics real

**Goal**: El auditor calcula la profundidad real de clics de cada página sobre un grafo de enlaces internos calculado una sola vez, y advierte cuando hay páginas demasiado profundas.
**Depends on**: Nada (primera fase de v1.3)
**Requirements**: DEPTH-01, DEPTH-02, DEPTH-03
**Success Criteria** (what must be TRUE):

  1. El worker calcula, sobre el grafo de enlaces internos (no sobre `Page.depth`), la profundidad real en clics de cada página vía BFS desde home, y persiste ese cómputo una sola vez por auditoría (en `Audit.stats`).
  2. El reporte muestra un issue de advertencia agregado con el porcentaje de páginas a más de 3 clics de home (no un issue por página individual).
  3. El módulo de grafo/BFS queda disponible como dato ya persistido para ser reusado sin recomputarse por el visualizador de arquitectura (Phase 20).

**Plans**: 2 plans (completed)

### Phase 17: Check schema-contenido mismatch

**Goal**: El auditor advierte cuando una página declara datos estructurados de alto riesgo sin contenido visible correspondiente, evitando el riesgo de acción manual de Google.
**Depends on**: Nada (independiente, reusa `@auditor/render` de v1.2 ya existente)
**Requirements**: SCHEMA-06, SCHEMA-07
**Success Criteria** (what must be TRUE):

  1. El auditor detecta páginas con JSON-LD `FAQPage`, `HowTo`, `Product`+`AggregateRating` o `Review` sin contenido visible correspondiente en el HTML.
  2. El hallazgo se reporta siempre con severidad `warning` (nunca `critical` automático).
  3. El check no marca como mismatch páginas confirmadas como renderizadas por JS en la muestra CSR/SSR de v1.2, evitando falsos positivos.

**Plans**: 2 plans (completed)

### Phase 18: Diagnósticos de Lighthouse desde PSI

**Goal**: El reporte muestra diagnósticos de Lighthouse accionables (formatos de imagen, CSS/JS sin usar, render-blocking) sin costo extra de API.
**Depends on**: Nada (aislado en `packages/psi`)
**Requirements**: PERF-05, PERF-06
**Success Criteria** (what must be TRUE):

  1. El reporte muestra diagnósticos curados (WebP/AVIF, CSS sin usar, recursos que bloquean el renderizado, compresión de texto, CSS/JS sin minificar) extraídos de la respuesta PSI que el auditor ya obtiene, sin llamadas adicionales a la API.
  2. Cada diagnóstico aparece como issue con severidad `warning`/`ok` (nunca `critical`) y no duplica la señal ya cubierta por las métricas LCP/CLS/TTFB/INP existentes.

**Plans**: 2 plans (completed)

### Phase 19: Agrupación por plantilla

**Goal**: El usuario puede ver qué le pasa a una plantilla de página completa (ej. "producto"), no solo qué tipo de error se repite.
**Depends on**: Nada directamente (decisión de UI compartida antes del visualizador de Phase 20)
**Requirements**: TEMPLATE-01, TEMPLATE-02
**Success Criteria** (what must be TRUE):

  1. Cada página del sitio queda clasificada en una plantilla (home / categoría / producto / artículo / otras) mediante heurística de segmentos de URL, sin asumir un CMS específico.
  2. El reporte permite ver los issues agrupados por plantilla, como eje complementario a la agrupación por tipo de issue ya existente (v1.2).

**Plans**: 2 plans (completed)

### Phase 20: Visualizador de arquitectura

**Goal**: El usuario puede ver de un vistazo la arquitectura jerárquica de su sitio, con señales de profundidad, páginas huérfanas y plantilla por nodo.
**Depends on**: Phase 16 (grafo/BFS compartido y persistido)
**Requirements**: ARCH-01, ARCH-02, ARCH-03, ARCH-04
**Success Criteria** (what must be TRUE):

  1. El reporte incluye un árbol jerárquico en SVG puro, agrupado por nivel de profundidad (0/1/2/3+).
  2. Cada nodo del árbol muestra URL/título, profundidad, indicador de página huérfana e indicador de página a más de 3 clics.
  3. El árbol reusa el grafo/BFS ya calculado y persistido en Phase 16, sin volver a parsear el HTML de las páginas.
  4. Cuando la clasificación de plantilla (Phase 19) ya está disponible, el nodo también muestra la plantilla de esa página.

**Plans**: 3 plans (completed)
**UI hint**: yes

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

### 🚧 v1.5 Fingerprinting técnico + fixes personalizados por CMS (Phases 25-27) - In Progress

**Milestone Goal:** Detectar el stack técnico del sitio auditado (CMS, builder si es WordPress, CDN/proxy, hosting/servidor, framework JS, analytics/tag manager) vía fingerprint propio (headers HTTP, HTML, paths conocidos — sin servicios pagos de terceros), mostrarlo como tabla al inicio del reporte apenas termina el escaneo, y usar ese stack detectado para generar recomendaciones de fix personalizadas por issue, con fallback genérico para el resto de plataformas.

Aditivo sobre v1.0-v1.4 — no toca el pipeline de crawl/checks/scoring existente. Secuencia de riesgo ascendente según research (ARCHITECTURE.md/SUMMARY.md): primero el contrato de datos completo del fingerprint (tipos con `confidence`, captura de headers/cookies sin requests extra, motor de detección por eje independiente) porque cambiarlo después obliga a retocar cada adaptador y cada UI consumidora; luego el wiring end-to-end mínimo (worker + tabla en el reporte) para validar que la detección produce resultados útiles y visibles *antes* de invertir en la pieza más costosa; y por último el motor de recomendaciones por CMS (patrón adaptador + fallback en cadena), el diferenciador central del milestone.

- [ ] **Phase 25: Fingerprint de stack técnico — contrato de datos y motor de detección** - Detecta CMS+builder/CDN/hosting/framework/analytics con confianza tipada por eje, nunca winner-take-all
- [ ] **Phase 26: Wiring en el worker + tabla de stack en el reporte** - Persiste el stack detectado una vez por auditoría y lo muestra en una tabla tokens-only al inicio del reporte
- [ ] **Phase 27: Motor de recomendaciones por CMS — patrón adaptador + fallback** - Reescribe el fix de los checks de mayor volumen según el CMS/builder detectado, con fallback genérico garantizado

## Phase Details

### Phase 25: Fingerprint de stack técnico — contrato de datos y motor de detección

**Goal**: El sistema puede determinar, a partir de headers/cookies/HTML ya capturados durante el crawl (sin requests adicionales), el stack técnico de un sitio —CMS+builder, CDN/proxy, hosting, framework JS, analytics— con un nivel de confianza tipado por eje, sin nunca forzar una respuesta cuando la señal es insuficiente.
**Depends on**: Nada (primera fase de v1.5; se apoya en el pipeline de crawl ya existente de v1.0-v1.4)
**Requirements**: FPRINT-01, FPRINT-02, FPRINT-03, FPRINT-04, FPRINT-05, FPRINT-06, FPRINT-07, FPRINT-08
**Success Criteria** (what must be TRUE):

  1. Dado el HTML/headers/cookies ya capturados de una página crawleada (sin llamadas HTTP adicionales), el sistema devuelve un stack detectado tipado con nivel de confianza (alto/medio/bajo/no-detectado) por eje: CMS, builder (si WordPress), CDN/proxy, hosting, framework JS y analytics.
  2. Para instalaciones WordPress con Elementor, WPBakery, Divi o el editor nativo (Gutenberg), el sistema identifica el builder correcto mediante marcadores propios de cada uno (Gutenberg vía regla positiva explícita, nunca como "default" implícito).
  3. Ante señal insuficiente (sitio headless/JAMstack, meta generator removido, CDN que oculta headers de origen), el sistema devuelve "no detectado con certeza" en el eje correspondiente en lugar de forzar una respuesta incorrecta.
  4. Cada eje de detección es independiente entre sí (nunca winner-take-all) y se apoya en más de una señal (headers + cookies + paths de assets), no solo en un header de servidor.

**Plans**: 3/4 plans executed

Plans:

- [x] 25-01-PLAN.md — Scaffold `@auditor/fingerprint` + contrato de datos (DetectedStack/AxisResult/Confidence/Signature/PageFingerprintInput) [wave 1]
- [x] 25-02-PLAN.md — Captura de headers curados + nombres de cookie en el crawler + columnas Page.responseHeaders/cookieNames + db:push [wave 1]
- [x] 25-03-PLAN.md — Registry de signatures por eje (cms/builder/cdn/hosting/jsFramework/analytics) [wave 2]
- [ ] 25-04-PLAN.md — Motor detectStack + suite de tests por eje (FPRINT-02..08) + QA contra sitios reales [wave 3]

### Phase 26: Wiring en el worker + tabla de stack en el reporte

**Goal**: El usuario ve, apenas termina el escaneo, una tabla del stack técnico detectado de su sitio, consistente con el design system existente, calculada una sola vez por auditoría.
**Depends on**: Phase 25 (tipos `DetectedStack` y motor de detección)
**Requirements**: FPRINT-09, STACKUI-01, STACKUI-02, STACKUI-03
**Success Criteria** (what must be TRUE):

  1. El worker invoca la detección de stack una sola vez por auditoría (después del crawl) y persiste el resultado asociado a la auditoría; abrir el reporte varias veces no vuelve a ejecutar la detección.
  2. El reporte muestra una tabla "Stack técnico detectado" visible apenas termina el escaneo, al inicio del reporte, antes del resto de las secciones de contenido.
  3. La tabla lista cada categoría detectada (CMS+builder, CDN/proxy, hosting, framework JS, analytics) junto a su nivel de confianza, incluyendo un estado visual explícito para "no detectado con certeza".
  4. La tabla se construye enteramente con tokens del design system existente (cero hex hardcodeado) y se ve correctamente en tema claro y oscuro.

**Plans**: TBD
**UI hint**: yes

### Phase 27: Motor de recomendaciones por CMS — patrón adaptador + fallback

**Goal**: Los issues de los checks de mayor volumen (alt text, title/meta, H1, Open Graph, canonical, JSON-LD, sitemap/robots.txt) muestran instrucciones de fix personalizadas según el CMS y builder detectados del sitio auditado, con un fallback genérico garantizado cuando no aplica un adaptador específico.
**Depends on**: Phase 25 (tipo `DetectedStack` con builder incluido). Se recomienda ejecutar después de Phase 26 para validar el fingerprint end-to-end antes de invertir en el motor de recomendaciones (ver research SUMMARY.md), aunque no es una dependencia técnica dura.
**Requirements**: CMSFIX-01, CMSFIX-02, CMSFIX-03, CMSFIX-04, CMSFIX-05
**Success Criteria** (what must be TRUE):

  1. Existe un adaptador por plataforma (WordPress —con resolución en cadena builder→plataforma→genérico—, Shopify, Webflow, Wix/Squarespace combinado) que implementa una interfaz común para resolver el texto de fix de un check dado.
  2. Cuando no hay CMS detectado con confianza suficiente, o no existe adaptador para la plataforma detectada, el sistema usa siempre el fallback genérico (ningún issue queda sin recomendación).
  3. Los issues de alt text, title/meta, H1, Open Graph, canonical, JSON-LD/datos estructurados y sitemap/robots.txt muestran una instrucción de fix específica del CMS (y del builder, cuando es WordPress) detectado para ese sitio.
  4. Los checks fuera de esa lista (hreflang, mixed content, enlaces rotos, profundidad de clics, etc.) siguen mostrando exactamente la misma recomendación genérica que antes de este milestone, sin regresión.
  5. La recomendación personalizada se resuelve al construir el modelo de reporte (no se persiste pre-calculada en la base de datos), por lo que aparece también en las exportaciones PDF/Markdown/PPTX sin cambios adicionales en el módulo de export.

**Plans**: TBD

### 📋 Next (Planned)

Próximo trabajo previsto tras v1.5:

- Deploy a producción: web → Vercel; worker → Railway/VPS; Resend con dominio verificado; revisión GDPR ligera.
- v2 monetización: planes de pago, auditorías/URLs ilimitadas, Stripe.
- v2 enriquecimiento: agrupación por plantilla del veredicto CSR/SSR (RENDER-04), re-crawl basado en render (RENDER-05), formatos extra de export DOCX/CSV (EXPORT-06), columna persistida `Page.renderVerdict` (REPORT-05), Domain Rating como contexto, fingerprint extendido (FPRINT-10..14) y fixes extendidos (CMSFIX-06/07) — ver `.planning/REQUIREMENTS.md`.

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
| 25. Fingerprint de stack técnico — contrato de datos y motor de detección | v1.5 | 3/4 | In Progress|  |
| 26. Wiring en el worker + tabla de stack en el reporte | v1.5 | 0/TBD | Not started | - |
| 27. Motor de recomendaciones por CMS — patrón adaptador + fallback | v1.5 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-07-05*
*Granularity: standard (7 phases v1.0 + 3 phases v1.1 + 5 phases v1.2 + 5 phases v1.3 + 4 phases v1.4 + 3 phases v1.5)*
*v1.0 MVP shipped: 2026-07-06 (phases 1-7)*
*v1.1 UI/UX shipped: 2026-07-06 (phases 8-10)*
*v1.2 render + exports shipped: 2026-07-08 (phases 11-15) — coverage 19/19 requirements*
*v1.3 checks + arquitectura shipped: 2026-07-09 (phases 16-20) — coverage 13/13 requirements*
*v1.4 visualización avanzada + resolución de URL shipped: 2026-07-10 (phases 21-24) — coverage 7/7 requirements*
*v1.5 roadmap created: 2026-07-21 (phases 25-27) — coverage 17/17 requirements mapped, pending execution*
