# Backlog — mejoras diferidas

Insumos capturados fuera del scope del milestone en curso. Léelo al abrir un milestone nuevo (`/gsd:new-milestone`).

## v1.4 (candidatas)

### URL-RESOLVE-01 — Resolución canónica de la URL de entrada
**Origen:** Feedback de Juan durante la validación visual de v1.3 (2026-07-09).

**Problema:** El usuario debería poder ingresar solo `aprendoclub.com` y que el sistema resuelva todo automáticamente. Hoy:
- El input SÍ acepta dominio pelado sin protocolo (`normalizeDomain` en `apps/web/app/api/audits/route.ts:29`). ✓
- Pero el worker hardcodea `startUrl = https://${audit.site.domain}` (`apps/worker/src/index.ts:272`). NO resuelve:
  - **http vs https**: asume https siempre; un sitio solo-http fallaría.
  - **redirect a www / canónico**: si `aprendoclub.com` redirige a `www.aprendoclub.com`, el crawler sigue el redirect por página (Crawlee captura `finalUrl`), pero `origin` y el sitemap discovery siguen usando `https://aprendoclub.com` — posible mismatch en el grafo de enlaces (Phase 16) y checks que comparan contra `origin`.

**Fix propuesto:** Antes de crawlear, una función de resolución canónica que:
1. Pruebe `https://<domain>`; si falla la conexión, pruebe `http://<domain>`.
2. Haga un GET/HEAD del home y siga los redirects hasta la URL final real (www o no, con/sin barra).
3. Use esa URL resuelta como `startUrl`/`origin` para todo el pipeline (crawl, sitemap discovery, grafo, checks).
4. Guarde la URL canónica resuelta (¿en `Audit` o `Site`?) para mostrarla en el reporte.

**Notas:** Es parte del core value ("cualquier persona ingresa una URL y recibe una auditoría"). Reduce fricción del lead magnet. Scope no trivial — merece su propia fase con discuss (dónde persistir la URL resuelta, cómo manejar dominios que no responden en ningún protocolo, timeout de resolución).

**Nota (2026-07-09):** El síntoma más grave del mismatch www (grafo de arquitectura vacío para sitios que redirigen a www) ya se mitigó puntualmente en `buildLinkGraph` (`resolveHomeKey` fallback a la página root del mismo registrable domain). Pero la resolución canónica completa (usar la URL real resuelta como `startUrl`/`origin` en TODO el pipeline) sigue pendiente — el worker aún arranca en `https://<domain>` sin resolver http/https ni www.

### SCHEMA-VIZ-01 — Visualizador de schema completo (estilo Classy Schema)
**Origen:** Feedback de Juan durante validación de v1.3 (2026-07-09), con HTML de referencia de Classy Schema.

Tres piezas. La **#1 (grafo expandido) ya se implementó** como quick fix (commit `f715448`, `buildEntityGraph` expande entidades anidadas). Faltan:

2. **Código JSON-LD formateado por schema** en el reporte: mostrar el bloque `<script type="application/ld+json">` de cada entidad, formateado/indentado, con las propiedades legibles (treelist: `@type`, `author`, `datePublished`, `headline`, etc.) — como el panel derecho de Classy Schema.
3. **Validación por propiedad/tipo con errores individuales**: validar cada entidad y propiedad contra el vocabulario de schema.org y mostrar por nodo: "BlogPosting is a valid schema.org type", "articleSection is a valid property", y advertencias como "Product is missing reviews" (columnas error/warning/success por fila, como el treelist de Classy Schema). Es la pieza más grande — requiere una fuente del vocabulario schema.org (tipos + propiedades válidas + a qué tipo pertenece cada propiedad).

**Referencia:** HTML de Classy Schema (treelist DevExtreme `dx-treelist` con columnas de error/warning/success + expanders con descripciones de schema.org) guardado en el hilo de conversación del 2026-07-09.

## v1.7 (candidatas)

**Origen:** Pedido directo de Juan (2026-08-01), durante la corrida autónoma de v1.6, referenciando https://www.opengraph.to/ como inspiración de producto (API, docs, MCP server, home).

### API-01 — API pública segmentada por categoría de auditoría
Endpoints tipo `/api/v1/opengraph`, `/api/v1/onpage`, `/api/v1/technical`, etc. (no necesariamente una auditoría completa por endpoint, segmentada por categoría de check). Autenticación vía API key generable por el usuario desde su cuenta. Requiere: diseño de rate limiting/cuota por key (separado de la cuota de email del free tier), modelo de datos para API keys (creación/revocación/scopes), y definición de qué categorías se exponen como endpoint independiente vs sólo como parte de la auditoría completa existente.

### DOCS-01 — Documentación tipo blog, categorizada
Sección de artículos (estilo https://www.opengraph.to/articles) donde cada artículo explica un tipo de error/check, categorizado por categoría del reporte (técnico, on-page, CWV, datos estructurados, AEO, social). Contenido derivable del catálogo de checks ya existente (`packages/checks/src/registry.ts` + los `checkId` documentados) — candidato a generarse semi-automáticamente desde ahí en vez de escribirse 100% a mano.

### MCP-01 — MCP server con API key por usuario
Server MCP (ej. `auditor-mcp`, instalable vía `npx`) con tools tipo `inspect_og`/`suggest_og_tags` (y potencialmente equivalentes para otras categorías), autenticado con la misma API key de API-01. Referencia funcional: OpenGraph MCP Server (`opengraph-mcp`, dos tools: `inspect_og` fetch+score de OG tags, `suggest_og_tags` genera HTML recomendado).

### AUTH-01 — Sistema de sesiones seguro (JWT/cookies) + rol admin
Sesiones con expiración configurable (X días/horas), logout, cookies httpOnly/secure o JWT firmado — decidir cuál durante research (ambos son legítimos, trade-offs de revocación vs statelessness). Un correo maestro/admin (`juancarlosanguloabud@gmail.com`) sin límites de cuota/rate-limit. Reemplaza o convive con el flujo actual de verificación por email/double-opt-in (a definir en discuss: ¿el admin también pasa por double opt-in, o tiene bypass total?).

### SEC-01 — Auditoría OWASP Top 10 del sistema completo
Pasada completa de seguridad (OWASP Top 10 2021 o la versión vigente al momento) sobre todo el sistema — no sólo lo nuevo de v1.7, sino el pipeline existente (auth, quota, API nueva, MCP server). Candidato a `gsd-security-auditor`/threat model formal en vez de checklist ad-hoc.

### HOME-01 — Rediseño de home inspirado en opengraph.to
Home más orientado a SEO (server-rendered, metadata rica) y que muestre auditorías recientemente inspeccionadas (requiere decidir: ¿todas las auditorías públicas son listables, o sólo si el usuario opta in? implicancia de privacidad — hoy el email/sitio auditado no es necesariamente público).

**Notas generales:** Scope grande, multi-feature — tratar como milestone propio (v1.7) vía `/gsd-new-milestone`, no como fase suelta. Varias piezas tienen implicancias de seguridad/privacidad que merecen su propio research antes de roadmap (API keys + rate limiting, modelo de sesión JWT vs cookie, qué datos de auditorías son público-listables para el home).

## Milestone futuro (candidata, sin numerar aún) — Auditoría de `claude-seo`

**Origen:** Pedido directo de Juan (2026-08-02), durante la corrida autónoma de v1.6 (Phase 30 ejecutando).

### AUDIT-EXT-01 — Revisión completa de `github.com/AgricIDaniel/claude-seo` para extraer mejoras
Revisar el repo completo (checks, catálogo de reglas, cualquier heurística de SEO técnico/on-page/contenido que implemente) y evaluar qué vale la pena portar o adaptar al catálogo de `packages/checks` existente. Restricción explícita de Juan: **todo lo que se agregue debe ser determinístico, sin dependencia de AI/LLM** — a pesar de que el repo de referencia se llama "claude-seo" (posiblemente usa IA en su propio pipeline), lo que se busca es la LÓGICA de detección/reglas, no una integración de IA. Si alguna mejora identificada requiere una API externa o un servicio de datos (ej. algo tipo PSI/CrUX, WHOIS, algún check que necesite una fuente de terceros), evaluarlo igual y documentar el trade-off (rate limits, costo, dependencia externa) — no descartarlo de entrada sólo por necesitar una API, pero sí dejar afuera cualquier cosa que dependa de un modelo de lenguaje para decidir un resultado del check.

**Notas:** Antes de escribir roadmap, esto necesita una fase de research dedicada (leer el repo referenciado, mapear qué checks/reglas tiene contra el catálogo actual de `packages/checks/src/registry.ts`, identificar gaps reales vs. duplicados de lo que ya existe). Candidato a research previo vía `/gsd-new-milestone` (research automático) o un `/gsd-spike` acotado sólo de lectura del repo externo antes de comprometerse a fases concretas.

## Tech debt diferida — v1.6 Phase 30

### WR-05 — Regresión de recomendaciones por CMS para los checks SOCIAL-01..08
**Origen:** `30-VERIFICATION.md` (Phase 30, 2026-08-03). Decisión de Juan: diferir, no bloquea v1.6.

Phase 29 retiró `ONPAGE-05` del catálogo activo de checks, pero `packages/cms-adapters/src/types.ts` sigue listando `ONPAGE-05` en `SUPPORTED_CHECK_IDS` y no tiene ninguna entrada para los 8 checks nuevos `SOCIAL-01`..`SOCIAL-08` (Phase 30). Consecuencia: toda incidencia de Open Graph sobre WordPress/Shopify/Webflow/Wix/Squarespace pierde la recomendación específica de plataforma que tenía antes de v1.6 y cae al texto genérico; un slot del catálogo de "10 checks de mayor volumen" queda ocupado por un checkId que ya no puede dispararse. `coverage.test.ts` sigue en verde porque itera sobre la tupla vieja, sin detectar el gap.

**Fix propuesto:** en `packages/cms-adapters`, reemplazar la entrada `ONPAGE-05` por los 8 checkIds `SOCIAL-01..08` en `SUPPORTED_CHECK_IDS` de cada adaptador relevante (WordPress/builder, Shopify, Webflow, Wix/Squarespace), con el copy de fix correspondiente por plataforma. Mismo patrón que el resto de `cms-adapters` (Phase 27).

**Notas:** Buen candidato para agruparlo con Phase 32 (panel de preview + snippets de fix) si esa fase todavía no arrancó, ya que ambos tocan la experiencia de "cómo arreglar" un problema de meta/social — o como fase propia de v1.7 si Phase 32 ya cerró sin incluirlo.
