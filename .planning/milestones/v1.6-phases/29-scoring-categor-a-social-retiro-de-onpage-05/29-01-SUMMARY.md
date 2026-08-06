---
phase: 29-scoring-categor-a-social-retiro-de-onpage-05
plan: 01
subsystem: scoring
tags: [typescript, vitest, turborepo, scoring, report-model, export]

# Dependency graph
requires:
  - phase: 28-performance-por-pagina
    provides: catálogo de checks y modelo de scoring de cinco categorías sobre el que se rebalancea
provides:
  - "union `Category` con seis miembros (`social` al final, orden cronológico)"
  - "`CATEGORY_WEIGHTS` rebalanceado: tech .30, perf .30, onpage .10, schema .05, aeo .15, social .10"
  - "nota de corte de versión v1.6 en el docblock de `CATEGORY_WEIGHTS` (scores pre/post no comparables)"
  - "`CATEGORY_ORDER` de `report-model` exportado e incluyendo `social` (cierra el descarte silencioso de issues)"
  - "`CATEGORY_LABEL` con `Meta Tags / Social` verbatim en `packages/export` y en `apps/web`"
  - "test end-to-end que prueba que un issue `category: \"social\"` llega vivo a `model.issuesByCategory.social`"
  - "asserts de los seis pesos individuales y de la renormalización sin datos de `social`"
affects: [30-checks-meta-tags-social, 31-validacion-og-image, 32-panel-preview-social, 29-02, 29-03, 29-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "assert de objeto completo con `toEqual` para fijar valores Y conjunto exacto de claves de un `Record<Category, T>`"
    - "prueba de dientes por mutación cuando el orden de tareas hace imposible un rojo inicial genuino"

key-files:
  created: []
  modified:
    - packages/scoring/src/overallScore.ts
    - packages/scoring/src/overallScore.test.ts
    - packages/report-model/src/build.ts
    - packages/report-model/src/build.test.ts
    - packages/export/src/labels.ts
    - apps/web/app/components/ui/labels.ts
    - apps/web/tests/pages/api/audits/[id]/export.test.ts

key-decisions:
  - "Phase 29: `social` entra al final del union y del objeto de pesos (orden cronológico de introducción, no alfabético), consistente con el patrón que ya usaba `CATEGORY_WEIGHTS`"
  - "Phase 29: el rebalanceo se anota con el ID del requisito en comentario de línea junto a cada clave que cambia (`// .15 → .10 (SCORE-02)`), siguiendo el patrón del repo"
  - "Phase 29: el guardarraíl de suma (`toBeCloseTo(1.0, 5)`) no se duplica ni se endurece a igualdad estricta; el hueco que dejaba (onpage/schema invertidos suman 1 igual) se cierra con un assert de objeto completo, no con un segundo test de suma"
  - "Phase 29: `CATEGORY_ORDER` se exporta desde `build.ts` pero NO se agrega a `packages/report-model/src/index.ts` — la API pública del paquete no se amplía en esta fase"
  - "Phase 29: la etiqueta de la categoría es `Meta Tags / Social`, idéntica carácter por carácter en `packages/export/src/labels.ts` y `apps/web/app/components/ui/labels.ts` (gemelos verbatim por diseño)"

patterns-established:
  - "Fan-out de categoría como unidad atómica: ampliar el union `Category` y cerrar en la misma pasada los arrays/mapas que el compilador NO protege (`CATEGORY_ORDER` de `build.ts` descarta issues en silencio)"
  - "Prueba de dientes por mutación: cuando la tarea que escribe el test corre después de la que fija la constante, el rojo se produce invirtiendo temporalmente el fuente y verificando QUÉ caso falla"

requirements-completed: [SCORE-01, SCORE-02]

coverage:
  - id: D1
    description: "El union `Category` reconoce `social` como sexta categoría y `CATEGORY_WEIGHTS` la pondera"
    requirement: SCORE-01
    verification:
      - kind: unit
        ref: "packages/scoring/src/overallScore.test.ts#CATEGORY_WEIGHTS > pins the exact weight of each of the six categories"
        status: pass
      - kind: other
        ref: "pnpm typecheck --continue --force (16 successful, 0 cached)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rebalanceo explícito onpage .15→.10, schema .10→.05, social .10, con la suma de pesos intacta en 1.0"
    requirement: SCORE-02
    verification:
      - kind: unit
        ref: "packages/scoring/src/overallScore.test.ts#CATEGORY_WEIGHTS > sums to 1.0"
        status: pass
      - kind: unit
        ref: "packages/scoring/src/overallScore.test.ts#CATEGORY_WEIGHTS > pins the exact weight of each of the six categories"
        status: pass
    human_judgment: false
  - id: D3
    description: "Nota de corte de versión v1.6 en el docblock de `CATEGORY_WEIGHTS`: los scores generales previos a v1.6 no son comparables con los posteriores"
    requirement: SCORE-02
    verification: []
    human_judgment: true
    rationale: "Es redacción de documentación en código; su suficiencia para un lector futuro es juicio editorial, no verificable por test."
  - id: D4
    description: "Un issue persistido con `category: \"social\"` sobrevive hasta `model.issuesByCategory.social` en vez de descartarse en el seeding de buckets"
    requirement: SCORE-01
    verification:
      - kind: unit
        ref: "packages/report-model/src/build.test.ts#buildReportModel > conserva un issue de categoría social hasta issuesByCategory.social"
        status: pass
    human_judgment: false
  - id: D5
    description: "Renormalización correcta mientras `social` no tenga checks: queda fuera de `present`, `totalWeight` cae a 0.90 y el overall de cinco categorías no cambia"
    requirement: SCORE-02
    verification:
      - kind: unit
        ref: "packages/scoring/src/overallScore.test.ts#scoreOverall > renormalizes weights when social has no data"
        status: pass
    human_judgment: false
  - id: D6
    description: "Etiqueta `Meta Tags / Social` disponible y verbatim idéntica en los serializadores de export y en la UI web"
    requirement: SCORE-01
    verification:
      - kind: other
        ref: "grep -c 'Meta Tags / Social' en packages/export/src/labels.ts y apps/web/app/components/ui/labels.ts (1 y 1, cadenas idénticas)"
        status: pass
      - kind: unit
        ref: "pnpm --filter @auditor/export test (26 passed) + pnpm --filter @auditor/web test (71 passed)"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-08-01
status: complete
---

# Phase 29 Plan 01: Scoring — categoría Social Summary

**Sexta categoría `social` con peso .10 en el modelo de scoring, rebalanceando onpage a .10 y schema a .05, más el fan-out completo cerrado hasta el punto donde `buildReportModel` descartaba en silencio los issues de categorías no listadas**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-01T19:00:22Z
- **Completed:** 2026-08-01T19:09:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `Category` pasa a seis miembros con `social` al final, y `CATEGORY_WEIGHTS` queda en tech .30 / perf .30 / onpage .10 / schema .05 / aeo .15 / social .10, con el ID del requisito anotado en las tres claves que cambian.
- El docblock de `CATEGORY_WEIGHTS` documenta el corte de versión v1.6: un delta de score general que cruce esa frontera refleja el cambio de modelo, no un cambio del sitio auditado.
- `CATEGORY_ORDER` de `packages/report-model/src/build.ts` pasa a `export const` e incluye `social`, cerrando el descarte silencioso de la línea 247 (`if (bucket)`), que es el defecto más grave que este plan atacaba: sin él, los issues `SOCIAL-01..08` de Phase 30 habrían desaparecido del acordeón y del PPTX sin ningún error ni test rojo.
- Los tres sitios que el cambio de tipo rompía en compilación quedaron cerrados: `packages/export/src/labels.ts`, `apps/web/app/components/ui/labels.ts` y el `emptyByCat` del test de export de la web.
- Un test real prueba el camino end-to-end: un issue `category: "social"` entra por el mock de Prisma y sale vivo en `model.issuesByCategory.social` con su `checkId` intacto.
- Los seis pesos quedan fijados por un assert de objeto completo, cerrando el hueco que RESEARCH.md marcó como Wave 0 (con onpage y schema invertidos, el test de suma seguía en verde).

## Task Commits

Cada tarea se commiteó atómicamente:

1. **Tarea 1 (tracer): la categoría social de punta a punta** - `d3080a5` (feat)
2. **Tarea 2: endurecer los tests de peso y renormalización** - `4d319be` (test)

## Files Created/Modified

- `packages/scoring/src/overallScore.ts` - union `Category` de seis miembros, `CATEGORY_WEIGHTS` rebalanceado, docblocks actualizados (cinco→seis categorías, cuatro→cinco issue-derived) y nota de corte de versión v1.6. Bloque de renormalización y firma de `scoreOverall` sin tocar.
- `packages/scoring/src/overallScore.test.ts` - assert de los seis pesos con `toEqual`, test de renormalización sin datos de `social`, comentario que justifica el epsilon del guardarraíl de suma, nombres de `it` actualizados.
- `packages/report-model/src/build.ts` - `CATEGORY_ORDER` exportado e incluyendo `social`.
- `packages/report-model/src/build.test.ts` - test end-to-end del issue de categoría social con docblock que explica qué defecto silencioso convierte en suite roja.
- `packages/export/src/labels.ts` - `social` en `CATEGORY_ORDER` y `Meta Tags / Social` en `CATEGORY_LABEL`.
- `apps/web/app/components/ui/labels.ts` - `Meta Tags / Social` en `CATEGORY_LABEL`, verbatim idéntica a la de export.
- `apps/web/tests/pages/api/audits/[id]/export.test.ts` - `social: []` en `emptyByCat` (cierra TS2741).

## Decisions Made

- El guardarraíl de suma existente se dejó intacto y se documentó su epsilon en vez de endurecerlo: la suma en punto flotante de 0.3+0.3+0.1+0.05+0.15+0.1 no da exactamente 1, así que `=== 1` fallaría. El hueco real (valores invertidos que igual suman 1) se cierra con el assert de objeto completo, no con un segundo test de suma.
- `toEqual` sobre el objeto entero en vez de asserts por clave más un conteo de cardinalidad: una sola aserción fija los seis valores Y el conjunto exacto de claves (una clave de más o de menos falla).
- El nombre del `it` de la línea 30 pasó a "computes a weighted average across every scored category" en vez de "across all 6 categories": el test pasa cinco categorías (no hay datos de `social`), así que afirmar seis habría sido tan inexacto como afirmar cinco.

## Verificación de la prueba de dientes (Tarea 2)

El orden de tareas hace imposible un rojo inicial genuino (la Tarea 1 ya había fijado las constantes cuando se escribió el test), así que el rojo se produjo por mutación. Resultados observados:

- **Con `onpage: 0.05` y `schema: 0.1` invertidos en el fuente:** `pnpm --filter @auditor/scoring test` salió con exit status 1. Falló **exactamente un** caso: `CATEGORY_WEIGHTS > pins the exact weight of each of the six categories`, con el diff `- onpage: 0.1 / + onpage: 0.05` y `- schema: 0.05 / + schema: 0.1`. El guardarraíl viejo `sums to 1.0` **siguió en verde**, confirmando empíricamente el hueco que RESEARCH.md identificó como Wave 0: los valores invertidos siguen sumando 1.
- **Con los valores restaurados:** 27 tests en 3 archivos, todos en verde, exit 0. `git diff packages/scoring/src/overallScore.ts` quedó vacío respecto del estado que dejó la Tarea 1 (verificado antes del commit de la Tarea 2; el commit de esa tarea toca un solo archivo, el de tests).

## Deviations from Plan

None - el plan se ejecutó exactamente como estaba escrito.

## Issues Encountered

- El plan preveía que `apps/web/tests/pages/api/audits/[id]/export.test.ts` era uno de los tres sitios que rompían compilación, pero no `packages/export/src/test-fixtures.ts`, que también tiene la lista de categorías hardcodeada. Se confirmó en el typecheck que ese archivo NO rompe porque usa un cast `as Record<Category, ReportIssue[]>` que TypeScript no verifica — es exactamente la omisión silenciosa S-4 que el plan 29-03 tiene asignada. No se tocó: fuera de alcance de este plan.
- Ninguna otra fricción. Cero paquetes instalados (`git diff --stat pnpm-lock.yaml` vacío), cero cambios de esquema.

## Verificación ejecutada

| Comando | Resultado |
|---------|-----------|
| `pnpm --filter @auditor/scoring test` | 27 passed (3 archivos) |
| `pnpm --filter @auditor/report-model test` | 49 passed (4 archivos), con el `it` nuevo visible en salida verbose |
| `pnpm --filter @auditor/export test` | 26 passed (5 archivos) |
| `pnpm --filter @auditor/web test` | 71 passed (9 archivos) |
| `pnpm typecheck --continue --force` | 16 successful, 16 total, 0 cached (sin `FULL TURBO`) |
| `git diff --stat pnpm-lock.yaml` | vacío |

## Threat Model — dispositions verificadas

- **T-29-01 (mitigate):** cerrado. `"social"` está en `CATEGORY_ORDER` de `build.ts` y el test end-to-end prueba que el issue sobrevive al seeding de buckets. El guardarraíl de exhaustividad que convierte cualquier omisión futura en suite roja sigue asignado al plan 29-03.
- **T-29-04 (accept):** verificado por lectura. El guard interno del `.map` de `packages/export/src/pdf.tsx:191-194` (`result ? ... : "sin datos"`) sigue intacto y ahora cubre también a `social`; agregar la categoría a `CATEGORY_ORDER` de export no rompe el render de una categoría sin datos. La prohibición del plan (no presentar un score de una categoría no medida como si lo hubiera sido) se mantiene: la nota "Sin datos: ... (se muestran como 0)" del PPTX cubre a `social` mientras no tenga checks.
- **T-29-SC (accept):** confirmado, cero instalaciones.

## User Setup Required

None - no hay configuración de servicios externos ni cambios de esquema (`Issue.category` es una columna `String`, no un enum; no corre `pnpm db:push`).

## Next Phase Readiness

- El modelo de scoring ya reconoce `social`, así que los planes 29-02 (retiro de ONPAGE-05) y 29-03 (guardarraíles de exhaustividad de `CATEGORY_ORDER` en los tres paquetes + mover la constante de `page.tsx`) pueden arrancar sin bloqueos.
- Phase 30 puede emitir checks `SOCIAL-01..08` sabiendo que sus issues llegan al reporte: el camino está probado por test antes de que los checks existan.
- Pendiente conocido, ya asignado: `packages/export/src/test-fixtures.ts` sigue con la lista de cinco categorías hardcodeada (cast `as` que el compilador no verifica) — lo cubre el plan 29-03.

## Self-Check: PASSED

Los 6 archivos modificados y el SUMMARY existen en disco; los 2 commits de tarea (`d3080a5`, `4d319be`) existen en el historial.

---
*Phase: 29-scoring-categor-a-social-retiro-de-onpage-05*
*Completed: 2026-08-01*
