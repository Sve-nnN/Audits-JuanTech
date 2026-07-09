# Phase 16: Grafo de enlaces compartido + profundidad de clics real - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

El worker calcula, una sola vez por auditoría, un grafo de enlaces internos y la profundidad real (BFS desde home) de cada página. Persiste ese cómputo en `Audit.stats` para que lo reuse tanto el check de profundidad (issue agregado) como el futuro visualizador de arquitectura (Phase 20). No recalcula por separado en cada lectura del reporte.

</domain>

<decisions>
## Implementation Decisions

### Ubicación del módulo
- Nuevo paquete `packages/graph` con el BFS y el parser de links internos.
- El parser de links reusa el patrón ya existente en `packages/checks/src/checks/tech/canonicalDeep.ts` (cheerio.load + extracción de `<a href>` + `normalizeUrl`).
- Solo procesa páginas con `Page.html` no nulo (mismo criterio que canonicalDeep).

### Cuándo se calcula y persiste
- Se ejecuta como step del worker inmediatamente después del crawl, antes de correr los checks.
- Persiste en `Audit.stats.graph`: `{ nodes, edges, depthByUrl }` (JSON).
- Un solo cómputo por auditoría — no se recalcula al leer el reporte ni por otros consumidores (Phase 20 lo reusa leyendo `Audit.stats.graph`).

### Check de profundidad (DEPTH-01/02)
- Vive en `packages/checks`, lee `Audit.stats.graph.depthByUrl` (no `Page.depth`, que queda en 0 en crawls sembrados por sitemap).
- Emite **un único issue agregado** de severidad `warning` con el % de páginas a más de 3 clics de home — no un issue por página.

### Claude's Discretion
- Nombre exacto de campos internos del JSON de grafo (`nodes`/`edges`/`depthByUrl` es la forma mínima acordada; estructura interna de cada nodo/edge queda a criterio de implementación).
- Manejo de páginas huérfanas o sin html en el BFS (se excluyen del grafo pero no rompen el cómputo).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/checks/src/checks/tech/canonicalDeep.ts` — patrón de extracción de links internos vía cheerio + `normalizeUrl`, reusar tal cual para el parser del grafo.
- `Audit.stats` (`Json?` en `packages/db/prisma/schema.prisma`) — campo ya existente, sin migración necesaria.

### Established Patterns
- Checks viven en `packages/checks/src/checks/{category}/`.
- Paquetes standalone (`packages/psi`, `packages/scoring`, etc.) siguen convención de un `package.json` + `src/` propio dentro del monorepo.

### Integration Points
- Worker: nuevo step post-crawl, pre-checks, que llama a `packages/graph` y escribe `Audit.stats.graph`.
- `packages/checks`: nuevo check que lee `Audit.stats.graph.depthByUrl`.
- Phase 20 (visualizador) consumirá `Audit.stats.graph` sin recomputar — fuera de alcance de esta fase, solo dejar el dato disponible.

</code_context>

<specifics>
## Specific Ideas

No hay referencias específicas adicionales — los requisitos DEPTH-01/02/03 en REQUIREMENTS.md ya son LOCKED y cubren el detalle funcional.

</specifics>

<deferred>
## Deferred Ideas

- Visualizador de arquitectura (SVG, árbol jerárquico) — Phase 20, fuera de esta fase.
- Umbral de profundidad configurable por sitio — explícitamente fuera de alcance (LOCKED en REQUIREMENTS.md, 3 clics es estándar de industria).

</deferred>
