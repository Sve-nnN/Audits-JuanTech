---
phase: 11-checks-m-s-profundos-canonical-headings-fix-dato-cwv
plan: 04
subsystem: checks
tags: [seo, canonical, headings, diff, scoring, guardrail, SC5]
requires:
  - "@auditor/checks canonicalDeep (11-01)"
  - "@auditor/checks headingsCheck (11-02)"
  - "@auditor/scoring diffIssues / scoreCategory"
provides:
  - "phase11-guardrail.test.ts — no-colapso integrado canonical+headings + estabilidad de score"
affects:
  - "packages/checks (devDependency @auditor/scoring)"
tech-stack:
  added: []
  patterns:
    - "Test integrado que cruza dos checks distintos (SiteCheck + PageCheck) sobre la misma página"
    - "Guardarraíl de no-colapso vía diffIssues sobre la unión de fingerprints sub-tipados"
key-files:
  created:
    - packages/checks/src/checks/phase11-guardrail.test.ts
  modified:
    - packages/checks/package.json
decisions:
  - "@auditor/scoring añadido como devDependency de @auditor/checks (workspace:*) para importar diffIssues/scoreCategory en el test — es un paquete del monorepo, no una dependencia externa"
  - "Fixture de no-colapso: canonical cross-domain (destino fuera del set → único subtipo canonical) + headings skip/empty en la misma página → 3 fingerprints únicos"
metrics:
  duration: ~6 min
  completed: 2026-07-07
  tasks: 2
  files: 2
---

# Phase 11 Plan 04: SC#5 guardrail (no-colapso + estabilidad de score) Summary

Test integrado `phase11-guardrail.test.ts` que blinda SC#5 cruzando los dos checks nuevos de la fase: verifica que un hallazgo canonical (TECH-04:*) y hallazgos de headings (ONPAGE-08:*) sobre la MISMA página no se colapsan en el diff, y que incorporar ambos checks no desvía el score de una fixture con canonical/jerarquía correctas.

## What Was Built

- **`phase11-guardrail.test.ts`** — dos `describe` que cubren el concern integrado que ni 11-01 ni 11-02 prueban en aislamiento:
  - **No-colapso (Task 1):** página con `<link rel="canonical" href="https://otro-dominio.com/x">` (dispara `TECH-04:cross-domain`; el destino no está en el set → es el único subtipo canonical) + `<h1>Uno</h1><h3></h3>` (dispara `ONPAGE-08:skip` y `ONPAGE-08:empty`). Combina los `IssueDraft` de `canonicalDeep.run` y `headingsCheck.run`, asserta `new Set(fingerprints).size === fingerprints.length` y que `diffIssues(combined, []).statusByFingerprint.size === combined.length` con todos marcados `new`.
  - **Estabilidad de score (Task 2):** fixture limpia (canonical self-referente absoluta al mismo host + jerarquía H1→H2→H3 sin vacíos y H1 ≠ title). Ambos checks devuelven `[]`. Asserta `scoreCategory(base).score === scoreCategory([...base, ...nuevas]).score` (y status) porque las filas nuevas son cero — canonicalDeep/headingsCheck solo emiten filas de problema, nunca filas "ok", así que no alteran el denominador del score.
- **`packages/checks/package.json`** — `@auditor/scoring` añadido como devDependency (`workspace:*`) para importar `diffIssues`/`scoreCategory`/`ScorableIssue`.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Test de no-colapso de fingerprints (canonical + headings) | e8c47af | phase11-guardrail.test.ts, package.json, pnpm-lock.yaml |
| 2 | Test de estabilidad de score sobre fixture correcta | c86b015 | phase11-guardrail.test.ts |

## Requirements Covered

CANON-01, CANON-02, CANON-03, CANON-04, HEAD-01, HEAD-02, HEAD-03 — guardarraíl integrado SC#5: fingerprints sub-tipados de canonical+headings no colapsan en el diff y el score no se desvía sobre una fixture sana.

## Verification

- `pnpm --filter @auditor/checks exec tsc --noEmit` → limpio (exit 0).
- `pnpm --filter @auditor/checks test -- phase11-guardrail` → verde (2 tests nuevos).
- Suite completa `pnpm --filter @auditor/checks test` → 19 archivos / 79 tests verde.
- Suite `pnpm --filter @auditor/scoring test` → 3 archivos / 25 tests verde (sin regresiones).

## Deviations from Plan

- **[Rule 3 - Blocking] `@auditor/scoring` no era dependencia de `@auditor/checks`.** El test necesita importar `diffIssues`/`scoreCategory` desde `@auditor/scoring`. Se añadió como devDependency `workspace:*` y se corrió `pnpm install` para enlazar el paquete del monorepo. No es una instalación de paquete externo (es intra-workspace), así que no aplica el checkpoint de legitimidad de paquetes.

## Threat Flags

Ninguna superficie nueva: solo tests sobre lógica pura ya existente, sin entrada externa, sin red, sin dependencias externas nuevas (T-11-SC: accept — fase sin instalación de paquetes externos).

## Self-Check: PASSED

- FOUND: packages/checks/src/checks/phase11-guardrail.test.ts
- FOUND commit: e8c47af
- FOUND commit: c86b015
