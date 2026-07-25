---
phase: 25-fingerprint-de-stack-t-cnico-contrato-de-datos-y-motor-de-de
plan: 01
subsystem: fingerprint
tags: [typescript, cheerio, monorepo, workspace, data-contract, fingerprinting]

# Dependency graph
requires:
  - phase: 24-*
    provides: patrón de paquete puro del monorepo (@auditor/graph, @auditor/scoring) copiado como shape base
provides:
  - "Paquete @auditor/fingerprint (workspace, puro, dep runtime única: cheerio)"
  - "Contrato de datos tipado: DetectedStack, AxisResult, Confidence, Signal, SignalStrength, Axis, PageFingerprintInput, AggregatedInput, Signature"
  - "analytics como AxisResult[] (coexistencia GA4+GTM+Meta Pixel) fijado a nivel tipo (FPRINT-07)"
  - "no-detectado como miembro de union de primera clase en Confidence (FPRINT-08)"
  - "Signature.test: number (conteo de marcadores) para desempate de builders"
affects: [26-wiring-worker-ui, 27-cms-adapters, fingerprint-signatures, detectStack]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Paquete puro desacoplado de @auditor/db/@auditor/crawler en runtime (PageFingerprintInput propio, patrón GraphPage)"
    - "Barrel de solo-tipos (export type { ... }) sin exportar aún la función detectStack (Plan 25-04)"

key-files:
  created:
    - packages/fingerprint/package.json
    - packages/fingerprint/tsconfig.json
    - packages/fingerprint/src/types.ts
    - packages/fingerprint/src/index.ts
  modified:
    - pnpm-lock.yaml

key-decisions:
  - "cheerio como única dependencia runtime — NO se copió @auditor/crawler de graph/package.json (motor puro por decisión de CONTEXT/STATE.md)"
  - "AggregatedInput expone instancia cheerio ya cargada ($) + headers lowercase agregados + union de cookieNames + html elegido (home->fallback) como forma que consume Signature.test"
  - "Signal.unequivocal? y Signature.unequivocal? marcan señales inequívocas de plataforma para la regla '1 señal inequívoca -> alto' del resolvedor (Plan 25-04)"

patterns-established:
  - "Pattern: contrato de datos de fingerprint fijado antes de cualquier regla de detección (evita retrabajo en cascada sobre signatures/consumidores/UI)"
  - "Pattern: cookieNames solo transporta nombres, nunca valores — no hay campo para valores por construcción del tipo (T-25-01)"

requirements-completed: [FPRINT-02, FPRINT-07, FPRINT-08]

coverage:
  - id: D1
    description: "Paquete @auditor/fingerprint scaffold: resuelve en el workspace y typecheck en verde con cheerio como única dep runtime"
    verification:
      - kind: unit
        ref: "pnpm --filter @auditor/fingerprint typecheck"
        status: pass
      - kind: other
        ref: "grep -E '@auditor/(crawler|db|checks)' packages/fingerprint/package.json (sin match)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Contrato de datos: DetectedStack con analytics: AxisResult[], Confidence con no-detectado, Signature.test: number, PageFingerprintInput desacoplado de Prisma"
    requirement: FPRINT-07
    verification:
      - kind: unit
        ref: "pnpm --filter @auditor/fingerprint typecheck"
        status: pass
      - kind: other
        ref: "grep -cE 'analytics: AxisResult\\[\\]' packages/fingerprint/src/types.ts == 1"
        status: pass
      - kind: other
        ref: "grep -nE '^import .*(@auditor/db|@auditor/crawler|@prisma/client)' packages/fingerprint/src/types.ts (sin match)"
        status: pass
    human_judgment: false

# Metrics
duration: 6 min
completed: 2026-07-21
status: complete
---

# Phase 25 Plan 01: Scaffold @auditor/fingerprint + contrato de datos Summary

**Paquete puro @auditor/fingerprint (cheerio como única dep runtime) con el contrato de datos completo: DetectedStack (analytics como array, no-detectado de primera clase), Signature.test devolviendo conteo de marcadores, y PageFingerprintInput desacoplado de Prisma.**

## Performance

- **Duration:** ~6 min
- **Tasks:** 2
- **Files created:** 4 (package.json, tsconfig.json, src/types.ts, src/index.ts)
- **Files modified:** 1 (pnpm-lock.yaml)

## Accomplishments
- Creado el paquete workspace `@auditor/fingerprint` con el mismo shape que `@auditor/graph` pero con `cheerio` como ÚNICA dependencia runtime (sin `@auditor/crawler`, `@auditor/db` ni `@auditor/checks`), preservando el desacople decidido en CONTEXT/STATE.md.
- Fijado el contrato de datos completo en `src/types.ts`: `Axis`, `Confidence` (con `no-detectado`), `SignalStrength`, `Signal`, `AxisResult`, `DetectedStack` (`analytics` como `AxisResult[]`), `PageFingerprintInput`, `AggregatedInput` y `Signature`.
- Barrel de solo-tipos en `src/index.ts` exportando los 9 símbolos públicos; sin exportar aún `detectStack` (esa función la crea Plan 25-04, exportarla ahora rompería typecheck).

## Task Commits

Cada task se commiteó atómicamente:

1. **Task 1: Scaffold del paquete @auditor/fingerprint** - `5c55a37` (feat)
2. **Task 2: Contrato de datos (types.ts) + barrel de tipos (index.ts)** - `094cfda` (feat)

## Files Created/Modified
- `packages/fingerprint/package.json` - Manifest del paquete puro; `cheerio ^1.2.0` como única dep runtime, devDeps estándar del monorepo.
- `packages/fingerprint/tsconfig.json` - Idéntico a graph: extends `../../tsconfig.base.json`, lib ES2022, types node.
- `packages/fingerprint/src/types.ts` - Contrato de datos completo (9 tipos públicos).
- `packages/fingerprint/src/index.ts` - Barrel de solo-tipos.
- `pnpm-lock.yaml` - Registro del nuevo workspace package tras `pnpm install`.

## Decisions Made
- **cheerio como única dep runtime:** se copió el shape de `packages/graph/package.json` pero se OMITIÓ deliberadamente `@auditor/crawler` para mantener el motor puro y desacoplado (decisión de CONTEXT/STATE.md).
- **AggregatedInput con `$: CheerioAPI`:** la forma normalizada que consume `Signature.test` incluye una instancia cheerio ya cargada con el HTML elegido (home->fallback), headers lowercase agregados y union de cookieNames — evita que cada signature parsee HTML por su cuenta.
- **Campos `unequivocal?` en `Signal` y `Signature`:** habilitan la regla "1 señal inequívoca -> alto" del resolvedor de confianza que implementará el Plan 25-04.

## Deviations from Plan

None - plan executed exactly as written.

El único import en `types.ts` es `type { CheerioAPI } from "cheerio"` (dep runtime permitida). El match del grep de "forbidden imports" sobre `@auditor/db` corresponde a un comentario de documentación (justificación del desacople, patrón GraphPage), no a una sentencia `import` — confirmado con `grep -nE "^import "`.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- El contrato de datos está fijado y en verde; los consumidores (worker Phase 26, adapters CMS Phase 27) pueden importar los tipos sin resolver Prisma.
- Listo para Plan 25-02 (columnas `Page.responseHeaders`/`Page.cookieNames` + helpers de captura en el crawler).
- El registry de signatures (Plan 25-03) y `detectStack` + `resolveConfidence` (Plan 25-04) construyen sobre este contrato.

## Self-Check

- `packages/fingerprint/package.json` — FOUND
- `packages/fingerprint/tsconfig.json` — FOUND
- `packages/fingerprint/src/types.ts` — FOUND
- `packages/fingerprint/src/index.ts` — FOUND
- Commit `5c55a37` — FOUND
- Commit `094cfda` — FOUND

## Self-Check: PASSED

---
*Phase: 25-fingerprint-de-stack-t-cnico-contrato-de-datos-y-motor-de-de*
*Completed: 2026-07-21*
