# Phase 20: Visualizador de arquitectura - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

El reporte incluye un árbol jerárquico en SVG puro que muestra la arquitectura del sitio agrupada por nivel de profundidad (0/1/2/3+). Cada nodo muestra URL/título, profundidad, indicador de página huérfana, indicador de página a más de 3 clics, y la plantilla clasificada (Phase 19). Reusa el grafo/BFS ya persistido en `Audit.stats.graph` (Phase 16) sin re-parsear HTML.

</domain>

<decisions>
## Implementation Decisions

### Construcción del árbol (report-model)
- `build.ts` lee `Audit.stats.graph` (persistido por Phase 16: `{ nodes, edges, depthByUrl }`).
- Por cada nodo del grafo cruza `depthByUrl` (profundidad) + `pageId`.
- Título y plantilla: cargar las `Page` rows UNA sola vez (`select { id, url, title, finalUrl }`) y mapear por `pageId`. La plantilla se deriva con `classifyTemplate` (Phase 19) sobre la URL del nodo — no se re-parsea HTML (ARCH-03).
- **Orphan** = página crawleada (existe `Page` row) que NO aparece en `depthByUrl` del grafo (inalcanzable desde home vía BFS). Se muestran en un grupo "huérfanas" aparte del árbol por profundidad.

### Modelo de datos
- Nuevo campo **opcional** `ReportModel.architecture?: ReportArchitecture` donde:
  - `ReportArchitecture = { nodesByDepth: Record<"0"|"1"|"2"|"3+", ArchNode[]>, orphans: ArchNode[] }`
  - `ArchNode = { url: string; title: string | null; depth: number; template: PageTemplate; isDeep: boolean; isOrphan: boolean }` (`isDeep` = `depth > 3`).
- Opcional: `undefined` cuando el audit no tiene grafo persistido (audits viejos anteriores a Phase 16). La UI degrada ocultando la sección completa — no rompe el reporte.
- Profundidades `> 3` se colapsan en el bucket `"3+"`.

### UI — SVG puro, patrón EntityGraphSvg
- Nuevo componente `apps/web/app/components/ArchitectureTreeSvg.tsx`, SVG puro, mismo patrón que `EntityGraphSvg.tsx` ya existente: cero dependencias nuevas (CSP estricto), CSS-modules tokens-only (sin hex), layout determinista (columnas/filas por nivel de profundidad, sin motor de layout client-side).
- Se renderiza en `apps/web/app/audits/[id]/page.tsx` como sección nueva del reporte, solo cuando `model.architecture` está presente.
- Cada nodo dibuja: URL/título (truncado como en EntityGraphSvg), badge de profundidad, señal visual de huérfana y de "más de 3 clics", y la plantilla (color/label por plantilla, reusando `TEMPLATE_LABEL` de Phase 19).

### Claude's Discretion
- Layout exacto del árbol (columnas verticales por profundidad vs filas horizontales), tamaños, truncado de labels — mientras sea determinista y sin librería.
- Mapeo visual plantilla→color (reusar tokens existentes, no introducir hex nuevos).
- Cómo se dibujan (o si se dibujan) las edges entre niveles — el foco es la jerarquía por profundidad, no un grafo force-directed (LOCKED: no grafo interactivo, ARCH-01).
- Manejo de sitios muy grandes (muchos nodos por nivel): estrategia de truncado/resumen por nivel a criterio, documentando el límite elegido con un `log`/nota visible ("mostrando N de M").

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/app/components/EntityGraphSvg.tsx` — patrón exacto de SVG puro self-contained (layout determinista, `fill: currentColor` + clases token-backed sin hex, `truncate()` de labels) a imitar para el árbol de arquitectura.
- `packages/graph/src/types.ts` — `LinkGraph { nodes: GraphNode[], edges, depthByUrl }`, `GraphNode { url, pageId }` — la forma ya persistida en `Audit.stats.graph`.
- `packages/report-model/src/template.ts` — `classifyTemplate(url)`, `PageTemplate`, `TEMPLATE_ORDER` (Phase 19).
- `apps/web/app/components/ui/labels.ts` — `TEMPLATE_LABEL` (Phase 19) para los labels de plantilla en los nodos.

### Established Patterns
- `build.ts` (`buildReportModel`) ya lee `Audit.stats` (`stats?.perf`) y `Audit.scores` — agregar la lectura de `stats?.graph` en el mismo lugar, sin nuevas queries salvo la carga de `Page` rows para títulos.
- Campos opcionales en `ReportModel` con degradación en la UI ya es patrón establecido (`perf?`, y la propia sección de export).
- Componentes SVG puros sin dependencias por el CSP estricto del deploy (EntityGraphSvg es el precedente).

### Integration Points
- `packages/report-model/src/model.ts`: extender `ReportModel` con `architecture?`, exportar `ReportArchitecture`/`ArchNode`.
- `packages/report-model/src/build.ts`: leer `stats.graph`, cargar `Page` rows (title), construir `architecture` con `classifyTemplate`.
- `apps/web/app/components/ArchitectureTreeSvg.tsx`: nuevo componente.
- `apps/web/app/audits/[id]/page.tsx`: renderizar la sección cuando `model.architecture` existe.

</code_context>

<specifics>
## Specific Ideas

No hay referencias visuales específicas adicionales — ARCH-01..04 en REQUIREMENTS.md ya son LOCKED (SVG puro tipo EntityGraphSvg, agrupado por profundidad, no grafo interactivo). UI hint: yes, resuelto reusando el patrón SVG existente sin research de diseño nuevo.

</specifics>

<deferred>
## Deferred Ideas

- Grafo interactivo completo (force-directed, edges persistidas, drag/zoom) — explícitamente fuera de alcance (LOCKED en Out of Scope del milestone).
- Migración de storage para persistir edges por separado — no necesaria, el árbol por profundidad cubre el insight.

</deferred>
