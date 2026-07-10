# Phase 23: Grafo JSON-LD con layout radial - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Rework aislado del renderer `apps/web/app/components/EntityGraphSvg.tsx`: reemplazar el círculo uniforme actual (`angle = 2π·i/n`) por un **layout radial por componente conexo**. El nodo raíz de cada componente (entidad sin edges entrantes) se ubica al centro de su componente, con sus hijos alrededor. Una página con varios grafos (ej. `BlogPosting` + `BreadcrumbList`) muestra cada componente conexo con su propio centro, sin superponerse. Sigue siendo SVG puro, cero dependencias nuevas, tokens-only sin hex, layout determinista. No toca la extracción de datos (`buildEntityGraph` / `Page.schemaGraph`), solo el render.

</domain>

<decisions>
## Implementation Decisions

### Componentes conexos y raíz
- **Raíz de un componente** = nodo sin edges entrantes (incoming = 0). Si hay varios candidatos o un ciclo (todos con incoming), tomar el primero en orden de `graph.nodes` (determinista).
- **Detección de componentes conexos**: tratar el grafo como **no dirigido** para agrupar (unir nodos por cualquier edge, sea `from` o `to`), de modo que todo el grafo visual quede en un mismo componente.
- **Nodos `External`/sameAs** (typeMuted): son parte del componente que los enlaza (nodos hoja), no un cluster separado.
- **Orden de los componentes en el canvas**: determinista según el orden de aparición del root en `graph.nodes`.

### Geometría radial
- **Layout multi-anillo por BFS** desde el root: root al centro, hijos en anillo 1, nietos en anillo 2, etc.
- **Múltiples componentes**: dividir el canvas en celdas (grid/pack), cada componente centrado en su propia celda, sin solaparse.
- **Radio del anillo**: dinámico (crece con la cantidad de hijos, con un mínimo) para evitar solapamiento de nodos.
- **Ángulo de arranque de hijos**: distribución uniforme `2π/n` arrancando en `-π/2` (arriba), determinista.

### Overflow, escala y estados
- **Alto del canvas**: dinámico según la cantidad de filas de componentes (mantener el width del viewBox ~720 responsive vía la clase `.canvas` existente).
- **Cap de nodos por componente**: sin cap — los grafos JSON-LD son chicos. Reevaluar solo si aparece un caso denso real.
- **Un solo componente** (caso común): ocupa todo el canvas centrado (mejora del comportamiento actual).
- **Labels de edges**: mantener el chip + label en el midpoint como hoy (aceptable).

### Claude's Discretion
- Geometría exacta: radio base/mínimo del anillo, espaciado entre celdas, tamaño de nodo, número de columnas del grid de componentes.
- Fórmula exacta del radio dinámico y del alto de celda.
- Estrategia de tie-break fina cuando varios nodos empatan como candidatos a root.
- Si conviene un pequeño offset para separar labels de edge cuando dos edges comparten midpoint.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/app/components/EntityGraphSvg.tsx` — componente a reworkear. Hoy: `WIDTH=720`, `HEIGHT=480`, `RADIUS=170`, `NODE_RADIUS=34`, mapa `positions` por círculo uniforme, render de edges (line + chip + label + marker `arrow`) y nodos (circle + type + caption). Estado vacío (`nodes.length===0`) ya resuelto.
- `apps/web/app/components/EntityGraphSvg.module.css` — tokens-only, CSP-safe. `.canvas` escala responsive (`width:100%`, `max-width: var(--container-narrow)`), fade-in. Clases de color por tipo (`.typeAccent`, `.typePerson`, etc.), `.nodeCircle { fill: currentColor }`, `.edgeLine`, `.edgeChip`, `.edgeLabel`, `.arrow`.
- Tipos `EntityGraph`/`EntityGraphNode`/`EntityGraphEdge` exportados desde `@auditor/checks` (`packages/checks/src/checks/schema/entityGraph.ts`). Edge = `{ from, to, rel }`; node = `{ id, type, label }`.

### Established Patterns
- SVG puro determinista, sin motor de layout en cliente (CSP estricta) — mismo patrón que `ArchitectureTreeSvg` (Phase 22).
- Solo tokens semánticos, sin hex crudo (DS-01).
- La lógica de layout vive en el componente; el CSS solo hace color/tipografía/escala.

### Integration Points
- Se renderiza en `/audits/[id]/pages/[pageId]` (detalle de página). Sin cambios de datos ni de ruta.
- Consume `Page.schemaGraph` (persistido desde v1.3). No requiere migración ni cambios en el worker.

</code_context>

<specifics>
## Specific Ideas

- Referencia de patrón visual: dendrograma `ArchitectureTreeSvg` de Phase 22 (determinista, tokens, `overflow-x:auto` si hace falta) — pero acá el layout es radial, no top-down.
- Juan es design-conscious e itera el look; la fase cierra en checkpoint:human-verify (validación visual antes de cerrar).

</specifics>

<deferred>
## Deferred Ideas

- Cap "+N más" por componente para grafos densos — diferido hasta que exista un caso real que lo justifique.
- SDVIZ-02/03 (código JSON-LD formateado + validación por propiedad estilo Classy Schema) — es Phase 24.

</deferred>
