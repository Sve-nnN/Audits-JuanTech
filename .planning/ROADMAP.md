# Roadmap: Auditor Web (SEO/Técnico) — Lead Magnet para juan-tech.com

## Milestones

- ✅ **v1.0 MVP** — Phases 1-7 (shipped 2026-07-06)
- ✅ **v1.1 Overhaul de UI/UX y marca** — Phases 8-10 (shipped 2026-07-06)
- ✅ **v1.2 Detección de renderizado + exportación de reportes** — Phases 11-15 (shipped 2026-07-08)
- ✅ **v1.3 Profundizar checks técnicos + visualización de arquitectura** — Phases 16-20 (shipped 2026-07-09)
- ✅ **v1.4 Visualización avanzada + resolución de URL** — Phases 21-24 (shipped 2026-07-10)
- ✅ **v1.5 Fingerprinting técnico + fixes personalizados por CMS** — Phases 25-27 (shipped 2026-07-25)
- 🚧 **v1.6 Meta Tags / Social** — Phases 28-32 (in progress)

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

### 🚧 v1.6 Meta Tags / Social (Phases 28-32) - In Progress

**Milestone Goal:** Nueva categoría de score "Meta Tags/Social" que audita Open Graph/Twitter Card/charset por página, con panel visual de preview social (Google/Facebook/LinkedIn/X), métricas de performance propias (response time/HTML size) y snippets de fix listos para copiar.

Aditivo sobre v1.0-v1.5 — no toca el pipeline de crawl/checks/scoring existente salvo por el rebalanceo de pesos explícito de este mismo milestone. Secuencia de riesgo ascendente según research (`.planning/research/SUMMARY.md`), con un reordenamiento pedido por Juan sobre la propuesta original: primero la única pieza que toca `crawl.ts` (performance por página, aislada porque ningún milestone anterior lo había modificado), luego la decisión de scoring (categoría "social" + retiro de ONPAGE-05) *antes* de escribir los checks nuevos — para no construir checks contra un modelo de scoring que cambia bajo ellos —, después los checks de meta/social en sí (motor puro + checks de página), luego la validación de red de `og:image` (infra nueva, mismo patrón de dedupe+cap+concurrencia que `linkChecker.ts`/`brokenResourcesCheck`), y por último el panel de preview visual + snippets de fix, que consumen los resultados de las dos fases anteriores.

- [ ] **Phase 28: Performance por página** - Response time + HTML size medidos en el crawl, con umbrales de severidad
- [ ] **Phase 29: Scoring — categoría Social + retiro de ONPAGE-05** - Sexta categoría de score con pesos rebalanceados, ONPAGE-05 retirado sin duplicados
- [ ] **Phase 30: Checks de meta tags/social** - OG/Twitter Card/charset/duplicados por página
- [ ] **Phase 31: Validación de og:image** - Fetcher dedupeado, alcanzabilidad, dimensiones y peso
- [ ] **Phase 32: Panel de preview social + snippets de fix** - Preview Google/Facebook/LinkedIn/X + snippet HTML copiable

## Phase Details

### Phase 28: Performance por página

**Goal**: El crawler mide y persiste el tiempo de respuesta y el tamaño del HTML de cada página auditada, sin requests adicionales, y el auditor advierte cuando alguno de los dos supera el umbral esperado.
**Depends on**: Nada (primera fase de v1.6; toca únicamente `packages/crawler/src/crawl.ts` y el schema de `Page`, el único componente que ningún milestone anterior había modificado)
**Requirements**: PAGEPERF-01, PAGEPERF-02, PAGEPERF-03
**Success Criteria** (what must be TRUE):

  1. Cada página crawleada persiste su tiempo de respuesta (ms) y su tamaño de HTML (bytes), capturados durante el mismo request del crawl, sin llamadas HTTP extra.
  2. Una página con tiempo de respuesta superior a 1500ms o HTML superior a 300KB genera un issue de severidad error; entre 600-1500ms o 100-300KB, un issue de severidad warning.
  3. Un re-crawl de un sitio ya auditado en milestones anteriores sigue completando sin timeouts ni regresiones (smoke test contra un sitio real).

**Plans**: 2/3 plans executed
Plans:
**Wave 1**

- [x] 28-01-PLAN.md — Slice de punta a punta: columnas `Page.responseMs`/`htmlBytes`, helper `extractPageMetrics`, cableado en el upsert y check PERF-10 registrado

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 28-02-PLAN.md — Check PERF-11 (tamaño de HTML) más guardarraíles de colisión de checkId y de contenido del registry

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 28-03-PLAN.md — Script `verify-pageperf.mts`, `pnpm db:push` y smoke test de re-crawl (SC#3)

**Nota de severidad**: el enum real es `IssueSeverity { critical, warning, ok }`; "error" del criterio 2 mapea a `critical`.
**UI hint**: no

### Phase 29: Scoring — categoría Social + retiro de ONPAGE-05

**Goal**: El score general reconoce una sexta categoría "Meta Tags/Social" con pesos rebalanceados explícitamente, y el check ONPAGE-05 (ahora redundante con la categoría nueva) se retira sin duplicar issues.
**Depends on**: Nada directamente (cambio de tipos/constantes en `packages/scoring` y en el registry de `packages/checks`; independiente de Phase 28, se secuencia antes de Phase 30 para no escribir checks contra un modelo de scoring que todavía puede cambiar)
**Requirements**: SCORE-01, SCORE-02, SOCIAL-09
**Success Criteria** (what must be TRUE):

  1. El modelo de scoring reconoce `"social"` como categoría válida y los pesos de las 6 categorías (técnico, on-page, CWV, datos estructurados, AEO, social) suman 1.0, con on-page (.15→.10) y datos estructurados (.10→.05) reducidos explícitamente para cederle peso a social (.10 nuevo).
  2. El check `ONPAGE-05` ya no está activo en el catálogo de checks; ninguna auditoría nueva produce issues duplicados (mismo fingerprint) entre `onpage` y `social` para la misma señal de Open Graph.
  3. El cambio de catálogo de checks queda documentado como corte de versión: los scores de auditorías previas a v1.6 no son directamente comparables con los posteriores.

**Plans**: 4/4 plans executed

Plans:
**Wave 1**

- [x] 29-01-PLAN.md — Tracer: la categoría `social` de punta a punta (union `Category`, pesos rebalanceados, fan-out de compilación cerrado) + endurecimiento de los tests de peso
- [x] 29-02-PLAN.md — Retiro de ONPAGE-05: guardarrailes negativos en rojo, luego borrado del módulo y limpieza del barrel

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 29-03-PLAN.md — Guardarrailes de exhaustividad de `CATEGORY_ORDER` en report-model, export y apps/web

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 29-04-PLAN.md — Corte de versión registrado en PROJECT.md + gate de fase (typecheck y suite completos, sin caché)

**UI hint**: no

### Phase 30: Checks de meta tags/social

**Goal**: El auditor detecta y reporta, por página, los problemas de Open Graph, Twitter Card, charset y duplicados de tags que afectan cómo se ve el sitio al compartirse.
**Depends on**: Phase 29 (la categoría `social` y el retiro de ONPAGE-05 ya deben existir en el modelo de scoring antes de que estos checks aterricen ahí)
**Requirements**: SOCIAL-01, SOCIAL-02, SOCIAL-03, SOCIAL-04, SOCIAL-05, SOCIAL-06, SOCIAL-07, SOCIAL-08
**Success Criteria** (what must be TRUE):

  1. El auditor extrae de cada página, a partir del mismo HTML ya parseado por el crawl (sin segundo parseo), og:title/description/image/url/type, twitter:card y charset, vía un motor puro testeable con fixtures.
  2. El auditor genera issues de presencia/longitud para og:title (10-60 chars), og:description (55-200 chars), og:image (URL absoluta HTTPS) y og:url (coherente con canonical), y de presencia para og:type.
  3. El auditor detecta tags OG duplicados con valores distintos (mismo `property`) y marca twitter:card ausente o con valor inválido, evaluando el resto de twitter:* como error sólo cuando falta también el equivalente OG (regla anti-falso-positivo).
  4. El auditor advierte cuando el charset no está declarado dentro del primer 1KB del HTML.
  5. Guardarraíl de SOCIAL-09: sobre una página con las 4 etiquetas OG básicas presentes, ningún issue nuevo de esta fase colisiona por fingerprint (mismo `checkId:url`) con lo que emitía el retirado `ONPAGE-05` — verificado con un test explícito, no sólo por construcción (checkIds `SOCIAL-01..08` son distintos de `ONPAGE-05` por diseño, pero esta fase debe probarlo, no asumirlo; ver Phase 29 VERIFICATION.md W-06).

**Plans**: TBD

### Phase 31: Validación de og:image

**Goal**: El auditor verifica que la imagen social (og:image) de cada página sea alcanzable, tenga dimensiones adecuadas y no pese demasiado, sin sobrecargar el sitio auditado con requests repetidos.
**Depends on**: Phase 30 (necesita las URLs de og:image ya extraídas por el motor de meta/social)
**Requirements**: IMG-01, IMG-02, IMG-03, IMG-04
**Success Criteria** (what must be TRUE):

  1. El auditor deduplica las URLs de og:image antes de verificarlas — una misma imagen repetida en decenas de páginas se verifica una sola vez — con el mismo patrón de dedupe+cap+concurrencia que `linkChecker.ts`/`brokenResourcesCheck` (TECH-13).
  2. El auditor marca como error las og:image con status 4xx/5xx o cuyo content-type no es una imagen.
  3. El auditor advierte (warning) imágenes entre 200×200 y 600×315px o con ratio lejos de 1.91:1, y marca error si son menores a 200×200px.
  4. El auditor marca error si la imagen pesa más de 5MB y warning si pesa entre 1MB y 5MB.

**Plans**: TBD

### Phase 32: Panel de preview social + snippets de fix

**Goal**: El usuario ve, dentro del reporte, cómo se vería su página al compartirse en Google/Facebook/LinkedIn/X, y puede copiar el snippet HTML exacto para arreglar cada problema detectado.
**Depends on**: Phase 30 (checks de meta/social) y Phase 31 (validación de og:image) — el panel consume los resultados de ambas
**Requirements**: PREVIEW-01, PREVIEW-02, PREVIEW-03, PREVIEW-04, FIX-01, FIX-02
**Success Criteria** (what must be TRUE):

  1. El reporte muestra un panel de preview social por página con 3 layouts: estilo SERP de Google, Facebook/LinkedIn (comparten layout 1.91:1) y X/Twitter (summary vs summary_large_image).
  2. Las imágenes de terceros del preview se cargan vía proxy server-side con allowlist del origen auditado, nunca vía hotlink directo a la imagen del sitio del usuario.
  3. Cada issue de meta/social muestra un snippet HTML de fix prellenado con los valores reales de esa página (title/URL existentes), no un template genérico con placeholders.
  4. El snippet es accesible por teclado y copiable con un botón dentro del panel Meta Tags/Social.

**Plans**: TBD
**UI hint**: yes

### 📋 Next (Planned)

Próximo trabajo previsto tras v1.6:

- Deploy a producción: web → Vercel; worker → Railway/VPS; Resend con dominio verificado; revisión GDPR ligera.
- v2 monetización: planes de pago, auditorías/URLs ilimitadas, Stripe.
- v2 enriquecimiento: agrupación por plantilla del veredicto CSR/SSR (RENDER-04), re-crawl basado en render (RENDER-05), formatos extra de export DOCX/CSV (EXPORT-06), columna persistida `Page.renderVerdict` (REPORT-05), Domain Rating como contexto, fingerprint extendido (FPRINT-10..14), fixes extendidos (CMSFIX-06/07), y lo diferido explícitamente de v1.6 (SOCIAL-10..12, CMSFIX-08, IMG-05) — ver `.planning/REQUIREMENTS.md`.

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
| 28. Performance por página | v1.6 | 2/3 | In Progress|  |
| 29. Scoring — categoría Social + retiro de ONPAGE-05 | v1.6 | 4/4 | In Progress|  |
| 30. Checks de meta tags/social | v1.6 | 0/TBD | Not started | - |
| 31. Validación de og:image | v1.6 | 0/TBD | Not started | - |
| 32. Panel de preview social + snippets de fix | v1.6 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-07-05*
*Granularity: standard (7 phases v1.0 + 3 phases v1.1 + 5 phases v1.2 + 5 phases v1.3 + 4 phases v1.4 + 3 phases v1.5 + 5 phases v1.6)*
*v1.0 MVP shipped: 2026-07-06 (phases 1-7)*
*v1.1 UI/UX shipped: 2026-07-06 (phases 8-10)*
*v1.2 render + exports shipped: 2026-07-08 (phases 11-15) — coverage 19/19 requirements*
*v1.3 checks + arquitectura shipped: 2026-07-09 (phases 16-20) — coverage 13/13 requirements*
*v1.4 visualización avanzada + resolución de URL shipped: 2026-07-10 (phases 21-24) — coverage 7/7 requirements*
*v1.5 fingerprinting + fixes por CMS shipped: 2026-07-25 (phases 25-27) — coverage 18/18 requirements*
*v1.6 roadmap created: 2026-07-31 (phases 28-32) — coverage 24/24 requirements mapped, pending execution*
