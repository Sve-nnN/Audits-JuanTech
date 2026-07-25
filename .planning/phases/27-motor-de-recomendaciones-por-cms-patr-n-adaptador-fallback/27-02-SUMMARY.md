---
phase: 27
plan: 02
subsystem: cms-adapters
tags: [motor, registry, fallback, resolution, seo]
requires:
  - "@auditor/cms-adapters capa de datos (Plan 27-01: tipos + 4 adaptadores)"
  - "@auditor/fingerprint (DetectedStack type-only)"
provides:
  - "resolveCmsRecommendation(stack, checkId, generic): motor puro de resolución"
  - "registry: Record<CmsLabel, CmsAdapter>"
  - "API pública @auditor/cms-adapters (barrel src/index.ts)"
affects:
  - "Plan 27-03 (report-model importa resolveCmsRecommendation en el punto de inyección de build.ts)"
tech-stack:
  added: []
  patterns:
    - "Registry Record<CmsLabel,CmsAdapter> mirror de fingerprint/signatures/registry.ts (datos aislados del motor)"
    - "Función pura con guards tempranos + default seguro (nunca lanza) — patrón toReportStack"
    - "Import type-only del boundary (@auditor/fingerprint), cero @auditor/checks"
    - "Fallback = argumento generic devuelto byte-idéntico (no copia almacenada)"
key-files:
  created:
    - packages/cms-adapters/src/registry.ts
    - packages/cms-adapters/src/resolveCmsRecommendation.ts
    - packages/cms-adapters/src/index.ts
    - packages/cms-adapters/src/resolveCmsRecommendation.test.ts
  modified: []
decisions:
  - "El motor threadea cms.value como argumento label a lookup(checkId, label, builder), de modo que Wix/Squarespace (mismo adaptador) resuelven copy distinta"
  - "Guard CMS_LABELS.includes(value) ANTES de indexar el registry: default seguro, nunca indexa con label inesperado (V5 ASVS L1)"
  - "Set ACTIVATING = {alto, medio}: medio también activa la copy de plataforma (Pitfall 4, CONTEXT)"
requirements: [CMSFIX-01, CMSFIX-02, CMSFIX-04]
metrics:
  duration: ~6 min
  completed: 2026-07-25
status: complete
---

# Phase 27 Plan 02: Motor de resolución @auditor/cms-adapters Summary

Motor puro `resolveCmsRecommendation` con gating por confianza (alto/medio activan) y cadena de fallback obligatoria, el `registry` que mapea las 5 `CmsLabel` a sus adaptadores (Wix y Squarespace al mismo módulo), y el barrel público. Cubierto por una matriz de resolución/fallback en verde. Ningún check fuera de los 10 se toca: el genérico se devuelve byte-idéntico (CMSFIX-04).

## Qué se construyó

- **`registry.ts`** — `export const registry: Record<CmsLabel, CmsAdapter>` con un import por adaptador (WordPress/Shopify/Webflow/wixSquarespace). Wix y Squarespace referencian el mismo `wixSquarespaceAdapter`; el adaptador ramifica por label internamente (CMSFIX-01). Mismo shape que `fingerprint/src/signatures/registry.ts`.
- **`resolveCmsRecommendation.ts`** — función pura `resolveCmsRecommendation(stack: DetectedStack | null, checkId: string, generic: string | null): string | null`. Constantes de módulo: `ACTIVATING = Set{"alto","medio"}` y `CMS_LABELS`. Guards en orden con early-return de `generic`: (1) `!stack`; (2) `confidence` fuera del set activador; (3) `value == null` o no está en `CMS_LABELS`. Luego resuelve `adapter = registry[value]` e `instruction = adapter.lookup(checkId, value, stack.builder)`, devolviendo `instruction ?? generic`. Nunca indexa el registry sin el guard `includes` previo; nunca lanza.
- **`index.ts`** — barrel: `export { resolveCmsRecommendation }`, `export { SUPPORTED_CHECK_IDS }`, `export type { CmsLabel, CmsAdapter }`. Único punto de entrada que importará report-model (Plan 03).
- **`resolveCmsRecommendation.test.ts`** — 11 tests: helper `stackOf` parametriza `DetectedStack` por ejes `cms`/`builder`. Matriz de los 4 `Confidence` (alto/medio → copy "En WordPress…"; bajo/no-detectado → genérico), caminos de fallback (stack null, label sin adaptador "Drupal", `cms.value` null, checkId fuera de los 10 "TECH-10" con assert de identidad estricta, `generic === null` → null), variante builder (WordPress+Elementor ONPAGE-04 ≠ rama), y threading de label (Wix ≠ Squarespace, ambos ≠ genérico).

## Verificación (checks reales, no asumidos)

- `pnpm --filter @auditor/cms-adapters typecheck` → **PASA** (`tsc --noEmit`, exit 0, sin errores).
- `pnpm --filter @auditor/cms-adapters test` → **PASA** (2 test files, **21 tests**: 10 de `coverage.test.ts` del Plan 01 + 11 nuevos de resolución/fallback, 160ms).
- Ciclo TDD respetado: con el test escrito y sin la implementación, `test` fallaba con `Cannot find module './resolveCmsRecommendation'` (RED); tras crear registry/motor/barrel pasó a 21/21 (GREEN).
- Boundary duro: `grep -rn "@auditor/checks" packages/cms-adapters/src` → **0 líneas**. `DetectedStack` entra `import type` (verificado por grep); no hay import runtime de fingerprint.

## Deviations from Plan

**Commit único al final (instrucción del orquestador).** El plan marca Task 1 como `tdd="true"` (que implicaría commits RED/GREEN separados). El agente lanzador (Juan) indicó explícitamente "commit atómico al final con mensaje estilo `feat(27-02)`". Se respetó esa directiva: se ejecutó el gate TDD en vivo (RED verificado antes de implementar, GREEN después) pero se consolidó en un único commit `feat(27-02)`. Sin impacto en el resultado verificado.

Fuera de eso: plan ejecutado exactamente como está escrito.

## Supuestos de diseño resueltos en autónomo

- **Genéricos de entrada de los tests:** el plan pide "un generic conocido" para las aserciones. Como el contrato del motor es de identidad (devolver el argumento tal cual), los strings genéricos usados en el test son arbitrarios pero estables (constantes `GENERIC_ONPAGE_01`, `GENERIC_TECH_10`) — el valor exacto no afecta la validez de las aserciones de fallback/identidad. No se acoplaron a los genéricos verbatim de checks (que viven en `@auditor/checks`, boundary prohibido).
- **Firma de `lookup` con 3 args:** el motor pasa `cms.value` como el argumento `label` (firma `lookup(checkId, label, builder)` fijada en Plan 01), no la firma de 2 args del RESEARCH original. Es lo que permite que Wix/Squarespace ramifiquen bajo el mismo adaptador.

## Known Stubs

Ninguno. El motor es funcional y completo; `index.ts` expone la API que consumirá report-model en el Plan 03 (integración en `build.ts`, aún no ejecutada — fuera de alcance de este plan).

## Threat Flags

Ninguna superficie nueva. Los guards del motor mitigan T-27-02-01 (indexación con label/checkId inesperado → default seguro `generic`, nunca lanza) y T-27-02-02 (reescritura de genéricos fuera de los 10 → `?? generic` byte-idéntico, cubierto por el test de identidad estricta sobre TECH-10).

## Self-Check: PASSED

- Archivos creados: `registry.ts`, `resolveCmsRecommendation.ts`, `index.ts`, `resolveCmsRecommendation.test.ts` — los 4 existen (FOUND).
- typecheck/test verdes verificados en vivo (21 tests); boundary `@auditor/checks` = 0 líneas; `DetectedStack` type-only confirmado.
