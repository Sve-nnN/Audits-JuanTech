# Phase 22: Árbol de arquitectura estilo octopus - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

El visualizador de arquitectura muestra un dendrograma jerárquico real (estilo Octopus.do), más grande y legible, con las conexiones padre-hijo visibles entre nodos. `report-model` reconstruye la jerarquía desde los edges del grafo persistido; `ArchitectureTreeSvg` la renderiza en SVG puro.

</domain>

<decisions>
## Implementation Decisions

### Modelo — árbol anidado real
- Nuevo tipo `ArchTreeNode = ArchNode & { children: ArchTreeNode[] }` en `packages/report-model/src/model.ts`.
- `ReportArchitecture` gana `tree: ArchTreeNode[]` (raíces — normalmente la home a profundidad 0). Se **reemplaza** `nodesByDepth` por `tree` (el SVG se reescribe, ya no necesita las filas planas).
- Se mantiene `orphans: ArchNode[]` (páginas crawleadas sin padre en el grafo — inalcanzables).

### Reconstrucción de la jerarquía (build.ts)
- Se usa `graph.edges` (persistidos en `Audit.stats.graph` desde Phase 16, hasta ahora no consumidos por report-model).
- **Padre de cada nodo** = el nodo de MENOR profundidad que lo enlaza (según los edges `from→to`). Empate a igual profundidad → el primero encontrado (determinista, orden estable de `graph.nodes`/`edges`).
- La raíz es el nodo a profundidad 0 (home). Nodos rotos (4xx/5xx, `isBrokenPage`) se excluyen igual que en v1.3.
- Se sigue cargando las Page rows una vez para título/plantilla (reusa la carga existente de Phase 20).

### UI — dendrograma top-down (ArchitectureTreeSvg)
- Layout **top-down** estilo Octopus.do: raíz arriba, niveles hacia abajo. Conectores SVG (líneas o curvas suaves) visibles de cada padre a cada hijo.
- Layout determinista (sin motor de layout en cliente, CSP estricta): posición por nivel (Y) y por orden dentro del nivel (X), ancho dinámico según la cantidad de hojas.
- Cada nodo conserva las señales de v1.3: profundidad, indicador de huérfana, indicador de >3 clics (`isDeep`), y plantilla clasificada (color por plantilla, reusar `TEMPLATE_LABEL`/clases de token existentes).
- SVG puro, cero dependencias nuevas (patrón `EntityGraphSvg`/`ArchitectureTreeSvg` actual; tokens-only, sin hex).
- **Cap por rama** con "+N más" para sitios grandes (aprendoclub tiene 71 nodos): limitar hijos dibujados por nodo/nivel y resumir el resto, documentando el límite elegido con una nota visible (no truncado silencioso).

### Claude's Discretion
- Geometría exacta (ancho/alto de nodo, espaciado, si los conectores son líneas rectas, quebradas o curvas bezier).
- Valor del cap por rama (sugerido similar al `MAX_NODES_PER_ROW=12` actual).
- Si el árbol permite scroll horizontal dentro de un contenedor `overflow-x:auto` cuando es muy ancho.
- Estrategia de tie-break exacta para el padre cuando hay múltiples enlazadores a igual profundidad mínima.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/report-model/src/build.ts` (líneas ~194-244) — bloque `architecture` actual (nodesByDepth + orphans desde `graph.nodes`/`depthByUrl`); ahí se agrega la reconstrucción del árbol desde `graph.edges`. Ya carga Page rows (título/plantilla) y excluye páginas rotas (`isBrokenPage`).
- `graph.edges` — ya persistidos en `Audit.stats.graph` (Phase 16), `{ from, to }` normalizados; hasta ahora sin consumidor (el integration checker de v1.3 lo notó como "edges unused"). Esta fase los usa.
- `apps/web/app/components/ArchitectureTreeSvg.tsx` (226 líneas) — se reescribe: hoy hace filas por profundidad (`DEPTH_ORDER`, `MAX_NODES_PER_ROW`, geometría estática `NODE_W/NODE_H/GAP`); se conserva el patrón SVG puro + clases de plantilla (`TEMPLATE_CLASS`, `classForTemplate`, `truncate`) y el CSS module tokens-only.
- `apps/web/app/components/EntityGraphSvg.tsx` — precedente de conectores SVG (líneas con `marker`/arrow, edge labels) a reusar para los conectores padre-hijo.

### Established Patterns
- `ReportArchitecture` opcional (`architecture?`) — audits pre-Phase-16 sin grafo ocultan la sección; se preserva.
- Componentes SVG puros tokens-only sin hex (DS-01), sin dependencias (CSP estricta).
- `classifyTemplate` (Phase 19) para la plantilla por nodo.

### Integration Points
- `packages/report-model/src/model.ts`: `ArchTreeNode`, `ReportArchitecture.tree` (reemplaza `nodesByDepth`), export.
- `packages/report-model/src/build.ts`: reconstruir el árbol desde `graph.edges`.
- `apps/web/app/components/ArchitectureTreeSvg.tsx` + `.module.css`: rework a dendrograma.
- `apps/web/app/audits/[id]/page.tsx`: consume `model.architecture.tree` (ajuste menor si cambia la forma).
- Tests de `build.test.ts` que hoy verifican `nodesByDepth` — actualizar a `tree`.

</code_context>

<specifics>
## Specific Ideas

Origen: Juan pidió "que sea como la de octopus, que se vean las conexiones", con captura de referencia de Octopus.do (árbol top-down de cards conectadas). El árbol actual de v1.3 (filas planas por profundidad, sin conexiones) fue el punto de partida que Juan quiere elevar.

</specifics>

<deferred>
## Deferred Ideas

- Grafo interactivo (drag/zoom/force-directed) — fuera de alcance (Out of Scope del milestone, decisión LOCKED).
- Grafo JSON-LD radial (SDVIZ-01) — Phase 23, es el otro visualizador, no este.

</deferred>
