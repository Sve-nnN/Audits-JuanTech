# Deferred Items — Phase 19

## tests/pages/api/audits/[id]/export.test.ts missing `issuesByTemplate` field
- **Found during:** Plan 19-02, Task 1 typecheck baseline
- **Issue:** `tsc --noEmit` reports TS2741 — the ReportModel mock literal in this test file predates Plan 19-01's `issuesByTemplate` field addition and was never updated.
- **Scope:** Out of scope for Plan 19-02 (caused by Plan 19-01, unrelated to GroupingToggle/labels.ts/page.tsx changes). Confirmed pre-existing via `git stash` baseline check — same error present before this plan's changes.
- **Action needed:** Add `issuesByTemplate: {}` (or equivalent per-template empty-array record) to the mock ReportModel in that test file.
