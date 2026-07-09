---
phase: 17-check-schema-contenido-mismatch
plan: 01
subsystem: checks
tags: [schema.org, json-ld, seo, structured-data, tdd, vitest]

# Dependency graph
requires: []
provides:
  - "schemaContentMismatchCheck (SD-06 site-level check) detecting JSON-LD content mismatches for FAQPage/HowTo/Product+AggregateRating/Review"
  - "Local RenderVerdictValue type and renderVerdictByPageId contract on SiteCheckCtx/RunAllChecksOptions for CSR-suppression, decoupled from @auditor/render"
affects: [17-check-schema-contenido-mismatch/17-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Site-level check redeclares external package types locally (RenderVerdictValue mirrors @auditor/render's RenderVerdict) to avoid pulling worker-only/Playwright-carrying dependencies into @auditor/checks, matching the RenderIssueDraft/IssueDraft precedent"
    - "Heuristic checks with false-positive risk hardcode severity as a literal (never derived) and enforce it via an acceptance-criteria grep for the forbidden literal's absence"

key-files:
  created:
    - packages/checks/src/checks/schema/contentMismatch.ts
    - packages/checks/src/checks/schema/contentMismatch.test.ts
  modified:
    - packages/checks/src/types.ts
    - packages/checks/src/registry.ts
    - packages/checks/src/checks/schema/index.ts

key-decisions:
  - "renderVerdictByPageId keeps @auditor/checks free of any @auditor/render dependency by redeclaring the verdict union locally, preserving the Playwright/apps-web boundary guardrail"
  - "SD-06 severity is hardcoded to warning, never derived, and only suppressed on an explicit csr verdict — undetermined/out-of-sample pages are still evaluated normally"
  - "Match heuristic uses a 40-char normalized prefix snippet and a 50% signal-match threshold for FAQPage/HowTo to tolerate partial rendering without demanding exact full-text equality"

patterns-established:
  - "Pattern: heuristic SiteChecks that risk false positives document the acceptable-suppression signal explicitly in ctx (renderVerdictByPageId) rather than silently guessing"

requirements-completed: [SCHEMA-06, SCHEMA-07]

# Metrics
duration: 20min
completed: 2026-07-09
---

# Phase 17 Plan 01: Schema-Content Mismatch Detection Summary

**SD-06 site-level check flags JSON-LD FAQPage/HowTo/Product+AggregateRating/Review claims with no matching visible HTML content, always at warning severity, with a local renderVerdictByPageId contract ready for 17-02's CSR suppression wiring**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-09T09:58:00-05:00 (approx)
- **Completed:** 2026-07-09T10:02:18-05:00
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added `RenderVerdictValue` local type and `renderVerdictByPageId` field on `SiteCheckCtx`/`RunAllChecksOptions`, threaded through `runAllChecks`, with zero new dependency edge to `@auditor/render`
- Implemented `schemaContentMismatchCheck` (checkId `SD-06`) detecting content mismatches across the 4 highest-risk JSON-LD types, always emitting `severity: "warning"`
- 13 TDD test cases covering mismatch/match pairs for all 4 types, CSR suppression, multi-type aggregation into a single issue, and a cross-fixture severity guardrail — full `@auditor/checks` suite (100/100 tests) and typecheck both pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend SiteCheckCtx/RunAllChecksOptions with renderVerdictByPageId** - `186638c` (feat)
2. **Task 2 RED: Failing tests for schemaContentMismatchCheck** - `37d158e` (test)
3. **Task 2 GREEN: Implement and register schemaContentMismatchCheck** - `e37d617` (feat)

**Plan metadata:** (final commit, see below)

_Note: Task 2 is a TDD task — RED (test) and GREEN (feat) commits, no REFACTOR commit needed._

## Files Created/Modified
- `packages/checks/src/checks/schema/contentMismatch.ts` - SD-06 SiteCheck: detects FAQPage/HowTo/Product+AggregateRating/Review JSON-LD without matching visible HTML content
- `packages/checks/src/checks/schema/contentMismatch.test.ts` - 13 TDD cases covering all 4 risky types, CSR suppression, aggregation, and the always-warning guardrail
- `packages/checks/src/checks/schema/index.ts` - registers `schemaContentMismatchCheck` in `schemaSiteChecks` and named exports
- `packages/checks/src/types.ts` - adds `RenderVerdictValue` and `SiteCheckCtx.renderVerdictByPageId`
- `packages/checks/src/registry.ts` - adds `renderVerdictByPageId` to `RunAllChecksOptions` and the `siteCtx` assembly in `runAllChecks`

## Decisions Made
- Kept `RenderVerdictValue` a local redeclaration (not an import from `@auditor/render`) to preserve the Playwright/apps-web isolation boundary enforced by `scripts/assert-no-playwright-in-web.mjs`
- Severity is a hardcoded literal `"warning"`, never derived, enforced by a grep-verifiable absence of the `"critical"` string literal in the implementation file
- CSR suppression only triggers on an explicit `"csr"` verdict; `"undetermined"` or a missing entry (out-of-sample pages) still gets evaluated normally, per CONTEXT.md decision

## Deviations from Plan

None - plan executed exactly as written. Two trivial follow-up fixes were needed to satisfy strict typecheck/acceptance-criteria greps, both within Rule 1/3 scope:

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `noUncheckedIndexedAccess` typecheck errors in the new test file**
- **Found during:** Task 2 (post-GREEN typecheck verification)
- **Issue:** `issues[0].field` accesses failed strict TS typecheck since `issues[0]` is possibly `undefined` under the project's `noUncheckedIndexedAccess` setting
- **Fix:** Changed to optional chaining (`issues[0]?.field`) in the 2 affected test blocks
- **Files modified:** packages/checks/src/checks/schema/contentMismatch.test.ts
- **Verification:** `pnpm --filter @auditor/checks typecheck` exits 0
- **Committed in:** e37d617 (part of Task 2 GREEN commit)

**2. [Rule 3 - Blocking] Removed a quoted `"critical"` occurrence from a doc comment**
- **Issue:** The acceptance criteria requires `grep -c '"critical"' contentMismatch.ts` to return 0 (proving severity is never derived to critical), but an explanatory doc comment used the quoted form (`never "critical"`), tripping the grep despite being harmless prose
- **Fix:** Reworded the comment to `never critical` (no quotes) — no functional change
- **Files modified:** packages/checks/src/checks/schema/contentMismatch.ts
- **Verification:** `grep -c '"critical"' packages/checks/src/checks/schema/contentMismatch.ts` returns 0
- **Committed in:** e37d617 (part of Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking) — both within Task 2's single commit, no separate commits needed since they preceded the initial GREEN commit
**Impact on plan:** No scope creep — both fixes were required to satisfy the plan's own acceptance criteria.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `renderVerdictByPageId` contract is in place and ready for 17-02 to populate from the worker's v1.2 render sample (`@auditor/render`), which will wire real CSR suppression into SD-06's already-tested suppression path
- SD-06 is live in `schemaSiteChecks` and will run in every audit from this point forward

---
*Phase: 17-check-schema-contenido-mismatch*
*Completed: 2026-07-09*

## Self-Check: PASSED

All created/modified files verified to exist on disk. All 3 task commit hashes (186638c, 37d158e, e37d617) verified present in git log.
