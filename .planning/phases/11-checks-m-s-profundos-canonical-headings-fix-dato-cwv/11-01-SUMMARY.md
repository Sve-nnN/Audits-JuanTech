---
phase: 11-checks-m-s-profundos-canonical-headings-fix-dato-cwv
plan: 01
subsystem: checks
tags: [seo, canonical, site-check, tech]
requires:
  - "@auditor/crawler normalizeUrl"
  - "@auditor/checks SiteCheck/IssueDraft types"
provides:
  - "canonicalDeep SiteCheck (TECH-04 deep) con 9 fingerprints sub-tipados"
affects:
  - "packages/checks techSiteChecks / registry siteChecks"
tech-stack:
  added: []
  patterns:
    - "SiteCheck que indexa el set crawleado por URL normalizada (url + finalUrl)"
    - "Fingerprints sub-tipados TECH-04:<subtipo> para no colapsar el diff"
key-files:
  created:
    - packages/checks/src/checks/tech/canonicalDeep.ts
    - packages/checks/src/checks/tech/canonicalDeep.test.ts
  modified:
    - packages/checks/src/checks/tech/index.ts
decisions:
  - "canonicalDeep resuelve el estado del destino contra el set ya crawleado, sin red (skip silencioso si el destino same-domain no está en el set)"
  - "Severidades por CONTEXT #2: noindex/redirect/http-error/chain/noindex-conflict = critical; cross-domain/relative/multiple-conflicting/final-url-mismatch = warning"
metrics:
  duration: ~12 min
  completed: 2026-07-06
---

# Phase 11 Plan 01: canonicalDeep (canonical profundo) Summary

SiteCheck nuevo `canonicalDeep` (checkId TECH-04) que valida el destino de la canonical contra el set de páginas ya crawleado sin ninguna llamada de red, emitiendo 9 subtipos de hallazgo con fingerprints sub-tipados.

## What Was Built

- **`canonicalDeep.ts`**: SiteCheck que construye un `Map<normalizedUrl, Page>` (indexando por `url` y `finalUrl`) y por cada página con canonical evalúa 9 subtipos:
  - Críticos: `noindex-conflict`, `noindex-target`, `redirect-target` (3xx), `http-error-target` (4xx/5xx), `chain` (canonical→canonical).
  - Warnings: `multiple-conflicting`, `relative`, `cross-domain`, `final-url-mismatch`.
  - Destino same-domain ausente del set → skip silencioso (cero falso positivo).
  - Parseo de host envuelto en try/catch (mitigación T-11-01: canonical malformada nunca lanza).
- **`canonicalDeep.test.ts`**: 11 casos vitest (9 subtipos + skip silencioso + no-colapso de fingerprints con `new Set(fingerprints).size === issues.length`).
- **`tech/index.ts`**: `canonicalDeep` registrado en `techSiteChecks` y re-exportado (fluye a `siteChecks` vía registry).

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Implementar canonicalDeep SiteCheck | 35931f1 | canonicalDeep.ts |
| 2 | Tests de canonicalDeep + registro en techSiteChecks | ffddc1e | canonicalDeep.test.ts, tech/index.ts |

## Verification

- `pnpm --filter @auditor/checks exec tsc --noEmit` — limpio.
- `pnpm --filter @auditor/checks test -- canonicalDeep` — 11/11 verde.
- Suite completa del paquete: 17 archivos, 70 tests verde (sin regresiones por el registro).
- `canonicalDeep` presente en `techSiteChecks`.

## Requirements Covered

CANON-01, CANON-02, CANON-03, CANON-04 — destino noindex/3xx/4xx/5xx/cadena → crítico; cross-domain/relativo/múltiple/mismatch → warning; conflicto canonical+noindex → crítico; skip silencioso para destinos ausentes; fingerprints sub-tipados en los 9 hallazgos.

## Deviations from Plan

None - plan ejecutado tal cual. Único ajuste menor: `Page.statusCode` es nullable, se normalizó con `?? 0` antes de las comparaciones de rango (typecheck), sin cambiar la lógica.

## Threat Flags

Ninguna superficie nueva: entrada es HTML ya persistido, sin red, sin dependencias nuevas. T-11-01 mitigado (try/catch en parseo de URL/host).

## Notes

- El PageCheck `canonicalCheck` (TECH-04 page-level: presencia/única/self) se conserva intacto según decisión de CONTEXT.
- Headings (ONPAGE-08) y fix REPORT-03 del dato CWV quedan para otros planes de la fase (no en el alcance de 11-01).

## Self-Check: PASSED

- FOUND: packages/checks/src/checks/tech/canonicalDeep.ts
- FOUND: packages/checks/src/checks/tech/canonicalDeep.test.ts
- FOUND commit: 35931f1
- FOUND commit: ffddc1e
