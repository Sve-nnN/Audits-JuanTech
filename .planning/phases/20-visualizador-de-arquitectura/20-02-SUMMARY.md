---
phase: 20-visualizador-de-arquitectura
plan: 02
subsystem: report-model
tags: [report-model, architecture, arch-03, arch-04, graph, tdd]
requires:
  - "Audit.stats.graph persisted by the worker (Phase 16, LinkGraph shape)"
  - "Page.title column (Plan 20-01)"
  - "classifyTemplate (Phase 19)"
provides:
  - "ArchNode / ReportArchitecture types exported from @auditor/report-model"
  - "ReportModel.architecture populated in buildReportModel from persisted graph + Page rows"
affects:
  - "Plan 20-03 (SVG tree) renders ReportModel.architecture with no second graph computation"
tech-stack:
  added: []
  patterns:
    - "Conditional single extra query inside the existing Promise.all (no new round-trip)"
    - "Degradation-safe optional model field (undefined for pre-Phase-16 audits)"
    - "TDD RED->GREEN for the assembly logic"
key-files:
  created: []
  modified:
    - packages/report-model/src/model.ts
    - packages/report-model/src/index.ts
    - packages/report-model/src/build.ts
    - packages/report-model/src/build.test.ts
decisions:
  - "architecture is an OPTIONAL ReportModel field — undefined for graphless audits, so pre-Phase-16 fixtures and audits never break"
  - "isDeep means depth > 3 (strictly greater), distinct from the 3+ bucket which includes depth 3"
  - "orphans carry depth -1 as the no-BFS-path sentinel; the UI renders them without a depth badge"
  - "page.findMany runs only when a non-empty graph exists — no extra query for graphless audits"
metrics:
  duration: ~6m
  completed: 2026-07-09
---

# Phase 20 Plan 02: Architecture Report Model Summary

`buildReportModel` now assembles an optional, serializable `architecture` object from the link graph already persisted at `Audit.stats.graph` (Phase 16) plus a single load of the audit's `Page` rows — the pure-data foundation the SVG tree (Plan 20-03) will render, with no HTML re-parse (ARCH-03) and per-node template from `classifyTemplate` (ARCH-04).

## What Was Built

- **Types (`model.ts`):** Added exported `ArchNode { url, title, depth, template, isDeep, isOrphan }` and `ReportArchitecture { nodesByDepth: Record<"0"|"1"|"2"|"3+", ArchNode[]>, orphans: ArchNode[] }`. Added an OPTIONAL `ReportModel.architecture?` field with a doc comment noting it is undefined for pre-Phase-16 audits and the UI hides the whole section when absent.
- **Exports (`index.ts`):** Added `ArchNode` and `ReportArchitecture` to the existing `export type { ... } from "./model"` block.
- **Assembly (`build.ts`):** Extended `AuditStats` with an optional `graph` field mirroring the persisted `LinkGraph`. Read `const graph = stats?.graph` and `hasGraph = !!graph && graph.nodes.length > 0`. Added a SINGLE `prisma.page.findMany({ where:{ auditId }, select:{ id, url, title, finalUrl } })` to the existing `Promise.all` (conditional — only when `hasGraph`, otherwise `Promise.resolve([])`, so graphless audits issue zero extra queries). Built `pagesById` + `nodePageIds`, bucketed each graph node into `"0"/"1"/"2"/"3+"` by `depthByUrl[node.url] ?? 0` (`depth >= 3` collapses into `"3+"`), set `isDeep = depth > 3`, and pulled `title` from the matched Page row (null when absent). Crawled pages whose `pageId` is not a graph node become `orphans` with `depth: -1` and `isOrphan: true`. `architecture` is left `undefined` outside the graph branch.

## Verification

- `pnpm --filter @auditor/report-model test` — 33 tests pass across 4 files (5 new architecture cases + no regression on perf/issues/diff/template/PII).
- `pnpm --filter @auditor/report-model typecheck` — exit 0 (proves the `title: true` select typechecks against the Plan 20-01 client — no phantom field).
- Grep acceptance: `stats?.graph` = 1, `prisma.page.findMany` = 1 (exactly one query added), `title: true` present, `depth > 3` present, `classifyTemplate(` used for both nodes and orphans.
- Degradation confirmed by test: `architecture === undefined` for graphless fixtures and for an empty-nodes graph, with `page.findMany` never called in those cases.

## Deviations from Plan

None - plan executed exactly as written (TDD RED -> GREEN as specified).

## Tasks & Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | ArchNode/ReportArchitecture types + optional ReportModel.architecture | 92e764a |
| 2 (RED) | Failing tests for architecture assembly | d103dc5 |
| 2 (GREEN) | Assemble architecture from stats.graph + single Page-rows load | f356d54 |

## Threat Notes

Per the plan threat model: `classifyTemplate` is already try/catch-guarded (degrades to "other", never throws) over adversarial `node.url` — no new parsing added (T-20-01). Graph size is bounded by the 500-URL crawl cap; array construction is O(n) (T-20-02, accepted; per-level render truncation is Plan 20-03's concern). No package installs (T-20-SC). `node.url`, `page.title` and `page.url` flow verbatim from the audited third-party site into the serializable model — Plan 20-03 must render `title` as an escaped React text child (never `dangerouslySetInnerHTML`).

## Self-Check: PASSED
- packages/report-model/src/model.ts — ArchNode/ReportArchitecture + optional architecture present, typecheck green.
- packages/report-model/src/build.ts — stats.graph read, single page.findMany, architecture assembly present, typecheck green.
- packages/report-model/src/index.ts — both types exported.
- Commit 92e764a — FOUND.
- Commit d103dc5 — FOUND.
- Commit f356d54 — FOUND.
