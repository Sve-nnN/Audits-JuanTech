---
phase: 16-grafo-de-enlaces-compartido-profundidad-de-clics-real
plan: 01
subsystem: crawler
tags: [cheerio, bfs, link-graph, monorepo-package, tdd]

# Dependency graph
requires: []
provides:
  - "@auditor/graph workspace package exporting buildLinkGraph(pages, origin) -> LinkGraph"
  - "LinkGraph/GraphNode/GraphEdge/GraphPage type contracts"
affects: [16-02-worker-integration, phase-20-architecture-visualizer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure BFS-from-home click-depth computation, decoupled from Page.depth (which is always 0 on sitemap-seeded crawls)"
    - "Standalone workspace package shape mirrors packages/render: type module, main/types point at ./src/index.ts, tsc --noEmit + vitest run scripts"

key-files:
  created:
    - packages/graph/package.json
    - packages/graph/tsconfig.json
    - packages/graph/src/types.ts
    - packages/graph/src/buildLinkGraph.ts
    - packages/graph/src/buildLinkGraph.test.ts
    - packages/graph/src/index.ts
  modified: []

key-decisions:
  - "GraphPage decoupled from @auditor/db (minimal id/url/finalUrl/html shape only), same isolation pattern as @auditor/render's types.ts"
  - "Dual-key page index (normalized url + normalized finalUrl) reused verbatim from canonicalDeep.ts so canonical/redirect targets resolve correctly"
  - "Orphan pages, pages with html: null, and external-domain links are silently excluded from the graph rather than throwing — computation always degrades gracefully"

patterns-established:
  - "buildLinkGraph is a pure function: no DB, no network, JSON-serializable output ready to persist once per audit in Audit.stats.graph"

requirements-completed: [DEPTH-01, DEPTH-03]

# Metrics
duration: 20min
completed: 2026-07-08
---

# Phase 16 Plan 01: Grafo de enlaces compartido (paquete @auditor/graph) Summary

**Nuevo paquete `@auditor/graph` con `buildLinkGraph(pages, origin)`: BFS puro desde home sobre enlaces internos parseados vía cheerio, reemplaza `Page.depth` como fuente de verdad de profundidad de clics.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-08T14:58:00Z
- **Completed:** 2026-07-08T19:59:39Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- `@auditor/graph` existe como workspace package instalable (`pnpm-workspace.yaml` glob `packages/*` lo recoge sin config adicional)
- `buildLinkGraph` calcula profundidad real vía BFS desde home, con shortest-path garantizado cuando hay múltiples rutas
- Manejo correcto de casos borde: páginas huérfanas, páginas sin html, enlaces externos, home ausente — todos degradan sin excepción
- Suite de 7 tests TDD (RED confirmado en Task 1, GREEN en Task 2), typecheck limpio, cero `any`

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold @auditor/graph package with types and failing BFS tests** - `7c341f9` (test)
2. **Task 2: Implement buildLinkGraph BFS (GREEN) and verify against the fixture suite** - `19a6d5d` (feat)

_TDD plan: RED confirmed (module-not-found error) in Task 1's commit before Task 2 implemented the module._

## Files Created/Modified
- `packages/graph/package.json` - Workspace package manifest (`@auditor/crawler` workspace dep, `cheerio` dep, mirrors `@auditor/render` shape)
- `packages/graph/tsconfig.json` - Extends `tsconfig.base.json`, no DOM lib (server-only package)
- `packages/graph/src/types.ts` - `GraphPage`/`GraphNode`/`GraphEdge`/`LinkGraph` contracts
- `packages/graph/src/buildLinkGraph.ts` - Pure BFS implementation: filters html-bearing pages, dual-key url index, internal-link adjacency via cheerio + `normalizeUrl`/`sameRegistrableDomain`, BFS shortest-path depth, reachable-only nodes/edges
- `packages/graph/src/buildLinkGraph.test.ts` - 7 behavior cases (linear chain, shortest path, orphan exclusion, null-html exclusion, external-link exclusion, missing-home graceful degradation, edge containment)
- `packages/graph/src/index.ts` - Barrel export (`buildLinkGraph` + all named types)

## Decisions Made
- Reused the exact link-extraction pattern from `canonicalDeep.ts`/`orphanPages.ts` (cheerio.load + `a[href]` + `normalizeUrl` + `sameRegistrableDomain`) rather than inventing a new parser — zero new parsing logic, zero new threat surface (per threat register T-16-02).
- `GraphPage` intentionally decoupled from `@auditor/db`'s `Page` model — this package stays a pure, dependency-light building block reusable by both the worker (Plan 16-02) and the future Phase 20 architecture visualizer without pulling in Prisma types.
- Edge dedup done via a `Set<string>` of `"from to"` string keys — simplest correct approach given the small per-audit graph size (bounded by the crawl's 500-URL cap).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
`git commit` reported the new `buildLinkGraph.ts` file as binary (`Bin 0 -> 3243 bytes` in the diffstat) despite the file containing only standard ASCII TypeScript source (verified via `file`, `grep -P '[^\x00-\x7F]'`, and `git show HEAD:...` — all confirm plain text, no null bytes, no non-ASCII characters). This is a git diff-heuristic quirk, not a content problem: `git show` returns the correct source, `pnpm vitest run` and `pnpm typecheck` both pass against the committed file. No action needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
`@auditor/graph` is ready for Plan 16-02 to wire as a worker step (post-crawl, pre-checks) that calls `buildLinkGraph(pages, origin)` and persists the result to `Audit.stats.graph`. The DEPTH-01 check (reading `depthByUrl` instead of `Page.depth`) and the future Phase 20 architecture visualizer both consume this same package without recomputation. No blockers.

---
*Phase: 16-grafo-de-enlaces-compartido-profundidad-de-clics-real*
*Completed: 2026-07-08*

## Self-Check: PASSED

All created files and referenced commits verified present on disk / in git log.
