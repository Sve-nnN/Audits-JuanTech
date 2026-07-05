# Requirements: Auditor Web (SEO/Técnico)

**Defined:** 2026-07-05
**Core Value:** Cualquier persona ingresa una URL y recibe una auditoría completa, precisa y accionable de su web (errores reales priorizados por severidad), a cambio de su email verificado.

## v1 Requirements

Requisitos para el release inicial (lead magnet gratuito). Cada uno mapea a una fase del roadmap.

### Fundamentos (INFRA)

- [ ] **INFRA-01**: El proyecto se estructura como monorepo con app web (Next.js/Vercel) y worker de fondo desplegables por separado
- [ ] **INFRA-02**: Existe un esquema de base de datos persistente (Postgres) para email, sitio, auditoría, corrida, página e issue
- [ ] **INFRA-03**: La app web encola un job de auditoría en una cola (Redis) y el worker lo consume (wiring end-to-end verificable con un job no-op)
- [ ] **INFRA-04**: El worker actualiza el estado del job en la base de datos (queued → running → done/failed) como fuente única de verdad

### Motor de Crawler (CRAWL)

- [ ] **CRAWL-01**: El crawler descubre URLs desde sitemap.xml (incluye sitemap index / sitemaps anidados)
- [ ] **CRAWL-02**: Si no hay sitemap, el crawler descubre URLs siguiendo enlaces internos desde la home (fallback)
- [ ] **CRAWL-03**: El crawler respeta robots.txt (no rastrea rutas bloqueadas para su user-agent)
- [ ] **CRAWL-04**: El crawler aplica rate limiting / concurrencia conservadora por dominio para no ser bloqueado ni abusar del sitio destino
- [ ] **CRAWL-05**: El crawler descarga y parsea el HTML de cada página (extracción con Cheerio) capturando status HTTP, headers y cadena de redirects
- [ ] **CRAWL-06**: El crawl respeta el límite de 500 URLs por auditoría en free tier
- [ ] **CRAWL-07**: El crawl reporta progreso (páginas rastreadas / total estimado) consultable desde la UI
- [ ] **CRAWL-08**: El crawl es resiliente: timeouts por URL y por job, reintentos, y detección de jobs colgados (no deja zombis)

### SEO Técnico (TECH)

- [ ] **TECH-01**: Detecta accesibilidad y contenido de robots.txt
- [ ] **TECH-02**: Detecta presencia y validez de sitemap.xml (conteo de URLs)
- [ ] **TECH-03**: Reporta el código de estado HTTP de cada página y marca páginas internas con error (4xx/5xx)
- [ ] **TECH-04**: Verifica la etiqueta canonical de cada página
- [ ] **TECH-05**: Evalúa indexabilidad (meta robots / X-Robots-Tag: index/noindex)
- [ ] **TECH-06**: Detecta cadenas de redirects
- [ ] **TECH-07**: Detecta viewport meta tag
- [ ] **TECH-08**: Detecta contenido duplicado y near-duplicate entre páginas (fingerprint tipo SimHash/shingling)
- [ ] **TECH-09**: Analiza profundidad de clic y detecta páginas huérfanas
- [ ] **TECH-10**: Verifica reciprocidad de hreflang y conflictos canonical-hreflang
- [ ] **TECH-11**: Detecta mixed content (recursos HTTP servidos en páginas HTTPS)
- [ ] **TECH-12**: Verifica enlaces externos rotos (HEAD/GET, detecta 4xx/5xx/timeout)
- [ ] **TECH-13**: Verifica recursos rotos (imágenes, CSS, JS)

### On-Page (ONPAGE)

- [ ] **ONPAGE-01**: Evalúa title tag (presencia, longitud, calidad de keyword)
- [ ] **ONPAGE-02**: Evalúa meta description (presencia, longitud, calidad)
- [ ] **ONPAGE-03**: Evalúa H1 (presencia, unicidad)
- [ ] **ONPAGE-04**: Verifica alt text en imágenes (cobertura)
- [ ] **ONPAGE-05**: Verifica Open Graph tags
- [ ] **ONPAGE-06**: Evalúa longitud de contenido (conteo de palabras)
- [ ] **ONPAGE-07**: Verifica atributo lang del documento

### Datos Estructurados (SD)

- [ ] **SD-01**: Detecta presencia de bloques JSON-LD
- [ ] **SD-02**: Valida la sintaxis/validez de cada bloque JSON-LD
- [ ] **SD-03**: Clasifica y evalúa impacto de schemas por tipo (Organization, WebSite, FAQPage, Person, etc.)

### Rendimiento / Core Web Vitals (PERF)

- [ ] **PERF-01**: Obtiene Performance Score (Lighthouse) móvil y desktop vía Google PageSpeed Insights API sobre una muestra de páginas
- [ ] **PERF-02**: Reporta LCP, CLS, INP y TTFB (móvil y desktop) cuando estén disponibles
- [ ] **PERF-03**: El muestreo de páginas para PSI respeta las cuotas de la API y cachea resultados (no corre PSI en las 500 URLs)
- [ ] **PERF-04**: Cada métrica se compara contra los umbrales oficiales de Google (LCP ≤ 2500ms, INP ≤ 200ms, etc.) y se marca su severidad

### Visibilidad en IA / AEO (AEO)

- [ ] **AEO-01**: Verifica control de acceso de crawlers de IA en robots.txt (GPTBot, ClaudeBot, PerplexityBot, Google-Extended)
- [ ] **AEO-02**: Verifica presencia y estructura de llms.txt / llms-full.txt (peso bajo en el score)
- [ ] **AEO-03**: Evalúa datos estructurados orientados a IA (FAQPage, Article, Organization/Person con sameAs)
- [ ] **AEO-04**: Evalúa formato de contenido para extracción por IA (encabezados como preguntas, listas, tablas, longitud de párrafo)

### Scoring y Reporte (SCORE)

- [ ] **SCORE-01**: Calcula un score por categoría (0-100) con estado (Bueno / Necesita mejora / Crítico)
- [ ] **SCORE-02**: Calcula un score general ponderado a partir de los scores por categoría
- [ ] **SCORE-03**: Clasifica cada issue en severidad (Crítico / Necesita mejora / Bueno-OK) con estándar de 3 niveles
- [ ] **SCORE-04**: Genera una tabla de issues prioritarios ordenada por severidad
- [ ] **SCORE-05**: Cada issue incluye valor medido, fuente, criterio y recomendación
- [ ] **REPORT-01**: El reporte se visualiza en la web (score general, scores por categoría, tabla priorizada y detalle por issue)
- [ ] **REPORT-02**: Cada auditoría tiene un ID/URL único para consultar su reporte

### Comparación de Corridas (DIFF)

- [ ] **DIFF-01**: Cada issue tiene un fingerprint estable (check_id + URL normalizada) para poder comparar corridas
- [ ] **DIFF-02**: El sistema compara la corrida actual contra la anterior del mismo sitio/email y marca issues nuevos, persistentes y resueltos

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

Se completa durante la creación del roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (pendiente — lo llena el roadmapper) | — | Pending |

**Coverage:**
- v1 requirements: 54 total
- Mapped to phases: 0 (pendiente)
- Unmapped: 54 ⚠️

---
*Requirements defined: 2026-07-05*
*Last updated: 2026-07-05 after initial definition*
