---
phase: 19-agrupacion-por-plantilla
plan: 01

subsystem: report-model
tags: [typescript, vitest, report-model, url-classification, grouping]

requires:
  - phase: 15-detalle-por-categoria
    provides: "groupIssuesByType / issuesByCategory pattern in packages/report-model (style precedent mirrored here)"
provides:
  - "classifyTemplate(url) pure URL-segment classifier -> PageTemplate (home/category/product/article/other)"
  - "TEMPLATE_ORDER display-order array"
  - "ReportModel.issuesByTemplate second grouping axis alongside issuesByCategory"
affects: [19-02-report-ui-toggle, 20-arch-visualizer]

tech-stack:
  added: []
  patterns:
    - "Second ReportModel grouping axis computed once in buildReportModel from the same issuesForDetail query, mirroring the issuesByCategory pattern (Object.fromEntries over an *_ORDER array, single pass push into buckets)"

key-files:
  created:
    - packages/report-model/src/template.ts
    - packages/report-model/src/template.test.ts
  modified:
    - packages/report-model/src/model.ts
    - packages/report-model/src/build.ts
    - packages/report-model/src/build.test.ts
    - packages/report-model/src/index.ts

key-decisions:
  - "Match priority inside classifyTemplate is product > category > article (first-scanned set wins), distinct from TEMPLATE_ORDER which is only display order — matches CONTEXT.md bullet order verbatim"
  - "Issues with url === null are skipped from issuesByTemplate but retained in issuesByCategory (no regression to the existing axis) — verified via a length-sum assertion in build.test.ts"

patterns-established:
  - "Pure URL classifiers live in packages/report-model/src/*.ts as dependency-free functions with try/catch degrading to a safe default (never throw on adversarial input) — template.ts follows grouping.ts's precedent"

requirements-completed: [TEMPLATE-01, TEMPLATE-02]

duration: 15min
completed: 2026-07-09
---

# Phase 19 Plan 01: Clasificador de plantilla + issuesByTemplate Summary

**`classifyTemplate(url)` heuristic de segmentos de URL (home/category/product/article/other) más `ReportModel.issuesByTemplate` como segundo eje de agrupación junto a `issuesByCategory`, sin tocar el cálculo existente.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-09T16:57:00Z
- **Completed:** 2026-07-09T16:59:37Z
- **Tasks:** 2 completed
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- `classifyTemplate(url): PageTemplate` pura, nunca lanza excepción (URL malformada degrada a `"other"`), matching case-insensitive por segmento completo (no substring), prioridad product > category > article.
- `TEMPLATE_ORDER` exportado como `["home", "category", "product", "article", "other"]`.
- `ReportModel.issuesByTemplate: Record<PageTemplate, ReportIssue[]>` calculado en `buildReportModel` sobre el mismo `issuesForDetail` usado por `issuesByCategory`, sin alterar ese cálculo (diff solo agrega código nuevo, no toca el loop existente).
- `classifyTemplate`, `PageTemplate`, `TEMPLATE_ORDER` re-exportados desde `@auditor/report-model` (index.ts) para que Plan 19-02 los consuma directamente.

## Task Commits

Each task was committed atomically (TDD RED -> GREEN):

1. **Task 1: classifyTemplate heuristic** - `9a137d1` (test, RED) -> `e93e924` (feat, GREEN)
2. **Task 2: Wire issuesByTemplate into ReportModel/buildReportModel** - `93b15ee` (feat)

**Plan metadata:** pending (this commit)

_Task 1 followed the full RED->GREEN TDD cycle (test file confirmed failing with "Cannot find module" before template.ts existed). Task 2 extended the existing build.test.ts suite (already-passing baseline) with new assertions plus the new production code in a single commit, per the plan's explicit action step._

## Files Created/Modified
- `packages/report-model/src/template.ts` - `PageTemplate` type, `TEMPLATE_ORDER`, `classifyTemplate(url)` pure heuristic
- `packages/report-model/src/template.test.ts` - 10 tests covering every classification bucket, case-insensitivity, full-segment matching, priority order, malformed-URL safety
- `packages/report-model/src/model.ts` - `ReportModel.issuesByTemplate` field + `PageTemplate` type import
- `packages/report-model/src/build.ts` - `issuesByTemplate` computed in `buildReportModel`, second pass over `issuesForDetail`, added to the returned model
- `packages/report-model/src/build.test.ts` - extended existing "returns a populated ReportModel" test with `issuesByTemplate` bucket + null-url-skip regression assertions
- `packages/report-model/src/index.ts` - re-exports `classifyTemplate`, `TEMPLATE_ORDER`, `PageTemplate`

## Decisions Made
- Match priority (product > category > article) implemented as three sequential `.some()` scans in the documented order, matching the CONTEXT.md bullet list verbatim — kept distinct from `TEMPLATE_ORDER` (display order) per the plan's explicit note.
- New `build.test.ts` fixtures used `category: "schema"` (not asserted elsewhere in the pre-existing test) for the classified-product fixture, to avoid perturbing the existing `issuesByCategory.tech`/`.aeo` length assertions; the pre-existing `issuesByCategory.onpage` assertion was updated from length 1 to length 2 to account for the added null-url fixture (documented inline in the test as an intentional extension, not a silent behavior change).

## Deviations from Plan

None - plan executed exactly as written. `issuesByCategory` computation block in `build.ts` is untouched (diff shows only additions after it, per the plan's verification note).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 19-02 can import `classifyTemplate`, `PageTemplate`, `TEMPLATE_ORDER` and consume `model.issuesByTemplate` directly from `@auditor/report-model` with no further report-model changes needed.
- `pnpm --filter @auditor/report-model test` (28/28 passing) and `npx tsc --noEmit -p packages/report-model` (zero errors) both green.

---
*Phase: 19-agrupacion-por-plantilla*
*Completed: 2026-07-09*

## Self-Check: PASSED

All created/modified files found on disk; all 3 task commit hashes (9a137d1, e93e924, 93b15ee) found in git log.
