# Requirements: Auditor Web (SEO/Técnico)

**Defined:** 2026-07-05
**Core Value:** Cualquier persona ingresa una URL y recibe una auditoría completa, precisa y accionable de su web (errores reales priorizados por severidad), a cambio de su email verificado.

## v1 Requirements

Requisitos para el release inicial (lead magnet gratuito). Cada uno mapea a una fase del roadmap.

### Fundamentos (INFRA)

- [x] **INFRA-01**: El proyecto se estructura como monorepo con app web (Next.js/Vercel) y worker de fondo desplegables por separado
- [x] **INFRA-02**: Existe un esquema de base de datos persistente (Postgres) para email, sitio, auditoría, corrida, página e issue
- [x] **INFRA-03**: La app web encola un job de auditoría en una cola (Redis) y el worker lo consume (wiring end-to-end verificable con un job no-op)
- [x] **INFRA-04**: El worker actualiza el estado del job en la base de datos (queued → running → done/failed) como fuente única de verdad

### Motor de Crawler (CRAWL)

- [x] **CRAWL-01**: El crawler descubre URLs desde sitemap.xml (incluye sitemap index / sitemaps anidados)
- [x] **CRAWL-02**: Si no hay sitemap, el crawler descubre URLs siguiendo enlaces internos desde la home (fallback)
- [x] **CRAWL-03**: El crawler respeta robots.txt (no rastrea rutas bloqueadas para su user-agent)
- [x] **CRAWL-04**: El crawler aplica rate limiting / concurrencia conservadora por dominio para no ser bloqueado ni abusar del sitio destino
- [x] **CRAWL-05**: El crawler descarga y parsea el HTML de cada página (extracción con Cheerio) capturando status HTTP, headers y cadena de redirects
- [x] **CRAWL-06**: El crawl respeta el límite de 500 URLs por auditoría en free tier
- [x] **CRAWL-07**: El crawl reporta progreso (páginas rastreadas / total estimado) consultable desde la UI
- [x] **CRAWL-08**: El crawl es resiliente: timeouts por URL y por job, reintentos, y detección de jobs colgados (no deja zombis)

### SEO Técnico (TECH)

- [x] **TECH-01**: Detecta accesibilidad y contenido de robots.txt
- [x] **TECH-02**: Detecta presencia y validez de sitemap.xml (conteo de URLs)
- [x] **TECH-03**: Reporta el código de estado HTTP de cada página y marca páginas internas con error (4xx/5xx)
- [x] **TECH-04**: Verifica la etiqueta canonical de cada página
- [x] **TECH-05**: Evalúa indexabilidad (meta robots / X-Robots-Tag: index/noindex)
- [x] **TECH-06**: Detecta cadenas de redirects
- [x] **TECH-07**: Detecta viewport meta tag
- [x] **TECH-08**: Detecta contenido duplicado y near-duplicate entre páginas (fingerprint tipo SimHash/shingling)
- [x] **TECH-09**: Analiza profundidad de clic y detecta páginas huérfanas
- [x] **TECH-10**: Verifica reciprocidad de hreflang y conflictos canonical-hreflang
- [x] **TECH-11**: Detecta mixed content (recursos HTTP servidos en páginas HTTPS)
- [x] **TECH-12**: Verifica enlaces externos rotos (HEAD/GET, detecta 4xx/5xx/timeout)
- [x] **TECH-13**: Verifica recursos rotos (imágenes, CSS, JS)

### On-Page (ONPAGE)

- [x] **ONPAGE-01**: Evalúa title tag (presencia, longitud, calidad de keyword)
- [x] **ONPAGE-02**: Evalúa meta description (presencia, longitud, calidad)
- [x] **ONPAGE-03**: Evalúa H1 (presencia, unicidad)
- [x] **ONPAGE-04**: Verifica alt text en imágenes (cobertura)
- [x] **ONPAGE-05**: Verifica Open Graph tags
- [x] **ONPAGE-06**: Evalúa longitud de contenido (conteo de palabras)
- [x] **ONPAGE-07**: Verifica atributo lang del documento

### Datos Estructurados (SD)

- [x] **SD-01**: Detecta presencia de bloques JSON-LD
- [x] **SD-02**: Valida la sintaxis/validez de cada bloque JSON-LD
- [x] **SD-03**: Clasifica y evalúa impacto de schemas por tipo (Organization, WebSite, FAQPage, Person, etc.)
- [x] **SD-04**: Valida cada bloque JSON-LD contra schema.org por página (propiedades requeridas/recomendadas por tipo, tipos de valor, referencias `@id` no resueltas) y reporta errores y warnings, estilo Classy Schema
- [x] **SD-05**: Construye y visualiza un grafo de entidades del JSON-LD por página (nodos por `@type`/`@id`, aristas por `@id`/references/`sameAs`) mostrando las conexiones entre entidades

### Rendimiento / Core Web Vitals (PERF)

- [x] **PERF-01**: Obtiene Performance Score (Lighthouse) móvil y desktop vía Google PageSpeed Insights API sobre una muestra de páginas
- [x] **PERF-02**: Reporta LCP, CLS, INP y TTFB (móvil y desktop) cuando estén disponibles
- [x] **PERF-03**: El muestreo de páginas para PSI respeta las cuotas de la API y cachea resultados (no corre PSI en las 500 URLs)
- [x] **PERF-04**: Cada métrica se compara contra los umbrales oficiales de Google (LCP ≤ 2500ms, INP ≤ 200ms, etc.) y se marca su severidad

### Visibilidad en IA / AEO (AEO)

- [x] **AEO-01**: Verifica control de acceso de crawlers de IA en robots.txt (GPTBot, ClaudeBot, PerplexityBot, Google-Extended)
- [x] **AEO-02**: Verifica presencia y estructura de llms.txt / llms-full.txt (peso bajo en el score)
- [x] **AEO-03**: Evalúa datos estructurados orientados a IA (FAQPage, Article, Organization/Person con sameAs)
- [x] **AEO-04**: Evalúa formato de contenido para extracción por IA (encabezados como preguntas, listas, tablas, longitud de párrafo)

### Scoring y Reporte (SCORE)

- [x] **SCORE-01**: Calcula un score por categoría (0-100) con estado (Bueno / Necesita mejora / Crítico)
- [x] **SCORE-02**: Calcula un score general ponderado a partir de los scores por categoría
- [x] **SCORE-03**: Clasifica cada issue en severidad (Crítico / Necesita mejora / Bueno-OK) con estándar de 3 niveles
- [x] **SCORE-04**: Genera una tabla de issues prioritarios ordenada por severidad
- [x] **SCORE-05**: Cada issue incluye valor medido, fuente, criterio y recomendación
- [x] **REPORT-01**: El reporte se visualiza en la web (score general, scores por categoría, tabla priorizada y detalle por issue)
- [x] **REPORT-02**: Cada auditoría tiene un ID/URL único para consultar su reporte

### Comparación de Corridas (DIFF)

- [x] **DIFF-01**: Cada issue tiene un fingerprint estable (check_id + URL normalizada) para poder comparar corridas
- [x] **DIFF-02**: El sistema compara la corrida actual contra la anterior del mismo sitio/email y marca issues nuevos, persistentes y resueltos

### Captura y Verificación de Email (AUTH)

- [ ] **AUTH-01**: El usuario deja su email para solicitar una auditoría
- [ ] **AUTH-02**: El email se normaliza (lowercase, strip de plus-addressing, filtro de dominios desechables) antes de guardar
- [ ] **AUTH-03**: El usuario recibe un email de verificación (double opt-in) con enlace/token único
- [ ] **AUTH-04**: El acceso a lanzar una auditoría se habilita sólo tras verificar el email
- [ ] **AUTH-05**: Se registra evidencia de consentimiento (timestamp, IP, texto mostrado) al verificar

### Cuota y Rate Limiting (QUOTA)

- [ ] **QUOTA-01**: Cada email verificado tiene derecho a 1 auditoría por semana (rolling 7 días)
- [ ] **QUOTA-02**: Cada auditoría free está limitada a 500 URLs rastreadas
- [ ] **QUOTA-03**: El sistema bloquea/encola con mensaje claro cuando se excede la cuota semanal
- [ ] **QUOTA-04**: Se persiste el historial de auditorías por email (sitio, stats, fecha, estado de corrección de errores)

## v2 Requirements

Diferido a futuro. Rastreado pero fuera del roadmap actual.

### Monetización (PAY)

- **PAY-01**: Planes de pago con auditorías ilimitadas
- **PAY-02**: URLs ilimitadas por auditoría en planes pagos
- **PAY-03**: Integración de cobro (Stripe)

### Enriquecimiento (ENRICH)

- **ENRICH-01**: Comparación HTML crudo vs renderizado con Playwright sobre muestra de páginas (detección de dependencia de JS rendering)
- **ENRICH-02**: Export del reporte a PDF / compartible
- **ENRICH-03**: Progreso en tiempo real vía SSE (sobre el polling de v1)
- **ENRICH-04**: Domain Rating u otras métricas externas (Ahrefs) como contexto opcional

## Out of Scope

Excluido explícitamente. Documentado para evitar scope creep.

| Feature | Reason |
|---------|--------|
| Cobro / planes pagos / ilimitado | v2 — primero validar propuesta con free tier |
| Corrección automática de errores en el sitio del usuario | La herramienta detecta y recomienda, no modifica sitios ajenos |
| Domain Rating como parte del score | Métrica de contexto, no del cálculo; evita dependencia de datos pagos de terceros en el core |
| Playwright en las 500 URLs del crawl | Costo/tiempo prohibitivo a escala; v2 sólo sobre muestra |
| Crawlear rutas bloqueadas por robots.txt | Anti-feature: riesgo legal/reputacional y de bloqueo |
| App móvil nativa | v1 es web |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| CRAWL-01 | Phase 2 | Pending |
| CRAWL-02 | Phase 2 | Pending |
| CRAWL-03 | Phase 2 | Pending |
| CRAWL-04 | Phase 2 | Pending |
| CRAWL-05 | Phase 2 | Pending |
| CRAWL-06 | Phase 2 | Pending |
| CRAWL-07 | Phase 2 | Pending |
| CRAWL-08 | Phase 2 | Pending |
| TECH-01 | Phase 3 | Complete |
| TECH-02 | Phase 3 | Complete |
| TECH-03 | Phase 3 | Complete |
| TECH-04 | Phase 3 | Complete |
| TECH-05 | Phase 3 | Complete |
| TECH-06 | Phase 3 | Complete |
| TECH-07 | Phase 3 | Complete |
| TECH-08 | Phase 3 | Complete |
| TECH-09 | Phase 3 | Complete |
| TECH-10 | Phase 3 | Complete |
| TECH-11 | Phase 3 | Complete |
| TECH-12 | Phase 3 | Complete |
| TECH-13 | Phase 3 | Complete |
| ONPAGE-01 | Phase 3 | Complete |
| ONPAGE-02 | Phase 3 | Complete |
| ONPAGE-03 | Phase 3 | Complete |
| ONPAGE-04 | Phase 3 | Complete |
| ONPAGE-05 | Phase 3 | Complete |
| ONPAGE-06 | Phase 3 | Complete |
| ONPAGE-07 | Phase 3 | Complete |
| SD-01 | Phase 4 | Complete |
| SD-02 | Phase 4 | Complete |
| SD-03 | Phase 4 | Complete |
| SD-04 | Phase 4 | Complete |
| SD-05 | Phase 4 | Complete |
| AEO-01 | Phase 4 | Complete |
| AEO-02 | Phase 4 | Complete |
| AEO-03 | Phase 4 | Complete |
| AEO-04 | Phase 4 | Complete |
| PERF-01 | Phase 5 | Pending |
| PERF-02 | Phase 5 | Pending |
| PERF-03 | Phase 5 | Pending |
| PERF-04 | Phase 5 | Pending |
| SCORE-01 | Phase 6 | Pending |
| SCORE-02 | Phase 6 | Pending |
| SCORE-03 | Phase 6 | Pending |
| SCORE-04 | Phase 6 | Pending |
| SCORE-05 | Phase 6 | Pending |
| REPORT-01 | Phase 6 | Pending |
| REPORT-02 | Phase 6 | Pending |
| DIFF-01 | Phase 6 | Pending |
| DIFF-02 | Phase 6 | Pending |
| AUTH-01 | Phase 7 | Pending |
| AUTH-02 | Phase 7 | Pending |
| AUTH-03 | Phase 7 | Pending |
| AUTH-04 | Phase 7 | Pending |
| AUTH-05 | Phase 7 | Pending |
| QUOTA-01 | Phase 7 | Pending |
| QUOTA-02 | Phase 7 | Pending |
| QUOTA-03 | Phase 7 | Pending |
| QUOTA-04 | Phase 7 | Pending |

**Coverage:**

- v1 requirements: 63 total (se agregaron SD-04 y SD-05: validación estilo Classy Schema + grafo de entidades)
- Mapped to phases: 63/63 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-05*
*Last updated: 2026-07-05 after adding SD-04/SD-05 (schema validation + entity graph) to Phase 4*
