---
phase: 17-check-schema-contenido-mismatch
plan: 02
subsystem: worker
tags: [render, playwright, schema.org, seo, aeo]

# Dependency graph
requires:
  - phase: 17-check-schema-contenido-mismatch/17-01
    provides: "SD-06 schemaContentMismatchCheck and the renderVerdictByPageId contract on SiteCheckCtx/RunAllChecksOptions"
provides:
  - "RenderIssueDraft.verdict field exposing the explicit ssr/csr/undetermined verdict on every render draft"
  - "Worker pipeline order where runRenderSample executes before runAllChecks, with its per-page verdict threaded into the check battery as renderVerdictByPageId"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Worker builds a Record<pageId, verdict> lookup from a best-effort sample pass and threads it into the next pipeline stage's options, rather than the check battery reaching back into a separate data source"

key-files:
  created: []
  modified:
    - packages/render/src/types.ts
    - packages/render/src/detect.ts
    - packages/render/src/detect.test.ts
    - apps/worker/src/index.ts

key-decisions:
  - "RenderVerdict is imported directly in apps/worker (which already depends on @auditor/render) and never re-exported into @auditor/checks, preserving the Playwright/apps-web isolation boundary from 17-01"
  - "renderVerdictByPageId is populated only from pages actually present in renderIssues (i.e. actually sampled) — out-of-sample pages get no entry rather than a synthesized 'undetermined', so SD-06 evaluates them normally"

patterns-established: []

requirements-completed: [SCHEMA-07]

# Metrics
duration: 15min
completed: 2026-07-09
---

# Phase 17 Plan 02: Render Sample Reordering Summary

**Worker now runs the v1.2 Playwright render sample before the check battery and threads its per-page SSR/CSR/undetermined verdict into `runAllChecks` as `renderVerdictByPageId`, closing SD-06's CSR-suppression cross-check**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-09T10:05:00-05:00 (approx)
- **Completed:** 2026-07-09T10:20:00-05:00
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `RenderIssueDraft` now exposes an explicit `verdict: RenderVerdict` field, populated on all three code paths (csr/ssr/undetermined branches in `detect.ts`), covered by new assertions in `detect.test.ts`
- `apps/worker/src/index.ts` moves the `runRenderSample` try/catch block to run immediately after `buildLinkGraph` and before `runAllChecks` (previously it ran after the perf sample, near the end of the pipeline)
- The worker builds `renderVerdictByPageId` from `renderIssues` (keyed by `pageId`) and passes it into `runAllChecks`, giving SD-06 (built in 17-01) the real render verdicts to suppress CSR false positives
- Full verification suite green: `@auditor/render` tests+typecheck, `@auditor/worker` typecheck, `@auditor/checks` tests, and `pnpm assert:web-boundary` all pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Expose an explicit verdict field on RenderIssueDraft** - `42c72c0` (feat)
2. **Task 2: Reorder the worker pipeline and thread renderVerdictByPageId into runAllChecks** - `10f900e` (feat)

**Plan metadata:** (final commit, see below)

## Files Created/Modified
- `packages/render/src/types.ts` - adds `verdict: RenderVerdict` to `RenderIssueDraft`
- `packages/render/src/detect.ts` - populates `verdict` on the csr/ssr branches of `detectRenderVerdict` and on `undeterminedVerdict`
- `packages/render/src/detect.test.ts` - adds one `.verdict` assertion per existing branch (ssr/csr/undetermined)
- `apps/worker/src/index.ts` - relocates the `runRenderSample` try/catch block before `runAllChecks`, builds `renderVerdictByPageId` from `renderIssues`, and passes it into the `runAllChecks` call

## Decisions Made
- Kept the `RenderVerdict` import worker-local (never re-exported into `@auditor/checks`, which keeps its own local `RenderVerdictValue` type per 17-01's decision) to preserve the Playwright/apps-web isolation boundary
- `renderVerdictByPageId` only contains entries for pages that were actually part of the render sample (i.e. present in `renderIssues` with a `pageId`) — pages outside the sample get no entry, so SD-06 still evaluates them normally instead of assuming a verdict

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SCHEMA-07's cross-check requirement is fully closed: SD-06 (from 17-01) now receives real per-page CSR verdicts from the v1.2 render sample instead of an always-empty `renderVerdictByPageId`
- Phase 17 is complete — both plans (SD-06 detection + render-sample wiring) have shipped and are verified end-to-end via the full test/typecheck/boundary-assertion suite

---
*Phase: 17-check-schema-contenido-mismatch*
*Completed: 2026-07-09*

## Self-Check: PASSED

All created/modified files verified to exist on disk. Both task commit hashes (42c72c0, 10f900e) verified present in git log.
