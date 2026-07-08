# Phase 15: UX del reporte — agrupación e indicadores - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

El reporte presenta los issues agrupados por tipo en dropdowns (en "Issues prioritarios" y en "Detalle por categoría") y muestra el estado del JSON-LD por página en la lista de páginas + grafo, para que la información sea legible sin saturación. Categoría REPORT nueva (presentación), adicional al sketch de research. No entra: nuevos checks (Phase 11 ya hecha), export (Phase 13/14), persistencia de veredicto (v2).

</domain>

<decisions>
## Implementation Decisions

### Agrupación "Issues prioritarios" (REPORT-01)
- Agrupar por **`checkId` + title** (cada grupo un dropdown, p.ej. "Imágenes sin alt text — 12 páginas"). Un solo tipo de issue agrupa todas las páginas afectadas.
- Orden de grupos: por **severidad (peor primero) → luego cantidad de páginas afectadas** (REPORT-01).
- Componente: reusar el patrón `details`/`summary` nativo que ya usa `CategoryAccordion` (accesible, sin JS extra) para los grupos colapsables. No introducir un dropdown JS nuevo.
- Contenido expandido de cada grupo: filas de las páginas afectadas (URL + valor medido + estado/diff), reusando el estilo de `IssuesTable`.

### Agrupación "Detalle por categoría" (REPORT-02)
- Dentro de cada categoría, agrupar por tipo en dropdowns tanto en **problems como en correct**, con orden consistente con Area 1 (severidad → cantidad).
- Reuso: **un solo componente/helper de agrupación** reusado en "Issues prioritarios" y en "Detalle por categoría" (DRY + orden garantizado idéntico).
- Dónde se agrupa: helper puro **`groupIssuesByType(issues: ReportIssue[])`** en `@auditor/report-model` (testeable, single source of truth del orden). Devuelve grupos `{ checkId, title, severity, count, issues }` ya ordenados. La UI solo renderiza.
- Estado vacío: mantener el `EmptyState` actual cuando una categoría/sección no tiene issues.

### Estado JSON-LD por página (REPORT-04)
- Cuatro estados por página derivados de los issues de categoría **schema** de esa página (por `pageId`) cruzados con la presencia de `schemaGraph`:
  - **error** (rojo) si hay algún issue schema `critical` en la página,
  - **advertencia** (amarillo) si hay algún issue schema `warning` (y ninguno critical),
  - **correcto** (verde) si hay JSON-LD presente (`schemaGraph` con nodos) y ningún problema,
  - **sin JSON-LD** (neutral) si no hay `schemaGraph`.
- Dónde: en la lista de páginas `apps/web/app/audits/[id]/pages/page.tsx` — el badge actual (2 estados) pasa a 4 estados.
- Cálculo: helper puro que cruza los issues `schema` (por `pageId`) con la presencia de `schemaGraph`; mapea al peor estado. Testeable.
- Mapeo a badge (reusa `SeverityBadge`/`Badge` de la librería, sin colores nuevos): critical→`error`, warning→`advertencia`, ok+presente→`correcto` (variante ok), ausente→neutral "sin JSON-LD".

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/app/audits/[id]/page.tsx` — "Issues prioritarios" (IssuesTable de `priorityIssues`, líneas ~264-270) y "Detalle por categoría" (CategoryAccordion + AccordionSubgroup problems/correct, ~347-392). Aquí se inserta la agrupación por tipo.
- `apps/web/app/components/ui/CategoryAccordion.tsx` — usa `details`/`summary` nativo (patrón accesible ya validado en Fase 9). `AccordionSubgroup` (problems/correct). Base del dropdown de grupos.
- `apps/web/app/components/ui/IssuesTable.tsx` + `Badge.tsx`/`SeverityBadge` — filas y badges reusables.
- `@auditor/report-model` (`packages/report-model/src/model.ts`) — `ReportModel` con `issuesByCategory: Record<Category, ReportIssue[]>`, `priorityIssues`, `priorityCandidates`. Aquí vive el nuevo helper puro `groupIssuesByType`.
- `apps/web/app/audits/[id]/pages/page.tsx` — lista de páginas; ya lee `schemaGraph` (select id/url/finalUrl/statusCode/schemaGraph) y muestra Badge "N entidad(es) JSON-LD" / "sin JSON-LD". Aquí pasa a 4 estados.

### Established Patterns
- `ReportIssue` lleva `checkId`, `category`, `title`, `severity` (critical|warning|ok), `measuredValue`, `source`/url, `diffStatus`.
- Categoría `schema` = checks SCHEMA-* (jsonldValidity, schemaValidate, danglingIds, jsonldPresence). El estado JSON-LD por página se deriva de estos por `pageId`.
- Accesibilidad baseline v1.1: `details`/`summary` nativo, focus-visible, roles, reduced-motion. Copy español neutro, sin voceo. Tokens only, cero hex.

### Integration Points
- `packages/report-model/src/model.ts` (o un `grouping.ts` del paquete) — nuevo `groupIssuesByType` puro + su test.
- `apps/web/app/audits/[id]/page.tsx` — renderiza grupos en prioritarios y en detalle por categoría usando el helper.
- `apps/web/app/audits/[id]/pages/page.tsx` — badge JSON-LD de 4 estados usando el helper de estado por página.
- El estado JSON-LD por página puede exponerse desde `buildReportModel`/un helper de report-model para no recomputar en la UI, cruzando issues schema con schemaGraph.

</code_context>

<specifics>
## Specific Ideas

- REPORT-01/02 comparten orden: el helper `groupIssuesByType` es la única fuente del orden (severidad → cantidad), así prioritarios y detalle por categoría se ven consistentes. Añadir test del helper que fije el orden y el conteo por grupo.
- REPORT-04: añadir test del helper de estado JSON-LD que cubra los 4 casos (critical→error, warning→advertencia, presente-sin-problemas→correcto, ausente→sin JSON-LD).
- No romper el render existente: la agrupación reemplaza el listado plano dentro de las mismas secciones; el resto del reporte (score, categorías, perf, diff) queda igual.

</specifics>

<deferred>
## Deferred Ideas

- Persistir `Page.renderVerdict` / badge CSR-SSR por página (v2, REPORT-05).
- Agrupación por plantilla (v2, RENDER-04).

</deferred>
