---
phase: 16-grafo-de-enlaces-compartido-profundidad-de-clics-real
verified: 2026-07-08T20:11:44Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
---

# Phase 16: Grafo de enlaces compartido + profundidad de clics real — Verification Report

**Phase Goal:** El auditor calcula la profundidad real de clics de cada página sobre un grafo de enlaces internos calculado una sola vez, y advierte cuando hay páginas demasiado profundas.
**Verified:** 2026-07-08T20:11:44Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | El sistema calcula la profundidad real en clics vía BFS desde home sobre el grafo de enlaces internos — nunca usando `Page.depth` | ✓ VERIFIED | `packages/graph/src/buildLinkGraph.ts` implements BFS from `homeUrl` over `adjacency` built purely from parsed `<a href>` links (cheerio + `normalizeUrl`/`sameRegistrableDomain`). No reference to `Page.depth` anywhere in the graph package or in `depth.ts`. |
| 2 | El cómputo del grafo/BFS es una función pura reusable (sin efectos secundarios, sin DB) | ✓ VERIFIED | `buildLinkGraph(pages: GraphPage[], origin: string): LinkGraph` takes plain in-memory data, no imports of `@auditor/db`/Prisma/network calls. `GraphPage` is a decoupled minimal shape. Output (`{nodes, edges, depthByUrl}`) is plain JSON-serializable data. |
| 3 | El worker calcula el grafo/BFS una sola vez por auditoría, inmediatamente después del crawl y antes de los checks, y persiste el resultado en `Audit.stats.graph` (estado terminal `done`) | ✓ VERIFIED | `apps/worker/src/index.ts:321` — single `buildLinkGraph(...)` call site, located right after the `Promise.all([pages, robotsTxt, sitemapUrls])` fetch and before `writePhase("analyzing")`/`runAllChecks`. `graph` is threaded through `crawlAndCheck()`'s return value (line 306, 523) to the single `prisma.audit.update` call (line 532-548) that sets `status: "done"` and includes `graph` inside the `stats` object (line 544). Not written into intermediate progress writes (`writePhase`, `onProgress`). |
| 4 | El reporte de una auditoría con páginas a más de 3 clics de home muestra un único issue agregado de severidad warning con el porcentaje — no un issue por página | ✓ VERIFIED | `packages/checks/src/checks/tech/depth.ts` (`TECH-14`) returns exactly one `IssueDraft` per `run()` call regardless of how many pages exceed depth 3 (`over`/`total` aggregated into one `measuredValue` string with `%`). Test 4 in `depth.test.ts` explicitly asserts `result.length === 1` for 20 deep pages. `severity: over > 0 ? "warning" : "ok"`. |
| 5 | El check de profundidad lee `Audit.stats.graph.depthByUrl` (vía el contexto que le pasa el worker), nunca `Page.depth` | ✓ VERIFIED | `SiteCheckCtx.depthByUrl?: Record<string, number>` (packages/checks/src/types.ts:47) threaded from `RunAllChecksOptions` (registry.ts:27) into `siteCtx` (registry.ts:56), populated by the worker from `graph.depthByUrl` (apps/worker/src/index.ts:332). `depthCheck.run({ depthByUrl })` destructures only that field — no `Page`/`depth` field read. |
| 6 | El grafo/BFS se calcula una sola vez y queda disponible para ser reusado sin recomputar (DEPTH-03, fundamento para Phase 20) | ✓ VERIFIED | `Audit.stats.graph = { nodes, edges, depthByUrl }` persisted once at the terminal `done` write; `packages/graph` is a standalone, DB-free workspace package exporting `buildLinkGraph`/`LinkGraph`/`GraphNode`/`GraphEdge`/`GraphPage`, consumable by future Phase 20 without recomputing HTML. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/graph/src/buildLinkGraph.ts` | `buildLinkGraph(pages, origin) -> LinkGraph` with BFS depth from home | ✓ VERIFIED | Exists, substantive (BFS + adjacency + dual-key url index), exported from `index.ts`, wired into worker. |
| `packages/graph/src/types.ts` | `LinkGraph`/`GraphNode`/`GraphEdge`/`GraphPage` contracts | ✓ VERIFIED | All four types present, exported via barrel. |
| `packages/graph/src/index.ts` | Barrel export of `@auditor/graph` | ✓ VERIFIED | Re-exports `buildLinkGraph` + all named types. |
| `packages/checks/src/checks/tech/depth.ts` | `SiteCheck` TECH-14 — issue agregado de % de páginas >3 clics | ✓ VERIFIED | `depthCheck` exported, registered in `techSiteChecks` (index.ts import + array entry). |
| `apps/worker/src/index.ts` | Cómputo post-crawl, paso de `depthByUrl` a `runAllChecks`, persistencia en `Audit.stats.graph` | ✓ VERIFIED | Single call site (line 321), threaded to `runAllChecks` (line 332) and final `prisma.audit.update` (line 544). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `packages/graph/src/buildLinkGraph.ts` | `@auditor/crawler` `normalizeUrl`/`sameRegistrableDomain` | import | ✓ WIRED | `import { normalizeUrl, sameRegistrableDomain } from "@auditor/crawler"` used throughout the BFS/link-parsing logic. |
| `apps/worker/src/index.ts` | `packages/graph` `buildLinkGraph` | import + call post-crawl, pre-checks | ✓ WIRED | `import { buildLinkGraph, type LinkGraph } from "@auditor/graph"` (line 5); single call at line 321, before `writePhase("analyzing")`. |
| `apps/worker/src/index.ts` | `packages/checks` `runAllChecks` | `depthByUrl` passed through `RunAllChecksOptions` | ✓ WIRED | `depthByUrl: graph.depthByUrl` passed at the `runAllChecks({...})` call site (line 332). |
| `packages/checks/src/checks/tech/depth.ts` | `SiteCheckCtx.depthByUrl` | ctx read (no DB access) | ✓ WIRED | `run({ depthByUrl })` destructures the ctx field exclusively; no `Page`/DB reads. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `@auditor/graph` test suite (7 BFS behavior cases) | `cd packages/graph && pnpm vitest run` | 7/7 tests passed | ✓ PASS |
| `@auditor/graph` typecheck | `cd packages/graph && pnpm typecheck` | exits 0 | ✓ PASS |
| `packages/checks` full suite (regression check for optional `depthByUrl`) | `cd packages/checks && pnpm vitest run` | 87/87 tests passed (20 files) | ✓ PASS |
| `apps/worker` typecheck | `cd apps/worker && pnpm typecheck` | exits 0 | ✓ PASS |
| `@auditor/graph` resolved as workspace member | `pnpm -r list --filter @auditor/graph --depth -1` | `@auditor/graph@0.1.0` resolved from `packages/graph` | ✓ PASS |
| `@auditor/graph` listed as worker dependency | `grep "@auditor/graph" apps/worker/package.json` | `"@auditor/graph": "workspace:*"` present, alphabetically positioned | ✓ PASS |
| No `Page.depth` references in graph/depth check code | `grep -rn "Page.depth\|page.depth" packages/graph packages/checks/src/checks/tech/depth.ts` | no matches | ✓ PASS |
| Git commits referenced in SUMMARYs exist | `git log --oneline \| grep -E "7c341f9\|19a6d5d\|5df49ac\|56fd54b"` | all 4 commits found | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DEPTH-01 | 16-01, 16-02 | BFS propio sobre grafo de enlaces internos, no `Page.depth` | ✓ SATISFIED | `buildLinkGraph` BFS + `depthCheck` reads `ctx.depthByUrl` exclusively. |
| DEPTH-02 | 16-02 | Reporte marca advertencia con % de páginas >3 clics, issue agregado no por página | ✓ SATISFIED | `depthCheck` returns exactly 1 issue with computed `%`, `severity: warning` when `over > 0`. |
| DEPTH-03 | 16-01, 16-02 | BFS/grafo se calcula una sola vez, reusable por check de profundidad y futuro visualizador (Phase 20) | ✓ SATISFIED | Single `buildLinkGraph` call site in worker, persisted once to `Audit.stats.graph` at terminal `done` write; `@auditor/graph` is a standalone reusable package. |

No orphaned requirements found — REQUIREMENTS.md maps only DEPTH-01/02/03 to Phase 16, all three are declared in plan frontmatter (`16-01-PLAN.md`: DEPTH-01, DEPTH-03; `16-02-PLAN.md`: DEPTH-01, DEPTH-02, DEPTH-03) and satisfied.

### Anti-Patterns Found

None. Scanned all files modified in this phase (`packages/graph/src/*.ts`, `packages/checks/src/checks/tech/depth.ts`, `packages/checks/src/types.ts`, `packages/checks/src/registry.ts`, `apps/worker/src/index.ts`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/stub patterns — zero matches.

### Human Verification Required

None. All truths are verifiable via automated tests, typecheck, and static code inspection; no visual/UX/external-service behavior specific to this phase requires human judgment. (End-to-end "run a real audit and see TECH-14 appear in the report UI" was noted in the plan's manual-trace verification step as covered by existing worker integration patterns, not a new UI surface — the report already renders issues generically by category/severity without per-check-ID special-casing, confirmed via `grep -rn "TECH-1[0-4]" apps/web/` returning no hardcoded allowlist.)

### Gaps Summary

No gaps found. Both plans (16-01, 16-02) were executed as specified, all automated verification commands pass, all key links are wired end-to-end from HTML parsing through BFS through worker persistence through the depth check to the issue emitted in the report pipeline.

---

_Verified: 2026-07-08T20:11:44Z_
_Verifier: Claude (gsd-verifier)_
