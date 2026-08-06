---
phase: 29-scoring-categor-a-social-retiro-de-onpage-05
plan: 03
subsystem: scoring
tags: [typescript, vitest, guardarrail, report-model, export, nextjs, refactor]

# Dependency graph
requires:
  - phase: 29-scoring-categor-a-social-retiro-de-onpage-05
    provides: "union `Category` de seis miembros y `CATEGORY_WEIGHTS` rebalanceado (29-01), única fuente de verdad exhaustiva en runtime"
provides:
  - "test de exhaustividad de `CATEGORY_ORDER` en `packages/report-model` (el sitio que descarta issues en silencio)"
  - "test de exhaustividad de `CATEGORY_ORDER`, `CATEGORY_LABEL` y `CATS` en `packages/export`"
  - "test de exhaustividad de `CATEGORY_ORDER` y `CATEGORY_LABEL` en `apps/web`, más paridad de copy con el mapa de export"
  - "fixtures de `packages/export` que ejercitan las seis categorías (markdown, PDF y PPTX dejan de dar falso verde sobre social)"
  - "`CATEGORY_ORDER` de la web exportado desde `apps/web/app/components/ui/labels.ts` en vez de declarado en un archivo de página"
affects: [30-checks-meta-tags-social, 31-validacion-og-image, 32-panel-preview-social]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "guardarraíl de exhaustividad en runtime contra `Object.keys(CATEGORY_WEIGHTS)`: el único `Record<Category, T>` del repo sirve de fuente de verdad, sin declarar una lista paralela de categorías"
    - "prueba de dientes por mutación en los tres paquetes: quitar la última entrada del array debe poner la suite en rojo antes de dar el guardarraíl por bueno"

key-files:
  created:
    - packages/export/src/labels.test.ts
    - apps/web/app/components/ui/labels.test.ts
  modified:
    - packages/report-model/src/build.test.ts
    - packages/export/src/test-fixtures.ts
    - packages/export/src/markdown.test.ts
    - apps/web/app/components/ui/labels.ts
    - apps/web/app/audits/[id]/page.tsx

key-decisions:
  - "Phase 29: la fuente de verdad en runtime de los tres tests es `Object.keys(CATEGORY_WEIGHTS)`, nunca una constante `ALL_CATEGORIES` paralela con la lista literal — una lista paralela sería un cuarto sitio capaz de desincronizarse"
  - "Phase 29: `CATS` de `packages/export/src/test-fixtures.ts` pasa de privado a exportado para que el test de exhaustividad pueda leerlo; es un módulo de fixtures, no código de producción, así que no amplía la API del paquete"
  - "Phase 29: el tercer caso del test de la web fija el literal `Meta Tags / Social` a mano en vez de importarlo de `@auditor/export` — la web no depende de ese paquete y la duplicación de copy es deliberada, así que el guardarraíl protege la paridad sin crear la dependencia"
  - "Phase 29: `CATEGORY_ORDER` de la web se reubica a `labels.ts` (junto a su par natural `CATEGORY_LABEL`, replicando el módulo gemelo de export) en vez de exportarse desde `page.tsx`: un archivo de página de App Router no debe exportar símbolos sueltos y además ningún test puede importarlo"

patterns-established:
  - "Un array `Category[]` sin test de exhaustividad es un descarte silencioso esperando a pasar: TypeScript no protege arrays ni casts `as`, así que cada sitio que declara un orden de categorías necesita su propio guardarraíl en runtime"
  - "Fixtures incompletas producen falso verde: un serializador testeado contra cinco de seis categorías pasa en verde sin haber visto nunca la sexta"

requirements-completed: [SCORE-01]

coverage:
  - id: D1
    description: "El `CATEGORY_ORDER` de `packages/report-model` (el que siembra los buckets y descarta con `if (bucket)`) cubre todas las categorías del modelo de scoring"
    requirement: SCORE-01
    verification:
      - kind: unit
        ref: "packages/report-model/src/build.test.ts#CATEGORY_ORDER > cubre todas las categorías de CATEGORY_WEIGHTS"
        status: pass
      - kind: other
        ref: "prueba de dientes: quitar `social` del array puso la suite en rojo con exactamente 2 casos fallando (2 failed | 48 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`CATEGORY_ORDER`, `CATEGORY_LABEL` y las fixtures de `packages/export` cubren todas las categorías del modelo de scoring"
    requirement: SCORE-01
    verification:
      - kind: unit
        ref: "packages/export/src/labels.test.ts#CATEGORY_ORDER / CATEGORY_LABEL — exhaustividad de categorías (4 casos)"
        status: pass
      - kind: other
        ref: "prueba de dientes: quitar `social` de `packages/export/src/labels.ts` puso la suite en rojo (3 failed | 27 passed, exit 1); restaurado con `git diff` vacío y 30 passed"
        status: pass
    human_judgment: false
  - id: D3
    description: "`CATEGORY_ORDER` y `CATEGORY_LABEL` de `apps/web` cubren todas las categorías, y la etiqueta de la categoría social es verbatim la misma que la del paquete de export"
    requirement: SCORE-01
    verification:
      - kind: unit
        ref: "apps/web/app/components/ui/labels.test.ts (3 casos, visibles por nombre en la corrida verbose)"
        status: pass
      - kind: other
        ref: "prueba de dientes: quitar `social` del array puso la suite en rojo (1 failed | 2 passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Las fixtures de `packages/export` ejercitan la categoría social, así que markdown, PDF y PPTX dejan de dar falso verde sobre una categoría que nunca veían"
    requirement: SCORE-01
    verification:
      - kind: unit
        ref: "packages/export/src/markdown.test.ts#toMarkdown > includes domain, overall score and per-category scores (assert `toContain('Meta Tags / Social')`)"
        status: pass
      - kind: other
        ref: "el assert de markdown fue uno de los 3 casos que la prueba de dientes puso en rojo, o sea que la fixture llega de verdad al serializador"
        status: pass
    human_judgment: false
  - id: D5
    description: "`apps/web` deja de declarar `CATEGORY_ORDER` dentro de un archivo de página de App Router y `page.tsx` no exporta ningún símbolo nuevo"
    requirement: SCORE-01
    verification:
      - kind: other
        ref: "`grep -Ec '^const CATEGORY_ORDER' page.tsx` = 0; `grep -c 'CATEGORY_ORDER' page.tsx` = 3 (import + 2 consumos); `grep -Ec '^export ' page.tsx` = 2"
        status: pass
      - kind: other
        ref: "pnpm --filter @auditor/web typecheck exit 0; pnpm --filter @auditor/web test 74 passed"
        status: pass
    human_judgment: false
  - id: D6
    description: "Cero cambios de comportamiento en el render del reporte y de los tres exports"
    requirement: SCORE-01
    verification:
      - kind: other
        ref: "`pnpm test` completo: 13 tareas exitosas; `pnpm typecheck --continue`: 16 exitosas. La suite de export pasó de 26 a 30 tests sin ningún caso previo cambiando de resultado."
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-01
status: complete
---

# Phase 29 Plan 03: Guardarrailes de exhaustividad de categorías Summary

**Los tres arrays `Category[]` que TypeScript no protege quedan cubiertos por un test en runtime contra `Object.keys(CATEGORY_WEIGHTS)`, las fixtures de export dejan de dar falso verde sobre la categoría social, y `CATEGORY_ORDER` de la web se muda del archivo de página a su módulo de presentación para poder testearse**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-01T23:15:16Z
- **Completed:** 2026-08-01T23:20:00Z
- **Tasks:** 2
- **Files created:** 2 / **modified:** 5

## Accomplishments

- Los tres paquetes que declaran un orden de categorías (`packages/report-model`, `packages/export`, `apps/web`) tienen ahora un test que compara su array contra `Object.keys(CATEGORY_WEIGHTS)`. Esa es la única protección posible: TypeScript exige exhaustividad en un `Record<Category, T>` pero no en un array `Category[]` ni en un literal casteado con `as`, así que hasta este commit una categoría nueva podía quedar fuera sin romper compilación y sin poner rojo ningún test.
- El sitio crítico queda cerrado con dientes: `CATEGORY_ORDER` de `build.ts` siembra los buckets de `issuesByCategory` y el `if (bucket)` descarta sin error todo issue de categoría no listada. La prueba de dientes confirmó que quitar una entrada pone la suite en rojo.
- Las fixtures de `packages/export` pasaron de cinco a seis categorías. Antes de este commit, los tests de markdown, PDF y PPTX pasaban en verde sin haber visto nunca la categoría social — falso verde sobre una categoría que ya existía en el modelo desde 29-01.
- `CATEGORY_ORDER` de la web salió de `apps/web/app/audits/[id]/page.tsx` y vive exportado en `apps/web/app/components/ui/labels.ts`, junto a su par natural `CATEGORY_LABEL` y replicando la estructura del módulo gemelo de `packages/export`. La página lo importa; sus dos sitios de consumo (tarjetas de score y secciones de detalle) no cambiaron.
- Un tercer caso del test de la web fija la paridad de copy: la etiqueta `Meta Tags / Social` de la UI y la de export son gemelas verbatim por diseño (la web no depende del paquete de export), así que un cambio unilateral en cualquiera de los dos lados ahora pone la suite en rojo.

## Task Commits

Cada tarea se commiteó atómicamente:

1. **Tarea 1: exhaustividad en `packages/report-model` y `packages/export`** - `8abe48a` (test)
2. **Tarea 2: `CATEGORY_ORDER` de la web al módulo de presentación + test** - `18fa631` (refactor)

## Files Created/Modified

- `packages/export/src/labels.test.ts` - **nuevo**. Cuatro casos: `CATEGORY_ORDER`, las claves de `CATEGORY_LABEL` y el `CATS` de las fixtures contra `Object.keys(CATEGORY_WEIGHTS)`, más un cuarto que compara los tres en un solo `toEqual` para que un fallo señale de inmediato cuál se quedó atrás. Docblock que explica qué defecto silencioso convierte en suite roja y por qué no se declara una lista literal de categorías.
- `apps/web/app/components/ui/labels.test.ts` - **nuevo**. Tres casos: exhaustividad de `CATEGORY_ORDER`, exhaustividad de `CATEGORY_LABEL` y paridad verbatim del copy de la categoría social con el mapa de export.
- `packages/report-model/src/build.test.ts` - `describe("CATEGORY_ORDER")` propio con el caso de exhaustividad, colocado antes del `describe("buildReportModel")`; `CATEGORY_ORDER` agregado al import existente de `./build` y `CATEGORY_WEIGHTS` + el tipo `Category` importados de `@auditor/scoring`.
- `packages/export/src/test-fixtures.ts` - `CATS` pasa a exportado e incluye `"social"`; el literal `issuesByCategory` suma la clave `social` con array vacío tipado. El cast `as Record<Category, ReportIssue[]>` se deja intacto (alcance aparte, T-29-07 con disposición `accept`).
- `packages/export/src/markdown.test.ts` - comentario de cardinalidad actualizado (cinco → seis categorías) y assert `toContain("Meta Tags / Social")` agregado.
- `apps/web/app/components/ui/labels.ts` - `export const CATEGORY_ORDER` con las seis categorías, colocado inmediatamente antes de `CATEGORY_LABEL` con un comentario de una línea que referencia SCORE-01.
- `apps/web/app/audits/[id]/page.tsx` - declaración local de `CATEGORY_ORDER` eliminada y el nombre agregado al import que ya traía `CATEGORY_LABEL`, `STATUS_LABEL`, `STRATEGY_LABEL` y `TEMPLATE_LABEL`. El import de tipo `Category` se conserva: sigue usándose en la línea 245.

## Decisions Made

- El cuarto caso de `packages/export/src/labels.test.ts` es redundante por diseño con los tres anteriores. Existe porque un `toEqual` de objeto imprime en el diff cuál de los tres arrays (orden, etiquetas, fixtures) se desincronizó, mientras que tres asserts sueltos sólo dicen que el primero falló y cortan.
- La prohibición del plan (no resolver la exhaustividad con una constante `ALL_CATEGORIES` paralela que duplique la lista de categorías) se respetó. El único `ALL_CATEGORIES` que existe en el repo es una variable local de `packages/export/src/labels.test.ts` cuyo valor es literalmente `(Object.keys(CATEGORY_WEIGHTS) as Category[]).sort()` — deriva de la fuente de verdad, no la duplica.
- La prueba de dientes se corrió en los tres paquetes, no sólo en el que los criterios de aceptación exigían. Un guardarraíl que nunca se vio en rojo es una afirmación, no una prueba.

## Verificación de la prueba de dientes

Los tres arrays se mutaron quitando la última entrada (`"social"`), se corrió la suite del paquete, se restauró el archivo y se volvió a correr:

| Paquete | Con la entrada quitada | Restaurado |
|---------|------------------------|------------|
| `packages/export` (`src/labels.ts`) | exit 1 — 3 failed \| 27 passed: los dos casos de exhaustividad de `labels.test.ts` que miran `CATEGORY_ORDER`, más el assert de markdown | `git diff --stat` vacío, 30 passed |
| `packages/report-model` (`src/build.ts`) | 2 failed \| 48 passed: el caso nuevo de exhaustividad **y** el test end-to-end del issue social que dejó 29-01 (confirma que el descarte silencioso es real y que el guardarraíl nuevo lo detecta antes) | `git diff --stat` vacío, 50 passed |
| `apps/web` (`app/components/ui/labels.ts`) | 1 failed \| 2 passed: el caso de exhaustividad de `CATEGORY_ORDER` (el de `CATEGORY_LABEL` sigue verde, que es exactamente el punto — el `Record` sí está protegido por el compilador, el array no) | 3 passed |

El resultado de la web es el más ilustrativo: con la categoría quitada del array, el test de `CATEGORY_LABEL` siguió en verde y sólo cayó el del array. Esa asimetría es la razón de existir de todo este plan.

## Deviations from Plan

None - el plan se ejecutó exactamente como estaba escrito.

## Issues Encountered

- Ninguna fricción. Cero paquetes instalados, cero cambios de esquema, cero endpoints nuevos.
- `apps/web/app/audits/[id]/page.tsx` conserva su `import type { Category, ... }` después de sacar la constante: `Category` sigue usándose en el cast de la línea 245 (`CATEGORY_LABEL[issue.category as Category]`). Verificado antes de editar para no dejar un import muerto.

## Verificación ejecutada

| Comando | Resultado |
|---------|-----------|
| `pnpm --filter @auditor/export test` | 30 passed (6 archivos), exit 0 — eran 26 en 5 archivos |
| `pnpm --filter @auditor/report-model test` | 50 passed (4 archivos), exit 0 — eran 49 |
| `pnpm --filter @auditor/web test` | 74 passed (10 archivos), exit 0 — eran 71 en 9 |
| `pnpm --filter @auditor/web exec vitest run app/components/ui/labels.test.ts --reporter=verbose` | los 3 `it` visibles por nombre en verde |
| `pnpm --filter @auditor/export typecheck` | exit 0 |
| `pnpm --filter @auditor/web typecheck` | exit 0 |
| `pnpm typecheck --continue` (repo completo) | 16 successful, 16 total |
| `pnpm test` (repo completo) | 13 successful, 13 total |
| `grep -c 'Object.keys(CATEGORY_WEIGHTS)' packages/export/src/labels.test.ts` | 5 (criterio: ≥ 3) |
| `grep -c 'Object.keys(CATEGORY_WEIGHTS)' packages/report-model/src/build.test.ts` | 2 (criterio: ≥ 1) |
| `grep -c 'Object.keys(CATEGORY_WEIGHTS)' apps/web/app/components/ui/labels.test.ts` | 3 (criterio: ≥ 2) |
| `grep -Ec '\["tech", *"perf"' packages/export/src/labels.test.ts` y en `build.test.ts` | 0 y 0 (ningún test declara la lista literal) |
| `grep -c 'social' packages/export/src/test-fixtures.ts` | 2 (criterio: ≥ 2) |
| `grep -c 'Meta Tags / Social' packages/export/src/markdown.test.ts` | 1 (criterio: ≥ 1) |
| `grep -Ec '^export const CATEGORY_ORDER' apps/web/app/components/ui/labels.ts` | 1, con las seis categorías terminando en `"social"` |
| `grep -Ec '^const CATEGORY_ORDER' 'apps/web/app/audits/[id]/page.tsx'` | 0 |
| `grep -c 'CATEGORY_ORDER' 'apps/web/app/audits/[id]/page.tsx'` | 3 (import + 2 consumos) |
| `grep -Ec '^export ' 'apps/web/app/audits/[id]/page.tsx'` | 2 (`export const dynamic`, `export default async function`) |
| `git diff --diff-filter=D` sobre los dos commits | vacío en ambos (cero borrados) |

## Threat Model — dispositions verificadas

- **T-29-01 (mitigate):** cerrado. Los cuatro sitios que RESEARCH.md identificó quedan cubiertos: S-1 (`report-model/build.ts`) y S-2 (`export/labels.ts`) ya corregidos por 29-01 y ahora con test; S-3 (`apps/web`) corregido y con test en este plan; S-4 (`export/test-fixtures.ts`) completado y cubierto por el tercer caso de `labels.test.ts`. La prueba de dientes se corrió en los tres paquetes.
- **T-29-07 (accept):** sin cambios. No se agregó ningún cast `as` nuevo. Los dos existentes (`test-fixtures.ts:68-75` y `build.ts:245`) siguen ahí, ahora con la categoría completa y cubiertos indirectamente por los tests de exhaustividad. Refactorizarlos a construcción exhaustiva sigue fuera de alcance.
- **T-29-SC (accept):** confirmado, cero instalaciones de paquetes.

## Prohibición del plan — verificada

`MUST NOT resolver la exhaustividad duplicando la lista de categorías en una constante paralela`: **respetada**. Ningún archivo nuevo declara un literal de categorías. Verificado con `grep -Ec '\["tech", *"perf"'` = 0 en los tres archivos de test. La única variable con nombre de lista completa (`ALL_CATEGORIES` en `packages/export/src/labels.test.ts`) es una derivación en runtime de `Object.keys(CATEGORY_WEIGHTS)`, no una lista escrita a mano.

## User Setup Required

None - no hay configuración de servicios externos ni cambios de esquema; no corre `pnpm db:push`.

## Next Phase Readiness

- Phase 30 puede agregar los checks `SOCIAL-01..08` sabiendo que sus issues llegan al reporte web y a los tres exports, y que cualquier categoría futura que se omita en un array va a poner una suite en rojo en vez de desaparecer en silencio.
- El plan 29-04 (si existe en la fase) y las fases 31/32 heredan un `CATEGORY_ORDER` importable y testeado en `apps/web`, así que agregar tarjetas de score o secciones de detalle no vuelve a requerir tocar el archivo de página.
- Deuda conocida que este plan NO cierra (T-29-07, disposición `accept`): los dos casts `as Record<Category, T>` de `test-fixtures.ts` y `build.ts` siguen mintiendo sobre exhaustividad al compilador. Los tests nuevos los cubren, pero la construcción exhaustiva real queda pendiente para quien quiera tomarla.

## Self-Check: PASSED

- Los 7 archivos existen en disco: `packages/export/src/labels.test.ts`, `apps/web/app/components/ui/labels.test.ts`, `packages/report-model/src/build.test.ts`, `packages/export/src/test-fixtures.ts`, `packages/export/src/markdown.test.ts`, `apps/web/app/components/ui/labels.ts`, `apps/web/app/audits/[id]/page.tsx`.
- Los dos commits de tarea existen en el historial: `8abe48a`, `18fa631`.

---
*Phase: 29-scoring-categor-a-social-retiro-de-onpage-05*
*Completed: 2026-08-01*
