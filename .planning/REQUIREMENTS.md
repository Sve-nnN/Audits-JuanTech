# Requirements: Auditor Web (SEO/Técnico) — Milestone v1.4

**Defined:** 2026-07-09
**Core Value:** Cualquier persona ingresa una URL y recibe una auditoría completa, precisa y accionable de su web (errores reales priorizados por severidad), a cambio de su email verificado.

Milestone v1.4 = **Visualización avanzada + resolución de URL**. Origen: feedback directo de Juan durante la validación visual de v1.3 (2026-07-09), con capturas de referencia de Octopus.do (árbol) y Classy Schema (grafo/validación JSON-LD). Numeración de fases continúa desde la 21.

## v1.4 Requirements

### Árbol de arquitectura estilo octopus

- [ ] **ARCH-05**: El visualizador de arquitectura renderiza un árbol jerárquico real (dendrograma) con conexiones padre-hijo visibles entre nodos, reconstruyendo la jerarquía desde los edges del grafo de enlaces ya persistido (`Audit.stats.graph`) — no filas planas por profundidad. Cada nodo cuelga de su padre real (el nodo de menor profundidad que lo enlaza en el BFS).
- [ ] **ARCH-06**: El árbol es más grande y legible (estilo Octopus.do), con layout determinista y ancho dinámico según la cantidad de nodos por nivel. Cada nodo conserva sus señales de v1.3 (profundidad, indicador de huérfana, indicador de >3 clics, plantilla clasificada). Sigue siendo SVG puro sin dependencias nuevas (CSP estricta, patrón `EntityGraphSvg`/`ArchitectureTreeSvg`).

### Grafo JSON-LD con layout radial

- [ ] **SDVIZ-01**: El grafo de entidades (`EntityGraphSvg`) usa layout radial por componente conexo: el nodo raíz de cada grafo (entidad sin edges entrantes) se ubica en el centro de su componente con sus hijos alrededor, en vez del círculo uniforme actual. Una página con múltiples grafos (ej. BlogPosting + BreadcrumbList) muestra cada componente con su propio centro.

### Código y validación JSON-LD (estilo Classy Schema)

- [ ] **SDVIZ-02**: El detalle de página muestra el código JSON-LD formateado/indentado por entidad, con sus propiedades legibles (árbol de propiedades: `@type`, y cada propiedad con su valor), como el panel de propiedades de Classy Schema.
- [ ] **SDVIZ-03**: Cada entidad y propiedad se valida contra el vocabulario de schema.org y se muestran errores/warnings/success individuales por nodo: tipo válido/ inválido, propiedad válida/ desconocida, y advertencias de alto valor (ej. "Product declara AggregateRating sin reviewCount", patrón que Google penaliza). Alcance pragmático: cubrir el subconjunto de tipos/propiedades de alto valor SEO/rich-results, no el vocabulario completo (la fuente exacta del vocab y las reglas se deciden en el discuss de la fase). Nunca falla dura del score (informativo/warning, coherente con v1.3 SD-06).

### Resolución canónica de la URL de entrada

- [ ] **URLRES-01**: Antes de crawlear, el auditor resuelve la URL canónica real del dominio de entrada: prueba `https://`, cae a `http://` si no responde, y sigue los redirects del home hasta su URL final (con/sin `www`, con/sin barra). El usuario puede ingresar solo `aprendoclub.com` y el sistema resuelve todo.
- [ ] **URLRES-02**: La URL resuelta se usa como `origin`/`startUrl` en todo el pipeline (crawl, sitemap discovery, grafo de enlaces, checks) y se persiste para mostrarla en el reporte. Reemplaza la mitigación puntual de v1.3 (`resolveHomeKey` en `buildLinkGraph`) por una resolución correcta aguas arriba. Maneja con gracia dominios que no responden en ningún protocolo (error claro, no crawl vacío).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Grafo de arquitectura interactivo (force-directed, drag/zoom, edges persistidas editables) | El dendrograma jerárquico estático cubre el insight sin el costo de un motor de layout en cliente ni migración de storage (decisión LOCKED desde v1.3). |
| Validación del vocabulario schema.org completo (cientos de tipos/propiedades) | Ahogaría a la audiencia lead-magnet y multiplicaría el mantenimiento; se cubre el subconjunto de alto valor SEO/rich-results (SDVIZ-03). |
| Editor visual de JSON-LD / generación de schema corregido | Fuera del core value (auditar, no editar); el reporte señala errores, no los corrige por el usuario. |
| Recrawl automático al resolver una URL distinta a la ingresada | La resolución ocurre una vez antes del crawl; no se reintenta ni se comparan variantes de dominio (una sola URL canónica por auditoría). |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| URLRES-01 | Phase 21 | Pending |
| URLRES-02 | Phase 21 | Pending |
| ARCH-05 | Phase 22 | Pending |
| ARCH-06 | Phase 22 | Pending |
| SDVIZ-01 | Phase 23 | Pending |
| SDVIZ-02 | Phase 24 | Pending |
| SDVIZ-03 | Phase 24 | Pending |

**Coverage:**

- v1.4 requirements: 7 total
- Mapped to phases: 7/7 ✓
- Unmapped: 0

**Mapa de fases:**

- Phase 21 — Resolución canónica de la URL de entrada: URLRES-01, URLRES-02
- Phase 22 — Árbol de arquitectura estilo octopus: ARCH-05, ARCH-06
- Phase 23 — Grafo JSON-LD con layout radial: SDVIZ-01
- Phase 24 — Código + validación JSON-LD estilo Classy Schema: SDVIZ-02, SDVIZ-03

---
*Requirements defined: 2026-07-09*
*Roadmap mapped: 2026-07-09 (phases 21-24) — coverage 7/7*
