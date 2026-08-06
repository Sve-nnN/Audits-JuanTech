---
phase: 32-panel-de-preview-social-snippets-de-fix
fixed_at: 2026-08-06T17:46:36Z
review_path: .planning/phases/32-panel-de-preview-social-snippets-de-fix/32-REVIEW.md
iteration: 2
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 32: Code Review Fix Report

**Fixed at:** 2026-08-06T17:46:36Z
**Source review:** .planning/phases/32-panel-de-preview-social-snippets-de-fix/32-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 1 (critical+warning; the 3 Info items remain out of scope by design)
- Fixed: 1
- Skipped: 0

## Fixed Issues

### WR-01: `twitterImageStatus`'s same-URL check runs on already-capped strings, letting two different long URLs collapse to "equal"

**Files modified:** `packages/report-model/src/socialPreview.ts`, `packages/report-model/src/build.ts`, `packages/report-model/src/socialPreview.test.ts`, `packages/report-model/src/build.test.ts`
**Commit:** `9be317f`
**Applied fix:** Moved the `twitterImage === ogImage` equality decision from `build.ts` (which only ever saw the already-500-char-capped strings) into `socialPreview.ts`, where the raw `firstValue(...)` results are still available before `cap()` runs. `extractSocialPreview` now returns an internal `twitterImageSameAsOgImage: boolean` computed from the raw, uncapped `og:image`/`twitter:image` values (mirroring the existing "twitter:image falls back to og:image when absent" rule, but on raw strings). `build.ts` destructures `twitterImageSameAsOgImage` out of `extracted` before spreading the rest into the final `SocialPreviewData` entry, so the raw-comparison signal never reaches the public model/RSC payload — it only drives the `twitterImageStatus: twitterImageSameAsOgImage ? imageStatus : "ok"` decision. The 500-char `cap()` is otherwise untouched and still applies to everything that gets displayed/persisted (`ogImage`, `twitterImage`, `twitterCardDeclared`, etc.), preserving the WR-01 (iteration 1) mitigation.

Added tests:
- `socialPreview.test.ts`: reproduces the exact collision described in the finding — two distinct URLs over 500 chars sharing an identical 500-char prefix (`.../aaa...-og.png` vs `.../aaa...-tw.png`) — and asserts `result.ogImage === result.twitterImage` (both truncated, correctly identical for display) while `result.twitterImageSameAsOgImage` is `false` (correctly distinct pre-truncation). Also added two smaller unit tests pinning the non-collision baseline behavior (`twitter:image` absent → `true`; `twitter:image` a distinct short URL → `false`).
- `build.test.ts`: end-to-end integration test through `buildReportModel` with the same long-URL-collision HTML and an `IMG-01` "unreachable" issue on `og:image`, asserting `preview.twitterImageStatus === "ok"` (does NOT wrongly inherit `"unavailable"`) and that the internal `twitterImageSameAsOgImage` signal is not present on the returned `SocialPreviewData` object (`not.toHaveProperty`).

Verification: `pnpm --filter @auditor/report-model run typecheck` clean; `pnpm --filter @auditor/report-model test` — 93/93 tests pass (up from 90, +3 new); full monorepo `pnpm test` — 14/14 tasks pass, no regressions; `pnpm turbo run typecheck --filter=@auditor/web --filter=@auditor/report-model` clean (confirms the internal-only `twitterImageSameAsOgImage` field doesn't leak into any consumer's type expectations).

## Skipped Issues

None — the one in-scope finding was fixed. `WR-03` (image proxy's exact-origin allowlist) remains intentionally untouched across both iterations: it is a locked product/security decision pending Juan's explicit sign-off, not a mechanical fix, and is out of this fixer's authority. `IN-01`/`IN-02`/`IN-03` remain out of scope (`critical+warning` only) and are carried forward for visibility in `32-REVIEW.md`.

---

_Fixed: 2026-08-06T17:46:36Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
