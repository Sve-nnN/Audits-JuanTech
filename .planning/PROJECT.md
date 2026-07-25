# Auditor Web (SEO/Técnico) — Lead Magnet para juan-tech.com

## What This Is

Herramienta de auditoría web tipo "Screaming Frog pero más completo y automatizado". Un crawler entra a todas las páginas de un sitio (a partir del sitemap), las rastrea y detecta todo tipo de errores: SEO técnico, contenido, on-page, datos estructurados, rendimiento/Core Web Vitals (vía Lighthouse/unlighthouse) y visibilidad en IA (AEO). El resultado es un reporte con score general, scores por categoría e issues priorizados por severidad. Sirve como lead magnet para atraer clientes a juan-tech.com: las personas dejan su email, lo verifican, y ganan acceso a auditar una web.

## Core Value

Que cualquier persona ingrese una URL y reciba una auditoría completa, precisa y accionable de su web (con errores reales priorizados por severidad), a cambio de su email verificado. Si todo lo demás falla, el crawler + reporte de auditoría debe funcionar y ser confiable.

## Current Milestone: ninguno — planificando próximo (post v1.5)

v1.5 shipped 2026-07-25 (ver abajo). Próximo milestone aún no definido — arrancar con `/gsd-new-milestone`.

## Prior State: v1.5 shipped 2026-07-25

Seis milestones entregados: v1.0 (pipeline de auditoría), v1.1 (UI/UX + marca), v1.2 (renderizado + exportación), v1.3 (checks técnicos profundos + visualización de arquitectura), v1.4 (visualizaciones estilo Octopus.do/Classy Schema + resolución canónica de URL) y v1.5 (fingerprint de stack técnico + recomendaciones de fix personalizadas por CMS). El producto ahora detecta el stack técnico del sitio auditado (CMS+builder, CDN/proxy, hosting, framework JS, analytics) con confianza tipada por eje sin requests adicionales, lo muestra en una tabla al inicio del reporte, y usa ese stack para personalizar la recomendación de fix de los 10 checks de mayor volumen (WordPress con resolución por builder, Shopify, Webflow, Wix/Squarespace), con fallback genérico garantizado.

**Cierre v1.5:** aditivo, sin tocar el pipeline de v1.0-v1.4. `@auditor/fingerprint` (motor `detectStack`, 6 ejes independientes tipados por `Confidence`) y `@auditor/cms-adapters` (patrón adaptador + `resolveCmsRecommendation` con fallback) quedan desacoplados de `@auditor/db`/`@auditor/crawler`/`@auditor/checks` en runtime. `Audit.stack` (Prisma `Json?`) persiste una detección por auditoría; `buildReportModel` resuelve la recomendación personalizada en lectura (nunca persistida), llegando gratis a UI y a los 3 exports. 18/18 requisitos satisfechos, integración 10/10 wired, audit `passed`. Primer `SECURITY.md` del proyecto (7/7 threats). Detalle en `.planning/MILESTONES.md` y `.planning/milestones/v1.5-ROADMAP.md`.

**Trabajo previsto posterior:**
- **E2e verify-cms-fix.mts** contra audit real (Postgres) — corrida manual de Juan, no bloqueante.
- **Nyquist retroactivo** para Phase 25/26 (`/gsd-validate-phase 25` y `26`) — coverage TODO opcional, no bloqueante.
- **Deploy a producción:** web → Vercel; worker → Railway/VPS; Resend con dominio verificado; revisión GDPR ligera. Incluye las 2 verificaciones humanas diferidas de v1.2 (runtime Docker del render + render visual del PDF).
- **v2 monetización:** planes de pago, auditorías/URLs ilimitadas, Stripe.
- **v2 enriquecimiento:** RENDER-04/05, EXPORT-06 (DOCX/CSV), REPORT-05 (`Page.renderVerdict` persistido), Domain Rating como contexto.
- **Tech debt no bloqueante de v1.4:** SD-07 sin dedupe/cap de mensajes; `SchemaEntities.tsx` usa índice de array como key de React (bajo riesgo, ver `24-REVIEW.md`).
- **Debug abierto (no relacionado a v1.4):** `pdf-export-crash-reading-s` — crash de export PDF en runtime Next server (`TypeError: Cannot read properties of undefined (reading 'S')`); hipótesis confirmada apunta a exportar `@react-pdf/renderer` vía `serverExternalPackages`; próxima acción pendiente de ejecutar (ver `.planning/debug/pdf-export-crash-reading-s.md` y `STATE.md` → Deferred Items).

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Crawler sitemap + fallback link-crawl, respeta robots.txt, rate-limit, 500 URLs — v1 (verificado juan-tech.com)
- ✓ SEO técnico: robots/sitemap/HTTP/canonical/indexabilidad/redirects/404 internos/viewport/duplicados+SimHash/huérfanas/hreflang/mixed content/enlaces+recursos rotos — v1
- ✓ On-page: title/meta/H1/alt/OG/longitud/lang — v1
- ✓ Datos estructurados: presencia+validez JSON-LD, validación schema.org (Classy Schema), grafo de entidades — v1
- ✓ Rendimiento/CWV vía PageSpeed Insights (score/LCP/CLS/INP/TTFB móvil+desktop), muestreado+cacheado — v1
- ✓ AEO: crawlers IA, llms.txt, datos estructurados IA, formato de contenido — v1
- ✓ Score general + por categoría con estados (health-ratio size-independent) — v1
- ✓ Reporte web con issues priorizados (valor medido/fuente/criterio/recomendación) — v1
- ✓ Email + double opt-in + normalización antes de auditar — v1
- ✓ Almacenamiento email↔auditorías + historial — v1
- ✓ Cuota free 1/semana/email + 500 URLs — v1
- ✓ Comparación entre corridas (diff nuevos/persistentes/resueltos por fingerprint) — v1
- ✓ Crawls largos en worker de fondo con cola BullMQ (sin bloquear/sin timeouts, lock robusto) — v1
- ✓ Fuentes de marca: Array (display, self-hosted), Khand (títulos/UI), Geist Sans (body), Geist Mono (métricas), con fallbacks y font-display swap — v1.1 (FONT-01..04, Phase 8)
- ✓ Design system tokenizado (color/tipografía/espaciado/radios/sombras/z-index) + tema claro/oscuro dark-first persistente sin FOUC + layout base compartido — v1.1 (DS-01..04, Phase 8)
- ✓ Librería de componentes tokens-only: ScoreGauge, CategoryCard, Badge severidad/diff, IssuesTable responsive, CategoryAccordion, Button/Input/Field, EmptyState/ErrorState, Skeleton — v1.1 (COMP-01..08, Phase 9)
- ✓ 6 pantallas rediseñadas (home, verificación, progreso, reporte, páginas + grafo, historial) ensambladas con la librería — v1.1 (SCREEN-01..06, Phase 10)
- ✓ Copy humanizado en español neutro sin voceo (UI, errores, cuota, verificación, recomendaciones) — v1.1 (COPY-01..03, Phase 10)
- ✓ Motion sutil (score count-up, reveals, progreso animado) que respeta prefers-reduced-motion — v1.1 (MOTION-01..03, Phase 10)
- ✓ Responsive sin overflow horizontal + contraste AA + foco visible + roles/labels ARIA + navegación por teclado — v1.1 (A11Y-01..03, Phase 10)
- ✓ Canonicals profundos (canonical a noindex/3xx/4xx/5xx, cadena, cross-domain, relativo, múltiple, mismatch con URL final) — v1.2 (CANON-01..04, Phase 11)
- ✓ Jerarquía de encabezados (saltos de nivel, headings vacíos, fuera de orden, H1 duplica title) — v1.2 (HEAD-01..03, Phase 11)
- ✓ Detección CSR vs SSR sobre una muestra (HTML crudo vs DOM renderizado), riesgo informativo con degradación limpia — v1.2 (RENDER-01..03, Phase 12)
- ✓ Exportación del reporte en PDF con branding, Markdown-para-LLM y PPTX, con top-N + "N de M", sin PII, acentos/ñ correctos — v1.2 (EXPORT-01..03/05, Phases 13)
- ✓ Botón Exportar accesible (selector PDF/Markdown/PPTX, teclado, estado de carga, sin doble envío) — v1.2 (EXPORT-04, Phase 14)
- ✓ UX del reporte: issues agrupados por tipo en dropdowns + URL en issues de CWV + estado JSON-LD por página — v1.2 (REPORT-01..04, Phases 11 y 15)
- ✓ Profundidad de clics real (BFS sobre grafo de enlaces internos, no `Page.depth`) computada una vez y reusada; issue agregado de % de páginas a >3 clics — v1.3 (DEPTH-01..03, Phase 16)
- ✓ Check schema-contenido mismatch (FAQPage/HowTo/Product+AggregateRating/Review sin contenido visible), warning con supresión de falsos positivos vía muestra CSR — v1.3 (SCHEMA-06/07, Phase 17)
- ✓ Diagnósticos de Lighthouse (WebP/AVIF, CSS sin usar, render-blocking, compresión, minificación) extraídos de la respuesta PSI sin llamadas extra, severidad no-crítica — v1.3 (PERF-05/06, Phase 18)
- ✓ Agrupación de issues por plantilla de página (home/categoría/producto/artículo/otras) vía heurística de URL, con toggle en el reporte — v1.3 (TEMPLATE-01/02, Phase 19)
- ✓ Visualizador de arquitectura del sitio en SVG puro (árbol por profundidad, huérfanas, >3 clics, plantilla por nodo), reusa el grafo persistido — v1.3 (ARCH-01..04, Phase 20)
- ✓ Resolución canónica de URL de entrada (http/https + www, redirects del home) usada como origin único en todo el pipeline, reemplaza `resolveHomeKey` — v1.4 (URLRES-01/02, Phase 21)
- ✓ Árbol de arquitectura estilo octopus: dendrograma jerárquico con conexiones padre-hijo + mapa navegable con zoom/pan — v1.4 (ARCH-05/06, Phase 22)
- ✓ Grafo JSON-LD radial: raíz de cada componente conexo al centro con hijos alrededor — v1.4 (SDVIZ-01, Phase 23)
- ✓ Código JSON-LD formateado por entidad + validación por propiedad/tipo contra schema.org (Classy Schema, subconjunto de alto valor, nunca falla dura del score) — v1.4 (SDVIZ-02/03, Phase 24)
- ✓ Fingerprint de stack técnico: captura de headers curados + nombres de cookie sin requests adicionales, motor `detectStack` propio (registry de signatures por eje, sin dependencias externas pagas/GPL) con detección independiente por eje (CMS, builder WordPress, CDN/proxy, hosting, framework JS, analytics) tipada por confianza (alto/medio/bajo/no-detectado), nunca forzando una respuesta sin señal — v1.5 (FPRINT-01..08, Phase 25)
- ✓ Persistencia del stack detectado (una detección por auditoría, sin re-detectar por vista) + tabla "Stack técnico detectado" al inicio del reporte, tokens-only, ambos temas — v1.5 (FPRINT-09, STACKUI-01..03, Phase 26)
- ✓ Motor de recomendaciones por CMS: patrón adaptador (WordPress con builder, Shopify, Webflow, Wix/Squarespace) con fallback genérico garantizado, resuelto en lectura en `buildReportModel` (nunca persistido, gratis en exports) — v1.5 (CMSFIX-01..05, Phase 27)

### Active

<!-- Current scope. Building toward these. -->

v1.5 completa (Phases 25, 26, 27 shipped). Pendiente cierre de milestone.

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Cobro / planes de pago / auditorías ilimitadas / URLs ilimitadas — v2. La v1 valida la propuesta con cuota gratuita antes de monetizar.
- Métricas propietarias externas como Domain Rating de Ahrefs como parte del score — contexto opcional, no parte del cálculo del score de auditoría (evita dependencia de datos de terceros pagos en el core).
- Corrección automática de errores en el sitio del usuario — la herramienta detecta y recomienda, no modifica sitios ajenos.
- App móvil nativa — v1 es web.

## Context

- **Origen:** Juan (juan-tech.com) es ingeniero de software y consultor SEO técnico freelance. La herramienta es a la vez lead magnet y demostración de expertise.
- **Referencia funcional:** Ya existe un reporte de ejemplo generado por una herramienta parecida (auditoría de juan-tech.com, score 86/100). Define el formato objetivo del output: score general, scores por categoría (SEO Técnico, Rendimiento/CWV, On-Page, Datos Estructurados, AEO), tabla de issues priorizados y detalle por issue (valor medido, fuente, criterio, recomendación).
- **Categorías y checks del reporte de referencia** son la base del catálogo de checks a implementar.
- **Rendimiento:** Se usa Lighthouse (unlighthouse para crawl multi-página) + Google PageSpeed Insights API (Lighthouse + CrUX) para datos de campo.
- **Extracción HTML:** el reporte de referencia usa Cheerio para parsear HTML crudo; JS rendering (Playwright) es deseable para comparar HTML crudo vs renderizado.
- **Ecosistema:** entorno con Vercel disponible; Next.js App Router como default de frontend.
- **Estado actual (post-v1.4):** monorepo pnpm+Turborepo con `apps/web` (Next.js, Vercel) y `apps/worker` (Crawlee, contenedor propio); paquetes db, queue, crawler, checks, psi, scoring, email, quota, graph, report-model, render, export. `packages/crawler` gana `resolveCanonicalUrl` (https→http, redirects, timeout); `apps/worker` la usa antes de `runCrawl` y persiste `Audit.resolvedUrl`. `apps/web` gana `ArchitectureMap` (viewport zoom/pan sobre el dendrograma) en ruta propia `/audits/[id]/arquitectura`, `EntityGraphSvg` con layout radial por componente conexo, y `SchemaEntities.tsx` (panel Classy Schema) alimentado por `Page.schemaJson` + `validateEntities` de `packages/checks`. Paquetes `packages/fingerprint` (detección de stack técnico, v1.5 Phase 25) y `packages/cms-adapters` (motor de recomendaciones por CMS, v1.5 Phase 27) desacoplados de `@auditor/db`/`@auditor/crawler`/`@auditor/checks` en runtime; `packages/report-model` los consume en `buildReportModel` sin persistir el resultado. Postgres (instancia propia, `shared-postgres`, migrado desde Neon el 2026-07-24) + Redis/BullMQ (Upstash). UI con design system tokenizado, 4 fuentes de marca y tema claro/oscuro; reporte con agrupación de issues, indicador JSON-LD por página y botón Exportar. `apps/worker/Dockerfile` pinneado a `mcr.microsoft.com/playwright:v1.61.1-noble`. Pendiente: deploy a producción (env/keys/Resend/GDPR) + 2 verificaciones humanas de runtime diferidas de v1.2 (Docker render, PDF visual) + debug abierto de crash en export PDF (ver `STATE.md` → Deferred Items).

## Constraints

- **Tech stack**: Frontend Next.js (App Router) desplegado en Vercel; el crawl corre en un worker de fondo con cola (BullMQ/Redis o equivalente) en un contenedor propio (Railway/Fly/VPS) — Decidido por el usuario. Razón: crawl + Lighthouse sobre 500 URLs excede los límites de duración/CPU de funciones serverless cortas.
- **Performance**: Una auditoría gratuita rastrea hasta 500 URLs; debe completar sin timeouts y reportar progreso.
- **Cuota**: 1 auditoría/semana/email en free tier — requiere rate limiting persistente por email.
- **Verificación**: acceso a auditar sólo tras verificar el email (double opt-in) para evitar abuso.
- **Datos**: almacenar email, website auditado, stats, historial de auditorías y estado de corrección de errores.
- **APIs externas**: Google PageSpeed Insights API (rate limits/clave); considerar caché.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Frontend Next.js (Vercel) + worker/cola en contenedor propio | Crawl+Lighthouse de 500 URLs no cabe en funciones serverless cortas | ✓ Good — probado e2e en v1.0 (web encola, worker ejecuta) |
| Modo de trabajo GSD: YOLO | Usuario delegador, ejecuta end-to-end | ✓ Good — 10 fases entregadas sin fricción |
| Granularidad Standard (5-8 fases) | Balance entre MVP rápido y estructura | ✓ Good — 7 fases v1.0 + 3 v1.1 |
| Cuota free: 1 auditoría/semana, 500 URLs | Validar propuesta antes de monetizar | — Pending (falta lanzamiento a producción) |
| Cobro (ilimitado) diferido a v2 | Primero validar con free tier | — Pending |
| Scoring health-ratio size-independent | Penalización absoluta tanqueaba sitios grandes | ✓ Good — overall 91 vs 86 de referencia (v1.0 Phase 6) |
| Fuentes de marca: Khand para títulos, Array sólo como token display | Decisión de marca de Juan; a Juan le gustan los títulos en Khand | ✓ Good — v1.1 (UI-FEEDBACK.md) |
| Componentes tokens-only (cero hex crudo) | Coherencia dark/light y theming sin duplicar valores | ✓ Good — v1.1 Phase 9 |
| No construir ruta `/styleguide` | Validar componentes en las pantallas reales de la Fase 10 | ✓ Good — v1.1 (validación visual diferida a Phase 10) |
| v1.1 estrictamente UI-only | Proteger el pipeline validado de v1.0 | ✓ Good — flujo e2e preservado verbatim |
| v1.2 aditivo sobre v1.0/v1.1 en riesgo ascendente | Aislar la única pieza de infra nueva (render+Docker) a una fase; no romper el pipeline validado | ✓ Good — 5/5 seams de integración PASS, score de fixture estable |
| Render CSR/SSR como riesgo informativo, no falla dura del score | Evita penalizar SSR con hidratación parcial; CSR es señal, no cero automático | ✓ Good — v1.2 Phase 12 (severidad ok/warning) |
| Solo renderizar una muestra (selectSample, MAX_RENDER_PAGES=10), nunca las 500 URLs | Playwright es 5–10× costo/tiempo de Cheerio | ✓ Good — v1.2 Phase 12 |
| Chromium fuera del bundle de Vercel: exports con libs JS puras (@react-pdf/renderer, pptxgenjs) | Serverless no debe cargar navegador headless; guardarrail automatizado | ✓ Good — v1.2 (assert:web-boundary Checks C/D) |
| buildReportModel como single source of truth (report UI + exports + grouping) | Evitar ensamblado divergente de datos entre reporte y serializers | ✓ Good — v1.2 Phase 13 (una fragilidad latente: query JSON-LD paralela en pages/page.tsx) |
| Exports on-demand en route Node (sin cola/async) | Son lecturas rápidas de datos ya persistidos | ✓ Good — v1.2 Phase 13 |
| `resolveCanonicalUrl` con fallback https→http + timeout acotado (AbortController) | Sitios con redirect a www dejaban un grafo vacío (bug v1.3); resolver antes de crawlear evita mitigaciones puntuales aguas abajo | ✓ Good — v1.4 Phase 21, confirmado en vivo por Juan retroactivamente el 2026-07-10 |
| Dendrograma determinista sin motor de layout en cliente (dos pasadas: leafCursor + promedio de hijos) | CSP estricta del proyecto no permite librerías de layout en el navegador | ✓ Good — v1.4 Phase 22 |
| Mapa de arquitectura en ruta propia (`/audits/[id]/arquitectura`) en vez de embebido en el reporte | Zoom/pan necesita su propio viewport a pantalla completa sin competir con el resto del reporte | ✓ Good — v1.4 Phase 22 |
| Checkpoints humanos de v1.4 cerrados por confirmación retroactiva (no re-verificación en vivo) | Juan ya había validado el look/comportamiento en una sesión previa; el gap era de proceso (falta de registro escrito), no funcional | ✓ Good — v1.4, cierre 2026-07-10 vía /gsd-autonomous; lección: dejar el VERIFICATION.md/checkpoint cerrado en el momento evita este trabajo de reconciliación después |
| Motor de fingerprint propio (registry de signatures) en vez de `wappalyzer-core` o APIs pagas | Librería deprecada/GPL-3.0 incompatible; requisito explícito de Juan de no depender de servicios de terceros pagos en el core | ✓ Good — v1.5 Phase 25, 34 tests, validado contra 6 sitios reales |
| `packages/fingerprint` desacoplado de `@auditor/db`/`@auditor/crawler`/`@auditor/checks` en runtime | Mismo patrón que `packages/graph`/`packages/scoring`; motor de detección debe ser reusable/testeable sin infra | ✓ Good — v1.5 Phase 25, única dep runtime es `cheerio` |
| Confianza de detección por reglas explícitas de conteo de señales (no puntaje numérico 0-100) | Más fácil de calibrar sin datos reales previos; auditable por regla en vez de umbral arbitrario | ✓ Good — v1.5 Phase 25 |
| `detectStack` invocado una sola vez por auditoría en el worker (post-crawl) y persistido en `Audit.stack`; report-model solo lee el escalar | Evita recomputar el fingerprint en cada vista del reporte; misma auditoría siempre muestra el mismo stack | ✓ Good — v1.5 Phase 26, `grep detectStack` en report-model = 0 |
| CMS+builder combinado en una sola fila ("WordPress (Elementor)") en vez de dos filas separadas | Builder solo tiene sentido en contexto del CMS; una fila combinada es más legible que dos filas dependientes | ✓ Good — v1.5 Phase 26 |
| Wix y Squarespace comparten un único adaptador técnico (`wixSquarespaceAdapter`), ramificando por `label` internamente | Módulo técnico similar entre ambas plataformas, pero copy distinta por checkId; ramificar en vez de duplicar adaptador reduce superficie sin perder especificidad | ✓ Good — v1.5 Phase 27, tests confirman Wix ≠ Squarespace por checkId |
| TECH-04 (canonical) resuelto como un solo copy por plataforma que cubre tanto ubicación del campo como destino roto/en cadena/con noindex, en vez de checkIds separados | Los checks de canonical básico y canonicalDeep comparten el mismo checkId `TECH-04`; separar requeriría tocar el catálogo de checks fuera de scope de la fase | ✓ Good — v1.5 Phase 27, redacción validada por Juan |
| Resolución de recomendación por CMS en `buildReportModel` (lectura), nunca persistida en DB | Mismo patrón que el fingerprint: evita recomputar/guardar un derivado que cambiaría si se recalibra el copy; llega gratis a exports sin tocar `packages/export` | ✓ Good — v1.5 Phase 27, cero commits en `packages/export` durante la fase |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-25 after Phase 27 — v1.5 milestone completo, cierre pendiente*
