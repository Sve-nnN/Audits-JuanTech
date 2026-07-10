---
phase: 24-codigo-validacion-jsonld-classy-schema
plan: 03
subsystem: ui, web
tags: [schema, jsonld, classy-schema, react, badges]

requires:
  - phase: 24-01
    provides: "motor puro validateEntities (13 tipos, ok/warning/error, nunca critical)"
  - phase: 24-02
    provides: "Page.schemaJson (Json?) persistido por el worker + extractJsonLdBlocks/flattenNodes en @auditor/checks"
provides:
  - "SchemaEntities: componente cliente con card por entidad JSON-LD (header @type + badge, árbol propiedad→valor anidado indentado, badges por propiedad, issues/anti-patrones, toggle a código crudo)"
  - "Nueva <section> 'Código y validación JSON-LD' en /audits/[id]/pages/[pageId], entre el grafo de entidades y los hallazgos"
  - "page.tsx construye entidades desde Page.schemaJson con fallback Playwright-free (cheerio + extractJsonLdBlocks/flattenNodes) para audits viejos sin ese campo"
affects: []

tech-stack:
  added: []
  patterns:
    - "Cap de profundidad de indentación (MAX_DEPTH) antes de recursar en arrays/objetos anidados (mitigación T-24-06, DoS por JSON-LD profundo)"
    - "Badges por propiedad SOLO si el nombre está en validations[i].properties; propiedades desconocidas quedan sin marcar (decisión: no ruido)"

key-files:
  created:
    - apps/web/app/components/SchemaEntities.tsx
    - apps/web/app/components/SchemaEntities.module.css
  modified:
    - apps/web/app/audits/[id]/pages/[pageId]/page.tsx

key-decisions:
  - "Datos desde Page.schemaJson; fallback por Page.html vía cheerio.load + extractJsonLdBlocks + flattenNodes cuando schemaJson es null (audits pre-24-02)"
  - "Código crudo se muestra con <pre>{JSON.stringify(entity, null, 2)}</pre> — sin dangerouslySetInnerHTML, sin highlighter, cero deps nuevas"
  - "Validación es informativa (ok/warning/error) — nunca degrada el score de la auditoría"

patterns-established:
  - "Panel tipo Classy Schema: card de entidad con header @type + badge de estado, árbol de propiedades indentado, badges por propiedad conocida, lista de issues, toggle a código crudo"

requirements-completed: [SDVIZ-02, SDVIZ-03]

duration: ~45min (incl. checkpoint de espera por aprobación visual)
completed: 2026-07-10
---

# Phase 24 Plan 03: Panel Classy Schema (código + validación JSON-LD) Summary

Panel visual estilo Classy Schema en el detalle de página: una card por entidad JSON-LD con árbol de propiedades legible, badges de estado por propiedad/entidad del motor `validateEntities`, y un toggle para inspeccionar el código crudo formateado — aprobado visualmente por Juan.

## Performance

- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 3

## Accomplishments
- `SchemaEntities` (cliente): card por entidad con header `@type` + badge, árbol `propiedad → valor` con anidados indentados (tope de profundidad para evitar DoS con JSON-LD muy anidado), badges por propiedad conocida (ok/warning/error; desconocidas sin marcar), issues/anti-patrones visibles (incluye el caso Product+AggregateRating sin reviewCount), toggle a código crudo (`<pre>` + `JSON.stringify`).
- `page.tsx`: selecciona `schemaJson`+`html`, arma las entidades desde `schemaJson` o fallback Playwright-free (`cheerio.load` + `extractJsonLdBlocks`/`flattenNodes`), corre `validateEntities` server-side, y renderiza la nueva sección entre el grafo de entidades y los hallazgos.
- Checkpoint visual (Task 3) presentado y **aprobado por Juan** tras validar en `/audits/[id]/pages/[pageId]`: árbol por entidad, badges y toggle correctos.

## Task Commits

Cada task auto se commiteó atómicamente durante la ejecución previa de esta sesión:

1. **Task 1: Componente SchemaEntities** — `0383a19` feat(24-03): SchemaEntities component (Classy Schema panel)
2. **Task 2: Wire en page.tsx** — `9233426` feat(24-03): wire Classy Schema panel into page detail
   - fix adicional: `84f7d41` fix(24-03): apply MAX_DEPTH cap before recursing into arrays (T-24-06)
3. **Task 3: Checkpoint human-verify** — sin commit propio (gate de aprobación); Juan confirmó el look visual, cerrando el plan.

## Files Created/Modified
- `apps/web/app/components/SchemaEntities.tsx` — árbol de propiedades por entidad, badges, toggle a código crudo
- `apps/web/app/components/SchemaEntities.module.css` — estilos tokens-only (sin hex, DS-01)
- `apps/web/app/audits/[id]/pages/[pageId]/page.tsx` — select `schemaJson`+`html`, construcción de entidades (+ fallback), `validateEntities`, nueva `<section>`

## Decisions Made
- Toggle de código crudo por entidad (no global), a discreción del executor por legibilidad.
- Sin colapsables adicionales; densidad de filas y copy en español neutral siguiendo el patrón de `.graphCard`.

## Deviations from Plan

### Auto-fixed Issues

**1. [T-24-06 — DoS mitigation] Cap de profundidad antes de recursar en arrays**
- **Found during:** Task 1/2 verificación de threat model (T-24-06, JSON-LD anidado profundo/enorme)
- **Issue:** La recursión del árbol de propiedades no acotaba explícitamente la profundidad al bajar por arrays anidados, dejando abierta la mitigación STRIDE declarada en el plan.
- **Fix:** Se aplica el tope `MAX_DEPTH` también antes de recursar en arrays (no solo en objetos), cortando a código crudo/`@id` más allá del límite.
- **Files modified:** `apps/web/app/components/SchemaEntities.tsx`
- **Verification:** typecheck + build OK; revisión manual del límite de indentación.
- **Committed in:** `84f7d41`

---

**Total deviations:** 1 auto-fixed (mitigación de seguridad ya prevista en el threat model del plan).
**Impact on plan:** Ninguno fuera de alcance; cierra la mitigación T-24-06 tal como estaba especificada.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Fase 24 completa: motor (24-01), persistencia (24-02) y UI (24-03) cierran SDVIZ-02/03.
- Milestone v1.4 (4 fases: 21, 22, 23, 24) queda completo pendiente de verificación de fase y auditoría de milestone.

---
*Phase: 24-codigo-validacion-jsonld-classy-schema*
*Completed: 2026-07-10*
