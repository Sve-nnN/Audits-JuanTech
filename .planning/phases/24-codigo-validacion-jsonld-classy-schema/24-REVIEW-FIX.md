---
phase: 24-codigo-validacion-jsonld-classy-schema
fixed_at: 2026-07-10T06:45:00Z
review_path: .planning/phases/24-codigo-validacion-jsonld-classy-schema/24-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 24: Code Review Fix Report

**Fixed at:** 2026-07-10T06:45:00Z
**Source review:** .planning/phases/24-codigo-validacion-jsonld-classy-schema/24-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (Warning-level; Info-level IN-01/IN-02/IN-03 out of scope per fix_scope=critical_warning)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: `CHECK_ID = "SD-04"` collision left dangling after retiring `schemaValidateCheck`

**Files modified:** `packages/checks/src/checks/schema/schemaValidate.ts`
**Commit:** c064adf
**Applied fix:** Renamed the retired `schemaValidateCheck`'s `CHECK_ID` from `"SD-04"` to `"SD-04-legacy"`, with a comment explaining it must never be re-registered because it would collide with `danglingIdRefsCheck`'s active `"SD-04"` checkId. Verified no test asserts the literal checkId string value (only the `describe()` label references "SD-04"), so this is a safe, non-breaking rename. Full `packages/checks` vitest suite (121 tests / 24 files) passes.

### WR-02: Recursive property tree has no breadth cap — only depth is bounded

**Files modified:** `apps/web/app/components/SchemaEntities.tsx`
**Commit:** 4b1b41f
**Applied fix:** Added `MAX_ITEMS_PER_LEVEL = 50` constant mirroring the existing `MAX_DEPTH` pattern. Applied it in three places: the primitive-array render branch (slices to 50 items, appends `(+N más)`), the nested-array render branch (slices to 50 `PropertyValue` children, appends a `+N más` line), and `PropertyRows` (slices object keys to 50 rendered rows, appends a `+N propiedades más` line). This caps both array-width and object-width DoS surfaces per level while leaving the existing depth cap untouched.

### WR-03: Page detail route always fetches full `Page.html` even when `schemaJson` covers the data

**Files modified:** `apps/web/app/audits/[id]/pages/[pageId]/page.tsx`
**Commit:** bcc85f1
**Applied fix:** Removed `html: true` from the primary `select`. `buildEntities` is now called first with `page.schemaJson` and `null` for html. Only when `entities.length === 0 && page.schemaJson === null` (i.e., a pre-Plan-24-02 audit with no persisted snapshot) does a second, narrow `prisma.page.findFirst({ select: { html: true } })` query fetch the HTML fallback. This matches the fix suggested in the review exactly, keeping the hot-path query lean for all audits created after Plan 24-02 shipped.

## Verification

- `packages/checks`: `tsc --noEmit` clean; `vitest run` — 121/121 tests passed (24/24 files).
- `apps/web`: `tsc --noEmit` clean (no errors introduced).
- No Info-level findings (IN-01, IN-02, IN-03) were touched — out of scope per `fix_scope: critical_warning`.

---

_Fixed: 2026-07-10T06:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
