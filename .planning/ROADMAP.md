# Roadmap: Auditor Web (SEO/Técnico) — Lead Magnet para juan-tech.com

## Overview

El proyecto se construye de adentro hacia afuera: primero el esqueleto de datos y cola que conecta la app web con el worker de fondo (sin eso nada más puede persistir ni ejecutarse sin bloquear requests); luego el motor de crawler que descubre y rastrea páginas de forma confiable (la pieza de mayor riesgo real, por variabilidad de sitios externos); después las capas de checks que consumen esos datos rastreados, empezando por SEO técnico y on-page (sin dependencias externas), sumando datos estructurados y AEO (el diferenciador del producto), y dejando Rendimiento/CWV al final de las categorías de check porque es la única con límites de API externos y variabilidad de Lighthouse. Con las cinco categorías de checks completas, se construye el scoring, la comparación entre corridas y el reporte visual. Por último, el flujo de verificación de email y cuota se cierra como compuerta obligatoria antes de cualquier lanzamiento público, aunque gran parte de su trabajo (tablas de email/cuota, endpoint de creación de auditoría) puede construirse en paralelo con las fases anteriores.

**Milestone v1.1 (UI/UX y marca):** una vez validado el pipeline funcional en v1.0, el overhaul de UI se construye de fundamentos hacia afuera: primero las fuentes de marca y el design system (tokens, tema claro/oscuro, layout base) porque todo lo demás depende de esas variables y decisiones visuales; luego la librería de componentes reutilizables (score gauge, cards, badges, tabla de issues, acordeones, formularios, estados vacíos/skeletons) que consume esos tokens; y por último las pantallas completas, donde se ensamblan los componentes, se aplica el copy humanizado, el motion sutil y se valida accesibilidad/responsive de punta a punta. No se toca lógica de crawl/checks/scoring/email.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Fundamentos — monorepo, esquema de datos y cola** - Wiring end-to-end verificable (enqueue → dequeue → estado en DB) antes de cualquier lógica de crawl
- [x] **Phase 2: Motor de crawler** - Descubrimiento, rastreo y parseo confiables de hasta 500 URLs por sitio
- [x] **Phase 3: SEO Técnico + On-Page** - Checks sin dependencias externas sobre las páginas ya rastreadas (completed 2026-07-05)
- [x] **Phase 4: Datos Estructurados + AEO** - Validación de JSON-LD y visibilidad en IA (diferenciador del producto)
- [x] **Phase 5: Rendimiento / Core Web Vitals** - Integración con PageSpeed Insights, muestreada y cacheada
- [x] **Phase 6: Scoring, comparación de corridas y reporte** - Score general/por categoría, tabla priorizada y diff entre auditorías
- [x] **Phase 7: Verificación de email, cuota y compuerta de lanzamiento** - Double opt-in, normalización, rate limiting y persistencia de historial (completed 2026-07-06)
- [x] **Phase 8: Fundamentos de marca — fuentes y design system** - Tipografía de marca (Array/Khand/Geist), tokens de diseño y theming claro/oscuro sin flash (completed 2026-07-06)
- [ ] **Phase 9: Librería de componentes** - Score gauge, cards, badges, tabla de issues, acordeones, formularios, estados vacíos y skeletons pulidos y reutilizables
- [ ] **Phase 10: Pantallas rediseñadas, copy, motion y accesibilidad** - Todas las pantallas ensambladas con copy humanizado, motion sutil y accesibilidad/responsive validados

## Phase Details

### Phase 1: Fundamentos — monorepo, esquema de datos y cola

**Goal**: Existe la base de datos, el monorepo (web + worker) y la cola de trabajos, con un job no-op que prueba el wiring completo Vercel↔Redis↔worker↔Postgres.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):

  1. El monorepo tiene app web (Next.js) y worker desplegables por separado, cada uno con su propio proceso de build/deploy.
  2. El esquema de Postgres existe y es consultable para email, site, audit, page, issue y quota_usage.
  3. Al encolar un job no-op desde la web, el worker lo toma y actualiza su estado en la base de datos: queued → running → done.
  4. Un job que se cuelga o falla se detecta y se marca como failed en vez de quedar zombi indefinidamente.

**Plans**: TBD

### Phase 2: Motor de crawler

**Goal**: Dado cualquier sitio, el sistema descubre y rastrea de forma confiable hasta 500 páginas, respetando robots.txt y sin ser bloqueado por el sitio destino.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: CRAWL-01, CRAWL-02, CRAWL-03, CRAWL-04, CRAWL-05, CRAWL-06, CRAWL-07, CRAWL-08
**Success Criteria** (what must be TRUE):

  1. Un sitio con sitemap.xml (incluyendo sitemap index anidado) tiene todas sus URLs descubiertas y rastreadas.
  2. Un sitio sin sitemap igual se rastrea siguiendo enlaces internos desde la home (fallback).
  3. El crawl nunca excede 500 URLs y nunca rastrea rutas bloqueadas por robots.txt.
  4. El progreso del crawl (páginas rastreadas / total estimado) es consultable desde la UI mientras corre.
  5. Una página lenta o rota no cuelga ni tumba el crawl completo (timeouts, reintentos, sin zombis).

**Plans**: TBD

### Phase 3: SEO Técnico + On-Page

**Goal**: Cada página rastreada produce hallazgos precisos de SEO técnico y on-page, sin depender de APIs externas.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: TECH-01, TECH-02, TECH-03, TECH-04, TECH-05, TECH-06, TECH-07, TECH-08, TECH-09, TECH-10, TECH-11, TECH-12, TECH-13, ONPAGE-01, ONPAGE-02, ONPAGE-03, ONPAGE-04, ONPAGE-05, ONPAGE-06, ONPAGE-07
**Success Criteria** (what must be TRUE):

  1. Cada página reporta su código HTTP, canonical, indexabilidad y cadena de redirects, marcando 4xx/5xx internos como error.
  2. El sistema detecta contenido duplicado/near-duplicate, páginas huérfanas, problemas de hreflang y mixed content en todo el sitio.
  3. Enlaces externos rotos y recursos rotos (imágenes/CSS/JS) quedan reportados.
  4. Title, meta description, H1, alt text, Open Graph, longitud de contenido y atributo lang se evalúan por página.

**Plans**: TBD

### Phase 4: Datos Estructurados + AEO

**Goal**: Cada página rastreada produce hallazgos de validez de datos estructurados y de visibilidad ante motores de IA.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: SD-01, SD-02, SD-03, SD-04, SD-05, AEO-01, AEO-02, AEO-03, AEO-04
**Success Criteria** (what must be TRUE):

  1. La presencia y validez sintáctica de cada bloque JSON-LD se detecta y reporta, clasificando el tipo de schema y su impacto.
  2. Cada bloque JSON-LD se valida contra schema.org (propiedades requeridas/recomendadas, referencias `@id` no resueltas) y sus errores/warnings se reportan por página, estilo Classy Schema.
  3. Cada página con datos estructurados muestra un grafo de entidades (nodos por `@type`/`@id`, aristas por `@id`/references/`sameAs`) que visualiza las conexiones entre entidades.
  4. El control de acceso de crawlers de IA (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) en robots.txt se evalúa explícitamente.
  5. La presencia de llms.txt/llms-full.txt se reporta como señal de bajo peso, y el formato de contenido para extracción por IA (encabezados como preguntas, listas, tablas, longitud de párrafo) se evalúa.

**Plans**: TBD
**UI hint**: yes

### Phase 5: Rendimiento / Core Web Vitals

**Goal**: Cada auditoría incluye datos reales de rendimiento y Core Web Vitals sobre una muestra de páginas, sin agotar la cuota de PageSpeed Insights.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04
**Success Criteria** (what must be TRUE):

  1. Una muestra representativa de páginas (no las 500) obtiene Performance Score móvil y desktop vía PSI.
  2. LCP, CLS, INP y TTFB se reportan cuando la API los provee, para móvil y desktop.
  3. Los resultados de PSI se cachean por URL+estrategia, evitando re-consultar en corridas próximas y respetando cuotas.
  4. Cada métrica se compara contra los umbrales oficiales de Google y se marca su severidad; una falla/límite de PSI degrada el reporte parcialmente en vez de hacerlo fallar completo.

**Plans**: TBD

### Phase 6: Scoring, comparación de corridas y reporte

**Goal**: El usuario puede ver un reporte completo, priorizado y comparado contra su auditoría anterior del mismo sitio.
**Mode:** mvp
**Depends on**: Phase 3, Phase 4, Phase 5
**Requirements**: SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05, REPORT-01, REPORT-02, DIFF-01, DIFF-02
**Success Criteria** (what must be TRUE):

  1. Cada auditoría completada muestra un score general y scores por categoría con estado (Bueno / Necesita mejora / Crítico).
  2. Una tabla de issues priorizados por severidad es visible, y cada issue muestra valor medido, fuente, criterio y recomendación.
  3. Cada auditoría tiene una URL única donde se puede consultar su reporte.
  4. Al correr una segunda auditoría del mismo sitio, el reporte marca qué issues son nuevos, persistentes o resueltos respecto a la corrida anterior.

**Plans**: TBD
**UI hint**: yes

### Phase 7: Verificación de email, cuota y compuerta de lanzamiento

**Goal**: Sólo emails verificados y dentro de su cuota semanal pueden lanzar una auditoría, con mitigaciones de abuso activas.
**Mode:** mvp
**Depends on**: Phase 1 (paralelizable con Fases 2-6; compuerta obligatoria antes de lanzamiento público)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, QUOTA-01, QUOTA-02, QUOTA-03, QUOTA-04
**Success Criteria** (what must be TRUE):

  1. Un usuario debe dejar su email y verificarlo (double opt-in) antes de poder lanzar una auditoría.
  2. El email se normaliza (lowercase, sin plus-addressing, filtrado de dominios desechables) antes de guardarse.
  3. Se registra evidencia de consentimiento (timestamp, IP, texto mostrado) al momento de verificar.
  4. Un email verificado no puede iniciar más de 1 auditoría por ventana móvil de 7 días; al exceder la cuota recibe un mensaje claro.
  5. El historial de auditorías por email (sitio, stats, fecha, estado de corrección de errores) se persiste y es consultable.

**Plans**: TBD

### Phase 8: Fundamentos de marca — fuentes y design system

**Goal**: El auditor tiene tipografía de marca, tokens de diseño y theming claro/oscuro consistentes, sirviendo de base para toda la librería de componentes y las pantallas.
**Mode:** mvp
**Depends on**: Phase 6 (consume el reporte y las pantallas existentes de v1.0 como superficie a rediseñar)
**Requirements**: FONT-01, FONT-02, FONT-03, FONT-04, DS-01, DS-02, DS-03, DS-04
**Success Criteria** (what must be TRUE):

  1. El texto de display usa Array (self-hosted vía `next/font/local`), los títulos/UI usan Khand, el body usa Geist Sans y el código/métricas usan Geist Mono, con fallbacks y `font-display: swap` en toda la app.
  2. Los tokens de color, tipografía, espaciado, radios, sombras y z-index están centralizados como variables CSS y se usan en vez de valores hardcodeados.
  3. La paleta de marca y la escala de severidad (crítico/advertencia/ok) y de estados (good/needs_improvement/critical) son coherentes en toda la interfaz.
  4. El usuario puede alternar entre modo claro y oscuro, la preferencia persiste (localStorage) entre sesiones y no hay flash de tema incorrecto al cargar.
  5. Todas las pantallas comparten el mismo layout base (contenedor, grid, header/footer).

**Plans**: 5 plans

- [x] 08-01-PLAN.md — Fuentes de marca + dependencias (geist/next-themes, fonts.ts, Array woff2)
- [x] 08-02-PLAN.md — Design tokens (tokens.css: primitivos + semánticos dark/light)
- [x] 08-03-PLAN.md — Theming next-themes: providers, ThemeToggle, globals + layout wiring
- [x] 08-04-PLAN.md — Layout base shell (header/footer/container/grid) montado en layout
- [x] 08-05-PLAN.md — Migración de CSS Modules v1.0 (home/report) a tokens, sin regresión

**UI hint**: yes

### Phase 9: Librería de componentes

**Goal**: Existe una librería de componentes reutilizables y pulidos, construida sobre los tokens y fuentes de la Fase 8, que cubre todos los patrones visuales necesarios para las pantallas del auditor.
**Mode:** mvp
**Depends on**: Phase 8
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07, COMP-08
**Success Criteria** (what must be TRUE):

  1. El score gauge/círculo muestra el score general con color por estado y número legible.
  2. Las cards por categoría muestran score, estado y etiqueta de forma consistente entre sí.
  3. Los badges de severidad y de diff (nuevo/persistente/resuelto) son componentes reutilizables en toda la app.
  4. La tabla de issues es responsive (colapsa o scrollea en móvil) y su columna de URL es clickeable.
  5. El acordeón de detalle por categoría, los botones/inputs/formularios con sus estados (hover/focus/disabled/error), los estados vacíos/de error con copy e ícono, y los skeletons de carga están implementados y listos para usarse en cualquier pantalla.

**Plans**: 6 plans

- [x] 09-01-PLAN.md — Fundación: verificar/instalar lucide-react + extraer labels.ts y url.ts compartidos
- [x] 09-02-PLAN.md — ScoreGauge (COMP-01) + CategoryCard (COMP-02): score-state visual pair
- [ ] 09-03-PLAN.md — Badge severidad/diff (COMP-03) + Skeleton con shimmer accesible (COMP-08)
- [ ] 09-04-PLAN.md — Button + Input + Field con estados accesibles (COMP-06)
- [ ] 09-05-PLAN.md — EmptyState/ErrorState (COMP-07) + CategoryAccordion (COMP-05)
- [ ] 09-06-PLAN.md — IssuesTable responsive con URL sticky/clickeable + estado vacío (COMP-04)

**UI hint**: yes

### Phase 10: Pantallas rediseñadas, copy, motion y accesibilidad

**Goal**: Todas las pantallas del auditor (home, verificación, progreso, reporte, páginas + grafo, historial) quedan ensambladas con los componentes de la Fase 9, con copy humanizado, motion sutil y accesibilidad/responsive validados de punta a punta.
**Mode:** mvp
**Depends on**: Phase 8, Phase 9
**Requirements**: SCREEN-01, SCREEN-02, SCREEN-03, SCREEN-04, SCREEN-05, SCREEN-06, COPY-01, COPY-02, COPY-03, MOTION-01, MOTION-02, MOTION-03, A11Y-01, A11Y-02, A11Y-03
**Success Criteria** (what must be TRUE):

  1. El home presenta un hero y un flujo email→verificar→URL claro, jerárquico y profesional; la página de verificación de email muestra con claridad los estados de éxito, error y expirado.
  2. El progreso de auditoría muestra la fase actual (rastreando / analizando / midiendo rendimiento) con feedback vivo y animado, sin sensación de estar colgado.
  3. El reporte `/audits/[id]` muestra hero score, categorías, issues prioritarios, detalle de problemas/correctos, rendimiento y diff, y todos sus textos (incluyendo recomendaciones de issues, mensajes de error/cuota/verificación) están en español neutro sin voceo, humanizados, sin tells de IA.
  4. Las páginas rastreadas y el grafo de entidades se navegan con un visual limpio; el historial por email lista auditorías con score, fecha y acceso al reporte.
  5. Todas las animaciones (score que cuenta, reveal de secciones, transiciones, hover) respetan `prefers-reduced-motion`; todas las pantallas son responsive (móvil/tablet/desktop) sin overflow horizontal, con contraste AA en ambos temas, foco visible, roles/labels ARIA y navegación por teclado funcional (acordeones, toggle de tema, formularios).

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fundamentos — monorepo, esquema de datos y cola | 1/1 | Complete ✅ | 2026-07-05 |
| 2. Motor de crawler | 1/1 | Complete ✅ | 2026-07-05 |
| 3. SEO Técnico + On-Page | 1/1 | Complete   | 2026-07-05 |
| 4. Datos Estructurados + AEO | 1/1 | Complete ✅ | 2026-07-05 |
| 5. Rendimiento / Core Web Vitals | 1/1 | Complete ✅ | 2026-07-05 |
| 6. Scoring, comparación de corridas y reporte | 1/1 | Complete ✅ | 2026-07-05 |
| 7. Verificación de email, cuota y compuerta de lanzamiento | 1/1 | Complete   | 2026-07-06 |
| 8. Fundamentos de marca — fuentes y design system | 5/5 | Complete   | 2026-07-06 |
| 9. Librería de componentes | 2/6 | In Progress|  |
| 10. Pantallas rediseñadas, copy, motion y accesibilidad | 0/? | Not started | - |

---
*Roadmap created: 2026-07-05*
*Granularity: standard (7 phases v1.0 + 3 phases v1.1 = 10 phases)*
*v1.1 phases (8-10) appended: 2026-07-06*
*Phase 8 planned: 2026-07-06 (5 plans, 3 waves)*
*Phase 9 planned: 2026-07-06 (6 plans, 4 waves)*
