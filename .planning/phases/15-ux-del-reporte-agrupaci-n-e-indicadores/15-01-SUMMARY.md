---
phase: 15-ux-del-reporte-agrupaci-n-e-indicadores
plan: 01
subsystem: report-model
tags: [helpers, grouping, jsonld, pure-logic, tdd]
requires:
  - "@auditor/report-model ReportIssue/ReportSeverity types (model.ts)"
provides:
  - "groupIssuesByType(issues) → IssueTypeGroup[] (única fuente del orden severidad→cantidad, REPORT-01/02)"
  - "jsonLdStateForPage(schemaSeverities, hasSchemaGraph) → JsonLdState de 4 valores (REPORT-04)"
affects:
  - "Planes 15-02 (componente IssueTypeGroup) y 15-03 (badge JSON-LD) consumen estos helpers"
tech-stack:
  added: []
  patterns:
    - "Helpers puros sin React/Prisma, testeados con vitest (patrón build.test.ts)"
    - "Peso de severidad canónico local { critical:0, warning:1, ok:2 }"
key-files:
  created:
    - packages/report-model/src/grouping.ts
    - packages/report-model/src/grouping.test.ts
    - packages/report-model/src/jsonld.ts
    - packages/report-model/src/jsonld.test.ts
  modified:
    - packages/report-model/src/index.ts
decisions:
  - "Clave de grupo = `checkId` + espacio + `title` (subtipos del mismo checkId con títulos distintos = grupos separados)"
  - "Orden de grupos por (peso de severidad asc, count desc); empate total resuelto por orden de inserción del Map (estable, sin depender de la estabilidad de Array.sort)"
  - "jsonLdStateForPage devuelve solo el estado semántico; el mapeo a badge/color vive en la UI (plan 03)"
metrics:
  duration: ~4 min
  completed: 2026-07-08
---

# Phase 15 Plan 01: Helpers puros de agrupación e indicadores JSON-LD Summary

Dos helpers puros en `@auditor/report-model` que sostienen la Fase 15: `groupIssuesByType` (agrupa issues por `checkId`+`title` y los ordena severidad-peor-primero luego cantidad descendente — única fuente del orden para REPORT-01/02) y `jsonLdStateForPage` (deriva el peor de 4 estados error/warning/ok/absent para REPORT-04), ambos con TDD.

## What Was Built

- **`groupIssuesByType(issues: ReportIssue[]): IssueTypeGroup[]`** (`grouping.ts`): agrupa por clave compuesta `checkId`+`title` en un `Map`, computa la peor severidad del grupo (menor peso), el `count` y preserva el orden de entrada de los issues. Ordena los grupos por `(peso de severidad asc, count desc)`. No muta la entrada y no pierde/duplica issues (suma de counts == longitud de entrada, mitiga T-15-01). Tipo `IssueTypeGroup` = `{ checkId, title, severity, count, issues }`.
- **`jsonLdStateForPage(schemaSeverities, hasSchemaGraph): JsonLdState`** (`jsonld.ts`): precedencia critical→"error", warning→"warning", si no hay ninguno y hay grafo→"ok", sino→"absent". Tipo `JsonLdState = "error" | "warning" | "ok" | "absent"`.
- **`index.ts`**: re-exporta ambos helpers y sus tipos desde el paquete.

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 (RED) | test groupIssuesByType | f6c7bc5 |
| 1 (GREEN) | impl groupIssuesByType + export | 331172a |
| 2 (RED) | test jsonLdStateForPage | 230f664 |
| 2 (GREEN) | impl jsonLdStateForPage + export | 47bf307 |

## Verification

- `pnpm --filter @auditor/report-model test` → 3 archivos, 17 tests verdes (7 grouping + 5 jsonld + 5 build existentes).
- `pnpm --filter @auditor/report-model typecheck` → limpio.
- Ambos helpers y tipos importables desde `@auditor/report-model` (verificado en index.ts).

## TDD Gate Compliance

Ambas tareas siguieron RED→GREEN: commit `test(...)` con el módulo inexistente (fallo real de import) antes del commit `feat(...)` con la implementación. Sin fase REFACTOR necesaria (helpers mínimos). Gates presentes en git log para las dos features.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: packages/report-model/src/grouping.ts
- FOUND: packages/report-model/src/grouping.test.ts
- FOUND: packages/report-model/src/jsonld.ts
- FOUND: packages/report-model/src/jsonld.test.ts
- FOUND commits: f6c7bc5, 331172a, 230f664, 47bf307
