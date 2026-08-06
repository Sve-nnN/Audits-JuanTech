---
phase: 32-panel-de-preview-social-snippets-de-fix
reviewed: 2026-08-06T00:00:00Z
depth: standard
files_reviewed: 26
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
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 32: Code Review Report

**Reviewed:** 2026-08-06
**Depth:** standard
**Files Reviewed:** 32 (as listed; `files_reviewed` counts unique source files)
**Status:** issues_found

## Summary

Reviewed all four plans of Phase 32 (32-01..32-04): the `SocialPreviewData` derivation in `@auditor/report-model`, the fix-snippet builder in `@auditor/meta-social`, the same-origin image proxy route, and the React preview panel (Google/Facebook-LinkedIn/X tabs + `FixSnippet`).

The security-sensitive surfaces hold up well. `FixSnippet`'s HTML-attribute escaping (`escapeAttr`) is correct and ordered properly (`&` first, no double-escaping), verified against a real `"><script>` payload in tests. The image proxy route (`preview-image/route.ts`) correctly reuses Phase 31's `assertPublicDestination`/`pinnedDispatcher` SSRF defenses, re-derives `Content-Type` against a closed allowlist instead of forwarding the origin's header, follows redirects manually while revalidating every hop, and returns generic bodyless 40x responses on every rejection path (no reason/status leak) — all as documented and all covered by tests that assert `fetch` is never called before validation passes.

One real correctness bug was found in how the X (Twitter) card variants reuse `imageStatus`: that verdict is computed exclusively from `og:image`'s IMG-01 network check, but `XPreview`/`SocialCardLayout` apply it to `twitterImage`, which can be a different, independently-declared URL. This makes the panel show a false "image unavailable" placeholder (with copy that explicitly blames `og:image`) for pages where the real `twitter:image` is fine, or the reverse. Three warnings and a few smaller informational items round out the review — none block the security model, but the imageStatus mismatch should be fixed before shipping since it directly undermines the panel's core promise (showing what the page will actually look like when shared).

## Critical Issues

### CR-01: `imageStatus` (derived only from `og:image`) is reused for `twitterImage`, producing a false preview verdict when the two URLs differ

**File:** `packages/report-model/src/build.ts:142-152` (root cause) and `apps/web/app/audits/[id]/social/XPreview.tsx:36-59` (manifestation)

**Issue:** `resolveImageStatus` (build.ts:142) is documented as "Verdict on the declared `og:image`" and is computed by scanning only `IMG-01` issues (`OG_IMAGE_CHECK_ID`, `packages/report-model/src/build.ts:338-344`) — the network check that validates **only `og:image`** (confirmed: `packages/checks/src/checks/network/ogImageNetwork.ts:300` — "IMG-01: network validation of the declared og:image"; there is no equivalent network check for `twitter:image`).

`socialPreview.ts:140` sets `twitterImage: firstValue(data, "twitter:image") ?? ogImage` — when the page declares an **explicit, distinct** `twitter:image` (a common real-world pattern: sites often serve a differently-cropped image to Twitter/X), `twitterImage !== ogImage`.

`XPreview.tsx` then passes this same page-level `imageStatus` to both layouts:
```tsx
// summary_large_image variant (XPreview.tsx:36-44)
<SocialCardLayout auditId={auditId} image={data.twitterImage} imageStatus={data.imageStatus} {...text} />

// summary variant (XPreview.tsx:47-59)
<PreviewImage auditId={auditId} ogImage={data.twitterImage} imageStatus={data.imageStatus} aspectRatio="1 / 1" />
```

`PreviewImage.tsx:38-50` short-circuits **before ever attempting to load the image** when `imageStatus === "unavailable"`, showing a placeholder whose copy says: *"La imagen declarada en og:image no se pudo verificar."* Two concrete failure modes:

1. `og:image` is broken (IMG-01 → `unavailable`) but the page's distinct `twitter:image` is perfectly valid → the X tab wrongly shows "image unavailable" (blaming `og:image` in the copy) for an image that was never even attempted, even though it would have rendered fine through the very same proxy.
2. `og:image` is fine (`imageStatus: "ok"`) but the distinct `twitter:image` is actually broken → the X tab attempts to load it; this case degrades gracefully via `PreviewImage`'s `onError` handler, so it is not itself broken, but it shows how thin the coupling is.

Failure mode 1 is a real, user-visible incorrect result and is not covered by any existing test — `XPreview.test.tsx` only exercises `imageStatus: "ok"` fixtures with a distinct `twitterImage` (`OG_IMAGE` vs `TWITTER_IMAGE` constants), never a divergent status.

**Fix:** Either (a) compute a second, twitter-specific image verdict in `buildReportModel`/`resolveImageStatus` when `twitter:image` is explicitly declared and differs from `og:image` (defaulting to `"ok"` when unverifiable, same fail-open posture as today), and thread it through `SocialPreviewData` as e.g. `twitterImageStatus`, or (b) if a dedicated network check is out of scope for this phase, at minimum stop conflating the two: only apply `imageStatus` to `twitterImage` when `twitterImage === ogImage` (i.e., when it's actually the same URL that IMG-01 verified), and treat an explicit, distinct `twitter:image` as always `"ok"` (let the client-side `onError` fallback in `PreviewImage` be the only source of truth for it, exactly as already happens for a broken same-origin image that slips past IMG-01 today).

```ts
// packages/report-model/src/socialPreview.ts — sketch of option (b)
const twitterImage = firstValue(data, "twitter:image") ?? ogImage;
// ...
// caller (build.ts) — only forward the og:image verdict when the URLs match:
const twitterImageStatus =
  extracted.twitterImage === extracted.ogImage ? imageStatus : "ok";
```

## Warnings

### WR-01: Site-controlled URL/token fields bypass the documented RSC-payload text cap

**File:** `packages/report-model/src/socialPreview.ts:12-23, 123-141`

**Issue:** `PREVIEW_TEXT_MAX_CHARS` / `cap()` is documented as "a defensive cap on the site-controlled text that reaches the RSC payload of the preview panel (mitigation T-32-02)" and is applied to `title`, `description`, `twitterTitle`, `twitterDescription` — but **not** to `ogImage`, `twitterImage`, or `twitterCardDeclared` (`socialPreview.ts:130-133, 140`), all of which are also attacker/site-controlled `content="..."` attribute values with no length limit in the source HTML. A page with a multi-kilobyte `og:image`/`twitter:card` attribute value (deliberately or via a broken CMS template) reaches the client untouched, both bloating the RSC payload the stated mitigation is meant to bound and being echoed back verbatim into the `<img src>` query string built by `PreviewImage.tsx:60`.

**Fix:** Apply the same `cap()` (or a URL-appropriate limit) to `ogImage`, `twitterImage`, and `twitterCardDeclared` before they're placed in the returned object:
```ts
ogImage: cap(firstValue(data, "og:image") ?? null),
twitterCardDeclared: cap(twitterCard ?? null),
...
twitterImage: cap(firstValue(data, "twitter:image") ?? null) ?? ogImage,
```

### WR-02: `fetchImage`/GET handler have no catch-all around non-network failure paths, which could leak a non-generic error response

**File:** `apps/web/app/api/audits/[id]/preview-image/route.ts:88-132, 165-168`

**Issue:** The route's stated security contract (comment at `route.ts:37-40`, mitigation T-32-09) is that "no rejection branch says why it rejected" — every failure path must resolve to one of the three generic, bodyless `DENIED`/`NOT_FOUND`/`BAD_REQUEST` responses. Inside `fetchImage`'s per-hop loop, `pinnedDispatcher(addresses)` (line 95) is called **outside** the local `try`, and the whole `fetchImage(...)` call at line 168 is **not** wrapped in a `try/catch` in `GET`. If `pinnedDispatcher` (or the synchronous part of `dispatcher.destroy()`) ever throws — today it doesn't, but nothing guards against a future change introducing that — the exception propagates out of the route handler entirely, and Next.js's default error handling takes over instead of the route's own generic-response contract. This is defense-in-depth, not a currently-exploitable bug (verified `pinnedDispatcher` only constructs an `undici.Agent` and never throws today), but it's the one gap in an otherwise carefully "fail into a generic response" design.

**Fix:** Wrap the `fetchImage` call site (or the loop body) in a top-level `try { ... } catch { return NOT_FOUND(); }` so *every* exception — not just `fetch`'s — degrades to the same generic response used elsewhere in the file.

### WR-03: Exact-origin allowlist silently breaks previews for the (common) case where `og:image`/`twitter:image` is hosted off-origin, even though IMG-01 already validated it as reachable

**File:** `apps/web/app/api/audits/[id]/preview-image/route.ts:159-161`

**Issue:** This is a deliberate, documented decision (`32-CONTEXT.md:33`, code comment `route.ts:25-27`), so it is not a defect in the implementation — but its practical impact is worth surfacing explicitly since it silently degrades a large fraction of real audits: any site whose `og:image`/`twitter:image` lives on a different origin than `audit.resolvedUrl` (a CDN subdomain, `i0.wp.com`, Cloudinary, an asset host, etc. — a very common real-world pattern) will have `imageStatus: "ok"` from `resolveImageStatus` (which has no origin awareness) but get a 403 from this proxy, silently falling back to the client-side "No se pudo cargar la imagen" placeholder. The panel's placeholder copy in that case (`PreviewImage.tsx:44-46`) tells the reader the image failed to load — not that the tool itself refused to fetch a perfectly valid cross-origin image. Recommend confirming this trade-off is understood and, if worth improving later, considering a scoped allowlist (e.g., same-origin OR the exact host(s) already proven reachable by IMG-01 for that specific declared URL) rather than exact full-audit-origin match.

## Info

### IN-01: `resolveImageStatus`'s return type duplicates the `SocialImageStatus` union instead of importing it

**File:** `packages/report-model/src/build.ts:142-145`

**Issue:** `model.ts:160` exports `export type SocialImageStatus = "ok" | "unavailable" | "none";`, but `build.ts:145` re-declares the identical literal union inline (`): "ok" | "unavailable" | "none" {`) instead of importing `SocialImageStatus`. If a new status is ever added to the type in `model.ts`, this function's signature would not be forced to acknowledge it — TypeScript would happily accept the narrower return type as a valid subtype, and the drift would go unnoticed until a caller actually needed the new value.

**Fix:**
```ts
import type { SocialImageStatus } from "./model";
export function resolveImageStatus(
  ogImage: string | null,
  imgIssues: { fingerprint: string }[]
): SocialImageStatus { ... }
```

### IN-02: `cap()` truncates by UTF-16 code unit, which can split a surrogate pair and emit a malformed string

**File:** `packages/report-model/src/socialPreview.ts:20-23`

**Issue:** `value.slice(0, PREVIEW_TEXT_MAX_CHARS)` truncates at a raw UTF-16 index. If an `og:title`/`og:description` contains a character outside the BMP (e.g., most emoji) exactly straddling position 500, `.slice()` can cut a surrogate pair in half, leaving a lone unpaired surrogate in the returned string. This renders as a replacement glyph (or, depending on downstream serialization, can produce `U+FFFD`/invalid UTF-8 on export) rather than crashing, so impact is low, but it's an easy one-line fix.

**Fix:** Use `Array.from(value).slice(0, PREVIEW_TEXT_MAX_CHARS).join("")` (code-point aware) or trim back one position when `value.charCodeAt(PREVIEW_TEXT_MAX_CHARS - 1)` is a high surrogate.

### IN-03: `FixSnippet.triggerDownload`'s ref bookkeeping is overwritten on rapid repeated clicks

**File:** `apps/web/app/audits/[id]/social/FixSnippet.tsx:68-82`

**Issue:** `pendingUrlRef.current` and `revokeTimerRef.current` are overwritten on every `triggerDownload()` call without clearing the previous timer. Each `setTimeout` closure still correctly revokes its own `objectUrl` (so there's no actual blob-URL leak), but if the component unmounts between two rapid clicks, the unmount cleanup (`FixSnippet.tsx:57-63`) can end up clearing/revoking the wrong (already-nulled) ref, silently skipping the eager revoke for the most recent object URL — it will still be revoked by its own pending timeout after unmount, so this is a bookkeeping nit rather than a leak, but the ref pair should track a list (or at least the latest pending timer id/url pair correctly) to make the invariant actually hold.

**Fix:** Track pending downloads in a small array/Map keyed by `objectUrl`, or clear the previous timer before overwriting the refs:
```ts
if (revokeTimerRef.current) clearTimeout(revokeTimerRef.current);
if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
```

---

_Reviewed: 2026-08-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
