---
phase: 26-wiring-en-el-worker-tabla-de-stack-en-el-reporte
plan: 03
subsystem: report-model (contrato de datos del stack)
tags: [report-model, fingerprint, FPRINT-09, STACKUI-02, tdd]
requires:
  - "Audit.stack Json? column + cliente Prisma regenerado (26-01)"
  - "@auditor/fingerprint como dep de packages/report-model (26-01)"
provides:
  - "ReportStack / ReportStackAxis: contrato serializable del stack en ReportModel"
  - "ReportModel.stack? (undefined cuando Audit.stack es null)"
  - "toReportStack(rawStack): transform puro CMS+builder combinado, analytics array, sin signals"
  - "Re-export de Confidence desde @auditor/report-model para apps/web"
affects:
  - packages/report-model/src/model.ts
  - packages/report-model/src/index.ts
  - packages/report-model/src/build.ts
  - packages/report-model/src/build.test.ts
tech-stack:
  added: []
  patterns:
    - "campo opcional degradation-safe en ReportModel (mismo patrón que perf?/architecture?)"
    - "transform en buildReportModel como single source of truth (nunca query paralela)"
    - "re-export de tipo de dep transitiva para evitar dep directa en apps/web (patrón PageTemplate)"
key-files:
  created: []
  modified:
    - packages/report-model/src/model.ts
    - packages/report-model/src/index.ts
    - packages/report-model/src/build.ts
    - packages/report-model/src/build.test.ts
decisions:
  - "toReportStack exportada (named export de build.ts) para test unitario directo; no se agregó a index.ts (no la consume apps/web todavía)"
  - "CMS+builder: confianza mostrada = cms.confidence (el builder es refinamiento, no cambia la confianza)"
  - "builder NO se combina si cms.value !== 'WordPress' (evita label 'Shopify (Elementor)' por señal espuria)"
metrics:
  duration: ~10m
  completed: 2026-07-22
status: complete
---

# Phase 26 Plan 03: Contrato de datos del stack en report-model — Summary

`buildReportModel` ahora lee el campo escalar persistido `Audit.stack` (que ya viene del `findUnique` existente, sin query paralela ni re-detección — FPRINT-09) y lo transforma con `toReportStack` en un `ReportStack` serializable expuesto como `model.stack`. El transform combina CMS+builder en un único label (`"WordPress (Elementor)"`) con la confianza del CMS, mapea `analytics` como array ordenado (coexistencia GA4/GTM/Meta Pixel) y descarta `signals`/`evidence` para no filtrar detalle de detección al cliente (T-26-03-01). Cuando `Audit.stack` es null (audits pre-v1.5), `model.stack` queda `undefined` y la UI oculta la sección entera.

## Task Status

| Task | Nombre | Estado | Commit |
| ---- | ------ | ------ | ------ |
| 1 | Tipos ReportStack/ReportStackAxis + ReportModel.stack + exports (incl. Confidence) | Completa | `406df60` |
| 2 | toReportStack + lectura de audit.stack en buildReportModel + tests (TDD) | Completa | `8649fac` |

## Qué se implementó

### Task 1 — Tipos y exports (`406df60`)
- `model.ts`: `import type { Confidence } from "@auditor/fingerprint"`; interfaces `ReportStackAxis` (`{ value: string | null; confidence: Confidence }`) y `ReportStack` (`cms`/`cdn`/`hosting`/`jsFramework: ReportStackAxis`; `analytics: ReportStackAxis[]`). Campo opcional `ReportModel.stack?` documentado como degradation-safe (mismo patrón que `perf?`/`architecture?`).
- `index.ts`: `ReportStack`/`ReportStackAxis` agregados al bloque `export type { ... } from "./model"`; re-export `export type { Confidence } from "@auditor/fingerprint"` para que apps/web lo importe desde report-model sin dep directa a fingerprint (patrón `PageTemplate`).

### Task 2 — Transform + lectura + tests (TDD, `8649fac`)
- `build.ts`: `import type { AxisResult, DetectedStack } from "@auditor/fingerprint"`. Helper interno `toReportStackAxis` (mapea `AxisResult` → `{ value, confidence }`, descarta `signals`). Función pura exportada `toReportStack(rawStack: DetectedStack): ReportStack`: folding CMS+builder solo para WordPress, `analytics.map(...)`. Lectura del campo escalar `audit.stack` (`rawStack ? toReportStack(rawStack) : undefined`) y `stack` agregado al objeto de retorno junto a `perf`/`architecture`.
- `build.test.ts`: fixtures `axis()` y `makeDetectedStack()`; 2 casos de integración en `buildReportModel` (stack presente sin re-detección, `Audit.stack = null` → undefined) y 6 casos unitarios de `toReportStack` (5 ejes sin signals, CMS+builder combinado, CMS sin builder, CMS no-WordPress no combina, analytics múltiple ordenado, analytics vacío → []).

**Ciclo TDD:** tests escritos primero → RED confirmado (7 fallos, `toReportStack is not a function`) → implementación → GREEN (44/44).

## Verificación

| Check | Comando | Resultado |
| ----- | ------- | --------- |
| Typecheck | `pnpm --filter @auditor/report-model typecheck` | PASS (tsc --noEmit sin errores) |
| Tests | `pnpm --filter @auditor/report-model test` | PASS (44/44, 4 archivos) |
| Grep guard (no re-detección) | `grep -c "detectStack" packages/report-model/src/build.ts` | `0` |

## Threat model

- **T-26-03-01 (Information Disclosure — mitigate):** aplicado. `toReportStackAxis` transporta solo `value`+`confidence`; test asserta que `JSON.stringify(model.stack)` no contiene `"signals"` ni `"evidence"`, y que cada axis tiene exactamente las claves `["confidence","value"]`.
- **T-26-03-03 (Tampering — accept):** el label combinado se compone a partir de constantes de firmas (Phase 25), no de strings crudos del sitio; escape final en JSX (26-05).

## Deviations from Plan

None - plan ejecutado exactamente como está escrito.

## Notas de integración para Wave siguiente

- `apps/web` debe importar `Confidence`, `ReportStack`, `ReportStackAxis` desde `@auditor/report-model` (no desde `@auditor/fingerprint`).
- `page.tsx` NUNCA debe hacer query paralela a `audit.stack`: consume `model.stack`.
- `analytics === []` es el estado "no detectado" que la UI pinta como fila; `model.stack === undefined` oculta la sección completa.

## Self-Check: PASSED
- FOUND: packages/report-model/src/model.ts (ReportStack/ReportStackAxis/ReportModel.stack?)
- FOUND: packages/report-model/src/index.ts (exports + re-export Confidence)
- FOUND: packages/report-model/src/build.ts (toReportStack + lectura audit.stack + return)
- FOUND: packages/report-model/src/build.test.ts (casos nuevos)
- FOUND commit: 406df60 (Task 1)
- FOUND commit: 8649fac (Task 2)
