# Roadmap: Auditor Web (SEO/Técnico) — Lead Magnet para juan-tech.com

## Milestones

- ✅ **v1.0 MVP** — Phases 1-7 (shipped 2026-07-06)
- ✅ **v1.1 Overhaul de UI/UX y marca** — Phases 8-10 (shipped 2026-07-06)
- 🚧 **v1.2 Detección de renderizado + exportación de reportes** — Phases 11-15 (in progress)
- 📋 **Next** — Deploy a producción + v2 (monetización / enriquecimiento) — planned (scope por definir)

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

### 🚧 v1.2 Detección de renderizado + exportación de reportes (Phases 11-15)

Aditivo sobre v1.0/v1.1 — el pipeline validado no se rompe. Secuencia de riesgo ascendente (según research SUMMARY): checks puros primero (canonical + headings, cero infra), luego el pase de render CSR/SSR (única pieza que toca worker + Docker) en aislamiento, después la fundación de export (lecturas puras de datos ya persistidos con libs JS puras, sin Chromium en Vercel), el botón de export como UI fina sobre la route, y por último la agrupación/indicadores del reporte (categoría REPORT nueva, fuera del sketch original de research).

- [x] **Phase 11: Checks más profundos (canonical + headings) + fix dato CWV** — Reglas Cheerio puras sobre HTML ya almacenado: canonicals profundos, jerarquía de encabezados y la URL faltante en issues de rendimiento
- [x] **Phase 12: Detección de renderizado CSR/SSR** — Pase selectivo de Playwright (muestra, worker-only) que reporta SSR vs CSR con degradación limpia
- [x] **Phase 13: Fundación de export + serializers** — `buildReportModel` compartido + paquete `@auditor/export` puro + route Node que genera PDF / Markdown-LLM / PPTX
- [ ] **Phase 14: Botón Exportar (UI)** — Control arriba a la derecha del reporte con selector de tipo, accesible y con estado de carga
- [ ] **Phase 15: UX del reporte — agrupación e indicadores** — Issues agrupados por tipo en dropdowns + estado JSON-LD por página en la lista de páginas

### 📋 Next (Planned)

Próximo trabajo previsto tras v1.2 (scope por definir vía `/gsd:new-milestone`):

- Deploy a producción: web → Vercel; worker → Railway/VPS; Resend con dominio verificado; revisión GDPR ligera.
- v2 monetización: planes de pago, auditorías/URLs ilimitadas, Stripe.
- v2 enriquecimiento: agrupación por plantilla del veredicto CSR/SSR (RENDER-04), re-crawl basado en render (RENDER-05), formatos extra de export DOCX/CSV (EXPORT-06), columna persistida `Page.renderVerdict` (REPORT-05), Domain Rating como contexto.

## Phase Details

### Phase 11: Checks más profundos (canonical + headings) + fix dato CWV

**Goal**: La auditoría detecta errores profundos de canonical y de jerarquía de encabezados, y los issues de rendimiento muestran la URL analizada — todo con lógica Cheerio pura sobre el HTML ya almacenado, sin tocar infra ni migraciones.
**Depends on**: Phase 6 (motor de checks + scoring + diff de v1.0)
**Requirements**: CANON-01, CANON-02, CANON-03, CANON-04, HEAD-01, HEAD-02, HEAD-03, REPORT-03
**Success Criteria** (what must be TRUE):

  1. El reporte marca como crítico un canonical que apunta a una página noindex, a una redirección 3xx / 4xx / 5xx, o que forma una cadena canonical→canonical.
  2. El reporte detecta canonicals cross-domain, relativos (no absolutos), múltiples/conflictivos, el conflicto canonical+noindex y el mismatch entre canonical y la URL final resuelta.
  3. El reporte lista errores de jerarquía de encabezados: saltos de nivel (H1→H3 sin H2), headings vacíos, headings fuera de orden, múltiples H1 y H1 que sólo duplica el title.
  4. Cada issue de Rendimiento/CWV muestra la URL de la página analizada (ya no aparece "—").
  5. Los múltiples hallazgos por página no se colapsan en el diff (fingerprints sub-tipados, p. ej. `TECH-04:chain`) y el score de la fixture juan-tech.com no se desvía de forma inesperada por las nuevas filas.

**Plans**: 4 plans

- [x] 11-01-PLAN.md — canonicalDeep SiteCheck (TECH-04 sub-tipado): destino noindex/3xx/4xx/5xx/cadena/cross-domain/relativo/múltiple/mismatch (CANON-01..04)
- [x] 11-02-PLAN.md — headingsCheck (ONPAGE-08): saltos de nivel, vacíos, fuera de orden, H1 duplica title (HEAD-01..03)
- [x] 11-03-PLAN.md — Fix REPORT-03: source en PerfIssueDraft + mapPerfIssues + mapeo del worker
- [x] 11-04-PLAN.md — Guardarraíl SC#5: no-colapso de fingerprints + estabilidad de score de fixture

### Phase 12: Detección de renderizado CSR/SSR

**Goal**: La auditoría determina, sobre una muestra representativa, si cada página se renderiza server-side o client-side comparando HTML crudo vs DOM renderizado, y lo reporta como riesgo sin comprometer la estabilidad del pipeline ni la frontera web/worker.
**Depends on**: Phase 11 (fingerprints sub-tipados y scoring ya endurecidos) — comparte el motor de checks de v1.0
**Requirements**: RENDER-01, RENDER-02, RENDER-03
**Success Criteria** (what must be TRUE):

  1. Sobre una muestra representativa (reusa `selectSample`, nunca las 500 URLs), el reporte indica por página si el render es SSR o CSR mediante un issue.
  2. Cuando contenido clave (título, H1, texto principal) falta en el HTML crudo y sólo aparece tras el render JS, el reporte lo marca como riesgo SEO/AEO con severidad acorde — nunca como falla dura del score.
  3. Si el render falla, se bloquea o hace timeout, el reporte muestra "no determinado" para esa página y la auditoría completa sin caerse.
  4. El worker ejecuta Playwright en un contenedor con imagen pinneada (`mcr.microsoft.com/playwright:v1.61.1-noble`), libera los navegadores en todos los caminos (sin procesos zombie ni OOM bajo concurrencia 2 + PSI) y Playwright nunca llega al bundle de Vercel (paquete `@auditor/render` worker-only).

**Plans**: 3 plans

- [x] 12-01-PLAN.md — paquete @auditor/render + lógica pura de detección SSR/CSR (RENDER-01/02)
- [x] 12-02-PLAN.md — cliente Playwright (pool, timeout, cleanup en finally, concurrencia 2) + runRenderSample con degradación (RENDER-01/03)
- [x] 12-03-PLAN.md — integración en worker + Dockerfile pinneado + aserción Playwright fuera del bundle web (RENDER-01/03, SC#4)

### Phase 13: Fundación de export + serializers

**Goal**: El reporte puede generarse on-demand en tres formatos (PDF con branding, Markdown-para-LLM y PPTX) desde una route Node de Next.js, leyendo datos ya persistidos con librerías JS puras — sin Chromium en el bundle web.
**Depends on**: Phase 12 (los reportes exportados ya incluyen los hallazgos CSR/SSR); consume el modelo de datos del reporte de v1.0
**Requirements**: EXPORT-01, EXPORT-02, EXPORT-03, EXPORT-05
**Success Criteria** (what must be TRUE):

  1. Una petición a la route de export devuelve el reporte como PDF con branding (fuentes de marca) y con acentos y ñ correctos (áéíóúñ¿¡).
  2. Una petición devuelve un Markdown estructurado por issue → página/selector → valor medido → criterio → recomendación, listo para que un LLM entienda y aplique los fixes.
  3. Una petición devuelve un PPTX de 7–12 slides con score general, scores por categoría e issues priorizados.
  4. Los tres formatos acotan el volumen a top-N issues con una nota explícita "mostrando N de M" y no incluyen PII (email/token); `pnpm why playwright` en el paquete web queda vacío (cero Chromium en Vercel).

**Plans**: 4 plans

Plans:
- [x] 13-01-PLAN.md — Paquete @auditor/report-model (buildReportModel) + refactor de page.tsx a single source of truth
- [x] 13-02-PLAN.md — Paquete @auditor/export: cap top-N compartido + serializers Markdown-LLM y PPTX
- [x] 13-03-PLAN.md — Serializer PDF con @react-pdf/renderer + fuente de marca embebida (acentos/ñ)
- [x] 13-04-PLAN.md — Route Node GET /api/audits/[id]/export (3 formatos) + guardarrail de frontera Chromium

### Phase 14: Botón Exportar (UI)

**Goal**: Desde el reporte, el usuario puede disparar cualquiera de los tres exports desde un control accesible arriba a la derecha, con feedback de carga y sin doble envío.
**Depends on**: Phase 13 (la route de export debe existir); reusa la librería de componentes y el baseline de accesibilidad de v1.1
**Requirements**: EXPORT-04
**Success Criteria** (what must be TRUE):

  1. El reporte muestra un botón "Exportar" arriba a la derecha con un selector de tipo (PDF / Markdown / PPTX).
  2. El control es operable por teclado y expone roles/labels ARIA para lectores de pantalla.
  3. Durante la generación el control muestra estado de carga/deshabilitado y evita el doble envío de peticiones pesadas.
  4. Al completar, el navegador descarga el archivo en el formato elegido.

**Plans**: TBD
**UI hint**: yes

### Phase 15: UX del reporte — agrupación e indicadores

**Goal**: El reporte presenta los issues agrupados por tipo en dropdowns y muestra el estado del JSON-LD por página, para que la información sea legible sin saturación. Categoría REPORT nueva, adicional al sketch de research.
**Depends on**: Phase 10 (pantallas de reporte y de páginas + grafo de v1.1) y Phase 11 (los nuevos issues de canonical/headings ya se agrupan bien)
**Requirements**: REPORT-01, REPORT-02, REPORT-04
**Success Criteria** (what must be TRUE):

  1. En "Issues prioritarios", los issues se agrupan por tipo en dropdowns (p. ej. "Imágenes sin alt text" agrupa todas las páginas afectadas), ordenados por severidad y cantidad, sin saturar la tabla.
  2. En "Detalle por categoría", tanto en problemas como en correctos los issues se agrupan por tipo en dropdowns con orden consistente.
  3. En la lista de páginas rastreadas + grafo de entidades, cada página muestra el estado de su JSON-LD (correcto / advertencia / error) en la misma lista.

**Plans**: TBD
**UI hint**: yes

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
| 14. Botón Exportar (UI) | v1.2 | 0/? | Not started | - |
| 15. UX del reporte — agrupación e indicadores | v1.2 | 0/? | Not started | - |

---
*Roadmap created: 2026-07-05*
*Granularity: standard (7 phases v1.0 + 3 phases v1.1 + 5 phases v1.2)*
*v1.0 MVP shipped: 2026-07-06 (phases 1-7)*
*v1.1 UI/UX shipped: 2026-07-06 (phases 8-10)*
*v1.2 render + exports roadmap: 2026-07-07 (phases 11-15) — coverage 19/19 requirements*
</content>
</invoke>
