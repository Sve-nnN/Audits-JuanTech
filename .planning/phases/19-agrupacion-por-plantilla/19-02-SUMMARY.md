---
phase: 19-agrupacion-por-plantilla
plan: 02

subsystem: ui
tags: [react, nextjs, client-component, accordion, accessibility]

requires:
  - phase: 19-agrupacion-por-plantilla
    provides: "classifyTemplate, PageTemplate, TEMPLATE_ORDER, ReportModel.issuesByTemplate (Plan 19-01)"
provides:
  - "GroupingToggle client component: tab toggle between two pre-rendered ReactNode subtrees, zero fetch"
  - "TEMPLATE_LABEL: Record<PageTemplate, string> label map in labels.ts"
  - "'Detalle por plantilla' accordion block in the audit report page, toggled against the existing 'Detalle por categoría' block"
affects: [20-arch-visualizer]

tech-stack:
  added: []
  patterns:
    - "Client-side visibility toggle over two server-rendered ReactNode props (no fetch, no re-derivation) — reusable pattern for any future dual-grouping UI"

key-files:
  created:
    - apps/web/app/audits/[id]/GroupingToggle.tsx
    - apps/web/app/audits/[id]/GroupingToggle.module.css
  modified:
    - apps/web/app/components/ui/labels.ts
    - apps/web/app/audits/[id]/page.tsx

key-decisions:
  - "GroupingToggle receives byType/byTemplate as ReactNode props computed server-side in page.tsx, rather than receiving raw data and re-deriving JSX client-side — keeps 100% of accordion/badge logic in the server component and matches the plan's zero-new-fetch requirement verbatim"
  - "role=tab/aria-selected/role=tablist/role=tabpanel implemented on top of the existing Button component (no new design primitive); tab pattern is intentionally minimal (no arrow-key roving tabindex) per plan-check's non-blocking cosmetic ARIA note"

patterns-established:
  - "Second-axis 'Detalle por X' block reuses CategoryAccordion/AccordionSubgroup/IssueTypeGroup verbatim, swapping only the source record, label map, and order array — precedent for any future third grouping axis"

requirements-completed: [TEMPLATE-02]

duration: 12min
completed: 2026-07-09
---

# Phase 19 Plan 02: GroupingToggle + Detalle por plantilla Summary

**Client-side tab toggle (`GroupingToggle`) wiring `ReportModel.issuesByTemplate` into a second "Detalle por plantilla" accordion block, switching against the existing "Detalle por categoría" block with zero additional fetches.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-09T16:56:00Z
- **Completed:** 2026-07-09T17:08:00Z
- **Tasks:** 2 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `TEMPLATE_LABEL: Record<PageTemplate, string>` added to `labels.ts`, mirroring the existing `CATEGORY_LABEL` pattern (neutral Spanish, no voceo).
- `GroupingToggle` client component: `role="tablist"`/`role="tab"`/`aria-selected`/`role="tabpanel"` built on the existing `Button` primitive, switching between two already-rendered `ReactNode` props via local `useState` — no fetch, no new design component.
- `apps/web/app/audits/[id]/page.tsx` now renders both "Detalle por categoría" (unchanged JSX, relocated into `GroupingToggle`'s `byType` prop) and a new "Detalle por plantilla" block (`byTemplate` prop) built over `TEMPLATE_ORDER` + `model.issuesByTemplate`, reusing `CategoryAccordion`/`AccordionSubgroup`/`IssueTypeGroup` verbatim.
- `pnpm --filter web build` succeeds (Next.js production build, zero type errors in the touched files).

## Task Commits

Each task was committed atomically:

1. **Task 1: TEMPLATE_LABEL + GroupingToggle client component** - `6257c7b` (feat)
2. **Task 2: Wire "Detalle por plantilla" into page.tsx behind GroupingToggle** - `db31ac2` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `apps/web/app/audits/[id]/GroupingToggle.tsx` - "use client" tab toggle, `byType`/`byTemplate` ReactNode props, `useState<"type" | "template">`
- `apps/web/app/audits/[id]/GroupingToggle.module.css` - `.tabs` class, spacing tokens only (`--space-3`, `--space-5`), zero hex colors (DS-01)
- `apps/web/app/components/ui/labels.ts` - `TEMPLATE_LABEL` export + `PageTemplate` type import from `@auditor/report-model`
- `apps/web/app/audits/[id]/page.tsx` - `GroupingToggle` import/usage, `TEMPLATE_ORDER`/`PageTemplate` import, `issuesByTemplate` read from model, new "Detalle por plantilla" accordion loop mirroring the category loop

## Decisions Made
- `byType`/`byTemplate` passed as pre-rendered `ReactNode` (not raw data) so `GroupingToggle` never touches issue-shaping logic — keeps the client bundle minimal and the server component as the single source of accordion JSX.
- Kept the ARIA tab pattern minimal (no roving `tabindex`/arrow-key navigation) since both tabs are natively focusable `<button>` elements reachable via `Tab`/`Enter`/`Space`; plan-check flagged this as a non-blocking cosmetic gap, not a blocking accessibility defect.

## Deviations from Plan

None - plan executed exactly as written. Logged one out-of-scope pre-existing issue (see below), not fixed per scope boundary.

### Deferred (out of scope, not fixed)

**1. [Scope boundary] `tests/pages/api/audits/[id]/export.test.ts` ReportModel mock missing `issuesByTemplate`**
- **Found during:** Task 1 typecheck baseline (`pnpm --filter web exec tsc --noEmit`)
- **Issue:** TS2741 — the mock `ReportModel` literal in this test predates Plan 19-01's `issuesByTemplate` field and was never updated there.
- **Confirmed pre-existing:** Reproduced identically via `git stash` before this plan's changes were applied — not caused by Plan 19-02.
- **Action:** Logged to `.planning/phases/19-agrupacion-por-plantilla/deferred-items.md`, not fixed (out of scope for files this plan touches, per Scope Boundary rule).

## Issues Encountered

None beyond the deferred pre-existing typecheck error above (unrelated to this plan's task files).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TEMPLATE-01 and TEMPLATE-02 (the full Phase 19 requirement set) are now complete: users can classify pages by template server-side (19-01) and toggle between "Por tipo de error" and "Por plantilla" in the report UI (19-02) with zero additional fetches.
- `packages/report-model`'s `TEMPLATE-01/02` exports (`classifyTemplate`, `PageTemplate`, `TEMPLATE_ORDER`, `ReportModel.issuesByTemplate`) plus this plan's `GroupingToggle`/`TEMPLATE_LABEL` pattern are directly reusable by Phase 20 (`20-arch-visualizer`) if it needs a third grouping axis or a similar toggle UI.
- Pre-existing `export.test.ts` typecheck gap (see Deferred section) should be picked up by whichever future plan next touches that test file, or addressed as a standalone quick fix.

---
*Phase: 19-agrupacion-por-plantilla*
*Completed: 2026-07-09*

## Self-Check: PASSED

All created/modified files found on disk; both task commit hashes (6257c7b, db31ac2) found in git log.
