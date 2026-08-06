# Project Milestones: Auditor Web (SEO/Técnico) — Lead Magnet para juan-tech.com

## v1.6 Meta Tags / Social (Shipped: 2026-08-06)

**Delivered:** Sexta categoría de score "Meta Tags / Social" con 8 checks nuevos de Open Graph/Twitter Card/charset por página, validación de `og:image` con fetcher dedupeado y defensa SSRF propia, métricas de performance por página (response time/HTML size), y panel visual de preview social en el reporte (Google/Facebook/LinkedIn/X) con snippets HTML de fix copiables.

**Phases completed:** 5 phases, 22 plans, 42 tasks

**Key accomplishments:**

- Sexta categoría `social` (peso .10) en el modelo de scoring, rebalanceando on-page (.15→.10) y datos estructurados (.10→.05), con retiro limpio de `ONPAGE-05` (redundante) sin migración de datos y sin duplicar issues.
- Paquete puro `@auditor/meta-social` (única dep de runtime `cheerio`, desacoplado de `@auditor/db`/`@auditor/checks`) con 8 checks nuevos de Open Graph/Twitter Card/charset, cero colisión de fingerprint con el check retirado.
- Validación de `og:image` (IMG-01..04): fetcher dedupeado por URL con una sola petición con rango (nunca más de 64 KiB), defensa SSRF propia (destino no verificable se reporta como tal, nunca como "roto"), emisión por página afectada.
- Response time + HTML size instrumentados en el crawl sin requests extra, con umbrales de severidad — código completo y testeado, verificación humana del smoke-test diferida.
- Panel de preview social en el reporte (Google/SERP, Facebook/LinkedIn, X) con proxy server-side de imágenes (reusa la defensa SSRF de og:image) y snippets HTML de fix prellenados con valores reales, accesibles por teclado y copiables.
- Defensa SSRF endurecida post-cierre de Phase 31 tras una segunda pasada de code review independiente (DNS rebinding + redirección sin revalidar), y el mismo patrón de code review adversarial (3 iteraciones de auto-fix) atrapó un bug real de atribución de imagen (`imageStatus`) en Phase 32.

**Stats:**

- 5 fases, 22 plans, 42 tasks; paquete nuevo `@auditor/meta-social`
- Requisitos: 21/24 con verificación formal `passed`; 3/24 (PAGEPERF-01..03) con código completo/testeado y verificación humana diferida
- Integración cross-fase: 0 blockers, 1 warning no bloqueante (`gsd-integration-checker`)
- 2 checkpoints de UAT quedan diferidos al cierre (Fase 28, Fase 32) — ver `.planning/STATE.md` → Deferred Verification

**Milestone audit:** GAPS_FOUND (no-blocking — 2 fases con verificación humana diferida, 0 blockers de integración) — ver `.planning/milestones/v1.6-MILESTONE-AUDIT.md`

**What's next:** Resolver los 2 checkpoints diferidos (`/gsd-verify-work 28`, `/gsd-verify-work 32`) cuando haya acceso real a `shared-postgres`; definir próximo milestone (`/gsd-new-milestone`).

---

## v1.5 Fingerprinting técnico + fixes personalizados por CMS (Shipped: 2026-07-25)

**Phases completed:** 3 phases, 12 plans, 19 tasks

**Key accomplishments:**

- Paquete puro @auditor/fingerprint (cheerio como única dep runtime) con el contrato de datos completo: DetectedStack (analytics como array, no-detectado de primera clase), Signature.test devolviendo conteo de marcadores, y PageFingerprintInput desacoplado de Prisma.
- Columnas aditivas Page.responseHeaders (Json) + Page.cookieNames (String[]) con helpers allowlist-only (curateHeaders) y names-only (parseCookieNames) cableados al upsert del CheerioCrawler, sin requests HTTP adicionales.
- Registry declarativo de detección de stack: seis módulos de signatures (cms/builder/cdn/hosting/jsFramework/analytics) con test() basado en conteo y Gutenberg por marcador positivo, agregados en un Record<Axis, Signature[]> con test estructural en verde.
- Motor puro `detectStack` que resuelve seis ejes de stack de forma independiente (WordPress + Cloudflare + Next.js a la vez) con confianza por reglas explícitas, `no-detectado` como estado de primera clase, y firmas de builder de WordPress calibradas contra HTML real.
- 1. [Rule 1 - Bug] Detección de P1001 por nombre/mensaje además del `code`
- Task 1 — Variante warningSubtle (commit `113e902`)
- 1. Título de sección replicado local en vez de cross-importar report.module.css
- 1. [Rule 3 - Blocking] `build` no existe como script en el mirror
- Commit único al final (instrucción del orquestador).
- 1. [Rule 3 - Blocking] Dependencias workspace agregadas a apps/worker

---

## v1.4 Visualización avanzada + resolución de URL (Shipped: 2026-07-10)

**Phases completed:** 4 phases, 10 plans, 9 tasks

**Key accomplishments:**

- resolveCanonicalUrl(domain) prueba https→http con fallback, sigue redirects del home vía GET y devuelve la finalUrl real (res.url) o null en fallo total, con timeout de 10s acotado por AbortController.
- El worker resuelve la URL canónica con `resolveCanonicalUrl(domain)` antes de `runCrawl`, la usa como `startUrl`/`origin` único de todo el pipeline, la persiste en `Audit.resolvedUrl`, falla la auditoría con un mensaje español neutro si el dominio no responde, y el reporte la muestra cuando difiere del dominio ingresado.
- Task 3 — checkpoint:human-verify (bloqueante).
- 1. [T-24-06 — DoS mitigation] Cap de profundidad antes de recursar en arrays

---

## v1.3 Profundizar checks técnicos + visualización de arquitectura (Shipped: 2026-07-09)

**Phases completed:** 5 phases, 11 plans, 17 tasks

**Key accomplishments:**

- Nuevo paquete `@auditor/graph` con `buildLinkGraph(pages, origin)`: BFS puro desde home sobre enlaces internos parseados vía cheerio, reemplaza `Page.depth` como fuente de verdad de profundidad de clics.
- Worker calcula `buildLinkGraph` una sola vez post-crawl, pasa `depthByUrl` al nuevo check `TECH-14` (issue agregado de % de páginas a más de 3 clics de home) y persiste `{ nodes, edges, depthByUrl }` en `Audit.stats.graph` del estado terminal `done`.
- SD-06 site-level check flags JSON-LD FAQPage/HowTo/Product+AggregateRating/Review claims with no matching visible HTML content, always at warning severity, with a local renderVerdictByPageId contract ready for 17-02's CSR suppression wiring
- Worker now runs the v1.2 Playwright render sample before the check battery and threads its per-page SSR/CSR/undetermined verdict into `runAllChecks` as `renderVerdictByPageId`, closing SD-06's CSR-suppression cross-check
- Nuevo contrato de datos y mapeo puro para 5 diagnósticos de Lighthouse (imágenes modernas, CSS sin usar, recursos bloqueantes, compresión de texto, CSS/JS sin minificar) extraídos de la respuesta PSI ya existente, sin llamadas HTTP adicionales y con severidad siempre no-crítica.
- runPsi adjunta diagnostics a cada PsiMetrics desde la misma respuesta PSI (cero llamadas extra) y el worker persiste issues PERF-05..PERF-09 junto al resto de issues perf en la misma pasada.
- `classifyTemplate(url)` heuristic de segmentos de URL (home/category/product/article/other) más `ReportModel.issuesByTemplate` como segundo eje de agrupación junto a `issuesByCategory`, sin tocar el cálculo existente.
- Client-side tab toggle (`GroupingToggle`) wiring `ReportModel.issuesByTemplate` into a second "Detalle por plantilla" accordion block, switching against the existing "Detalle por categoría" block with zero additional fetches.

---

Entries in reverse chronological order — newest first.

---

## v1.2 Detección de renderizado + exportación de reportes (Shipped: 2026-07-08)

**Delivered:** Ampliación aditiva del auditor sobre el pipeline validado de v1.0/v1.1 — checks más profundos de canonicals y jerarquía de encabezados, detección CSR vs SSR sobre una muestra (Playwright worker-only) y exportación del reporte en 3 formatos (PDF con branding, Markdown-para-LLM, PPTX) desde un botón accesible, más agrupación de issues por tipo e indicador de estado JSON-LD por página. Sin romper el pipeline de crawl/checks/scoring/diff/email.

**Phases completed:** 11-15 (15 plans total)

**Key accomplishments:**

- Canonicals profundos (sub-tipos de TECH-04: noindex, 3xx/4xx/5xx, cadena, cross-domain, relativo, múltiple, mismatch) y jerarquía de encabezados (ONPAGE-08: saltos, vacíos, orden, H1 duplica title) con lógica Cheerio pura sobre HTML ya almacenado; fix REPORT-03 (URL en issues de Rendimiento/CWV).
- Detección CSR/SSR: nuevo paquete worker-only `@auditor/render` compara HTML crudo vs DOM renderizado sobre una muestra (`selectSample`, `MAX_RENDER_PAGES=10`), severidad informativa (ok/warning, nunca falla dura), degradación limpia a "no determinado" y primer Dockerfile pinneado a `mcr.microsoft.com/playwright:v1.61.1-noble`.
- Fundación de export: `buildReportModel` como single source of truth + paquete puro `@auditor/export` (PDF vía `@react-pdf/renderer` con Khand/Geist embebidas, Markdown-LLM, PPTX 7–12 slides) servido desde una route Node; guardarrail `assert:web-boundary` garantiza cero Chromium en el bundle de Vercel.
- Botón Exportar: `ExportMenu` accesible (roving tabindex, teclado completo, ARIA) con descarga por blob y guard anti-doble-envío; primera suite RTL de `apps/web`.
- UX del reporte: agrupación de issues por tipo en dropdowns (`groupIssuesByType` + `IssueTypeGroup`) ordenados por severidad y cantidad, e indicador JSON-LD de 4 estados por página (`JsonLdBadge`).
- Exports acotan a top-N con nota "Mostrando N de M", cero PII y acentos/ñ correctos en los 3 formatos (guardarrail cero-PII).

**Stats:**

- 5 fases, 15 plans; paquetes nuevos `@auditor/render`, `@auditor/report-model`, `@auditor/export`
- Requisitos: 19/19 completos (CANON-01..04, HEAD-01..03, RENDER-01..03, EXPORT-01..05, REPORT-01..04)
- ~2 días desde el arranque de v1.2 (2026-07-06) hasta el cierre (2026-07-08)

**Git range:** `feat(11)` → `feat(15)` (tag `v1.2`)

**Milestone audit:** PASSED — 19/19 requisitos, 5/5 fases, 5/5 seams de integración, 3/3 flujos E2E, 0 blockers. Ver `.planning/milestones/v1.2-MILESTONE-AUDIT.md`.

**Known deferred items at close:** 2 (verificación humana runtime Docker de Phase 12 + render visual del PDF de Phase 13, ambos aceptados por Juan como parte del deploy). Ver STATE.md `## Deferred Items`.

**What's next:** Deploy a producción (web → Vercel; worker → Railway/VPS; Resend con dominio verificado; revisión GDPR ligera) y luego v2 (monetización + enriquecimiento).

---

## v1.1 Overhaul de UI/UX y marca (Shipped: 2026-07-06)

**Delivered:** Overhaul completo de UI/UX sobre el pipeline de v1.0 — design system con tipografía de marca, librería de componentes reutilizables y las 6 pantallas rediseñadas con copy humanizado, motion sutil y accesibilidad AA. UI-only, sin tocar la lógica de auditoría.

**Phases completed:** 8-10 (19 plans total)

**Key accomplishments:**

- Fundamentos de marca: Array (display, self-hosted), Khand (títulos/UI), Geist Sans (body) y Geist Mono (métricas) vía `next/font`, con fallbacks y `font-display: swap`.
- Design system tokenizado (color, tipografía, espaciado, radios, sombras, z-index) como CSS variables, con tema claro/oscuro dark-first vía next-themes, persistente y sin FOUC.
- Librería de componentes tokens-only (cero hex crudo): ScoreGauge, CategoryCard, Badge severidad/diff, IssuesTable responsive, CategoryAccordion, Button/Input/Field accesibles, EmptyState/ErrorState y Skeleton con shimmer.
- 6 pantallas rediseñadas (home, verificación, progreso, reporte, páginas + grafo, historial) con hero score count-up, barra de progreso animada de 3 fases y reveals suaves.
- Copy 100% humanizado en español neutro sin voceo; motion que respeta `prefers-reduced-motion`; barrido A11Y (skip-to-content, foco visible, contraste AA en ambos temas, navegación por teclado).
- Flujo e2e de v1.0 preservado verbatim (home → verify → progreso → reporte → páginas/grafo → historial).

**Stats:**

- 61 archivos de app modificados (excluyendo `.planning/`); ~5.8k inserciones
- 3 fases, 19 plans
- Requisitos: 31/31 completos (FONT-01..04, DS-01..04, COMP-01..08, SCREEN-01..06, COPY-01..03, MOTION-01..03, A11Y-01..03)
- ~1 día desde el arranque de v1.1 (2026-07-05) hasta el cierre (2026-07-06)

**Git range:** `feat(08-02)` → `feat(10)` (`v1.0.0` → `v1.1.0`)

**Milestone audit:** PASSED — ver `.planning/milestones/v1.1-MILESTONE-AUDIT.md`

**What's next:** Deploy a producción (web → Vercel; worker → Railway/VPS; Resend con dominio verificado; revisión GDPR ligera) y luego v2 (monetización: planes de pago, auditorías/URLs ilimitadas, Stripe; enriquecimiento ENRICH).

---

## v1.0 MVP (Shipped: 2026-07-06)

**Delivered:** Auditor web tipo Screaming-Frog automatizado como lead magnet — crawler, 5 categorías de checks (SEO técnico, on-page, datos estructurados, AEO, rendimiento/CWV), scoring, reporte con diff entre corridas y flujo de email con double opt-in y cuota semanal. Verificado con datos reales sobre juan-tech.com.

**Phases completed:** 1-7 (7 plans total)

**Key accomplishments:**

- Monorepo pnpm+Turborepo: `apps/web` (Next.js, Vercel) encola; `apps/worker` (Crawlee, contenedor propio) ejecuta crawl+checks+PSI. Postgres (Neon) + Redis/BullMQ (Upstash).
- Crawler Crawlee: sitemap + sitemap index + fallback link-crawl, respeta robots.txt, rate-limit, cap 500 URLs, progreso consultable.
- 20 checks SEO técnico + on-page; datos estructurados JSON-LD estilo Classy Schema + grafo de entidades; AEO (crawlers IA, llms.txt); rendimiento/CWV vía PageSpeed Insights muestreado y cacheado.
- Scoring health-ratio size-independent (overall 91 vs 86 de referencia), reporte `/audits/[id]` con issues priorizados y diff nuevos/persistentes/resueltos.
- Email double opt-in + normalización + registro de consentimiento + cuota 1/semana/email + historial persistido.

**Stats:**

- 7 fases, 7 plans; paquetes db, queue, crawler, checks, psi, scoring, email, quota (+ web, worker)
- 140 tests verdes; typecheck + build limpios
- Requisitos: 63/63 v1 completos
- 6 bugs reales encontrados y arreglados durante la verificación

**Git range:** milestone v1.0 cerrado en `2b3bf6f` (tag `v1.0.0`)

**What's next:** Overhaul de UI/UX y marca (v1.1).

---
