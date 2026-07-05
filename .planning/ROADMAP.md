# Roadmap: Auditor Web (SEO/Técnico) — Lead Magnet para juan-tech.com

## Overview

El proyecto se construye de adentro hacia afuera: primero el esqueleto de datos y cola que conecta la app web con el worker de fondo (sin eso nada más puede persistir ni ejecutarse sin bloquear requests); luego el motor de crawler que descubre y rastrea páginas de forma confiable (la pieza de mayor riesgo real, por variabilidad de sitios externos); después las capas de checks que consumen esos datos rastreados, empezando por SEO técnico y on-page (sin dependencias externas), sumando datos estructurados y AEO (el diferenciador del producto), y dejando Rendimiento/CWV al final de las categorías de check porque es la única con límites de API externos y variabilidad de Lighthouse. Con las cinco categorías de checks completas, se construye el scoring, la comparación entre corridas y el reporte visual. Por último, el flujo de verificación de email y cuota se cierra como compuerta obligatoria antes de cualquier lanzamiento público, aunque gran parte de su trabajo (tablas de email/cuota, endpoint de creación de auditoría) puede construirse en paralelo con las fases anteriores.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Fundamentos — monorepo, esquema de datos y cola** - Wiring end-to-end verificable (enqueue → dequeue → estado en DB) antes de cualquier lógica de crawl
- [x] **Phase 2: Motor de crawler** - Descubrimiento, rastreo y parseo confiables de hasta 500 URLs por sitio
- [x] **Phase 3: SEO Técnico + On-Page** - Checks sin dependencias externas sobre las páginas ya rastreadas (completed 2026-07-05)
- [ ] **Phase 4: Datos Estructurados + AEO** - Validación de JSON-LD y visibilidad en IA (diferenciador del producto)
- [ ] **Phase 5: Rendimiento / Core Web Vitals** - Integración con PageSpeed Insights, muestreada y cacheada
- [ ] **Phase 6: Scoring, comparación de corridas y reporte** - Score general/por categoría, tabla priorizada y diff entre auditorías
- [ ] **Phase 7: Verificación de email, cuota y compuerta de lanzamiento** - Double opt-in, normalización, rate limiting y persistencia de historial

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

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fundamentos — monorepo, esquema de datos y cola | 1/1 | Complete ✅ | 2026-07-05 |
| 2. Motor de crawler | 1/1 | Complete ✅ | 2026-07-05 |
| 3. SEO Técnico + On-Page | 1/1 | Complete   | 2026-07-05 |
| 4. Datos Estructurados + AEO | 0/1 | Planned    |  |
| 5. Rendimiento / Core Web Vitals | 0/TBD | Not started | - |
| 6. Scoring, comparación de corridas y reporte | 0/TBD | Not started | - |
| 7. Verificación de email, cuota y compuerta de lanzamiento | 0/TBD | Not started | - |

---
*Roadmap created: 2026-07-05*
*Granularity: standard (7 phases)*
