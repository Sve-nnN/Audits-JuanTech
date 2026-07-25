---
phase: 27-motor-de-recomendaciones-por-cms-patr-n-adaptador-fallback
reviewed: 2026-07-25T15:15:51Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - packages/cms-adapters/package.json
  - packages/cms-adapters/tsconfig.json
  - packages/cms-adapters/src/types.ts
  - packages/cms-adapters/src/wordpress.ts
  - packages/cms-adapters/src/shopify.ts
  - packages/cms-adapters/src/webflow.ts
  - packages/cms-adapters/src/wixSquarespace.ts
  - packages/cms-adapters/src/coverage.test.ts
  - packages/cms-adapters/src/registry.ts
  - packages/cms-adapters/src/resolveCmsRecommendation.ts
  - packages/cms-adapters/src/index.ts
  - packages/cms-adapters/src/resolveCmsRecommendation.test.ts
  - packages/report-model/package.json
  - packages/report-model/src/build.ts
  - packages/report-model/src/build.test.ts
  - apps/worker/scripts/verify-cms-fix.mts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-07-25T15:15:51Z
**Depth:** standard
**Files Reviewed:** 16 (12 source files + `build.test.ts` extension counted; 4 files listed in the prompt as "no modificado" for plan 27-03 header table are included above per `files_modified` of each plan)
**Status:** issues_found

## Summary

Revisé los 3 planes de la Fase 27 (`@auditor/cms-adapters` capa de datos, motor de resolución + registry, e integración en `report-model`). Verifiqué en vivo — no asumido — que:

- `pnpm --filter @auditor/cms-adapters typecheck` y `test` (21/21) pasan.
- `pnpm --filter @auditor/report-model typecheck` y `test` (48/48) pasan.
- `grep -rn "@auditor/checks" packages/cms-adapters/src` devuelve 0 líneas: el boundary duro de STATE.md (`cms-adapters`/`fingerprint` desacoplados de `db`/`crawler`/`checks` en runtime) se respeta; el único punto de contacto es el string `checkId`.
- El import de `DetectedStack`/`AxisResult` en `cms-adapters` es `import type` (nunca runtime de `@auditor/fingerprint`).
- `resolveCmsRecommendation` recibe `rawStack` (no `stack`/`ReportStack`) en los 3 call sites de `toReportIssue` en `build.ts` (confirmado por grep, no solo por el SUMMARY).
- El guard de severidad `ok` corta antes del motor; los checks fuera de los 10 (`TECH-10`) devuelven el genérico byte-idéntico.
- Los strings de `cms.value` que emite `@auditor/fingerprint/signatures/cms.ts` ("WordPress", "Shopify", "Webflow", "Wix", "Squarespace") coinciden exactamente con `CmsLabel`; los valores de `builder` ("Elementor", "WPBakery", "Divi", "Gutenberg") coinciden exactamente con `BUILDER_VARIANTS`/`builderCatalog` de `wordpress.ts`.
- No hay `dangerouslySetInnerHTML` en el camino de renderizado de `recommendation` (`apps/web/app/audits/[id]/pages/[pageId]/page.tsx` usa JSX de texto plano, auto-escapado) — el copy estático no introduce superficie XSS nueva, consistente con el threat model de los 3 planes.

La implementación cumple el objetivo funcional de la fase (CMSFIX-01..05) y las 4 verificaciones automatizadas declaradas en los planes pasan en vivo. No encontré bugs críticos ni vulnerabilidades. Encontré 3 warnings de mantenibilidad/riesgo de drift y 3 notas info, detalladas abajo.

## Warnings

### WR-01: `coverage.test.ts` no valida el `registry` real de producción — riesgo de drift silencioso

**File:** `packages/cms-adapters/src/coverage.test.ts:11-21`
**Issue:** El test de cobertura de 50 entradas (la garantía central de CMSFIX-03) construye su propio mapa local `adapters: Record<CmsLabel, CmsAdapter>` en lugar de importar el `registry` real de `packages/cms-adapters/src/registry.ts`. El comentario del archivo explica que esto fue intencional en el Plan 27-01 porque `registry.ts` "llega en el Plan 02" (no existía aún) — pero el Plan 27-02 sí creó `registry.ts` y el test no se actualizó para consumirlo. Hoy el mapa local coincide exactamente con `registry.ts` (verificado por inspección), pero si alguien introduce un error de wiring en `registry.ts` (p. ej. mapea `Wix` a `webflowAdapter` por error, o agrega una nueva `CmsLabel` sin adaptador), el test de cobertura de 50 entradas seguiría en verde porque nunca toca el objeto de producción — solo `resolveCmsRecommendation.test.ts` ejercita el `registry` real, y ese archivo cubre bastante menos superficie (no las 50 combinaciones, solo 2 checkIds vía Wix/Squarespace y WordPress).
**Fix:**
```ts
// packages/cms-adapters/src/coverage.test.ts
import { registry } from "./registry"; // en vez del mapa local `adapters`

describe("cobertura de catálogos cms-adapters", () => {
  it("las 50 combinaciones (5 labels × 10 checkIds) devuelven un string no vacío", () => {
    for (const label of CMS_LABELS) {
      const adapter = registry[label]; // ← consume el registry real de producción
      for (const checkId of SUPPORTED_CHECK_IDS) {
        const result = adapter.lookup(checkId, label, builderNone);
        expect(result?.trim().length ?? 0, `falta o está vacía ${label}/${checkId}`).toBeGreaterThan(0);
      }
    }
  });
});
```

### WR-02: Umbral de confianza `{alto, medio}` duplicado en dos módulos sin fuente única

**File:** `packages/cms-adapters/src/wordpress.ts:19` y `packages/cms-adapters/src/resolveCmsRecommendation.ts:10`
**Issue:** El mismo valor de negocio — "las confianzas `alto` y `medio` activan una variante específica" — está hardcodeado dos veces de forma independiente: `ACTIVATING_BUILDER` en `wordpress.ts` (gate del builder dentro del adaptador) y `ACTIVATING` en `resolveCmsRecommendation.ts` (gate del CMS en el motor). Son conceptualmente el mismo umbral (decisión lockeada de CONTEXT: "alto y medio"), pero al vivir en dos archivos sin importar de una fuente común, un cambio futuro de umbral (p. ej. si CONTEXT se revisita y decide que builder debería requerir solo `alto`) puede aplicarse en un lugar y olvidarse en el otro sin que ningún test lo detecte — el test de builder de `coverage.test.ts` solo prueba `Elementor+alto` y `Elementor+bajo`, no cubre un futuro desalineamiento entre los dos sets.
**Fix:** Extraer una constante compartida (p. ej. `ACTIVATING_CONFIDENCE = new Set<Confidence>(["alto", "medio"])`) en `types.ts` y que tanto `wordpress.ts` como `resolveCmsRecommendation.ts` la importen, en vez de redeclararla.

### WR-03: La copy personalizada de TECH-04 conflates sub-casos de `canonicalDeep` con acciones de fix incompatibles entre sí

**File:** `packages/cms-adapters/src/wordpress.ts:48-49` (y equivalentes en `shopify.ts:27-28`, `webflow.ts:28-29`, `wixSquarespace.ts` TECH-04 en ambos catálogos)
**Issue:** El checkId `TECH-04` es emitido tanto por `packages/checks/src/checks/tech/canonical.ts` (presencia/duplicado/vacío/auto-referencia — "dónde completar el campo canonical", que sí calza con la instrucción de plataforma) como por `packages/checks/src/checks/tech/canonicalDeep.ts` (8 sub-casos adicionales vía `SiteCheck`: `noindex-conflict`, `chain`, `cross-domain`, `redirect-target`, `http-error-target`, `final-url-mismatch`, `multiple-conflicting`, `relative`). El genérico de `canonicalDeep` para, por ejemplo, `noindex-conflict` es "Elige una sola señal: si la página debe indexarse quita el noindex; si no debe indexarse, quita la canonical" o para `chain` es "Apunta la canonical directamente a la URL final". La copy personalizada de WordPress que reemplaza a AMBOS ("En WordPress, con Yoast SEO o Rank Math el campo canonical está en la pestaña «Avanzado»...") no menciona en absoluto que el problema real no es la ausencia del campo sino un valor de canonical que apunta a un destino roto/con noindex/en cadena — el usuario que recibe esta recomendación personalizada para un issue de `chain` o `noindex-conflict` puede terminar simplemente "revisando dónde está el campo" sin entender que el fix real requiere cambiar el DESTINO, no solo ubicarlo. La decisión de CONTEXT que habilita el catálogo plano ("los sub-casos... comparten instrucción; el WHY/QUÉ específico ya lo muestran title/measuredValue/criterion") se justificó con un ejemplo de variantes de **grado** (title corto vs largo, misma acción de fix); los sub-casos de `canonicalDeep` son variantes de **tipo** de problema con acciones de fix distintas entre sí, un caso más amplio de lo que la justificación original cubrió explícitamente.
**Fix:** No es necesario reabrir la arquitectura del catálogo plano (decisión ya lockeada). Sugerencia acotada: para TECH-04 específicamente, considerar (a) agregar una nota breve y genérica en la copy de plataforma tipo "revisa también que el destino de la canonical sea una URL indexable, sin redirecciones ni conflictos con noindex" para cubrir el subconjunto de `canonicalDeep`, o (b) documentar explícitamente en el copy catalog (comentario) que esta limitación es conocida y aceptada, para que quede trazada como decisión consciente y no como omisión. Cualquiera de las dos cierra la brecha de trazabilidad sin tocar el motor.

## Info

### IN-01: Type assertion `value as CmsLabel` antes de la validación estructural en el motor

**File:** `packages/cms-adapters/src/resolveCmsRecommendation.ts:48-50`
**Issue:** `CMS_LABELS.includes(value as CmsLabel)` castea `value: string` a `CmsLabel` ANTES del chequeo `.includes`, en vez de usar una función type-guard (`(v): v is CmsLabel => ...`). Es funcionalmente seguro (la comparación de `.includes` es por igualdad de string en runtime, el cast no afecta el resultado), pero el orden invierte la intención habitual de un guard ("castear después de validar") y puede confundir a un futuro editor sobre si el chequeo realmente valida algo.
**Fix:** `function isCmsLabel(v: string): v is CmsLabel { return (CMS_LABELS as readonly string[]).includes(v); }` y usar `if (value == null || !isCmsLabel(value)) return generic;` sin cast previo.

### IN-02: 7 rutas de menú marcadas `[REVISAR]` siguen pendientes de verificación humana

**File:** `packages/cms-adapters/src/shopify.ts:16-17`, `webflow.ts:22,25`, `wixSquarespace.ts:19,26,44,51`
**Issue:** El propio Plan 27-01 declara estos 7 ítems (`ONPAGE-03` Shopify/Wix/Squarespace, `TECH-01` Webflow/Wix/Squarespace, `TECH-02` Webflow) como "Manual-Only" / verificación humana pendiente antes de cerrar la fase (per Assumptions Log A1-A6). No es un defecto de implementación — es una verificación explícitamente diferida por el propio plan — pero al momento de este review no encontré evidencia de que se haya resuelto (no hay commit ni nota posterior que la cierre). Queda como recordatorio de que la fase no debería darse por "verificada end-to-end" hasta que un humano confirme esas 7 rutas contra la documentación vigente de cada plataforma.
**Fix:** N/A — acción de seguimiento, no de código. Confirmar contra Shopify Help Center / Webflow Help Center / Wix Support / Squarespace Help Center antes del cierre final de fase, tal como indica el `human-check` del Plan 27-01 Task 2.

### IN-03: `wixSquarespaceAdapter.lookup` trata cualquier label que no sea `"Squarespace"` como Wix (fallback silencioso, no explícito)

**File:** `packages/cms-adapters/src/wixSquarespace.ts:65-67`
**Issue:** `const catalog = label === "Squarespace" ? squarespaceCatalog : wixCatalog;` — la rama `else` no verifica que `label === "Wix"`, simplemente asume Wix para cualquier otro valor. Hoy es inofensivo porque el `registry` solo invoca este adaptador con `"Wix"` o `"Squarespace"` (los únicos dos labels mapeados a él), pero es un fallback implícito, no un `switch` exhaustivo — si en el futuro se agregara una tercera label al mismo adaptador sin actualizar este branching, resolvería silenciosamente al catálogo de Wix sin ningún error ni test que lo detecte (se combina con WR-01: el test de cobertura tampoco pasa por el `registry` real).
**Fix:** `const catalog = label === "Wix" ? wixCatalog : label === "Squarespace" ? squarespaceCatalog : null;` con manejo explícito de `null` (o un `assertNever` si TypeScript permite acotar `label` a solo esos dos valores en este contexto), para que un label inesperado sea una falla visible en vez de una resolución silenciosa incorrecta.

---

_Reviewed: 2026-07-25T15:15:51Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
