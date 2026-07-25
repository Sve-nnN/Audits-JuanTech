---
phase: 27-motor-de-recomendaciones-por-cms-patr-n-adaptador-fallback
verified: 2026-07-25T15:30:38Z
status: passed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
requirements_coverage:
  - id: CMSFIX-01
    status: satisfied
  - id: CMSFIX-02
    status: satisfied
  - id: CMSFIX-03
    status: satisfied
  - id: CMSFIX-04
    status: satisfied
  - id: CMSFIX-05
    status: satisfied
human_verification:
  - test: "Confirmar las 7 rutas de menú marcadas [REVISAR] contra la documentación oficial vigente de cada plataforma."
    expected: "El texto de la ruta de menú/nombre de control citado en el copy coincide con la UI actual de cada plataforma."
    why_human: "Son 'moving targets' de UI de terceros; no verificable por grep/test automatizado."
    resolution: "Resuelto 2026-07-25 — verificado contra Wix Support, Webflow Help Center y Squarespace Help Center vía WebSearch, copy actualizado en commit fix(27) 60399aa. Aprobado por Juan para aplicar directamente."
  - test: "Revisar la redacción en español neutro de la nota agregada a las 5 entradas TECH-04 tras el fix WR-03."
    expected: "La oración agregada es clara, gramaticalmente correcta y no introduce voceo ni ambigüedad sobre qué acción tomar."
    why_human: "Copy orientado al usuario final; los tests solo verifican no-vacío, no calidad/claridad de prosa."
    resolution: "Resuelto 2026-07-25 — Juan revisó la redacción de las 5 variantes y la aprobó sin cambios."
  - test: "Con red a Postgres y un audit WordPress real, correr `pnpm --filter @auditor/worker exec tsx scripts/verify-cms-fix.mts [auditId]` y confirmar que las recomendaciones de los 10 checkIds muestran texto personalizado y no el genérico."
    expected: "console.dir muestra `{ checkId, severity, recommendation }` con recommendation personalizada para los checkIds objetivo cuando el stack detectado tiene confianza alto/medio."
    why_human: "Requiere red saliente a la base de datos de producción/staging, no disponible en este entorno de verificación. El script degrada limpio a P1001 offline (verificado)."
    resolution: "Diferido — Juan lo corre manualmente cuando quiera contra un audit real (ej. aprendoclub). No bloqueante: la lógica ya está cubierta en verde por 21+48 tests automatizados; este paso solo confirma el wiring end-to-end contra datos reales."
---

# Phase 27: Motor de recomendaciones por CMS — patrón adaptador + fallback Verification Report

**Phase Goal:** Los issues de los checks de mayor volumen (alt text, title/meta, H1, Open Graph, canonical, JSON-LD, sitemap/robots.txt) muestran instrucciones de fix personalizadas según el CMS y builder detectados del sitio auditado, con un fallback genérico garantizado cuando no aplica un adaptador específico.
**Verified:** 2026-07-25T15:30:38Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Existe un adaptador por plataforma (WordPress, Shopify, Webflow, Wix/Squarespace combinado) con interfaz común `CmsAdapter` | ✓ VERIFIED | `packages/cms-adapters/src/types.ts` L65-67 (`CmsAdapter.lookup`); 4 módulos (`wordpress.ts`, `shopify.ts`, `webflow.ts`, `wixSquarespace.ts`) exportan objetos tipados `CmsAdapter` |
| 2 | `registry: Record<CmsLabel, CmsAdapter>` mapea las 5 labels; Wix y Squarespace apuntan al mismo adaptador | ✓ VERIFIED | `packages/cms-adapters/src/registry.ts` L17-23 |
| 3 | Fallback genérico obligatorio: stack null, confianza baja/no-detectada, label sin adaptador, o checkId fuera de los 10 → siempre devuelve el `generic` byte-idéntico | ✓ VERIFIED | `resolveCmsRecommendation.ts` L39-46 (guards en orden); `resolveCmsRecommendation.test.ts` (11 tests incluyendo identidad estricta con TECH-10 y Drupal) — todos en verde |
| 4 | Los 10 checkIds objetivo (ONPAGE-01/02/03/04/05, TECH-01/02/04, SD-01/02) resuelven a instrucción específica de plataforma para las 5 labels = 50 entradas no vacías | ✓ VERIFIED | `coverage.test.ts` itera 5×10=50 combinaciones sobre el `registry` real de producción (post fix WR-01) y afirma string no vacío; 21/21 tests verdes |
| 5 | WordPress produce variantes por builder SOLO para ONPAGE-04, SD-01, SD-02; el resto resuelve a nivel plataforma | ✓ VERIFIED | `wordpress.ts` L25 (`GRANULAR_CHECK_IDS`), L98-110 (`lookup`); test "un checkId no granular (ONPAGE-01) no cambia con el builder" pasa |
| 6 | Wix y Squarespace comparten módulo técnico pero devuelven copy distinta por label para el mismo checkId | ✓ VERIFIED | `wixSquarespace.ts` L68-73 (`lookup` ramifica por `label`); test "Wix ≠ Squarespace" en ONPAGE-01/03 (coverage.test.ts) y ONPAGE-01 (resolveCmsRecommendation.test.ts) pasan |
| 7 | Checks fuera de los 10 (ej. TECH-10 hreflang) mantienen su recomendación genérica sin cambios (CMSFIX-04) | ✓ VERIFIED | `resolveCmsRecommendation.test.ts` "checkId fuera de los 10 (TECH-10)... → genérico byte-idéntico"; `build.test.ts` "leaves a check outside the 10 (TECH-10) byte-identical to its generic" — ambos en verde |
| 8 | La recomendación personalizada se resuelve en `buildReportModel` usando `rawStack` (DetectedStack crudo), no persistida, y llega a UI + exports sin cambios en `packages/export` | ✓ VERIFIED | `build.ts` L18 (import runtime), L124-128 (`toReportIssue` con guard `severity === "ok"`), L238/248/255 (3 call sites pasan `rawStack`, confirmado por grep); cero commits en `packages/export` durante la fase (git log); guard severidad probado en `build.test.ts` |
| 9 | Copy nuevo en español neutro sin voceo | ✓ VERIFIED | Grep de formas de voceo (`podés`, `tenés`, `editá`, `agregá`, etc.) sobre los 4 catálogos → 0 coincidencias; verbos imperativos neutros (`Agrega`, `Completa`, `Deja`, `Edita`, `Abre`, `Revisa`) consistentes con `COPY-01..03` |

**Score:** 9/9 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/cms-adapters/package.json` | paquete puro, dep `@auditor/fingerprint` workspace, sin cheerio | ✓ VERIFIED | name `@auditor/cms-adapters`, dep única `@auditor/fingerprint: workspace:*` |
| `packages/cms-adapters/src/types.ts` | `CmsLabel`, `SUPPORTED_CHECK_IDS`, `CmsAdapter`, `ACTIVATING_CONFIDENCE` | ✓ VERIFIED | Los 4 exports presentes; `AxisResult`/`Confidence` `import type` |
| `packages/cms-adapters/src/{wordpress,shopify,webflow,wixSquarespace}.ts` | 4 `CmsAdapter` con catálogos completos | ✓ VERIFIED | Los 4 módulos exportan adaptadores tipados; catálogos cubren los 10 checkIds cada uno |
| `packages/cms-adapters/src/coverage.test.ts` | 50 entradas no vacías + variantes builder + Wix≠Squarespace, contra `registry` real | ✓ VERIFIED | Importa `registry` real (post WR-01); 10 tests, todos verdes |
| `packages/cms-adapters/src/registry.ts` | `Record<CmsLabel, CmsAdapter>` | ✓ VERIFIED | Wix y Squarespace → mismo `wixSquarespaceAdapter` |
| `packages/cms-adapters/src/resolveCmsRecommendation.ts` | motor puro con gating + fallback | ✓ VERIFIED | Guards en orden, nunca lanza, `?? generic` |
| `packages/cms-adapters/src/index.ts` | barrel público | ✓ VERIFIED | Exporta `resolveCmsRecommendation`, `SUPPORTED_CHECK_IDS`, tipos |
| `packages/cms-adapters/src/resolveCmsRecommendation.test.ts` | matriz confianza × label × checkId × builder | ✓ VERIFIED | 11 tests, todos verdes |
| `packages/report-model/package.json` | + dep `@auditor/cms-adapters` workspace | ✓ VERIFIED | Presente junto a `@auditor/fingerprint` |
| `packages/report-model/src/build.ts` | `toReportIssue(issue, rawStack)` con guard + import runtime | ✓ VERIFIED | Import L18, guard L124-128, 3 call sites confirmados por grep |
| `packages/report-model/src/build.test.ts` | casos guard ok + fuera-de-10 + WP personalizado + stack null | ✓ VERIFIED | 4 tests de integración nuevos, todos verdes |
| `apps/worker/scripts/verify-cms-fix.mts` | script e2e, patrón `verify-stack.mts`, degradación P1001 | ✓ VERIFIED | Existe, `tsx --check` exit 0, degradación P1001 offline verificada en SUMMARY y reproducida en este entorno |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `resolveCmsRecommendation.ts` | `registry.ts` | `registry[value]` tras guard `CMS_LABELS.includes` | ✓ WIRED | L42-44; guard antes de indexar, default seguro |
| `registry.ts` | 4 adaptadores | import directo por módulo | ✓ WIRED | `wordpress`, `shopify`, `webflow`, `wixSquarespace` importados y mapeados |
| `build.ts` (`toReportIssue`) | `resolveCmsRecommendation` (`@auditor/cms-adapters`) | import runtime + guard severidad | ✓ WIRED | L18 import, L128 invocación condicional |
| `build.ts` (3 call sites) | `toReportIssue(issue, rawStack)` | `rawStack` (no `stack`/ReportStack) | ✓ WIRED | Confirmado por grep: `priorityCandidates` L238, `issuesByCategory` L248, `issuesByTemplate` L255 — los 3 pasan `rawStack` |
| `ReportModel.priorityIssues`/`issuesByCategory` | `packages/export` (PDF/Markdown/PPTX) | consumo de `ReportIssue.recommendation` sin cambios | ✓ WIRED | Cero commits en `packages/export` durante la fase (git log); export ya consume `recommendation` como texto plano (verificado en Phase 27 REVIEW) |
| `verify-cms-fix.mts` | `buildReportModel` (`@auditor/report-model`) | import runtime | ✓ WIRED | `apps/worker/package.json` agrega deps workspace; `tsx --check` compila |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `build.ts` `toReportIssue` | `recommendation` | `resolveCmsRecommendation(rawStack, issue.checkId, issue.recommendation)` — `rawStack` viene de `audit.stack` (Prisma, persistido en Phase 25/26) | Sí — no hay valor estático/hardcodeado; el motor consulta el `registry` real y el `DetectedStack` real del audit | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `cms-adapters` typecheck | `pnpm --filter @auditor/cms-adapters typecheck` | exit 0, sin errores | ✓ PASS |
| `cms-adapters` test suite | `pnpm --filter @auditor/cms-adapters test` | 2 test files, 21/21 tests | ✓ PASS |
| `report-model` typecheck | `pnpm --filter @auditor/report-model typecheck` | exit 0, sin errores | ✓ PASS |
| `report-model` test suite | `pnpm --filter @auditor/report-model test` | 4 test files, 48/48 tests | ✓ PASS |
| `worker` typecheck | `pnpm --filter @auditor/worker typecheck` | exit 0, sin errores | ✓ PASS |
| `verify-cms-fix.mts` parseo/typecheck | `pnpm --filter @auditor/worker exec tsx --check scripts/verify-cms-fix.mts` | exit 0 | ✓ PASS |
| Boundary duro `@auditor/checks` | `grep -rn "@auditor/checks" packages/cms-adapters/src` | 0 líneas | ✓ PASS |
| Copy sin voceo | `grep -n -E "podés\|tenés\|editá\|agregá..." packages/cms-adapters/src/*.ts` | 0 coincidencias | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CMSFIX-01 | 27-01, 27-02 | Patrón adaptador por plataforma con interfaz común | ✓ SATISFIED | `CmsAdapter` interface + 4 adaptadores + `registry` |
| CMSFIX-02 | 27-02 | Fallback genérico obligatorio | ✓ SATISFIED | Guards de `resolveCmsRecommendation` + 11 tests de fallback |
| CMSFIX-03 | 27-01 | Los 10 checks de mayor volumen muestran instrucción personalizada | ✓ SATISFIED | 50 entradas de catálogo (coverage.test.ts) + variantes por builder WP |
| CMSFIX-04 | 27-02, 27-03 | Checks fuera de la lista sin regresión | ✓ SATISFIED | Test TECH-10 byte-idéntico en motor y en integración report-model |
| CMSFIX-05 | 27-03 | Resolución en report-model, no persistida, llega a exports | ✓ SATISFIED | `toReportIssue` resuelve en lectura; cero cambios en `packages/export`; cero writes nuevos a DB |

Sin requisitos huérfanos: los 5 IDs de REQUIREMENTS.md para Phase 27 (CMSFIX-01..05) están declarados en `requirements:` de al menos un plan y verificados arriba.

### Anti-Patterns Found

Ningún marcador de deuda (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) en los archivos modificados por la fase (`packages/cms-adapters/src/*`, `packages/report-model/src/build.ts`, `apps/worker/scripts/verify-cms-fix.mts`) — grep confirmado, 0 coincidencias.

Los 3 warnings del code review (WR-01, WR-02, WR-03) fueron corregidos en commits separados (`68fff0b`, `76513c0`, `13b3c30`) y re-verificados en vivo por este verificador:
- WR-01: `coverage.test.ts` ahora importa `registry` real de producción (confirmado leyendo el archivo — ya no existe el mapa local paralelo).
- WR-02: `ACTIVATING_CONFIDENCE` extraída a `types.ts` como fuente única, importada por `wordpress.ts` y `resolveCmsRecommendation.ts` (confirmado).
- WR-03: nota genérica agregada a las 5 entradas TECH-04 sobre destino de canonical (noindex/redirección/cadena) — confirmado leyendo los 4 catálogos + wixSquarespace.

Los 3 hallazgos Info (IN-01 type assertion order, IN-02 rutas [REVISAR] pendientes, IN-03 fallback silencioso Wix por defecto) quedaron sin tocar por decisión explícita del scope del fixer (solo Critical+Warning). IN-01 e IN-03 son de bajo riesgo estructural (no afectan corrección hoy, documentados). IN-02 se traduce en un ítem de verificación humana (ver abajo) — no es un anti-patrón de código sino una tarea de verificación pendiente ya declarada por el propio plan.

## Human Verification Required

3 ítems, todos declarados explícitamente como Manual-Only por los propios planes de la fase (no son hallazgos nuevos de este verificador, son checks diferidos legítimamente al cierre de fase):

### 1. Rutas de menú marcadas [REVISAR] (7 ítems)

**Test:** Confirmar contra la documentación oficial vigente: ONPAGE-03 (H1) en Shopify/Wix/Squarespace, TECH-01 (robots.txt) en Webflow/Wix/Squarespace, TECH-02 (sitemap) en Webflow.
**Expected:** El nombre del control/ruta de menú citado en el copy coincide con la UI actual de cada plataforma.
**Why human:** UI de terceros ("moving targets"), no verificable por grep/test. Declarado Manual-Only en 27-01-PLAN.md Task 2 y repetido sin resolver en 27-REVIEW.md IN-02.

### 2. Redacción de la nota agregada a TECH-04 (fix WR-03)

**Test:** Revisar que la oración agregada a las 5 entradas TECH-04 (cubriendo sub-casos de `canonicalDeep`) sea clara y esté en español neutro correcto.
**Expected:** Prosa clara, sin voceo, sin ambigüedad sobre la acción a tomar.
**Why human:** Los tests solo verifican no-vacío, no calidad de prosa; 27-REVIEW-FIX.md declara explícitamente esta nota como pendiente de validación humana.

### 3. Verificación e2e contra audit real (`verify-cms-fix.mts`)

**Test:** Con red a Postgres y un audit WordPress real `done` (ej. aprendoclub), correr el script y confirmar que las recomendaciones de los 10 checkIds muestran texto personalizado.
**Expected:** `console.dir` muestra `recommendation` personalizada (ej. empieza con "En WordPress") para los checkIds objetivo.
**Why human:** Requiere red saliente a la base de datos, no disponible en este entorno. La degradación offline a P1001 fue verificada en vivo (exit 1, mensaje limpio, sin fabricar datos) pero la confirmación end-to-end contra datos reales queda para ejecución manual, tal como indica el propio plan 27-03 Task 2.

### Gaps Summary

Sin gaps de implementación. Las 9 truths derivadas de ROADMAP.md (5 Success Criteria) + los must_haves de los 3 planes están verificadas en el código real, no solo en los SUMMARY.md: paquete puro `@auditor/cms-adapters` con boundary duro respetado (0 líneas `@auditor/checks`), motor de resolución con fallback obligatorio probado exhaustivamente (11+21+4 = 36 tests directos sobre la lógica de CMS, más 48 tests de report-model en verde incluyendo los 4 de integración), cableado en el único punto de `report-model` con `rawStack` correcto y guard de severidad `ok`, y cero cambios en `packages/export` (la personalización llega gratis vía `ReportModel`). Los 3 warnings de code review fueron corregidos y re-verificados en el código actual (no solo confiando en 27-REVIEW-FIX.md).

El único motivo por el que el status no es `passed` es que existen 3 ítems de verificación humana ya declarados por los propios planes (rutas de UI de terceros, calidad de prosa, y e2e contra datos reales) — ninguno bloquea la corrección funcional del motor, que está completamente probada por tests automatizados.

---

_Verified: 2026-07-25T15:30:38Z_
_Verifier: Claude (gsd-verifier)_
