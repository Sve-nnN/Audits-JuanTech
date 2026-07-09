---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Profundizar checks técnicos + visualización de arquitectura
status: "Phase 17 in progress (Plan 17-01 executed)"
stopped_at: "Plan 17-01 completado (SD-06 schemaContentMismatchCheck + contrato renderVerdictByPageId). Falta Plan 17-02."
last_updated: "2026-07-09T15:09:50.853Z"
last_activity: 2026-07-09 — Phase 17 Plan 01 ejecutado (SD-06 schemaContentMismatchCheck registrado en schemaSiteChecks, renderVerdictByPageId en SiteCheckCtx/RunAllChecksOptions)
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 4
  completed_plans: 3
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-08 after v1.2)

**Core value:** Cualquier persona ingresa una URL y recibe una auditoría completa, precisa y accionable de su web (errores reales priorizados por severidad), a cambio de su email verificado.
**Current focus:** v1.3 (Profundizar checks técnicos + visualización de arquitectura) — roadmap creado (Phases 16-20), 13/13 requisitos mapeados. Próximo: `/gsd:plan-phase 16`.

## Current Position

Phase: 17 (Check schema-contenido mismatch) — in progress
Plan: 01 complete (SD-06 schemaContentMismatchCheck + contrato renderVerdictByPageId), 02 pending (reordenar runRenderSample antes de runAllChecks en el worker, exponer RenderIssueDraft.verdict)
Status: Phase 17 in progress (Plan 17-01 executed)
Last activity: 2026-07-09 — Phase 17 Plan 01 ejecutado (SD-06 schemaContentMismatchCheck registrado en schemaSiteChecks, renderVerdictByPageId en SiteCheckCtx/RunAllChecksOptions)

## Performance Metrics

**Velocity:**

- Total plans completed: 1 (en v1.1)
- Average duration: ~2 min
- Total execution time: <1 hora

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 9 | 1 | ~2 min | ~2 min |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 3 P3 | 60 | 5 tasks | 30 files |
| Phase 7 P1 | 90 min | 5 tasks | 29 files |
| Phase 8 P5 | 15 min | 2 tasks | 2 files |
| Phase 8 P4 | 8 min | 2 tasks | 4 files |
| Phase 8 P3 | 8 min | 2 tasks | 5 files |
| Phase 8 P2 | 3 min | 2 tasks | 1 file |
| Phase 8 P1 | 4 min | 3 tasks | 4 files |
| Phase 09 P05 | 8min | 2 tasks | 4 files |
| Phase 10 P01 | 8 min | 3 tasks | 4 files |
| Phase 09 P06 | 4min | 2 tasks | 2 files |
| Phase 10 P04 | ~15 min | 1 task | 2 files |
| Phase 10 P07 | ~12m | 2 tasks | 2 files |
| Phase 10 P03 | ~5 min | 2 tasks | 3 files |
| Phase 10 P02 | ~35 min | 1 task | 2 files |
| Phase 10 P05 | ~20m | 2 tasks | 4 files |
| Phase 10 P08 | ~12 min | 1 task | 3 files |
| Phase 11 P01 | ~12 min | 2 tasks | 3 files |
| Phase 11 P02 | ~6 min | 2 tasks | 3 files |
| Phase 11 P03 | ~5 min | 2 tasks | 3 files |
| Phase 11 P04 | ~6 min | 2 tasks | 2 files |
| Phase 12 P01 | ~4 min | 2 tasks | 6 files |
| Phase 12 P02 | ~4 min | 2 tasks | 6 files |
| Phase 12 P03 | ~7 min | 3 tasks | 7 files |
| Phase 13 P01 | ~14 min | 2 tasks | 9 files |
| Phase 13 P02 | ~22 min | 3 tasks | 10 files |
| Phase 13 P03 | ~7 min | 3 tasks | 11 files |
| Phase 13 P04 | ~10 min | 2 tasks | 5 files |
| Phase 14 P01 | ~7 min | 3 tasks | 7 files |
| Phase 15 P01 | ~4 min | 2 tasks | 5 files |
| Phase 15 P03 | ~6 min | 2 tasks | 3 files |
| Phase 16 P01 | ~20 min | 2 tasks | 6 files |
| Phase 16 P02 | 20min | 2 tasks | 7 files |
| Phase 17 P01 | 20min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 16]: 16-01 (DEPTH-01/03): nuevo paquete `@auditor/graph` con `buildLinkGraph(pages, origin)` puro — reusa el patrón de extracción de links de `canonicalDeep.ts` (cheerio + `normalizeUrl`/`sameRegistrableDomain`), BFS desde home con shortest-path garantizado, orphans/páginas sin html/enlaces externos excluidos sin lanzar excepción. `GraphPage` decoplado de `@auditor/db` (id/url/finalUrl/html mínimo). 7 tests TDD RED→GREEN, typecheck limpio, cero `any`. Listo para que 16-02 lo cablee en el worker y persista en `Audit.stats.graph`.
- [Roadmap v1.3]: Fases 16-20 anexadas en riesgo ascendente según research (SUMMARY.md): (16) grafo/BFS de enlaces compartido + check de profundidad de clics real (corrige la premisa de que `Page.depth` sirve tal cual — el BFS de `crawl.ts` sólo corre en fallback link-crawl puro, nunca en modo sitemap-seeded); (17) schema-contenido mismatch (independiente, cruza con la muestra CSR/SSR de v1.2); (18) diagnósticos de Lighthouse desde PSI (aislado en `packages/psi`, extracción antes del cacheo reducido de `parser.ts`/`cache.ts`); (19) agrupación por plantilla (decisión de UI compartida — generalizar `IssueTypeGroup` — antes del visualizador); (20) visualizador de arquitectura (mayor superficie nueva, SVG puro estilo `EntityGraphSvg.tsx`, depende del grafo/BFS de Phase 16, opcionalmente muestra la plantilla de Phase 19). Ningún paquete nuevo; el grafo/BFS se persiste en `Audit.stats` (mismo mecanismo que `stats.perf`) para que Phase 16 y Phase 20 nunca reparseen HTML por separado.
- [Phase 15]: 15-03 (REPORT-04, cierre de fase y milestone v1.2): `JsonLdBadge` (client component, apps/web/app/components/ui) deriva el peor de 4 estados JSON-LD con `jsonLdStateForPage` (helper puro 15-01) cruzando `schemaSeverities` (issues category=schema de la página) con `hasSchemaGraph = nodeCount > 0`, y lo mapea a variantes existentes de `Badge` sin colores nuevos: error→critical "JSON-LD con errores", warning→warning "JSON-LD con advertencias", ok→ok "{n} entidad(es) JSON-LD", absent→neutral "Sin JSON-LD". `pages/page.tsx` añade una segunda consulta `issue.findMany({ where:{ auditId, category:"schema" }, select:{ pageId, severity } })` agrupada en un `Map<pageId, ReportSeverity[]>` (severity de Prisma casteada a ReportSeverity), sustituyendo el badge de 2 estados por `JsonLdBadge`; resto de la fila (enlace, shortUrl, Reveal, orderBy url, EmptyState) intacto. TDD RED→GREEN en el badge; 28 tests web verdes (5 nuevos del badge) + typecheck + build.
- [Phase 15]: 15-01 (REPORT-01/02/04): dos helpers puros en @auditor/report-model (sin React/Prisma). `groupIssuesByType(issues)` = única fuente del orden: agrupa por clave compuesta `checkId`+espacio+`title` (subtipos del mismo checkId con títulos distintos = grupos separados), severidad del grupo = la peor (peso local {critical:0,warning:1,ok:2}), ordena por (peso asc, count desc) con empate total resuelto por orden de inserción del Map (estable sin depender de Array.sort), no muta la entrada y no pierde issues (suma counts == longitud, T-15-01). Tipo `IssueTypeGroup {checkId,title,severity,count,issues}`. `jsonLdStateForPage(schemaSeverities, hasSchemaGraph)` = peor de 4 estados con precedencia critical→"error" > warning→"warning" > (grafo presente)→"ok" > "absent"; devuelve solo el estado semántico (el mapeo a badge/color vive en la UI del plan 03). Tipo `JsonLdState`. Ambos exportados de index.ts. TDD RED→GREEN por tarea; 17 tests verdes (7 grouping + 5 jsonld + 5 build) + typecheck limpio.
- [Phase 14]: 14-01 (EXPORT-04, cierre de fase): client component `ExportMenu` (apps/web/app/components/ui) — trigger reusa `Button` (variant secondary, iconLeft Download, loading) con aria-haspopup/expanded/controls; menú `role="menu"` construido a mano (no hay Dropdown en la librería) con 3 items `role="menuitem"` (FileText/FileCode/Presentation), roving tabindex, teclado completo (Enter/Space/ArrowDown abre→primer item, ArrowUp→último, flechas con wrap, Home/End, Esc devuelve foco al trigger, Tab/click-fuera cierran sin exportar). Foco del trigger vía `document.getElementById(triggerId)` porque Button no reenvía ref (patrón 10-02). Descarga: `fetch('/api/audits/${auditId}/export?format=X')` → `blob()` → enlace temporal (`createObjectURL`+download+click+remove) → `revokeObjectURL` en finally; filename parseado de Content-Disposition con fallback `auditoria-<domain|id>.<ext>`. Guard `if (loading) return;` + Button disabled bloquean el doble fetch (SC#3). Error inline `role="alert"` con texto neutro fijo, se limpia al reintentar. CSS module tokens-only (cero hex). Montado en el header del reporte (rama done) agrupado con el linkOut en `.headerActions`. Primera suite RTL de apps/web: `// @vitest-environment jsdom` por archivo (env node por defecto se mantiene para las route tests de Phase 13); `@vitejs/plugin-react` añadido para transformar JSX bajo rolldown-vite; `cleanup()` explícito en afterEach (globals off). 18 tests verdes (11 ExportMenu + 7 route) + typecheck + build verdes.
- [Phase 13]: 13-04 (EXPORT-01/02/03/05, cierre de fase): route Node `GET /api/audits/[id]/export?format=pdf|md|pptx` (runtime nodejs) que lee `buildReportModel(auditId)` y devuelve el archivo con el serializer del formato (`toMarkdown`/`toPdf`/`toPptx`) como descarga — `Content-Type` por formato (application/pdf, text/markdown; charset=utf-8, presentationml) + `Content-Disposition: attachment; filename="auditoria-<slug(domain)>-<auditId>.<ext>"`. Validación con type guard (union pdf|md|pptx) → 400 sin tocar la DB; `buildReportModel → null` → 404. Acceso por auditId sin auth (free tier), cero PII. `body` tipado string|Uint8Array con cast a BodyInit (el Node runtime acepta Buffer/Uint8Array pero el tipo DOM los omite). @auditor/export añadida como dependency del web + vitest como devDep (primera suite de tests de apps/web). route.test.ts: 7 tests (3 formatos con firma %PDF/MD/PK + 400×2 + 404 + cero PII en MD) con vi.mock del builder y serializers reales. Guardarrail de frontera extendido con Check D en scripts/assert-no-playwright-in-web.mjs: pnpm why puppeteer/chromium en el web sin edges reales (reusa el filtro non-peer de Check C); prueba que @auditor/export, ahora dep real del web, no arrastra browser engine. assert:web-boundary PASS + build verde.
- [Init]: Frontend Next.js (Vercel) + worker/cola en contenedor propio (crawl+Lighthouse no cabe en serverless corto)
- [Init]: Modo de trabajo GSD: YOLO
- [Init]: Granularidad Standard → roadmap de 7 fases (v1.0)
- [Init]: Cuota free: 1 auditoría/semana/email, 500 URLs; cobro diferido a v2
- [Phase ?]: Phase 3: SimHash Hamming threshold=3 (tuneable) para near-duplicate content; validar empíricamente contra juan-tech.com
- [Phase 7]: Interfaces de storage (VerificationStore, AuditCountStore) para probar lógica de tokens/cuota 100% offline; dev-mode expone devVerifyUrl en request-verification para probar el flujo sin bandeja de entrada real.
- [Roadmap v1.1]: Fases 8-10 anexadas (fundamentos de marca → librería de componentes → pantallas+copy+motion+a11y). UI-only, no toca pipeline de v1.0.
- [Roadmap v1.2]: Fases 11-15 anexadas en riesgo ascendente: checks puros (canonical/headings + fix CWV) → render CSR/SSR (worker-only) → fundación export (libs JS puras, sin Chromium en Vercel) → botón export → UX reporte (agrupación/JSON-LD). Aditivo, no rompe el pipeline validado.
- [Phase ?]: 09-05: EmptyState/ErrorState y CategoryAccordion (composites wave 3) sobre details/summary nativos; EmptyState consume Button, acordeón consume Badge; tokens-only, cero hex
- [Phase ?]: IssuesTable estado vacio remapea text-muted a success
- [Phase ?]: 10-07: History desacoplado de home.module.css con history.module.css propio; locale fecha es neutro; STATUS_LABEL desde labels.ts
- [Phase 10]: 10-02: Home SCREEN-01 re-skineado con clases nuevas (.home/.shell/.hero/.flowCard); clases legacy de home.module.css preservadas para History; foco de paso por document.getElementById (Input no expone ref); dead-space fix sin centrado al viewport; copy neutro exacto del UI-SPEC.
- [Phase ?]: 10-03: SCREEN-02 verify desacoplado de home.module.css (verify.module.css propio); 4 estados con Button/ErrorState de Fase 9; copy neutro sin voceo; POST /api/verify preservado
- [Phase ?]: Report gauge count-up feeds interpolated value into ScoreGauge; reduced-motion final value
- [Phase 10]: 10-08: skip-to-content global en layout (no solo reporte); breadcrumb de pages a --accent-text; barra A11Y/responsive/motion validada en las 6 pantallas
- [Phase 11]: 11-02: headings = nuevo checkId ONPAGE-08 con fingerprint sub-tipado (skip/empty/order/h1-dup-title), una fila por subtipo; ONPAGE-03 (conteo/unicidad H1) intacto; todas WARNING
- [Phase 11]: 11-03 (REPORT-03): PerfIssueDraft gana source?: string; mapPerfIssues lo puebla con la url en todas las ramas; worker mapea source: draft.source ?? null en lugar del null hardcodeado
- [Phase 11]: 11-04 (SC#5): guardarraíl integrado phase11-guardrail.test.ts — canonical (TECH-04:*) + headings (ONPAGE-08:*) en la misma página no colapsan en diffIssues (fingerprints únicos) y fixture sana no desvía el score; @auditor/scoring añadido como devDependency de @auditor/checks (workspace)
- [Phase 12]: 12-03 (RENDER-01/03, cierre de fase): runRenderSample cableado best-effort en el worker tras el pase PSI (doble guarda: degradación interna + try/catch externo → auditoría siempre llega a `done`, SC#3); sus issues `aeo` entran a issueRowsWithoutDiff sin tocar diff/score/persist. Primer apps/worker/Dockerfile multi-stage pinneado a mcr.microsoft.com/playwright:v1.61.1-noble (SC#4), arranca `node --import tsx dist/index.js` (paquetes @auditor/* exponen TS source). scripts/assert-no-playwright-in-web.mjs (root script assert:web-boundary) prueba que @auditor/render nunca resuelve en el grafo de apps/web — refinado para tolerar la cadena peer preexistente de crawlee (pnpm why playwright NO discrimina web de worker). browser.ts desacoplado del DOM ambiental vía shim en globalThis para que el worker (lib Node) typechee el source de render.
- [Phase 12]: 12-02 (RENDER-01/03): capa Playwright en @auditor/render — launchBrowser (1 Chromium, args low-shm) + snapshotPage (context fresco, timeout 15s vía goto + Promise.race, context.close en finally en TODOS los caminos, T-12-03/04); runRenderSample best-effort reusa selectSample(MAX_RENDER_PAGES=10, indep. de PSI), lanes=RENDER_CONCURRENCY(2), degrada cualquier throw/block/timeout a undeterminedVerdict, NUNCA rechaza; snapshot inyectable → tests sin Chromium real (15 verdes); playwright pineado 1.61.1 solo en render; @auditor/psi añadido como dep de render; DOM lib en tsconfig para page.evaluate
- [Phase 13]: 13-03 (EXPORT-01/05): tercer serializer toPdf(model):Promise<Buffer> vía @react-pdf/renderer (renderer propio, sin navegador headless). Roles tipográficos v1.1 embebidos por Font.register de DOS familias: Khand (400/600) para TODOS los headings (portada/sección/categoría/título de issue) y Geist Sans (400) para el body; Array reservada a display, NO se embebe ni se usa en títulos. TTFs vendorizadas en src/fonts/ vía fetch-fonts.mjs reproducible (Khand descargada de google/fonts ofl/khand; Geist copiada del paquete geist local; fallback woff2→sfnt con wawoff2 devDep) — sfnt válidos con cobertura Latin completa (áéíóúñ¿¡). Estructura: portada (dominio+score+status) → Scores por categoría (CATEGORY_ORDER) → issues priorizados vía prioritizeIssues(model.priorityCandidates) con nota "Mostrando N de M". react ^19 añadido como dep (peer de @react-pdf); jsx=react-jsx en tsconfig. pdf.test.ts extrae texto con pdf-parse (import profundo lib/pdf-parse.js) y valida acentos en HEADING Khand Y body Geist Sans, nota N de M, cero PII (texto y binario) y ambas fuentes embebidas. 25 tests + typecheck verdes; grep Array==0 y headless==0 en pdf.tsx.
- [Phase 13]: 13-02 (EXPORT-02/03/05): nuevo paquete puro @auditor/export (JS puro, sin Chromium) — priority.ts con EXPORT_TOP_N=50 (tuneable) y prioritizeIssues() que opera SIEMPRE sobre model.priorityCandidates (set completo critical+warning, M=totalPriorityCandidates), única fuente del cap para los tres formatos, con nota "Mostrando N de M"; markdown.ts toMarkdown() estructurado por issue → checkId → página/selector → valor medido → criterio → recomendación (listo para LLM); pptx.ts toPptx()→Uint8Array in-memory vía pptxgenjs 4.0.1 con fórmula BASE_SLIDES=7 (portada+resumen+5 categorías) + 0..MAX_ISSUE_SLIDES(5) issues → total garantizado en [7,12] incluso sparse (0 issues→exactamente 7); buildPptxDeck expone slideCount para test. labels.ts duplica CATEGORY_ORDER/LABEL, STATUS/SEVERITY_LABEL y SEVERITY_SORT_WEIGHT sin depender de apps/web. Guardrail cero-PII (no-pii.test.ts): email/token en scope adyacente nunca aparecen en MD/PPTX; acentos/ñ preservados en ambos (extracción de texto del PPTX vía unzip JSZip en memoria). 19 tests + typecheck verdes.
- [Phase 13]: 13-01 (EXPORT-01/02/03/05): nuevo paquete puro @auditor/report-model — buildReportModel(auditId) devuelve un ReportModel serializable (cero React/Prisma/PII) que reemplaza el ensamblado inline de page.tsx; expone priorityCandidates (set completo critical+warning, fuente de la M en "N de M") aparte de priorityIssues (cap 60) y totalPriorityCandidates; url del issue derivada replicando issueUrl (source ?? scope) para render idéntico; buildReportModel retorna null para audit inexistente O status != done (page.tsx conserva consulta ligera para notFound vs progreso). Base compartida para los serializers de export (Plans 02/03).
- [Phase 12]: 12-01 (RENDER-01/02): nuevo paquete worker-only @auditor/render (cheerio, cero Playwright); detectRenderVerdict puro compara raw Page.html vs RenderedSnapshot (title/H1/texto + ratio<0.60→CSR); severidad SSR→ok/CSR→warning, NUNCA critical; category "aeo"; fingerprint RENDER-01:<verdict>:<url>; RenderIssueDraft local decoplado de @auditor/checks; undeterminedVerdict() para degradación de 12-02; RENDER_CSR_RATIO=0.60 tuneable
- [Phase 16]: 16-02 (DEPTH-01/02/03, cierre de fase): worker computa buildLinkGraph una sola vez post-crawl/pre-checks, pasa depthByUrl a runAllChecks (SiteCheckCtx/RunAllChecksOptions extendidos opcionalmente), nuevo SiteCheck TECH-14 emite un único issue agregado (ok/warning) con % de páginas a más de 3 clics de home vía siteFingerprint, y Audit.stats.graph ({nodes,edges,depthByUrl}) se persiste solo en la escritura final status:done (nunca en progreso intermedio), listo para Phase 20.
- [Phase 17-01]: SCHEMA-06/07: schemaContentMismatchCheck (SD-06, site-level) detecta FAQPage/HowTo/Product+AggregateRating/Review sin contenido visible correspondiente, severidad warning siempre (literal hardcodeado, nunca critical), suprimido solo por veredicto explicito renderVerdictByPageId==='csr' (undetermined/ausente sigue evaluando normal). RenderVerdictValue redeclarado localmente en @auditor/checks sin dependencia real de @auditor/render (preserva assert-no-playwright-in-web.mjs).

### Pending Todos

None yet.

### Blockers/Concerns

- [Research flag, Phase 16]: Umbral exacto de severidad para profundidad de clics (ok ≤3, warning en 4, critical en ≥5 sugerido pero no confirmado con Juan) — decidir en planning de Phase 16, detalle de producto de bajo riesgo.
- [Research flag, Phase 16]: Backfill de audits previos a v1.3 para el grafo/BFS persistido en `Audit.stats` — audits existentes no tendrán este dato; PITFALLS.md sugiere degradar sin backfill ("no disponible para auditorías previas a esta versión") como opción de bajo costo, decidir en Phase 16.
- [Research flag, Phase 17]: Umbral de "coincidencia suficiente" entre texto de JSON-LD y contenido visible (más robusto que patrones fijos div/dt/dd) es una decisión de producto a afinar con casos de prueba reales durante la ejecución de Phase 17, no en research.
- [Research flag, Phase 18]: Verificar vigencia de `overallSavingsMs` vs `metricSavings` en la versión exacta de Lighthouse detrás de PSI v5 (MEDIUM confidence en STACK.md) — validar con log/print de la respuesta real durante Phase 18, no bloquea el diseño.
- [Roadmap]: REQUIREMENTS.md traceability section tenía un conteo desactualizado ("54 total"); el conteo real de requisitos v1 es 61. Se corrigió durante la creación del roadmap.
- [Research flag, Phase 5]: Verificar cuotas actuales de PageSpeed Insights API en Google Cloud Console antes de finalizar diseño de muestreo/caché (cifras de research son MEDIUM confidence).
- [Research flag, Phase 3]: Decidir si hreflang reciprocity check es "presence-only" (recomendado v1) o validación completa de grafo cross-domain (mayor esfuerzo).
- [Research flag, Phase 6]: La fórmula de pesos del score es una decisión de producto, no un hecho investigado — validar contra el reporte de referencia (86/100) antes de lanzar.
- [Research flag, Phase 7]: Revisión legal/GDPR ligera pendiente como compuerta pre-lanzamiento, no resoluble sólo con ingeniería.
- [Roadmap v1.1]: REQUIREMENTS.md v1.1 decía "30 total" en su encabezado de coverage, pero el listado real tiene 31 requisitos (FONT4+DS4+COMP8+SCREEN6+COPY3+MOTION3+A11Y3). Se corrigió el conteo durante la creación del roadmap; los 31 quedaron mapeados.

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-07-08 (v1.2):

| Category | Item | Status |
|----------|------|--------|
| human_needed | Phase 12 — verificación humana runtime Docker: correr el contenedor pinneado con una auditoría real (≥10 páginas) en paralelo con PSI para confirmar cero Chromium huérfanos / OOM bajo concurrencia 2 | Deferred to deploy (aceptado por Juan) |
| human_needed | Phase 13 — verificación humana render visual del PDF: abrir un PDF real para confirmar glifos Khand/Geist y acentos áéíóúñ¿¡ | Deferred to deploy (aceptado por Juan) |

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | PAY-01/02/03 (planes de pago, ilimitado, Stripe) | Deferred to v2 | Init |
| v2 | ENRICH-01..04 (raw vs rendered HTML sample, export PDF, SSE, Domain Rating) | Deferred to v2 | Init |

## Session Continuity

Last session: 2026-07-09T15:09:50.849Z
Stopped at: Plan 17-01 completado (SD-06 schemaContentMismatchCheck + contrato renderVerdictByPageId). Falta Plan 17-02.
Resume file: None
