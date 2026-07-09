---
phase: 19-agrupacion-por-plantilla
verified: 2026-07-09T12:20:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Abrir un reporte de auditoría con issues (/audits/[id]), localizar la sección 'Detalle por categoría / plantilla', hacer clic en el botón 'Por plantilla' y luego volver a 'Por tipo de error'."
    expected: "El bloque de accordions cambia entre agrupación por categoría y agrupación por plantilla (Home/Categoría/Producto/Artículo/Otras). Ambos botones son alcanzables con Tab y activables con Enter/Space. Cambiar de pestaña NO dispara ninguna petición de red (Network tab inactivo)."
    why_human: "Apariencia visual, alternancia de subtree renderizado y ausencia de fetch en runtime no son verificables por grep/typecheck; requieren observar el render y el DevTools Network."
---

# Phase 19: Agrupación por plantilla Verification Report

**Phase Goal:** El usuario puede ver qué le pasa a una plantilla de página completa (ej. "producto"), no solo qué tipo de error se repite.
**Verified:** 2026-07-09T12:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Cada issue con URL conocida queda clasificado en exactamente una plantilla vía classifyTemplate | ✓ VERIFIED | `packages/report-model/src/template.ts` implementa `classifyTemplate(url): PageTemplate` pura, try/catch degrada a "other", match por segmento completo case-insensitive, prioridad product>category>article. 10 tests en template.test.ts pasan. |
| 2 | ReportModel expone issuesByTemplate con el mismo conjunto de issues que issuesByCategory (re-agrupado, sin perder ni duplicar) | ✓ VERIFIED | `build.ts:138-146` construye `issuesByTemplate` en segundo pase sobre el mismo `issuesForDetail` (query Prisma real); issues con `url==null` se omiten (documentado), loop de `issuesByCategory` intacto. build.test.ts valida length-sum. |
| 3 | El usuario puede alternar entre 'Detalle por categoría' y 'Detalle por plantilla' reusando CategoryAccordion/AccordionSubgroup/IssueTypeGroup sin componentes nuevos | ✓ VERIFIED | `page.tsx:302-360` envuelve ambos bloques en `<GroupingToggle byType byTemplate>`; el bloque byTemplate mapea `TEMPLATE_ORDER` sobre `issuesByTemplate` reusando los mismos componentes verbatim. |
| 4 | El toggle es accesible por teclado (botones reales role=tab/aria-selected) y no dispara fetch adicional | ✓ VERIFIED (código) / ⚠ interacción a confirmar por humano | `GroupingToggle.tsx` usa `<Button type="button" role="tab" aria-selected>` dentro de `role="tablist"`, `role="tabpanel"`, `useState<"type"|"template">`, sin ningún fetch. Ausencia de fetch en runtime → human check. |
| 5 | TEMPLATE-02 satisfecho: ver "qué le pasa a la plantilla de producto" sin nuevo fetch usando data ya en el ReportModel server-rendered | ✓ VERIFIED | Ambos datasets (issuesByCategory/issuesByTemplate) computados server-side en buildReportModel; toggle solo alterna visibilidad de subtrees ya renderizados. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/report-model/src/template.ts` | classifyTemplate + PageTemplate + TEMPLATE_ORDER | ✓ VERIFIED | 3+ exports, sin `any`, doc-comment cita TEMPLATE-01. |
| `packages/report-model/src/model.ts` | ReportModel.issuesByTemplate field | ✓ VERIFIED | Línea 102: `issuesByTemplate: Record<PageTemplate, ReportIssue[]>`. |
| `packages/report-model/src/build.ts` | issuesByTemplate computado junto a issuesByCategory | ✓ VERIFIED | Líneas 138-177, segundo pase + retorno; loop de category intacto. |
| `packages/report-model/src/index.ts` | re-export de classifyTemplate/TEMPLATE_ORDER/PageTemplate | ✓ VERIFIED | Líneas 6-7. |
| `apps/web/app/audits/[id]/GroupingToggle.tsx` | client component toggle sin fetch | ✓ VERIFIED | "use client", useState, 0 fetch, exporta GroupingToggle. |
| `apps/web/app/audits/[id]/GroupingToggle.module.css` | .tabs tokens-only | ✓ VERIFIED | 0 hex colors (DS-01). |
| `apps/web/app/components/ui/labels.ts` | TEMPLATE_LABEL Record<PageTemplate,string> | ✓ VERIFIED | 5 claves (Home/Categoría/Producto/Artículo/Otras). |
| `apps/web/app/audits/[id]/page.tsx` | sección Detalle por plantilla via GroupingToggle | ✓ VERIFIED | import + JSX, byType/byTemplate, TEMPLATE_ORDER map. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| build.ts | template.ts | classifyTemplate(issue.url) | ✓ WIRED | build.ts:144 |
| index.ts | template.ts | re-export | ✓ WIRED | index.ts:6-7 |
| page.tsx | GroupingToggle.tsx | `<GroupingToggle>` JSX | ✓ WIRED | page.tsx:304 |
| page.tsx | @auditor/report-model | TEMPLATE_ORDER import | ✓ WIRED | page.tsx:6 |
| labels.ts | page.tsx | TEMPLATE_LABEL import | ✓ WIRED | page.tsx:22 usado en :345 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| page.tsx byTemplate block | issuesByTemplate | model.issuesByTemplate ← buildReportModel ← `prisma.issue.findMany({where:{auditId}})` | Sí (query Prisma real, misma fuente que issuesByCategory) | ✓ FLOWING |

### Behavioral Spot-Checks / Probe Execution

| Check | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| report-model tests | `npx vitest run src/template.test.ts src/build.test.ts` | 15 passed (2 files) | ✓ PASS |
| report-model typecheck | `npx tsc --noEmit -p .` | exit 0 | ✓ PASS |
| apps/web typecheck (follow-up fix) | `pnpm --filter web exec tsc --noEmit` | exit 0 | ✓ PASS |

**Follow-up fix confirmado:** `apps/web/tests/pages/api/audits/[id]/export.test.ts` ahora incluye `issuesByTemplate: emptyByTemplate` (commit `52ec042`); el typecheck de apps/web está verde. El item en `deferred-items.md` quedó resuelto.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| TEMPLATE-01 | 19-01 | Clasifica cada página en plantilla vía heurística de segmentos de URL | ✓ SATISFIED | template.ts + 10 tests; REQUIREMENTS.md marcado Complete |
| TEMPLATE-02 | 19-01, 19-02 | Agrupa issues por plantilla como eje complementario | ✓ SATISFIED | issuesByTemplate + GroupingToggle UI; REQUIREMENTS.md marcado Complete |

Ambos IDs declarados en frontmatter están contabilizados y presentes en REQUIREMENTS.md (líneas 23-24, 58-59). Sin requirements huérfanos para Phase 19.

### Anti-Patterns Found

Ninguno. Sin TODO/FIXME/XXX/TBD/placeholder en los archivos de la fase; sin hex colors en el CSS; sin `any` en template.ts.

### Human Verification Required

#### 1. Alternancia visual del toggle de agrupación

**Test:** Abrir un reporte con issues (/audits/[id]), ir a "Detalle por categoría / plantilla", hacer clic en "Por plantilla" y volver a "Por tipo de error".
**Expected:** Los accordions cambian entre agrupación por categoría y por plantilla (Home/Categoría/Producto/Artículo/Otras). Ambos botones alcanzables con Tab, activables con Enter/Space, y el cambio NO dispara petición de red.
**Why human:** Render visual, alternancia de subtree y ausencia de fetch en runtime no son verificables por grep/typecheck.

### Gaps Summary

Sin gaps bloqueantes. Los 5 must-haves están verificados en código: clasificador puro y testeado, segundo eje `issuesByTemplate` alimentado por query Prisma real, y toggle UI accesible cableado en la página reusando los componentes existentes. El typecheck de apps/web (roto tras 19-02) fue corregido y está verde. Solo resta una confirmación humana de la interacción/visual del toggle, inherente al objetivo user-facing de la fase.

---

_Verified: 2026-07-09T12:20:00Z_
_Verifier: Claude (gsd-verifier)_
