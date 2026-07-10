# Phase 22 — Plan 22-03 Context: Mapa de arquitectura (página aparte + zoom/pan/drag)

**Gathered:** 2026-07-09
**Status:** Ready for planning (extension of Phase 22 after the checkpoint feedback)

<domain>
## Boundary

El árbol de arquitectura (dendrograma de 22-01/22-02) se mueve a una página dedicada a pantalla completa y se vuelve un "mapa" navegable: zoom (rueda + botones), pan/arrastrar, y reajuste de vista. En el reporte, la sección grande se reemplaza por una tarjeta/link a esa página. Feedback de Juan en el checkpoint de 22-02: "que sea una página aparte y una especie de mapa que puedo acercar, alejar y arrastrar; se ve muy pequeño dejarlo como lo tenemos".

</domain>

<decisions>
## Implementation Decisions

### Página dedicada
- Nueva ruta `apps/web/app/audits/[id]/arquitectura/page.tsx` (server component, mismo patrón que `audits/[id]/pages/page.tsx`): carga el `ReportModel` vía `buildReportModel(auditId)` (o directamente `Audit.stats.graph` + Page rows si se prefiere) y renderiza el mapa a pantalla completa. Si no hay `architecture` (audit pre-grafo), muestra un empty state y link de vuelta.
- En `apps/web/app/audits/[id]/page.tsx`: la sección "Arquitectura del sitio" (que hoy embebe `ArchitectureTreeSvg`) se **reemplaza** por una tarjeta/link "Ver mapa de arquitectura →" que navega a la nueva ruta. Se conserva la condición `model.architecture &&` (se oculta si no hay grafo).

### Mapa interactivo (componente cliente)
- Nuevo componente cliente `ArchitectureMap.tsx` ("use client") que envuelve el SVG del árbol en un viewport navegable:
  - **Zoom**: rueda del mouse (con `preventDefault`, zoom hacia el cursor) + botones `+`/`−`. Rango de escala acotado (ej. 0.2×–3×).
  - **Pan / arrastrar**: mousedown+mousemove sobre el lienzo (cursor `grab`/`grabbing`). También touch (pointer events) si es barato.
  - **Reajustar vista**: botón "Reajustar" que vuelve a escala/posición inicial (fit-to-view).
  - Implementación **sin librería nueva** (CSP estricta): un `<g transform="translate(tx,ty) scale(k)">` sobre el SVG existente, o un wrapper `<div>` con `transform: translate() scale()` y estado React (`useState` de `{x,y,k}`). Preferir transform CSS sobre el contenedor del SVG para no reescribir `ArchitectureTreeSvg`.
- **Reutiliza `ArchitectureTreeSvg` tal cual** (el dendrograma de 22-02): el mapa solo agrega el viewport interactivo alrededor. El árbol se dibuja a su tamaño completo natural (ya calcula `width`/`height` dinámicos); en el mapa NO se aplica un cap pequeño de contenedor — el pan/zoom permite navegarlo.

### Accesibilidad
- Teclado: el viewport es focusable; `+`/`−` hacen zoom, flechas hacen pan, `0`/"Reajustar" resetea. `role`/`aria-label` en los controles.
- Respeta `prefers-reduced-motion` (sin transiciones animadas de zoom si está activo).

### Claude's Discretion
- Mecanismo exacto del transform (SVG `<g transform>` vs CSS transform en un div contenedor) — el que sea más simple y no obligue a reescribir el árbol.
- Rango exacto de zoom, sensibilidad de la rueda, si hay minimapa (probablemente no, mantenerlo simple).
- Layout de los controles (esquina, barra) siempre que sean accesibles y tokens-only sin hex.
- Si el reporte muestra un thumbnail/preview pequeño del árbol en la tarjeta-link, o solo texto+ícono.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/app/audits/[id]/pages/page.tsx` — patrón exacto de subpágina de una auditoría (params async, `buildReportModel`/prisma, empty state, link de vuelta) a replicar para `/arquitectura`.
- `apps/web/app/components/ArchitectureTreeSvg.tsx` — el dendrograma (22-02); se reusa sin cambios dentro del mapa. Ya calcula `width`/`height` dinámicos y devuelve un `<svg>` con `viewBox`.
- `apps/web/app/audits/[id]/AuditProgress.tsx` — precedente de componente cliente ("use client", `useState`) colocado junto a la página.
- `packages/report-model` `buildReportModel` — single source of the `architecture` model.

### Established Patterns
- Subpáginas de auditoría bajo `audits/[id]/<sub>/page.tsx` (ya existe `pages`).
- Componentes cliente colocados junto a su página, tokens-only CSS sin hex (DS-01), sin dependencias nuevas (CSP estricta).
- Español neutral sin voceo en UI.

### Integration Points
- `apps/web/app/audits/[id]/arquitectura/page.tsx` (nueva) + su `.module.css`.
- `apps/web/app/components/ArchitectureMap.tsx` (nueva, cliente) + `.module.css`.
- `apps/web/app/audits/[id]/page.tsx`: reemplazar la sección embebida por la tarjeta/link.

</code_context>

<specifics>
## Specific Ideas

Juan: "mejor hacemos que sea una página aparte y que sea una especie de mapa que puedo acercar, alejar y arrastrar. se ve muy pequeño dejarlo como lo tenemos." Referencia mental: un mapa navegable (tipo Octopus.do / mapas) a pantalla, no una miniatura embebida.

</specifics>

<deferred>
## Deferred Ideas

- Minimapa, exportar el mapa como imagen, edición del árbol — fuera de alcance.
- Grafo force-directed — sigue fuera de alcance; esto es el MISMO dendrograma jerárquico, solo con viewport navegable.

</deferred>
