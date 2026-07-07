---
phase: 11-checks-m-s-profundos-canonical-headings-fix-dato-cwv
plan: 03
subsystem: reporting
tags: [perf, cwv, report, psi, worker]
requires:
  - "@auditor/psi mapPerfIssues"
  - "apps/worker persistencia de Issue rows"
provides:
  - "PerfIssueDraft.source poblado con la URL analizada"
  - "worker persiste source real en issues de Rendimiento/CWV"
affects:
  - "Reporte: columna source de issues perf ya no muestra '—'"
tech-stack:
  added: []
  patterns:
    - "Propagación de dato ya presente (url) a columna existente (Issue.source)"
key-files:
  created: []
  modified:
    - packages/psi/src/issues.ts
    - packages/psi/src/issues.test.ts
    - apps/worker/src/index.ts
decisions:
  - "source como campo opcional en PetIssueDraft; se puebla en el 100% de las ramas de mapPerfIssues"
metrics:
  duration: ~5 min
  completed: 2026-07-07
---

# Phase 11 Plan 03: Fix dato URL en issues de Rendimiento/CWV (REPORT-03) Summary

Los issues de Rendimiento/CWV ahora persisten y muestran la URL de la página analizada en su campo `source` en lugar de "—", propagando la `url` ya disponible en `mapPerfIssues` hacia la columna `Issue.source` del worker.

## What Was Built

- **`PerfIssueDraft.source?: string`** — nuevo campo opcional en la interface de `@auditor/psi`.
- **`mapPerfIssues` puebla `source: url`** en todas las ramas: bucle de `METRIC_SPECS`, ambas ramas de INP (presente/ausente) y el early-return "PSI no respondió".
- **Worker** — el `.map` de `perfIssues` reemplaza `source: null as string | null` por `source: draft.source ?? null`, consistente con el bloque de issues no-perf.
- **Tests** — dos aserciones nuevas en `issues.test.ts`: cada draft lleva `source === url` (incluyendo pageId) y el caso early-return sin mobile/desktop también.

## Tasks Completed

| Task | Name | Commits |
| ---- | ---- | ------- |
| 1 | source en PerfIssueDraft + mapPerfIssues (TDD) | 47a35db (test/RED), 7b3df77 (feat/GREEN) |
| 2 | Mapear draft.source en el worker | 8778405 (fix) |

## Verification

- `pnpm --filter @auditor/psi test -- issues` → 27 passed (5 files), incluyendo las 2 aserciones de `source` y el caso early-return.
- `pnpm --filter @auditor/worker exec tsc --noEmit` → limpio (exit 0).
- grep `source:\s*draft\.source` presente en el map de perfIssues (línea 368); ya no queda `source: null as string | null` en ese bloque.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- RED: `test(11-03)` commit 47a35db con 2 tests fallando (source undefined).
- GREEN: `feat(11-03)` commit 7b3df77 con implementación; 27 tests verdes.
- REFACTOR: no necesario.

## Self-Check: PASSED

- FOUND: packages/psi/src/issues.ts (source presente y poblado)
- FOUND: packages/psi/src/issues.test.ts (aserciones de source)
- FOUND: apps/worker/src/index.ts (source: draft.source ?? null)
- FOUND: 47a35db, 7b3df77, 8778405
