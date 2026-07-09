# Phase 19: Agrupación por plantilla - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Cada página del sitio se clasifica en una plantilla (home / categoría / producto / artículo / otras) vía heurística de segmentos de URL. El reporte permite ver los issues agrupados por plantilla, como eje complementario a la agrupación por tipo de issue ya existente (v1.2, Phase 15).

</domain>

<decisions>
## Implementation Decisions

### Clasificador de plantilla
- Nuevo módulo `packages/report-model/src/template.ts`, función `classifyTemplate(url: string): PageTemplate` donde `PageTemplate = "home" | "category" | "product" | "article" | "other"`.
- Heurística de segmentos de URL (sin asumir CMS específico):
  - Path vacío o `/` → `"home"`.
  - Segmento contiene `producto`/`product`/`p` (como segmento completo, ej. `/producto/`, `/product/`, `/p/`) → `"product"`.
  - Segmento contiene `categoria`/`category`/`c`/`coleccion`/`collection` → `"category"`.
  - Segmento contiene `blog`/`articulo`/`article`/`post`/`noticias`/`news` → `"article"`.
  - Resto → `"other"`.
- Se calcula **una sola vez** en `build.ts` al construir el `ReportModel` (no por render, no recalculado en cada request).
- No es una migración de schema — la plantilla se deriva on-the-fly del `ReportModel`, igual que el resto de las agrupaciones existentes (no se persiste en la tabla `Page`).

### Modelo de datos
- `ReportModel` gana `issuesByTemplate: Record<PageTemplate, ReportIssue[]>`, calculado en `packages/report-model/src/build.ts` junto a `issuesByCategory` (mismo punto del pipeline, mismo patrón).
- Reusar el patrón de `packages/report-model/src/grouping.ts` (`groupIssuesByType`) como referencia de forma/estilo para la nueva función de agrupación por plantilla.

### UI — reuso total del lenguaje visual existente
- Cero componentes de diseño nuevos. Se reusan `CategoryAccordion`, `CategoryCard`, `Badge` tal cual existen hoy en `apps/web/app/components/ui/`.
- En `apps/web/app/audits/[id]/page.tsx` se agrega una segunda sección de agrupación bajo un **toggle simple** ("Por tipo de error" / "Por plantilla") — tabs o radio nativos, sin librería nueva, mismo patrón de accordion ya usado para `issuesByCategory`.
- El toggle es puramente de presentación (cliente) — ambos datasets (`issuesByCategory` e `issuesByTemplate`) ya vienen calculados en el `ReportModel` que llega al server component; no hay fetch adicional.

### Claude's Discretion
- Nombres exactos de labels de plantilla en español para la UI (ej. "Producto", "Categoría", "Artículo", "Home", "Otras").
- Orden de las plantillas en el toggle/acordeón (sugerido: home, category, product, article, other).
- Mecanismo exacto del toggle (tabs vs radio) siempre que sea accesible por teclado y no rompa SSR/hidratación existente.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/report-model/src/grouping.ts` — `groupIssuesByType(issues)` es el precedente directo de forma/estilo a imitar para la nueva agrupación por plantilla.
- `packages/report-model/src/build.ts` — línea ~128, ya construye `issuesByCategory` con `Object.fromEntries` sobre `CATEGORY_ORDER`; agregar `issuesByTemplate` en el mismo lugar con un `TEMPLATE_ORDER` análogo.
- `apps/web/app/components/ui/CategoryAccordion.tsx` / `CategoryCard.tsx` / `Badge.tsx` — componentes ya accesibles (`<details>/<summary>` nativos, foco visible, color nunca como señal única) listos para reusar sin modificación.
- `apps/web/app/audits/[id]/page.tsx` — líneas ~301-321, patrón exacto de iteración + `CategoryAccordion` por categoría a replicar para plantillas.

### Established Patterns
- `ReportModel` (`packages/report-model/src/model.ts`) es el único punto de verdad que llega al server component — toda agrupación nueva se calcula ahí, no en el componente.
- Componentes de UI en `apps/web/app/components/ui/` siguen convención Khand/Badge/CSS-modules ya establecida — no introducir una librería de componentes nueva.

### Integration Points
- `packages/report-model/src/model.ts`: extender `ReportModel` con `issuesByTemplate` y exportar `PageTemplate`.
- `packages/report-model/src/build.ts`: computar `issuesByTemplate` junto a `issuesByCategory`.
- `apps/web/app/audits/[id]/page.tsx`: agregar el toggle + segunda sección de accordions por plantilla.

</code_context>

<specifics>
## Specific Ideas

No hay referencias específicas adicionales — TEMPLATE-01/02 en REQUIREMENTS.md ya son LOCKED y cubren el detalle funcional. UI hint: yes, pero se resuelve reusando el lenguaje visual 100% existente, sin research de diseño nuevo (ver decisión "UI — reuso total").

</specifics>

<deferred>
## Deferred Ideas

- ARCH-04 (Phase 20): el visualizador de arquitectura mostrará la plantilla clasificada por nodo cuando esté disponible — esta fase solo deja `classifyTemplate`/`issuesByTemplate` disponibles, la integración con el árbol de arquitectura es de Phase 20.

</deferred>
