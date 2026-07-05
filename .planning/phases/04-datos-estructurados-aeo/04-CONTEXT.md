# Phase 4: Datos Estructurados + AEO - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Mode:** Autonomous (incluye pedido explícito del usuario: validación estilo Classy Schema + grafo de entidades)

<domain>
## Phase Boundary

Cada página rastreada produce hallazgos de validez de datos estructurados (JSON-LD) y de visibilidad ante motores de IA (AEO). Cubre SD-01..05 y AEO-01..04. Consume `Page.html` (Fase 2). Genera `Issue` + datos de grafo de entidades por página. Incluye UI del grafo (diferenciador). NO incluye scoring global (Fase 6).
</domain>

<decisions>
## Implementation Decisions

### Checks de datos estructurados (SD)
- **SD-01** presencia de bloques JSON-LD (`<script type="application/ld+json">`).
- **SD-02** validez sintáctica (JSON parseable) de cada bloque.
- **SD-03** clasificación por `@type` y evaluación de impacto (Organization, WebSite, FAQPage, Person, Article, ProfessionalService, BreadcrumbList, Product, etc.).
- **SD-04 (Classy Schema style):** validación semántica contra schema.org por página: propiedades requeridas/recomendadas por tipo, tipos de valor esperados, y **referencias `@id` no resueltas** (un `@id` referenciado que no existe como nodo). Devuelve errores (falta requerida) y warnings (falta recomendada). Implementación con un mapa local type→{required, recommended} para los tipos comunes + reglas genéricas (`@context`, `@type`, `@id`, `sameAs`). No depende de red.
- **SD-05 (grafo de entidades):** construir un grafo por página: nodos = entidades JSON-LD (por `@type`/`@id`), aristas = referencias (`@id` apuntando a otro nodo, `sameAs`, propiedades que referencian entidades). Persistir el grafo (JSON) para render. UI: visualización del grafo (nodos/aristas) en el reporte de la página.

### Checks AEO
- **AEO-01** control de acceso de crawlers de IA en robots.txt: GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot, etc. Reportar allow/deny por bot (deny puede ser intencional o error — informar, severidad baja/informativa).
- **AEO-02** presencia/estructura de `llms.txt` y `llms-full.txt`. Peso bajo (research: 97% reciben cero requests de IA). Severidad informativa.
- **AEO-03** datos estructurados orientados a IA: FAQPage, Article (con campos), Organization/Person con `sameAs`.
- **AEO-04** formato de contenido para extracción por IA: encabezados como preguntas, listas, tablas, longitud de párrafo promedio.

### Grey areas resueltos
- schema.org validation es pragmática (mapa local de tipos comunes), no un validador exhaustivo del vocabulario completo — suficiente para v1 y coherente con "Classy Schema". Marcado como extensible.
- Grafo de entidades: alcance por página (no cross-site en v1). Render simple pero claro (fuerza dirigida o layout básico), self-contained.

### Claude's Discretion
- Librería de grafo para el render (algo liviano, SSR-friendly o client-only en un componente). Sin dependencias de red externas (CSP del entorno).
- Estructura de persistencia del grafo (columna Json en Page o tabla aparte).
</decisions>

<code_context>
## Existing Code Insights

- `packages/checks` (Fase 3): framework PageCheck/SiteCheck/NetworkCheck + registry. Los checks SD/AEO se agregan acá (nuevas familias `schema/` y `aeo/`).
- `Page.html` disponible. `Issue` con category/title/source/criterion/scope.
- Worker corre runAllChecks post-crawl — sumar las nuevas familias.
- Web: reporte por auditoría llega en Fase 6, pero el grafo por página necesita endpoint/datos ya en Fase 4 (persistir el grafo; render puede ser página dedicada o parte del futuro reporte).
</code_context>

<specifics>
## Specific Ideas

- Reporte de referencia (juan-tech.com): 6 bloques JSON-LD (Organization, WebSite, FAQPage, Person, ProfessionalService, ItemList), todos válidos, 100/100. AEO 78/100 (llms.txt faltante = crítico en su modelo, pero nosotros peso bajo; crawlers IA permitidos; formato de contenido bueno).
- Verificación: auditoría real juan-tech.com → confirmar detección de los 6 schemas, validación sin errores falsos, grafo de entidades con conexiones (Organization↔Person↔ProfessionalService vía sameAs/@id), AEO checks (llms.txt ausente, crawlers IA permitidos).
</specifics>

<deferred>
## Deferred Ideas

- Grafo cross-site (entidades conectadas entre páginas) → v2.
- Validador schema.org exhaustivo del vocabulario completo → extensión futura.
- Scoring de la categoría → Fase 6.
</deferred>
