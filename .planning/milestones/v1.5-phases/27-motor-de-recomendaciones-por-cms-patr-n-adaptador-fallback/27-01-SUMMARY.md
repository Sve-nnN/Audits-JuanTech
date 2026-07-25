---
phase: 27
plan: 01
subsystem: cms-adapters
tags: [copy, adapters, seo, fingerprint]
requires:
  - "@auditor/fingerprint (AxisResult type-only)"
provides:
  - "@auditor/cms-adapters (paquete puro: tipos + 4 adaptadores de copy)"
  - "CmsLabel, SUPPORTED_CHECK_IDS, CmsAdapter"
  - "wordpressAdapter, shopifyAdapter, webflowAdapter, wixSquarespaceAdapter"
affects:
  - "Plan 27-02 (registry + resolveCmsRecommendation consumen estos adaptadores)"
tech-stack:
  added: []
  patterns:
    - "Paquete puro mirror de packages/fingerprint (workspace TS consumido como fuente)"
    - "Catálogo Record<checkId,string> plano por adaptador, aislado del motor"
    - "Import type-only del boundary (@auditor/fingerprint), cero @auditor/checks"
key-files:
  created:
    - packages/cms-adapters/package.json
    - packages/cms-adapters/tsconfig.json
    - packages/cms-adapters/src/types.ts
    - packages/cms-adapters/src/wordpress.ts
    - packages/cms-adapters/src/shopify.ts
    - packages/cms-adapters/src/webflow.ts
    - packages/cms-adapters/src/wixSquarespace.ts
    - packages/cms-adapters/src/coverage.test.ts
  modified:
    - pnpm-lock.yaml
decisions:
  - "Firma lookup(checkId, label, builder): threadea CmsLabel para que Wix/Squarespace ramifiquen bajo el mismo adaptador (corrige los 2 args de RESEARCH)"
  - "index.ts / registry.ts / resolveCmsRecommendation.ts NO se crean en este plan: llegan en el Plan 02 (files_modified del plan solo lista los 8 archivos de la capa de datos)"
requirements: [CMSFIX-01, CMSFIX-03]
metrics:
  duration: ~5 min
  completed: 2026-07-25
status: complete
---

# Phase 27 Plan 01: Paquete @auditor/cms-adapters (capa de datos) Summary

Paquete puro `@auditor/cms-adapters` con el contrato `CmsAdapter` y los 5 catálogos de copy de fix por plataforma (50 entradas: 10 checkIds × 5 labels) más variantes por builder de WordPress para alt text y JSON-LD, garantizado por un test de cobertura en verde.

## Qué se construyó

- **`types.ts`** — `CmsLabel` (unión local de las 5 labels, no existe `CmsPlatform` en fingerprint), `SUPPORTED_CHECK_IDS` (tuple `as const` de los 10 checkIds), e interfaz `CmsAdapter` con `lookup(checkId, label, builder): string | null`. Importa `AxisResult` con `import type`.
- **`wordpress.ts`** — catálogo base a nivel plataforma para los 10 checkIds; para ONPAGE-04, SD-01 y SD-02 resuelve variantes por builder (Elementor/Divi/WPBakery/Gutenberg) solo cuando `builder.value` está en el set y `builder.confidence ∈ {alto, medio}`; en cualquier otro caso devuelve la copy con ramas. Divi y WPBakery comparten texto en SD-01/SD-02.
- **`shopify.ts` / `webflow.ts`** — catálogo plano de los 10 checkIds; `lookup` ignora `label` y `builder`.
- **`wixSquarespace.ts`** — dos catálogos internos (`wixCatalog`, `squarespaceCatalog`); `lookup` ramifica sobre `label` (`"Squarespace"` → squarespaceCatalog, si no → wixCatalog). Copy distinto por checkId entre ambas plataformas.
- **`coverage.test.ts`** — 10 tests: cobertura de las 50 entradas no vacías, variantes builder WP distintas de la rama (y ausencia de variante en checkId no granular), gate de confianza baja cae a la rama, Wix ≠ Squarespace en ONPAGE-01/ONPAGE-03, y `null` para checkId fuera del catálogo.

## Verificación (checks reales, no asumidos)

- `pnpm --filter @auditor/cms-adapters typecheck` → **PASA** (`tsc --noEmit`, sin errores).
- `pnpm --filter @auditor/cms-adapters test` → **PASA** (1 test file, **10 tests**, 163ms).
- `pnpm --filter @auditor/cms-adapters build` → **no aplica**: ningún paquete puro del monorepo define script `build` (mismo caso que `@auditor/fingerprint`, el mirror). El build del monorepo es `turbo run build` y los paquetes TS puros se consumen como fuente vía workspace. Como prueba de compilación a JS real se corrió `tsc` con emit a un dir temporal: **exit 0**, generó los 6 `.js` (`types`, `wordpress`, `shopify`, `webflow`, `wixSquarespace`, `coverage.test`).
- Boundary duro: `grep -rn "@auditor/checks" packages/cms-adapters/src` → **0 líneas**. Todos los imports de `@auditor/fingerprint` son `import type`. `CmsPlatform` no se usa (solo aparece en un comentario que documenta su ausencia).

## Deviations from Plan

### Auto-fixed / decisiones de diseño aplicadas

**1. [Rule 3 - Blocking] `build` no existe como script en el mirror**
- **Encontrado durante:** verificación final.
- **Situación:** el plan replica el shape de `packages/fingerprint/package.json`, que solo define `typecheck` y `test`. No hay script `build` por paquete en el monorepo (verificado: `pnpm --filter @auditor/fingerprint build` → "None of the selected packages has a build script"; `turbo.json` maneja `build` a nivel monorepo).
- **Resolución:** no se agregó un script `build` (habría desviado del mirror fiel exigido por el plan). Se validó la compilación con `tsc` emit temporal (exit 0). Sin cambios en el paquete.

**2. index.ts / registry.ts / resolveCmsRecommendation.ts diferidos al Plan 02**
- El plan 27-01 (`files_modified`) lista solo los 8 archivos de la capa de datos. `package.json` apunta `main`/`types` a `./src/index.ts` (aún inexistente), lo cual no afecta typecheck ni test (el test importa `./types` y los módulos directamente, sin barrel). El barrel, el `registry` y `resolveCmsRecommendation` se crean en el Plan 02, consistente con 27-PATTERNS.

## Supuestos de diseño registrados

- **Firma `lookup(checkId, label, builder)`** (design_resolution del plan): threadea `CmsLabel` para que Wix/Squarespace, mapeados al mismo adaptador, resuelvan copy distinta. Los adaptadores de label único ignoran `label` (parámetro nombrado `_label`).
- **Gate de builder** (Pitfall 5): variante específica solo con `builder.value ∈ {Elementor,Divi,WPBakery,Gutenberg}` y `builder.confidence ∈ {alto,medio}`; caso contrario → rama. Cubierto por test (confianza baja → rama).

## Verificación humana pendiente (ítems [REVISAR])

El copy se dejó con el mejor criterio del RESEARCH y cada ruta de menú frágil quedó marcada con comentario `[REVISAR]` en el código para que el verifier la enrute a revisión humana de fin de fase (rutas de admin son "moving targets"; ninguna se bloqueó). Referencia: 27-RESEARCH Assumptions Log A1–A6.

| checkId | Plataforma(s) | Duda | Ref |
|---------|---------------|------|-----|
| ONPAGE-03 | Shopify | Ubicación exacta del H1 depende del tema | A6 |
| ONPAGE-03 | Wix | Nombre exacto del control «Etiqueta SEO»/HTML tag en el panel de texto | A1 |
| ONPAGE-03 | Squarespace | En 7.1 el título de página no siempre es H1 | A2 |
| TECH-01 | Webflow | Nombre exacto de pestaña/campo robots.txt en el panel actual | A4 |
| TECH-01 | Wix | Ruta exacta del editor de robots.txt en el dashboard | A3 |
| TECH-01 | Squarespace | Texto/ubicación actual de la opción de ocultar de buscadores | A5 |
| TECH-02 | Webflow | Nombre exacto del toggle «Auto-generate sitemap» | A4 |

(7 rutas marcadas; A7 —Elementor Pro como vía de schema— ya está aceptada por CONTEXT con la aclaración "(versión Pro)", no requiere revisión.)

## Known Stubs

Ninguno. Los 5 catálogos están completos (50 entradas no vacías, garantizado por test). El copy es 100% estático/constante (sin interpolación de contenido del sitio auditado — sin nueva superficie XSS, T-27-01-01 mitigado por construcción).

## Self-Check: PASSED

- Archivos creados: los 8 archivos del plan existen (FOUND).
- Commit: `fbd229e` existe en el historial (FOUND).
- typecheck/test verdes verificados en vivo; boundary `@auditor/checks` = 0 líneas.
