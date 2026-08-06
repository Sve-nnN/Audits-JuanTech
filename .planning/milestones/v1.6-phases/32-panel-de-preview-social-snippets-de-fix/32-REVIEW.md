---
phase: 32-panel-de-preview-social-snippets-de-fix
reviewed: 2026-08-06T14:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - packages/report-model/src/model.ts
  - packages/report-model/src/build.ts
  - packages/report-model/src/build.test.ts
  - packages/report-model/src/socialPreview.ts
  - packages/report-model/src/socialPreview.test.ts
  - packages/report-model/package.json
  - apps/web/app/audits/[id]/social/GooglePreview.tsx
  - apps/web/app/audits/[id]/social/GooglePreview.module.css
  - apps/web/app/audits/[id]/social/GooglePreview.test.tsx
  - apps/web/app/audits/[id]/social/SocialPreviewPanel.tsx
  - apps/web/app/audits/[id]/social/SocialPreviewPanel.module.css
  - apps/web/app/audits/[id]/social/SocialPreviewPanel.test.tsx
  - apps/web/app/components/ui/IssueTypeGroup.tsx
  - apps/web/app/components/ui/IssueTypeGroup.module.css
  - apps/web/app/components/ui/IssueTypeGroup.test.tsx
  - apps/web/app/audits/[id]/page.tsx
  - apps/web/app/api/audits/[id]/preview-image/route.ts
  - apps/web/tests/app/api/audits/[id]/preview-image/route.test.ts
  - apps/web/app/audits/[id]/social/PreviewImage.tsx
  - apps/web/app/audits/[id]/social/PreviewImage.module.css
  - apps/web/app/audits/[id]/social/PreviewImage.test.tsx
  - packages/meta-social/src/fixSnippet.ts
  - packages/meta-social/src/fixSnippet.test.ts
  - packages/meta-social/src/index.ts
  - apps/web/app/audits/[id]/social/FixSnippet.tsx
  - apps/web/app/audits/[id]/social/FixSnippet.module.css
  - apps/web/app/audits/[id]/social/FixSnippet.test.tsx
  - apps/web/app/audits/[id]/social/SocialCardPreview.tsx
  - apps/web/app/audits/[id]/social/SocialCardPreview.module.css
  - apps/web/app/audits/[id]/social/SocialCardPreview.test.tsx
  - apps/web/app/audits/[id]/social/XPreview.tsx
  - apps/web/app/audits/[id]/social/XPreview.module.css
  - apps/web/app/audits/[id]/social/XPreview.test.tsx
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: issues_found
---

# Phase 32: Code Review Report

**Reviewed:** 2026-08-06
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

Iteration 3 (final confirmation pass) after the auto-fix loop applied `9be317f` for the iteration-2 Warning (`WR-01`: the `twitterImageStatus` same-URL check was running on already-capped 500-char strings, letting two genuinely different long URLs sharing a truncated prefix collapse to "equal"). Only that one commit landed since the iteration-2 review (`git log b878ecd..HEAD` / `192dde0..HEAD` shows nothing else touched `preview-image/route.ts`, `XPreview.tsx`, or any other reviewed file).

The fix was traced end-to-end and verified correct:

- `socialPreview.ts` now keeps `rawOgImage`/`rawTwitterImage` (uncapped, straight from `firstValue(...)`) alongside the existing `cap()`-ed `ogImage`/`twitterImage` used for display/storage, and derives a new internal-only signal `twitterImageSameAsOgImage: rawTwitterImage === rawOgImage` from the raw values. This signal is documented as intentionally NOT part of the public `SocialPreviewData` shape.
- `build.ts` destructures `{ twitterImageSameAsOgImage, ...extractedForModel }` out of the `extractSocialPreview` result, spreads only `extractedForModel` into the final `SocialPreviewData` entry, and uses `twitterImageSameAsOgImage` (not a string comparison of the capped fields) to decide `twitterImageStatus: twitterImageSameAsOgImage ? imageStatus : "ok"`.
- The pre-existing "twitter:image falls back to og:image when absent" rule is preserved: `rawTwitterImage = firstValue(data, "twitter:image") ?? rawOgImage`, and `twitterImage: cap(rawTwitterImage)` is provably equivalent to the prior `cap(firstValue(...)) ?? ogImage` expression for both the present and absent cases (verified by inspection: when `twitter:image` is absent, both reduce to `cap(rawOgImage)`).
- Leak check: grepped every call site of `extractSocialPreview` across the repo — the only consumer is `build.ts` (server-only), which strips the raw signal before constructing the client-facing model. `apps/web` never imports `extractSocialPreview` directly, so the internal field cannot reach the RSC payload through any other path.
- New tests cover both layers: `socialPreview.test.ts` asserts `twitterImageSameAsOgImage` is `false` for two >500-char URLs sharing a 500-char prefix, `true` when `twitter:image` is absent (inherits `og:image`), and `false` for two distinct short URLs; `build.test.ts` reproduces the exact >500-char shared-prefix scenario end-to-end and asserts `preview.twitterImageStatus === "ok"` (fails open, no wrong inheritance) while also asserting `preview` does **not** have an own `twitterImageSameAsOgImage` property (leak guard at the model boundary).
- `pnpm --filter @auditor/report-model exec tsc --noEmit` and `pnpm --filter web exec tsc --noEmit` are both clean; `pnpm --filter @auditor/report-model test` (93/93) and the full `apps/web` social-panel test suite (128/128 across 17 files) pass.
- `CR-01`, `WR-01` (iteration-1 original), and `WR-02` remain fixed exactly as verified in the iteration-2 review, with no regression: `XPreview.tsx` still consumes `data.twitterImageStatus`; `preview-image/route.ts`'s top-level `try/catch` around `fetchImage(...)` is untouched; the exact-origin allowlist (`route.ts:159-161`, WR-03) is untouched and still matches the locked decision in `32-CONTEXT.md`.

No new issues were found in this pass. `WR-03` is confirmed to remain the only genuinely open item, and it is a known, accepted, out-of-scope-for-this-loop product/security decision (human sign-off), not a bug — consistent with the iteration-1 and iteration-2 findings.

The three Info items from iteration 1/2 were out of the fixer's scope (critical+warning only) and remain unaddressed exactly as before — no regression, carried forward for visibility only, and none of them are blocking.

## Info

_Carried forward unchanged from the iteration-2 review. Out of scope for the critical+warning-only auto-fix loop; unaddressed by design, not a regression. Re-listed here for visibility only._

### IN-01: `resolveImageStatus`'s return type duplicates the `SocialImageStatus` union instead of importing it

**File:** `packages/report-model/src/build.ts:143-145`
**Issue:** `model.ts` exports `SocialImageStatus`, but `resolveImageStatus`'s signature re-declares the identical literal union inline instead of importing it, so a future addition to the type wouldn't force this function to acknowledge it.
**Fix:** `import type { SocialImageStatus } from "./model";` and use it as the return type.

### IN-02: `cap()` truncates by UTF-16 code unit, which can split a surrogate pair and emit a malformed string

**File:** `packages/report-model/src/socialPreview.ts:20-23`
**Issue:** `value.slice(0, PREVIEW_TEXT_MAX_CHARS)` can cut a surrogate pair (e.g. most emoji) in half when it straddles position 500, leaving an unpaired surrogate in the output. Note this now also affects the raw-vs-capped comparison introduced by the WR-01 (iteration 2) fix only in the sense that the *capped* `ogImage`/`twitterImage` display values could still contain a malformed surrogate — the new `twitterImageSameAsOgImage` equality signal itself operates on raw strings and is unaffected.
**Fix:** Use `Array.from(value).slice(0, PREVIEW_TEXT_MAX_CHARS).join("")` (code-point aware) or back off one position when the boundary character is a high surrogate.

### IN-03: `FixSnippet.triggerDownload`'s ref bookkeeping is overwritten on rapid repeated clicks

**File:** `apps/web/app/audits/[id]/social/FixSnippet.tsx:68-82`
**Issue:** `pendingUrlRef.current`/`revokeTimerRef.current` are overwritten on each `triggerDownload()` without clearing the previous timer; each closure still revokes its own URL correctly (no real leak), but the ref pair doesn't track more than one in-flight download, so the unmount cleanup can end up looking at a stale/nulled ref on rapid clicks.
**Fix:** Clear the previous timer/URL before overwriting, or track pending downloads in a small array/Map.

---

_Reviewed: 2026-08-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
