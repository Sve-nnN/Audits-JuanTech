---
phase: 15-ux-del-reporte-agrupaci-n-e-indicadores
verified: 2026-07-08T00:00:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 15: UX del reporte — agrupación e indicadores Verification Report

**Phase Goal:** El reporte presenta los issues agrupados por tipo en dropdowns (en "Issues prioritarios" y en "Detalle por categoría") y muestra el estado del JSON-LD por página en la lista de páginas + grafo, para que la información sea legible sin saturación.
**Verified:** 2026-07-08
**Status:** passed
**Re-verification:** No — initial verification (code review 15-REVIEW.md preceded this; its findings were confirmed applied)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | En "Issues prioritarios" los issues se agrupan por tipo en dropdowns, ordenados por severidad→cantidad, sin saturar | ✓ VERIFIED | `page.tsx:227` `<IssueTypeGroup issues={priorityCandidates} />` sobre el set COMPLETO (WR-01 aplicado); componente usa `<details>/<summary>` nativos; orden delegado a `groupIssuesByType` |
| 2 | En "Detalle por categoría" (problemas y correctos) los issues se agrupan por tipo con orden consistente | ✓ VERIFIED | `page.tsx:316` `<IssueTypeGroup issues={problems} />` y `:319` `issues={passing}` dentro de cada AccordionSubgroup; mismo componente→mismo helper→mismo orden |
| 3 | Cada página muestra su estado JSON-LD (correcto/advertencia/error/ausente) en la lista de páginas | ✓ VERIFIED | `pages/page.tsx:73-75` `<JsonLdBadge schemaSeverities={...} nodeCount={nodeCount} />`; estado derivado por `jsonLdStateForPage` cruzando issues `category:schema` por `pageId` × `schemaGraph.nodes.length` |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/report-model/src/grouping.ts` | `groupIssuesByType` + tipo `IssueTypeGroup`, única fuente del orden | ✓ VERIFIED | Agrupa por `checkId`+`title` con separador `\x00` como escape (texto plano, 0 NUL bytes reales); orden severidad→count; no muta ni pierde issues |
| `packages/report-model/src/jsonld.ts` | `jsonLdStateForPage` + tipo `JsonLdState` (4 estados) | ✓ VERIFIED | Precedencia error>warning>ok>absent implementada exacta; puro, sin React/Prisma |
| `packages/report-model/src/index.ts` | Re-exporta ambos helpers + tipos | ✓ VERIFIED | Líneas 2-5 exportan `groupIssuesByType`, `IssueTypeGroup`, `jsonLdStateForPage`, `JsonLdState` |
| `apps/web/app/components/ui/IssueTypeGroup.tsx` | Dropdown por grupo, llama al helper | ✓ VERIFIED | `groupIssuesByType(issues)` en línea 53; renderiza `<details>` por grupo con SeverityBadge+count+chevron |
| `apps/web/app/components/ui/JsonLdBadge.tsx` | Mapea 4 estados a variantes de Badge | ✓ VERIFIED | Wireado en pages/page.tsx; deriva `hasSchemaGraph = nodeCount > 0` |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `page.tsx` | `IssueTypeGroup` | import + render en ambas secciones | ✓ WIRED | import línea 13; usado en líneas 227, 316, 319 |
| `IssueTypeGroup.tsx` | `groupIssuesByType` | import de @auditor/report-model | ✓ WIRED | import línea 5; llamado línea 53 (única fuente del orden en ambas secciones) |
| `pages/page.tsx` | `JsonLdBadge` | import + render en la lista | ✓ WIRED | import línea 5; render líneas 73-75 |
| `JsonLdBadge.tsx` | `jsonLdStateForPage` | derivación de estado | ✓ WIRED | consumido según SUMMARY 15-03; mapeo estado→variante sin colores nuevos |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| IssueTypeGroup (prioritarios) | `priorityCandidates` | `buildReportModel` (model.priorityCandidates), set completo no recortado | ✓ Sí | ✓ FLOWING |
| IssueTypeGroup (detalle) | `problems` / `passing` | `byCategory` del modelo | ✓ Sí | ✓ FLOWING |
| JsonLdBadge | `schemaSeverityByPage.get(page.id)` + `nodeCount` | Prisma `issue.findMany({where:{auditId,category:"schema"}})` agrupado por `pageId` + `schemaGraph.nodes` | ✓ Sí (query real, no estático) | ✓ FLOWING |

### Applied Fixes from Code Review (confirmed present)

| Fix | Expected | Status | Evidence |
| --- | --- | --- | --- |
| WR-01 | Agrupar el set COMPLETO `priorityCandidates` y quitar la nota "mostrando N de M" | ✓ APPLIED | `page.tsx:227` usa `priorityCandidates` (no `priorityIssues` recortado); grep "Mostrando/mostrando" = 0 resultados |
| WR-02 | NUL literal reemplazado por escape `\x00` (archivo texto plano) | ✓ APPLIED | `file` reporta "UTF-8 text"; perl confirma 0 NUL bytes en working tree y en HEAD |
| UI-1 | summary con `flex-wrap` + `groupTitle` `min-width:0` | ✓ APPLIED | `IssueTypeGroup.module.css:27` flex-wrap, `:56` min-width:0 |
| UI-2 | `role="region"` incondicional removido de cada grupo | ✓ APPLIED | `IssueTypeGroup.tsx:70` comentario explícito, sin `role="region"` en el markup |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| report-model helpers testeados | `pnpm --filter @auditor/report-model test` | 3 files, 18 tests passed | ✓ PASS |
| web components testeados | `pnpm --filter web test` | 4 files, 28 tests passed | ✓ PASS |
| typecheck web | `pnpm --filter web typecheck` | tsc --noEmit sin errores | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| REPORT-01 | 15-01, 15-02 | Agrupación en "Issues prioritarios" | ✓ SATISFIED | IssueTypeGroup sobre priorityCandidates completo |
| REPORT-02 | 15-01, 15-02 | Agrupación en "Detalle por categoría" (problemas+correctos) | ✓ SATISFIED | IssueTypeGroup en problems y passing, mismo helper |
| REPORT-04 | 15-01, 15-03 | Estado JSON-LD de 4 valores por página | ✓ SATISFIED | JsonLdBadge + jsonLdStateForPage por pageId×schemaGraph |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | Ninguno | — | Sin TBD/FIXME/XXX; sin stubs; sin retornos vacíos hardcodeados; datos fluyen desde queries reales |

### Human Verification Required

Ninguna requerida para el estado `passed`. Nota informativa (no bloqueante): la UI-REVIEW no pudo capturar los componentes renderizados porque `/audits/[id]` y `/audits/[id]/pages` requieren un `auditId` sembrado tras verificación de email; la auditoría se hizo por código. Los tests RTL (jsdom) cubren el render de grupos y badges, y typecheck+build están limpios, por lo que no se eleva a `human_needed`.

### Gaps Summary

Sin gaps. Los 3 criterios de éxito del ROADMAP están satisfechos en el código: agrupación por tipo en dropdowns en ambas secciones alimentada por el mismo helper puro `groupIssuesByType` (orden consistente severidad→cantidad, WR-01 garantiza conteos verdaderos no recortados que ya no contradicen "Detalle por categoría"), y estado JSON-LD de 4 valores por página derivado por `jsonLdStateForPage` cruzando issues `schema` por `pageId` con el grafo. Los 4 hallazgos del code review (2 WARNING + 2 UI fixes) están aplicados y confirmados en el árbol de trabajo. Suites verdes: report-model 18, web 28, typecheck limpio.

---

_Verified: 2026-07-08_
_Verifier: Claude (gsd-verifier)_
