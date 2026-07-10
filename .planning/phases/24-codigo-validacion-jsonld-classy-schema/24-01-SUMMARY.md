---
phase: 24-codigo-validacion-jsonld-classy-schema
plan: 01
subsystem: checks
tags: [schema, jsonld, validation, scoring]
requires:
  - "packages/checks/src/checks/schema/extract.ts (flattenNodes, typesOf, hasProp)"
  - "packages/checks/src/checks/schema/schemaValidate.ts (SCHEMA_RULES)"
provides:
  - "validateEntities(entities): motor puro de validación por entidad/propiedad (13 tipos + anti-patrones)"
  - "EntityValidation/PropertyResult/EntityIssue/EntityStatus (contrato para scoring + UI 24-03)"
  - "schemaEntityValidateCheck (SD-07): check de scoring ok/warning, nunca critical"
affects:
  - "packages/scoring (SD-07 reemplaza SD-04 en la validación por-propiedad del score)"
  - "apps/web (consumirá validateEntities re-exportado en 24-03)"
tech-stack:
  added: []
  patterns:
    - "Motor puro determinista separado del check de scoring que lo envuelve"
    - "Anti-patrones de alto valor como lógica adicional, fuera de SCHEMA_RULES"
key-files:
  created:
    - packages/checks/src/checks/schema/validateEntities.ts
    - packages/checks/src/checks/schema/validateEntities.test.ts
    - packages/checks/src/checks/schema/schemaEntityValidate.ts
    - packages/checks/src/checks/schema/schemaEntityValidate.test.ts
  modified:
    - packages/checks/src/checks/schema/schemaValidate.ts
    - packages/checks/src/checks/schema/index.ts
decisions:
  - "author en Article/BlogPosting queda como requerido (error si falta); datePublished como recomendado (warning)"
  - "Review con required:[] y reviewRating recomendado -> su ausencia degrada a warning, no invalida"
  - "Anti-patrón Product+AggregateRating acepta reviewCount o ratingCount como conteo válido"
  - "SD-04 se mantiene exportado pero se retira del array schemaPageChecks (lo reemplaza SD-07)"
metrics:
  duration: ~10 min
  completed: 2026-07-09
  tasks: 2
  files: 6
---

# Phase 24 Plan 01: Motor de validación JSON-LD por entidad + check SD-07 Summary

Motor puro `validateEntities` que valida 13 tipos schema.org de alto impacto (required/recommended + anti-patrón Product+AggregateRating), envuelto por el check de scoring SD-07 que emite sólo ok/warning y reemplaza a SD-04 en el pipeline sin poder tumbar duro el score.

## What Was Built

- **Task 1 — Motor puro (`validateEntities.ts`)**: recibe entidades JSON-LD planas y devuelve, por entidad, el estado (ok/warning/error) de cada propiedad requerida/recomendada de su(s) tipo(s) conocido(s), más observaciones agregadas (requeridas faltantes = error; recomendadas faltantes = warning; anti-patrones = warning) y un status agregado. `SCHEMA_RULES` extendido de ~11 a 13 tipos (agregados LocalBusiness, Event, Recipe, Review). Propiedades desconocidas no se listan ni marcan; @type fuera del subconjunto no penaliza. Determinista, sin IO. Multi-tipo acumula reglas de todos los tipos conocidos.
- **Task 2 — Check de scoring (`schemaEntityValidate.ts`, SD-07)**: envuelve el motor en un `PageCheck`, mapea cualquier entidad con status error/warning a un IssueDraft `warning` (nunca `critical`); si todo queda ok emite un único `ok`; sin JSON-LD devuelve `[]`. Registrado en `schemaPageChecks` reemplazando a SD-04 (que se deja exportado para consumidores/tests). `validateEntities` y sus tipos + `schemaEntityValidateCheck` re-exportados desde el índice para la web (24-03).

## Deviations from Plan

None - plan executed exactly as written. (Ajuste menor: se reformuló un comentario en `validateEntities.ts` que mencionaba literalmente `Date.now`/`Math.random` para que la verificación `grep -c "Math.random\|Date.now"` devuelva 0 como exige el plan.)

## Verification

- `pnpm exec vitest run src/checks/schema/validateEntities.test.ts` → 11/11 verde
- `pnpm exec vitest run src/checks/schema/schemaEntityValidate.test.ts` → 5/5 verde (ninguna severidad critical)
- `pnpm test` (suite completa del paquete) → 121/121 verde en 24 archivos (sin regresiones tras retirar SD-04)
- `pnpm typecheck` → limpio
- `grep -c "Math.random\|Date.now" validateEntities.ts` → 0

## Commits

- `77abe94` test(24-01): failing tests for validateEntities engine
- `169a861` feat(24-01): pure validateEntities engine + SCHEMA_RULES for 13 types
- `e795952` test(24-01): failing tests for SD-07 schemaEntityValidateCheck
- `dad4433` feat(24-01): SD-07 schemaEntityValidateCheck wraps engine (ok/warning, never critical)

## TDD Gate Compliance

Cada task siguió RED (commit `test(...)`) → GREEN (commit `feat(...)`). Sin fase REFACTOR necesaria.

## Self-Check: PASSED

- Archivos creados verificados en disco (validateEntities.ts, validateEntities.test.ts, schemaEntityValidate.ts, schemaEntityValidate.test.ts).
- Commits 77abe94, 169a861, e795952, dad4433 presentes en git log.
