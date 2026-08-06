---
phase: 28-performance-por-p-gina
plan: 02
subsystem: checks
tags: [vitest, performance, guardrail, fingerprint, tdd]

# Dependency graph
requires:
  - phase: 28-performance-por-p-gina
    plan: 01
    provides: "`Page.htmlBytes` persistido, grupo `checks/perf/` con su barrel, `makePage` con las dos métricas enumeradas, y el checkId `PERF-11` reservado por decisión de Juan"
  - phase: 11-checks-catalog
    provides: "`PageCheck`/`IssueDraft`, `pageFingerprint`, `runAllChecks` y el patrón de guardarraíl integrado (`phase11-guardrail.test.ts`)"
provides:
  - "`PERF-11` (peso del documento HTML) implementado, testeado y registrado en las tres capas"
  - "`htmlSizeCheck` exportado desde `perfPageChecks` y por nombre"
  - "`checkIdCollision.test.ts`: guardarraíl permanente contra colisión de checkId entre `@auditor/checks` y `@auditor/psi`, resistente a drift (lee el fuente de PSI por `fs`)"
  - "`registry.test.ts`: guardarraíl permanente contra el check registrado a medias"
  - "`findCollisions(a, b)`: función pura de comparación de catálogos, local al test"
affects: [28-03-verificacion-manual, reporte-issues, scoring-perf]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guardarraíl cross-package por lectura de archivo fuente (`readFileSync` + `new URL(..., import.meta.url)`) en vez de import, para no crear arista de dependencia"
    - "Autoprueba del guardarraíl con datos sintéticos derivados del catálogo real, en lugar de mutar código de producción"
tech-stack-patterns:
  - "Test de contenido del registry como red contra el registro parcial de un check"

key-files:
  created:
    - packages/checks/src/checks/perf/htmlSize.ts
    - packages/checks/src/checks/perf/htmlSize.test.ts
    - packages/checks/src/checks/perf/checkIdCollision.test.ts
    - packages/checks/src/registry.test.ts
  modified:
    - packages/checks/src/checks/perf/index.ts

key-decisions:
  - "El guardarraíl de colisión extrae los checkIds de `packages/psi/src/issues.ts` con `readFileSync` sobre `new URL(\"../../../../psi/src/issues.ts\", import.meta.url)` y una regex sobre `checkId: \"...\"`, en vez de importar el paquete: importarlo agregaría `@auditor/psi` al grafo que `apps/web` resuelve, que es justo la frontera que `assert:web-boundary` protege."
  - "La capacidad de detección del guardarraíl se demuestra con datos sintéticos (`findCollisions(registryIds + psiIds[0], psiIds)`), nunca mutando `responseTime.ts` ni ningún archivo de `src`: una mutación temporal sin revertir persiste exactamente el defecto que el guardarraíl existe para impedir."
  - "La constante de URL del test de colisión se llama `TEST_URL` y no `URL`, porque una constante de módulo llamada `URL` tapa al constructor global y rompe la resolución del fuente de PSI."
  - "`measuredValue` de PERF-11 redondea (`Math.round(bytes / 1024)`) en vez de truncar, para que 100.5 KB no se lea como el umbral exacto."

patterns-established:
  - "Guardarraíl cross-package sin arista de dependencia: leer el fuente por `fs`, extraer con regex y fallar ruidosamente si la extracción sale vacía"
  - "Todo guardarraíl de ausencia (`esperar lista vacía`) lleva un caso gemelo que prueba que sí detecta, con datos sintéticos dentro del mismo `vitest run`"

requirements-completed: [PAGEPERF-02, PAGEPERF-03]

coverage:
  - id: D1
    description: "`PERF-11` emite las severidades correctas en los seis escalones (null, 0, 102400, 102401, 307200, 307201) con comparación estrictamente mayor"
    requirement: "PAGEPERF-03"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/perf/htmlSize.test.ts#htmlSizeCheck (PERF-11)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`measuredValue` expresa KB redondeados con `Math.round`, no truncados"
    requirement: "PAGEPERF-02"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/perf/htmlSize.test.ts#rounds the KB value instead of truncating it"
        status: pass
    human_judgment: false
  - id: D3
    description: "El `criterion` declara que la medición es del HTML sin comprimir (mitigación T-28-08)"
    requirement: "PAGEPERF-02"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/perf/htmlSize.test.ts#emits the catalog-standard issue shape"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ningún checkId de `pageChecks` colisiona con el catálogo real de `packages/psi`, y la unión de fingerprints sobre una misma URL no tiene duplicados"
    requirement: "PAGEPERF-03"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/perf/checkIdCollision.test.ts (4 casos, incluida la autoprueba de detección)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Los dos checks nuevos están en `pageChecks` y `runAllChecks` devuelve una fila crítica de cada uno sobre una página que dispara ambos; con métricas en `null` no devuelve ninguna"
    requirement: "PAGEPERF-03"
    verification:
      - kind: integration
        ref: "packages/checks/src/registry.test.ts (4 casos)"
        status: pass
    human_judgment: false
  - id: D6
    description: "`packages/checks` sigue sin dependencia sobre `@auditor/psi` y Playwright sigue fuera del bundle de `apps/web`"
    verification:
      - kind: integration
        ref: "pnpm assert:web-boundary → PASS; `@auditor/psi` ausente de dependencies y devDependencies de packages/checks"
        status: pass
    human_judgment: false
  - id: D7
    description: "Los umbrales de 100/300 KB producen una distribución de severidades razonable sobre webs reales de Juan"
    verification: []
    human_judgment: true
    rationale: "FA-1 sigue abierto: los umbrales lockeados marcan 10/10 sitios medidos y 5/10 como crítico. El plan 28-03 imprime la distribución real para recalibrar."

# Metrics
duration: 5min
completed: 2026-08-01
status: complete
---

# Phase 28 Plan 02: Tamaño de HTML (PERF-11) y guardarraíles del catálogo Summary

**`PERF-11` con umbrales 100/300 KB sobre HTML sin comprimir, más dos guardarraíles permanentes que convierten en suite roja la colisión de checkId con `packages/psi` y el check registrado a medias**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-01T15:11:15Z
- **Completed:** 2026-08-01T15:16:20Z
- **Tasks:** 2 (la 1 en ciclo TDD: RED + GREEN)
- **Files modified:** 5 (4 creados, 1 modificado)

## Accomplishments

- `htmlSizeCheck` (`PERF-11`) es el gemelo estructural de `responseTimeCheck`: mismo guard `== null`, misma ternaria de severidad, mismo orden de campos del `IssueDraft`, misma fila `ok` explícita. Lo único distinto es la métrica, las constantes y el copy.
- Umbrales como constantes de módulo escritas como producto (`WARN_BYTES = 100 * 1024`, `CRITICAL_BYTES = 300 * 1024`), con comparación estrictamente mayor: 102400 y 307200 caen en el escalón inferior.
- El `criterion` aclara que la medición es del documento **sin comprimir** y que el navegador muestra el tamaño transferido, que suele ser varias veces menor (mitigación de T-28-08, sobre una brecha medida de 3.6x a 7.4x).
- El guardarraíl de colisión lee `packages/psi/src/issues.ts` por `fs`, así que un checkId que PSI agregue en el futuro entra en la comparación sin tocar el test, y `packages/checks` no gana ninguna arista de dependencia.
- El guardarraíl demuestra su propia capacidad de detección dentro de la misma corrida de `vitest`, con un checkId real de PSI inyectado en una colección sintética. Cero ediciones a código de producción.
- `registry.test.ts` cubre el hueco que nadie cubría: presencia de los dos checkIds, unicidad de checkIds en `pageChecks`, ejecución real vía `runAllChecks` y el guard de dato ausente dentro del pipeline (no en aislamiento).
- Suite de `@auditor/checks`: de 25 archivos / 130 tests a 28 / 150. `pnpm typecheck` (16 tareas), `pnpm test` (13 tareas) y `pnpm assert:web-boundary` en verde.

## Task Commits

1. **Task 1 (RED): test de tamaño de HTML** — `cfe7017` (test)
2. **Task 1 (GREEN): `PERF-11` + barrel** — `5fa0c4e` (feat)
3. **Task 2: guardarraíles de colisión y de registry** — `31a2640` (test)

**Plan metadata:** ver commit `docs(28-02)` posterior.

## Files Created/Modified

- `packages/checks/src/checks/perf/htmlSize.ts` — check `PERF-11`, constantes `WARN_BYTES`/`CRITICAL_BYTES`, guard `page.htmlBytes == null`, `measuredValue` en KB redondeados.
- `packages/checks/src/checks/perf/htmlSize.test.ts` — 12 casos: los seis escalones de severidad, los dos de redondeo, forma estándar del `IssueDraft`, `finalUrl` sobre `url`, títulos distintos entre ramas, e integración vía `runAllChecks`.
- `packages/checks/src/checks/perf/checkIdCollision.test.ts` — 4 casos: extracción no vacía del catálogo de PSI, cero colisiones reales, unicidad de la unión de fingerprints sobre una misma URL, y autoprueba de detección.
- `packages/checks/src/registry.test.ts` — 4 casos: presencia de `PERF-10`/`PERF-11`, unicidad de checkIds, ejecución de punta a punta, y ausencia de filas con métricas en `null`.
- `packages/checks/src/checks/perf/index.ts` — `htmlSizeCheck` sumado al array `perfPageChecks` y al re-export nombrado.

## Decisions Made

- **Lectura por `fs`, nunca import.** Añadir `@auditor/psi` como dependencia de `packages/checks` metería el paquete en el grafo que `apps/web` resuelve, que es exactamente la frontera que `scripts/assert-no-playwright-in-web.mjs` protege. La ruta se resuelve con `new URL("../../../../psi/src/issues.ts", import.meta.url)` y la extracción usa una regex sobre `checkId: "..."`, que captura tanto los de `METRIC_SPECS`/`DIAGNOSTIC_SPECS` como los inline (`PERF-02-INP`).
- **Autoprueba con datos sintéticos, no con mutación de producción.** `findCollisions` quedó extraída como función pura exportada dentro del test para poder alimentarla con `[...registryIds, psiIds[0]]`. Mutar `responseTime.ts` para "ver fallar el test" habría sido peor: una edición temporal sin revertir persiste el defecto que este guardarraíl existe para impedir, y sin constraint único en `Issue.fingerprint` nada la detectaría.
- **`Math.round` sobre `bytes / 1024`.** El reporte declara sus umbrales en KB; truncar haría que 100.5 KB se lea como el límite exacto y confunda la lectura del umbral.
- **Fila `ok` explícita** (FA-5), siguiendo `contentLengthCheck` tal como CONTEXT.md manda. Suma ~500 filas `Issue` más por auditoría de 500 páginas.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Constante `URL` de módulo tapaba al constructor global**

- **Found during:** Task 2, primera corrida de `checkIdCollision.test.ts`.
- **Issue:** el test replicaba el patrón de `responseTime.test.ts`, que define `const URL = "https://example.com/page"` a nivel de módulo. En ese archivo es inocuo, pero acá el mismo nombre tapa al constructor global `URL` que necesita `new URL(..., import.meta.url)` para resolver la ruta del fuente de PSI: `TypeError: URL is not a constructor`, suite entera caída antes de correr un solo caso.
- **Fix:** la constante pasó a llamarse `TEST_URL`, con un comentario que explica por qué no puede llamarse `URL` en este archivo (para que un refactor futuro que "unifique nombres con los otros tests" no reintroduzca la falla).
- **Files modified:** `packages/checks/src/checks/perf/checkIdCollision.test.ts` (archivo declarado en `<files>` de la tarea; ningún archivo fuera del alcance).
- **Verification:** `pnpm --filter @auditor/checks exec vitest run src/checks/perf/checkIdCollision.test.ts src/registry.test.ts` sale en 0.
- **Committed in:** `31a2640` (commit de la tarea 2).

---

**Total deviations:** 1 auto-fix (Rule 3 - blocking). Cero desviaciones de alcance, cero dependencias nuevas, cero archivos tocados fuera de los declarados.

## Issues Encountered

- Divergencia menor con un criterio de aceptación literal: `grep -c 'readFileSync' packages/checks/src/checks/perf/checkIdCollision.test.ts` devuelve 2 (import + uso), no 1. El criterio pedía "al menos 1", así que se cumple.
- El resto de los greps de aceptación dan exactamente lo pedido: `CHECK_ID = "PERF-11"` → 1, `WARN_BYTES = 100 * 1024` → 1, `CRITICAL_BYTES = 300 * 1024` → 1, `page.htmlBytes == null` → 1, `Math.round` → 1, `htmlSizeCheck` en el barrel → 3, `export function findCollisions` → 1, `import.meta.url` → 1.

## Flagged Assumptions vigentes

- **FA-1** — los umbrales lockeados (100/300 KB) marcan 10/10 de los sitios reales medidos y 5/10 como crítico, incluido juan-tech.com. Se implementaron tal cual; el plan 28-03 imprime la distribución real para que Juan recalibre.
- **FA-4** — la brecha entre HTML sin comprimir y bytes transferidos (mediana ~5x) queda mitigada sólo con copy, no resuelta. Si el reporte llega a mostrar los dos números juntos, hay que revisitarlo.
- **FA-5** — el check emite fila `severity: "ok"` cuando la página pasa; con los dos checks de la fase el volumen de `Issue` sube ~14% sobre una auditoría de 500 páginas (T-28-09, disposición `accept`).

## Known Stubs

Ninguno.

## User Setup Required

Ninguno en este plan. **Sigue pendiente para el plan 28-03:** `pnpm db:push` contra la base configurada para materializar `Page.responseMs` y `Page.htmlBytes`; este plan corrió estrictamente offline.

## Next Phase Readiness

- Listo para el plan 28-03: los dos checks están implementados, registrados y cubiertos; lo único que falta para verificar contra datos reales es el `pnpm db:push` que ese plan tiene como checkpoint.
- Sin bloqueos. `pnpm typecheck` (16/16), `pnpm test` (13/13) y `pnpm assert:web-boundary` en verde.

## Self-Check: PASSED

Los 4 archivos declarados como creados y el modificado existen en disco; los 3 commits de tarea (`cfe7017`, `5fa0c4e`, `31a2640`) existen en el historial de git.

---
*Phase: 28-performance-por-p-gina*
*Completed: 2026-08-01*
