---
phase: 19-agrupacion-por-plantilla
reviewed: 2026-07-09T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - apps/web/app/audits/[id]/GroupingToggle.module.css
  - apps/web/app/audits/[id]/GroupingToggle.tsx
  - apps/web/app/audits/[id]/page.tsx
  - apps/web/app/components/ui/labels.ts
  - packages/report-model/src/build.test.ts
  - packages/report-model/src/build.ts
  - packages/report-model/src/index.ts
  - packages/report-model/src/model.ts
  - packages/report-model/src/template.test.ts
  - packages/report-model/src/template.ts
  - apps/web/tests/pages/api/audits/[id]/export.test.ts
findings:
  critical: 1
  warning: 1
  info: 3
  total: 5
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-07-09
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

La fase agrega un eje de agrupación por plantilla de página (`classifyTemplate`, `TEMPLATE_ORDER`, `TEMPLATE_LABEL`), lo expone en el `ReportModel` (`issuesByTemplate`) y lo renderiza mediante un toggle client-side (`GroupingToggle`). El clasificador de URL es puro, defensivo y bien probado; `buildReportModel` construye correctamente todos los buckets e inicializa cada plantilla. La lógica de negocio es sólida.

Sin embargo, hay un defecto bloqueante: convertir `issuesByTemplate` en propiedad **requerida** de `ReportModel` sin actualizar todos los constructores del modelo rompe la compilación del paquete `@auditor/export` (y por tanto su suite de tests). Verificado con `tsc --noEmit`. Además hay una carencia de accesibilidad en el patrón de tabs.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Campo requerido `issuesByTemplate` rompe la compilación del paquete export

**File:** `packages/report-model/src/model.ts:102` (raíz) · `packages/export/src/test-fixtures.ts:87`

**Issue:** En `model.ts` el nuevo campo se declaró como propiedad **no opcional**:

```ts
issuesByTemplate: Record<PageTemplate, ReportIssue[]>;
```

Pero `packages/export/src/test-fixtures.ts` `buildModel()` — cuyo tipo de retorno es explícitamente `ReportModel` (línea 61) — construye el objeto **sin** ese campo (líneas 87–110). Esto produce un error de tipos real, no hipotético. Confirmado ejecutando `tsc --noEmit` en `packages/export`:

```
src/test-fixtures.ts(87,3): error TS2741: Property 'issuesByTemplate' is missing
in type '{ audit: {...}; ... issuesByCategory: Record<...>; }' but required in type 'ReportModel'.
```

`buildModel()` es el fixture base de toda la suite de export (`markdown.test.ts`, `pptx.test.ts`, `pdf.test.ts`, `no-pii.test.ts`, `priority.test.ts`), de modo que el typecheck/CI del paquete `@auditor/export` queda roto por esta fase. Ningún serializador de export lee `issuesByTemplate` (verificado con grep: cero usos en `packages/export/`), así que el campo solo hace falta para satisfacer el tipo.

**Fix:** Actualizar el fixture para incluir el bucket (opción correcta, mantiene el contrato fuerte):

```ts
// packages/export/src/test-fixtures.ts, dentro del return de buildModel()
    issuesByCategory,
    issuesByTemplate: {
      home: [],
      category: [],
      product: [],
      article: [],
      other: [],
    },
  };
```

Alternativa si se acepta un contrato más laxo: declarar `issuesByTemplate?:` opcional en `model.ts` y que los consumidores usen `?? {}`. Preferible la primera para no debilitar el modelo.

## Warnings

### WR-01: Patrón de tabs con semántica ARIA incompleta

**File:** `apps/web/app/audits/[id]/GroupingToggle.tsx:25-46`

**Issue:** El componente declara `role="tablist"` con dos `role="tab"` y un `role="tabpanel"`, pero le faltan las asociaciones que el patrón WAI-ARIA de tabs exige para ser navegable por lector de pantalla:

- Los `role="tab"` no tienen `id` ni `aria-controls` apuntando al panel.
- El `role="tabpanel"` no tiene `id` ni `aria-labelledby` apuntando al tab activo.
- No hay manejo de teclado con flechas (patrón de tabs espera navegación con Left/Right); actualmente solo responde a click/Enter del `Button`.
- El tab no seleccionado debería exponer `tabIndex={-1}` (roving tabindex).

Como el proyecto marca UX/accesibilidad como prioridad alta, conviene cerrarlo.

**Fix:** Asociar ids y controlar el panel:

```tsx
<Button role="tab" id="tab-type" aria-selected={mode === "type"}
        aria-controls="panel-grouping" tabIndex={mode === "type" ? 0 : -1} ... />
<Button role="tab" id="tab-template" aria-selected={mode === "template"}
        aria-controls="panel-grouping" tabIndex={mode === "template" ? 0 : -1} ... />
<div role="tabpanel" id="panel-grouping"
     aria-labelledby={mode === "type" ? "tab-type" : "tab-template"}>
  {mode === "type" ? byType : byTemplate}
</div>
```

Y añadir `onKeyDown` en el tablist para mover el foco/selección con flechas.

## Info

### IN-01: Rama muerta en `issueUrl`

**File:** `packages/report-model/src/build.ts:64`

**Issue:** `const firstToken = raw.split(" ")[0] ?? raw;` — `String.prototype.split` siempre devuelve al menos un elemento (para `""` devuelve `[""]`), por lo que `[0]` nunca es `undefined` y el `?? raw` es código inalcanzable. No causa bug (el guard `if (!raw)` ya filtró vacíos), pero confunde al lector.

**Fix:** `const firstToken = raw.split(" ")[0];` (con `[0]!` o dejando el tipo inferido).

### IN-02: Bloques de renderizado duplicados en `page.tsx`

**File:** `apps/web/app/audits/[id]/page.tsx:305-358`

**Issue:** Los árboles `byType` (categoría) y `byTemplate` (plantilla) son casi idénticos: mismo `.filter(problems/passing)`, mismo `CategoryAccordion` + dos `AccordionSubgroup` + `IssueTypeGroup`. Solo difieren en la fuente (`issuesByCategory[category]` vs `issuesByTemplate[template]`), la clave de iteración y la etiqueta. Duplicación que obliga a editar dos sitios ante cualquier cambio de estructura.

**Fix:** Extraer un helper local, p. ej. `renderGroupedAccordions(order, source, labelMap)` que reciba el orden, el diccionario de issues y el mapa de etiquetas, y reutilizarlo para ambos ejes.

### IN-03: Ambos árboles de detalle se renderizan siempre en el servidor

**File:** `apps/web/app/audits/[id]/page.tsx:304-359`

**Issue:** `GroupingToggle` recibe `byType` y `byTemplate` ya renderizados; el server component emite el árbol completo de acordeones de **ambos** ejes en el HTML aunque solo uno sea visible a la vez (el otro solo se muestra al togglear). En auditorías con muchos issues esto duplica el peso del DOM/hidratación por render. El comentario del componente lo justifica como "sin fetch", lo cual es válido, pero el costo es real. (El rendimiento está fuera del alcance v1; se anota como contexto, no como bloqueo.)

**Fix:** Aceptable como está para v1. Si crece el tamaño de reporte, evaluar renderizar el segundo eje de forma diferida o memparar el árbol inactivo.

---

_Reviewed: 2026-07-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
