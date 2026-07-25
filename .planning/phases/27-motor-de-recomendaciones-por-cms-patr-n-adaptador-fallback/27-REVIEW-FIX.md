---
phase: 27-motor-de-recomendaciones-por-cms-patr-n-adaptador-fallback
fixed_at: 2026-07-25T15:30:00Z
review_path: .planning/phases/27-motor-de-recomendaciones-por-cms-patr-n-adaptador-fallback/27-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 27: Code Review Fix Report

**Fixed at:** 2026-07-25T15:30:00Z
**Source review:** .planning/phases/27-motor-de-recomendaciones-por-cms-patr-n-adaptador-fallback/27-REVIEW.md
**Iteration:** 1

**Scope:** Critical + Warning (default, sin `--all`). Los 3 hallazgos Info (IN-01, IN-02, IN-03) quedaron sin tocar, según lo pedido.

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03; 0 Critical)
- Fixed: 3
- Skipped: 0

Todos los fixes se aplicaron en un git worktree aislado (`gsd-reviewfix/27-*`), verificados con `pnpm --filter @auditor/cms-adapters typecheck && test` y `pnpm --filter @auditor/report-model typecheck && test` después de cada commit, y luego fast-forwardeados a `main` (sin conflicto, sin necesidad de merge manual).

## Fixed Issues

### WR-01: `coverage.test.ts` no validaba el `registry` real de producción

**Files modified:** `packages/cms-adapters/src/coverage.test.ts`
**Commit:** `68fff0b`
**Applied fix:** Se eliminó el mapa local `adapters: Record<CmsLabel, CmsAdapter>` (paralelo y potencialmente divergente) y el test ahora importa `registry` de `./registry` en las dos verificaciones que iteran por label (las 50 combinaciones y el chequeo de `checkId` fuera de catálogo). Verificado: `typecheck` limpio, 21/21 tests de `cms-adapters` y 48/48 de `report-model` en verde.

### WR-02: Umbral de confianza `{alto, medio}` duplicado sin fuente única

**Files modified:** `packages/cms-adapters/src/types.ts`, `packages/cms-adapters/src/wordpress.ts`, `packages/cms-adapters/src/resolveCmsRecommendation.ts`
**Commit:** `76513c0`
**Applied fix:** Se extrajo `ACTIVATING_CONFIDENCE = new Set<Confidence>(["alto", "medio"])` a `types.ts` (tipado contra el `Confidence` real de `@auditor/fingerprint`, no `Set<string>`). `wordpress.ts` (antes `ACTIVATING_BUILDER`) y `resolveCmsRecommendation.ts` (antes `ACTIVATING`) ahora importan la misma constante en vez de redeclararla — un cambio futuro de umbral queda en un solo lugar. Verificado: `typecheck` limpio, 21/21 + 48/48 tests en verde.

### WR-03: La copy de TECH-04 no distinguía sub-casos de `canonicalDeep`

**Files modified:** `packages/cms-adapters/src/wordpress.ts`, `packages/cms-adapters/src/shopify.ts`, `packages/cms-adapters/src/webflow.ts`, `packages/cms-adapters/src/wixSquarespace.ts` (catálogos Wix y Squarespace)
**Commit:** `13b3c30`
**Applied fix:** Se eligió la opción (a) sugerida por el reviewer sobre la (b): en vez de solo documentar la limitación en un comentario, se agregó una oración breve y genérica al final de cada una de las 5 entradas `TECH-04` (WordPress, Shopify, Webflow, Wix, Squarespace) orientando a revisar el *destino* de la canonical (noindex, redirección, cadena) cuando el problema no es la ubicación del campo. No se reabrió la arquitectura de catálogo plano (decisión lockeada en `27-CONTEXT.md`). Se agregó además un comentario de código en cada archivo documentando que esa entrada cubre ambos checks (`canonical.ts` y `canonicalDeep.ts`). Verificado: `typecheck` limpio, 21/21 + 48/48 tests en verde (ningún test asume el texto exacto de TECH-04).

**Nota:** este fix modifica copy orientada al usuario final. El contenido no puede verificarse automáticamente por los tests (solo chequean que el string sea no vacío) — **requiere validación humana** de que la redacción en español neutro sea correcta y clara antes de considerarse cerrado.

## Skipped Issues

Ninguno — los 3 hallazgos en scope (Critical + Warning) se resolvieron. Los 3 hallazgos Info (IN-01, IN-02, IN-03) quedaron fuera de scope por instrucción explícita y no se tocaron.

---

_Fixed: 2026-07-25T15:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
