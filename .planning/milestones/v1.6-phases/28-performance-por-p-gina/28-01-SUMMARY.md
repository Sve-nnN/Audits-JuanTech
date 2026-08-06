---
phase: 28-performance-por-p-gina
plan: 01
subsystem: crawler
tags: [prisma, postgres, crawlee, got, cheerio, vitest, performance]

# Dependency graph
requires:
  - phase: 25-fingerprinting
    provides: "`captureHeaders.ts` como analog de helper puro derivado de la respuesta del crawl, y el patrón de campo persistido en las dos ramas del `prisma.page.upsert`"
  - phase: 11-checks-catalog
    provides: "`PageCheck`/`IssueDraft`, `pageFingerprint`, `runAllChecks` y el guardarraíl de fingerprints únicos"
provides:
  - "`Page.responseMs` y `Page.htmlBytes` (Int? nullable) en el schema de Prisma"
  - "`extractPageMetrics(response, html)`: helper puro que deriva ambas métricas sin requests adicionales"
  - "Captura cableada en las ramas `create` y `update` del `prisma.page.upsert` del crawler"
  - "`PERF-10` (tiempo de respuesta) implementado, testeado y registrado en las tres capas del catálogo"
  - "`perfPageChecks` como grupo nuevo de checks bajo `packages/checks/src/checks/perf/`"
affects: [28-02-html-size, 28-03-verificacion-manual, reporte-issues, scoring-perf]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Helper puro de captura por página derivado de la respuesta ya en memoria (cero requests extra)"
    - "Grupo de checks `perf` con barrel propio y doble export"
tech-stack-patterns:
  - "Campo persistido en AMBAS ramas del upsert para evitar valores rancios en re-crawl"

key-files:
  created:
    - packages/crawler/src/pageMetrics.ts
    - packages/crawler/src/pageMetrics.test.ts
    - packages/checks/src/checks/perf/responseTime.ts
    - packages/checks/src/checks/perf/responseTime.test.ts
    - packages/checks/src/checks/perf/index.ts
  modified:
    - packages/db/prisma/schema.prisma
    - packages/crawler/src/crawl.ts
    - packages/checks/src/testUtils.ts
    - packages/checks/src/registry.ts
    - packages/checks/src/index.ts

key-decisions:
  - "checkIds `PERF-10` (tiempo de respuesta) y `PERF-11` (tamaño HTML) en lugar de los `PERF-07`/`PERF-08` lockeados en CONTEXT.md: esos dos ya están ocupados por diagnósticos de PSI y reusarlos colisionaría fingerprints (`checkId:url`) en el diff histórico, fallando en silencio. Decisión explícita de Juan."
  - "El parámetro `response` de `extractPageMetrics` se tipa laxo (`TimedResponse`) y el call site castea, porque el `PlainResponse` de Crawlee no declara `timings` aunque got-scraping sí lo adjunta en runtime."
  - "`responseMs` sale de `timings.phases.total` tal como está lockeado, con la salvedad documentada de que incluye la fase `wait` generada por nuestro propio `maxConcurrency`."
  - "`htmlBytes` se mide con `Buffer.byteLength` (bytes UTF-8) sobre HTML descomprimido, nunca con `html.length`."

patterns-established:
  - "Métricas por página: derivar en un helper puro aislado, para que recalibrar la fuente del dato sea un cambio de una línea"
  - "Guard de dato ausente en checks: `== null` y nunca falsy, para que `0` siga siendo una medición válida"
  - "Umbrales de severidad como constantes de módulo con comparación estrictamente mayor (el límite exacto cuenta como el escalón inferior)"

requirements-completed: [PAGEPERF-01, PAGEPERF-02, PAGEPERF-03]

coverage:
  - id: D1
    description: "`Page.responseMs` y `Page.htmlBytes` existen como columnas `Int?` nullable, sin `@default` ni backfill"
    requirement: "PAGEPERF-01"
    verification:
      - kind: unit
        ref: "pnpm db:generate && pnpm --filter @auditor/checks typecheck (el campo tipado existe en PageCheckCtx.page)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`extractPageMetrics` deriva `{ responseMs, htmlBytes }` de la respuesta ya cargada, devuelve `null` por campo ante cualquier ausencia de dato y nunca lanza"
    requirement: "PAGEPERF-01"
    verification:
      - kind: unit
        ref: "packages/crawler/src/pageMetrics.test.ts#extractPageMetrics (8 casos)"
        status: pass
    human_judgment: false
  - id: D3
    description: "`htmlBytes` cuenta bytes UTF-8 y no unidades UTF-16; HTML vacío vale 0 bytes, no null"
    requirement: "PAGEPERF-02"
    verification:
      - kind: unit
        ref: "packages/crawler/src/pageMetrics.test.ts#counts UTF-8 bytes, not UTF-16 code units"
        status: pass
      - kind: unit
        ref: "packages/crawler/src/pageMetrics.test.ts#treats an empty HTML body as 0 bytes"
        status: pass
    human_judgment: false
  - id: D4
    description: "`PERF-10` emite las severidades correctas en los seis escalones (null, 0, 600, 601, 1500, 1501) con comparación estrictamente mayor"
    requirement: "PAGEPERF-03"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/perf/responseTime.test.ts#responseTimeCheck (PERF-10)"
        status: pass
    human_judgment: false
  - id: D5
    description: "El check está registrado en las tres capas y `runAllChecks` lo ejecuta de punta a punta"
    requirement: "PAGEPERF-03"
    verification:
      - kind: integration
        ref: "packages/checks/src/checks/perf/responseTime.test.ts#produces exactly one critical PERF-10 issue for a slow page"
        status: pass
    human_judgment: false
  - id: D6
    description: "En una corrida real del crawler contra un sitio alcanzable, las filas `Page` persistidas traen `responseMs` y `htmlBytes` no nulos"
    verification: []
    human_judgment: true
    rationale: "Requiere `pnpm db:push` contra la base real y un crawl contra un sitio alcanzable; el plan 28-03 lo cubre con un script manual y un checkpoint. Este plan sólo verifica offline."

# Metrics
duration: 6min
completed: 2026-08-01
status: complete
---

# Phase 28 Plan 01: Slice vertical de tiempo de respuesta por página Summary

**`Page.responseMs`/`Page.htmlBytes` capturados dentro del request que el crawler ya hace, más el check `PERF-10` de umbral 600/1500 ms registrado de punta a punta en `runAllChecks`**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-01T15:00:23Z
- **Completed:** 2026-08-01T15:06:54Z
- **Tasks:** 3 (1 checkpoint resuelto por Juan + 2 ejecutadas)
- **Files modified:** 10 (5 creados, 5 modificados)

## Accomplishments

- `model Page` gana `responseMs Int?` y `htmlBytes Int?`, ambos documentados con unidad, semántica exacta y la nota de seguridad T-28-01 sobre el límite de 32 bits de `Int`.
- `extractPageMetrics` deriva las dos métricas del request que el crawler ya hizo: cero requests adicionales al sitio auditado, `null` por campo ante cualquier ausencia de dato y sin lanzar nunca.
- Las dos métricas se escriben en las ramas `create` **y** `update` del `prisma.page.upsert`, así que un re-crawl sobrescribe en vez de dejar valores rancios.
- `PERF-10` emite exactamente una fila por página (incluida la de severidad `ok`), con comparación estrictamente mayor en los dos umbrales, y su `criterion` aclara que la medición se hace desde nuestro rastreador y no es un tiempo de usuario real.
- El check quedó registrado en las tres capas (barrel del grupo, `pageChecks` del registry, barrel del paquete) y un test de integración vía `runAllChecks` lo prueba.
- Suites sin regresión: checks pasó de 24 archivos / 121 tests a 25 / 130; crawler de 4 / 33 a 5 / 41.

## Task Commits

1. **Task 1: Confirmar el esquema de checkId** — sin commit (checkpoint de decisión, resuelto por Juan antes de escribir código: opción `perf-10-11`)
2. **Task 2: Slice de punta a punta — responseMs desde el crawl hasta un issue PERF-10** — `415b9f9` (feat)
3. **Task 3: Tests unitarios del helper de captura (pageMetrics)** — `58beaad` (test)

**Plan metadata:** ver commit `docs(28-01)` posterior.

## Files Created/Modified

- `packages/db/prisma/schema.prisma` — `Page.responseMs` y `Page.htmlBytes` (`Int?`, sin `@default`, sin índice).
- `packages/crawler/src/pageMetrics.ts` — helper puro `extractPageMetrics` + interfaces `PageMetrics`/`TimedResponse`, con las reglas duras documentadas (fase `wait` incluida en `total`, HTML descomprimido, gap de tipos de Crawlee).
- `packages/crawler/src/pageMetrics.test.ts` — 8 casos: valor exacto, tres modos de ausencia de `responseMs`, `html` ausente, `html` vacío = 0 bytes, bytes UTF-8 > unidades UTF-16, y no-lanza ante entradas totalmente vacías.
- `packages/crawler/src/crawl.ts` — import del helper, derivación justo después de materializar `html`, y los dos campos en ambas ramas del upsert. `failedRequestHandler` intacto.
- `packages/checks/src/testUtils.ts` — `makePage` enumera `responseMs` y `htmlBytes` (sin esto todo test de umbral devolvería `[]`).
- `packages/checks/src/checks/perf/responseTime.ts` — check `PERF-10`, umbrales `WARN_MS = 600` / `CRITICAL_MS = 1500` como constantes de módulo.
- `packages/checks/src/checks/perf/responseTime.test.ts` — 9 casos, incluidos los seis escalones de severidad y el de integración vía `runAllChecks`.
- `packages/checks/src/checks/perf/index.ts` — barrel nuevo con doble export (`perfPageChecks` + `responseTimeCheck`).
- `packages/checks/src/registry.ts` — import + spread de `perfPageChecks` en `pageChecks`.
- `packages/checks/src/index.ts` — `export * from "./checks/perf";`.

## Decisions Made

- **checkIds `PERF-10`/`PERF-11`, no `PERF-07`/`PERF-08`** (decisión explícita de Juan en el checkpoint de la tarea 1). `PERF-07` y `PERF-08` ya existen como diagnósticos de PSI (`packages/psi/src/issues.ts:247` y `:255`), y ambos paquetes construyen el fingerprint con el mismo formato `checkId:url`, así que reusarlos colapsaría filas distintas en `diffIssues` sobre las páginas de la muestra PSI, sin constraint único que lo detecte. Renombrar los IDs de PSI quedó descartado porque rompería el diff histórico de todas las auditorías ya persistidas.
- **`TimedResponse` como tipo laxo del parámetro + cast en el call site.** El `PlainResponse` de Crawlee (`Omit<HttpResponse, 'body'> & IncomingMessage`) no declara `timings`, aunque got-scraping sí lo adjunta en runtime. El cast replica el precedente que `crawl.ts` ya usa para `redirectUrls`.
- **Fuente del dato aislada a propósito.** `timings.phases.total` se implementó tal como está lockeado, pero la derivación vive en una sola línea del helper para que cambiar a `phases.firstByte` (o a `total - wait`) sea trivial si el plan 28-03 muestra que la fase `wait` genera falsos positivos.
- **`htmlBytes` se captura y persiste en este plan, pero su check (`PERF-11`) llega en el plan 28-02**, tal como manda la decomposición trazadora.

## Deviations from Plan

### Desviación de CONTEXT.md aprobada por Juan

**D-A: checkIds `PERF-10`/`PERF-11` en lugar de los `PERF-07`/`PERF-08` lockeados en CONTEXT.md**

- **Origen:** Tarea 1 (`checkpoint:decision`, one-way por persistirse en `Issue.fingerprint`).
- **Resolución:** Juan seleccionó explícitamente la opción `perf-10-11` antes de escribir una sola línea de código.
- **Motivo:** colisión de fingerprint verificada contra `packages/psi/src/issues.ts`; falla silenciosa en los contadores de `diffIssues`.
- **Alcance:** este plan usa `PERF-10`; el plan 28-02 debe usar `PERF-11` para el check de tamaño de HTML.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tipado del parámetro `response` incompatible con el `PlainResponse` de Crawlee**

- **Found during:** Task 2 (gate intermedio, antes de escribir el check)
- **Issue:** `pnpm --filter @auditor/crawler typecheck` falló con `TS2345: Argument of type 'PlainResponse' is not assignable to parameter of type 'ResponseLike'` (weak type detection). El `PlainResponse` de Crawlee 3.17 es `Omit<HttpResponse, 'body'> & IncomingMessage & { body?: unknown }` y no declara `timings`, aunque got-scraping sí lo adjunta en runtime — el supuesto del plan de "tipar el parámetro de forma laxa" no alcanzaba por sí solo.
- **Fix:** la interface se exportó como `TimedResponse` y el call site castea (`response as TimedResponse | undefined`), replicando el precedente que `crawl.ts` ya usa para `redirectUrls`. El gap de tipos quedó documentado como regla dura en el doc-comment del helper, con la nota de que el cast se puede quitar si Crawlee llega a tipar `timings`.
- **Files modified:** `packages/crawler/src/pageMetrics.ts`, `packages/crawler/src/crawl.ts`
- **Verification:** `pnpm --filter @auditor/crawler typecheck` y `pnpm --filter @auditor/checks typecheck` salen en 0; el gate intermedio se completó antes de escribir el check.
- **Committed in:** `415b9f9` (commit de la tarea 2)

---

**Total deviations:** 1 decisión de usuario (D-A) + 1 auto-fix (Rule 3 - blocking).
**Impact on plan:** ninguno sobre el alcance. El auto-fix es estrictamente de tipos y no cambia el comportamiento en runtime. Sin scope creep, sin dependencias nuevas.

## Issues Encountered

- El gate intermedio obligatorio de la tarea 2 hizo exactamente su trabajo: el error de tipos apareció con la capa de captura como única sospechosa, en vez de mezclarse con errores del check tres pasos más adelante.
- Divergencia menor con un criterio de aceptación literal: `grep -c 'Buffer.byteLength' packages/crawler/src/pageMetrics.ts` devuelve 2, no 1, porque el símbolo aparece tanto en el código como en la regla dura del doc-comment que prohíbe `html.length`. La intención del criterio (usar `Buffer.byteLength` y nunca `html.length`) se cumple.

## Flagged Assumptions vigentes

Los cinco supuestos que el plan marcó siguen abiertos y **no** se resolvieron acá:

- **FA-1** — los umbrales lockeados (600/1500 ms) disparan en casi toda página real medida por RESEARCH; se implementaron tal cual. El plan 28-03 imprime la distribución real para recalibrar con datos de Juan.
- **FA-2** — `phases.total` incluye la fase `wait` generada por nuestro propio `maxConcurrency: 5`; la derivación quedó aislada para que el cambio sea de una línea.
- **FA-3** — la escritura es un upsert idempotente sobre `@@unique([auditId, url])`; queda sin test la atomicidad entre `responseMs` y el resto de la fila si el proceso muere a mitad del upsert.
- **FA-4** — `htmlBytes` mide HTML sin comprimir (entre 4x y 8x lo que viaja por la red); mitigado sólo con copy, no resuelto.
- **FA-5** — el check emite una fila `severity: "ok"` cuando la página pasa, siguiendo `contentLengthCheck`; suma ~500 filas `Issue` por auditoría de 500 páginas.

## Known Stubs

Ninguno. `htmlBytes` se captura y persiste pero todavía no tiene check: no es un stub, es el alcance deliberado de este plan (su check `PERF-11` es el plan 28-02, ya planificado).

## User Setup Required

Ninguno en este plan. **Pendiente para el plan 28-03:** `pnpm db:push` contra la base configurada para materializar las dos columnas nuevas; este plan corrió sólo `pnpm db:generate` (offline) tal como lo exige el propio plan.

## Next Phase Readiness

- Listo para el plan 28-02: `htmlBytes` ya se persiste, el grupo `checks/perf/` existe con su barrel, y `makePage` ya enumera el campo. `htmlSizeCheck` sólo necesita usar `PERF-11` y sumarse a los dos exports del barrel.
- Listo para el plan 28-03: la verificación contra datos reales sigue bloqueada por `pnpm db:push`, que ese plan tiene como checkpoint.
- Sin bloqueos. `pnpm typecheck` (16 tareas), ambas suites y `pnpm assert:web-boundary` en verde.

## Self-Check: PASSED

Los 5 archivos declarados como creados existen en disco y los 2 commits de tarea (`415b9f9`, `58beaad`) existen en el historial de git.

---
*Phase: 28-performance-por-p-gina*
*Completed: 2026-08-01*
