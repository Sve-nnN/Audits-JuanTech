---
phase: 16-grafo-de-enlaces-compartido-profundidad-de-clics-real
plan: 02
subsystem: worker
tags: [checks, worker, bfs, link-graph, tdd]

# Dependency graph
requires:
  - phase: 16-grafo-de-enlaces-compartido-profundidad-de-clics-real
    provides: "@auditor/graph buildLinkGraph(pages, origin) -> LinkGraph, plan 16-01"
provides:
  - "TECH-14 SiteCheck: single aggregated issue with % of pages beyond 3 clicks from home"
  - "Worker computes buildLinkGraph exactly once per audit, post-crawl, pre-checks"
  - "Audit.stats.graph ({ nodes, edges, depthByUrl }) persisted on every audit's terminal done state"
affects: [phase-20-architecture-visualizer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SiteCheckCtx/RunAllChecksOptions extended with optional depthByUrl, threaded from worker through runAllChecks into every SiteCheck.run(ctx) call"
    - "Worker-computed JSON (graph) persisted only at the terminal `done` write, never in intermediate progress writes, to guarantee single-computation-per-audit"

key-files:
  created:
    - packages/checks/src/checks/tech/depth.ts
    - packages/checks/src/checks/tech/depth.test.ts
  modified:
    - packages/checks/src/types.ts
    - packages/checks/src/checks/tech/index.ts
    - packages/checks/src/registry.ts
    - apps/worker/src/index.ts
    - apps/worker/package.json

key-decisions:
  - "depthByUrl kept optional on SiteCheckCtx/RunAllChecksOptions so every existing check/test that doesn't pass it keeps working unchanged (zero regressions in the 87-test suite)"
  - "graph computed once, right after Promise.all([pages, robotsTxt, sitemapUrls]) and before writePhase('analyzing'), then threaded through crawlAndCheck's return value to the single final prisma.audit.update call — the only place Audit.stats.graph is written"

patterns-established:
  - "TECH-14 pattern: single aggregated SiteCheck issue with a computed percentage (Math.round + measuredValue string), mirroring altText.ts's per-page pattern but at site scope, using siteFingerprint(checkId, scope) for stability"

requirements-completed: [DEPTH-01, DEPTH-02, DEPTH-03]

# Metrics
duration: 20min
completed: 2026-07-08
---

# Phase 16 Plan 02: Cablear el grafo de enlaces al pipeline del worker Summary

**Worker calcula `buildLinkGraph` una sola vez post-crawl, pasa `depthByUrl` al nuevo check `TECH-14` (issue agregado de % de páginas a más de 3 clics de home) y persiste `{ nodes, edges, depthByUrl }` en `Audit.stats.graph` del estado terminal `done`.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-08T20:00:00Z
- **Completed:** 2026-07-08T20:03:54Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- `TECH-14` registrado en `techSiteChecks`: issue único (`ok`/`warning`), nunca uno por página, con fingerprint estable entre corridas
- `SiteCheckCtx`/`RunAllChecksOptions` extendidos con `depthByUrl?` opcional — cero regresiones en la suite completa de checks (87 tests, 20 archivos)
- Worker computa el grafo exactamente una vez por auditoría (post-crawl, pre-checks) vía `buildLinkGraph`
- `Audit.stats.graph` sobrevive al estado terminal `done` (única escritura, no en los writes de progreso intermedios), listo para que Phase 20 lo reutilice sin recomputar

## Task Commits

Each task was committed atomically:

1. **Task 1: TECH-14 depth check reading ctx.depthByUrl** - `5df49ac` (feat)
2. **Task 2: Wire buildLinkGraph into the worker pipeline and persist Audit.stats.graph** - `56fd54b` (feat)

## Files Created/Modified
- `packages/checks/src/checks/tech/depth.ts` - `depthCheck: SiteCheck` (`TECH-14`), issue agregado con % de páginas >3 clics de home, lee `ctx.depthByUrl` exclusivamente
- `packages/checks/src/checks/tech/depth.test.ts` - 5 casos: undefined/empty ctx → `[]`, todo ≤3 → `ok` 0%, mezcla → `warning` con % correcto y fingerprint estable, siempre exactamente 1 issue
- `packages/checks/src/types.ts` - `SiteCheckCtx.depthByUrl?: Record<string, number>` con doc inline explicando por qué nunca se usa `Page.depth`
- `packages/checks/src/checks/tech/index.ts` - `depthCheck` registrado en `techSiteChecks` + export nombrado
- `packages/checks/src/registry.ts` - `RunAllChecksOptions.depthByUrl?`, pasado al `siteCtx` compartido por todos los `SiteCheck.run()`
- `apps/worker/src/index.ts` - `buildLinkGraph` importado de `@auditor/graph`, computado una vez post-crawl/pre-checks, `depthByUrl` pasado a `runAllChecks`, `graph` propagado por `crawlAndCheck()` hasta el único `prisma.audit.update` que fija `status: "done"` con `stats.graph`
- `apps/worker/package.json` - `@auditor/graph: workspace:*` agregado en posición alfabética entre `@auditor/db` y `@auditor/psi`

## Decisions Made
- `depthByUrl` opcional en toda la cadena de tipos (no requerido) para no romper ningún test/check existente que no lo pase — verificado corriendo la suite completa de `packages/checks` (87/87 verde) tras el cambio.
- El grafo se computa en un único punto del pipeline (justo después del `Promise.all` de pages/robots/sitemap, antes de `writePhase("analyzing")`) y se propaga por el valor de retorno de `crawlAndCheck()` hasta la única escritura final de `stats` — garantiza DEPTH-03 ("una sola vez por auditoría") sin depender de disciplina en cada call site.

## Deviations from Plan

None - plan executed exactly as written (incluyendo la corrección previa de CHECK_ID a `TECH-14` ya aplicada en el PLAN.md leído).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
`Audit.stats.graph` (`{ nodes, edges, depthByUrl }`) queda disponible en cada auditoría corrida desde este cambio, listo para que Phase 20 (architecture visualizer) lo consuma directamente sin recomputar HTML. Fase 16 completa: DEPTH-01/02/03 cerrados end-to-end.

---
*Phase: 16-grafo-de-enlaces-compartido-profundidad-de-clics-real*
*Completed: 2026-07-08*

## Self-Check: PASSED

All created/modified files and referenced commits (5df49ac, 56fd54b) verified present on disk / in git log.
