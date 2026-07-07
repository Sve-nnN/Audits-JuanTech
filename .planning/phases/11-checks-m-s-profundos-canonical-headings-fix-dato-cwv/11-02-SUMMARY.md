---
phase: 11-checks-m-s-profundos-canonical-headings-fix-dato-cwv
plan: 02
subsystem: checks
tags: [onpage, headings, ONPAGE-08, seo]
requires: [packages/checks/src/types.ts, packages/checks/src/util.ts, packages/checks/src/checks/onpage/h1.ts]
provides: [headingsCheck, "ONPAGE-08"]
affects: [packages/checks/src/checks/onpage/index.ts]
tech-stack:
  added: []
  patterns: [PageCheck, "fingerprint sub-tipado", "una fila por subtipo"]
key-files:
  created:
    - packages/checks/src/checks/onpage/headings.ts
    - packages/checks/src/checks/onpage/headings.test.ts
  modified:
    - packages/checks/src/checks/onpage/index.ts
decisions:
  - "Headings = nuevo checkId ONPAGE-08 con fingerprint sub-tipado; ONPAGE-03 (conteo/unicidad H1) intacto"
  - "order = el primer heading no es H1 (regla clara y testeable, no colapsa con skip)"
  - "Todas las emisiones WARNING (decisión #3 del CONTEXT)"
metrics:
  duration: ~6 min
  completed: 2026-07-06
  tasks: 2
  files: 3
---

# Phase 11 Plan 02: Headings hierarchy check (ONPAGE-08) Summary

Nuevo PageCheck `headingsCheck` (checkId `ONPAGE-08`) que valida la estructura de encabezados con 4 subtipos WARNING (salto de nivel, heading vacío, fuera de orden, H1 que duplica el title), cada uno con fingerprint sub-tipado para que el diff no colapse múltiples hallazgos por página. El conteo/unicidad de H1 (ONPAGE-03) queda intacto.

## What Was Built

- **`headings.ts`** — recolecta `h1..h6` en orden de documento (nivel numérico + texto trim) y aplica 4 reglas independientes:
  - `ONPAGE-08:skip` — salto descendente > 1 (H1→H3 sin H2)
  - `ONPAGE-08:empty` — algún heading H1–H6 vacío tras trim
  - `ONPAGE-08:order` — el primer heading no es H1
  - `ONPAGE-08:h1-dup-title` — único H1 cuyo texto normalizado iguala al `<title>`
  - Emite un IssueDraft por subtipo (nunca agregado); página sin headings → `[]`.
- **`headings.test.ts`** — 7 casos: 4 subtipos, no-colapso (fingerprints distintos en la misma página), jerarquía limpia y página sin headings.
- **`onpage/index.ts`** — `headingsCheck` añadido a `onPageChecks` y re-exportado.

## Requirements Covered

- HEAD-01, HEAD-02, HEAD-03 — saltos de nivel, headings vacíos, fuera de orden y H1 que duplica el title, todos WARNING, una fila por subtipo.

## Deviations from Plan

None - plan executed exactly as written. (Ajuste menor por `noUncheckedIndexedAccess`: los accesos indexados a `headings[]` se guardaron con variables locales; no cambia comportamiento — Rule 3, blocking typecheck.)

## Verification

- `pnpm --filter @auditor/checks exec tsc --noEmit` → limpio (exit 0).
- `pnpm --filter @auditor/checks test -- headings` → 18 archivos / 77 tests verdes.
- Los 4 literales de subtipo presentes en `headings.ts`.
- `headingsCheck` en `onPageChecks`.

## Self-Check: PASSED

- FOUND: packages/checks/src/checks/onpage/headings.ts
- FOUND: packages/checks/src/checks/onpage/headings.test.ts
- FOUND: commit 5c8100d (Task 1)
- FOUND: commit 893feb2 (Task 2)
