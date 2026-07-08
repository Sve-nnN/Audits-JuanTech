---
phase: 12-detecci-n-de-renderizado-csr-ssr
reviewed: 2026-07-06T00:00:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - packages/render/src/browser.ts
  - packages/render/src/renderSample.ts
  - packages/render/src/detect.ts
  - packages/render/src/types.ts
  - packages/render/src/renderSample.test.ts
  - apps/worker/src/index.ts
  - apps/worker/Dockerfile
  - scripts/assert-no-playwright-in-web.mjs
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: findings
---

# Phase 12: Code Review Report — Detección de renderizado CSR/SSR

**Reviewed:** 2026-07-06
**Depth:** deep
**Files Reviewed:** 8
**Status:** issues_found

## Summary

The render pass is well-structured for degradation and correctly enforces the softer parts of the contract: per-page cleanup lives in `finally` inside `snapshotPage`, concurrency is a real bounded worker-pool (shared cursor, 2 lanes — not an unbounded `Promise.all`), no path emits `critical` (only `warning`/`ok`), and the worker double-guards `runRenderSample` so a catastrophic render-layer failure never fails the audit. The web/worker boundary script is meaningful and honest about the crawlee peer chain.

However, there is one BLOCKER that defeats the phase's headline goal ("sin procesos zombie ni OOM bajo concurrencia 2"): the default lazy browser launch in `runRenderSample` has a race that orphans a second Chromium on every real run. The tests never exercise this path because they always inject `snapshot`, so it passed CI green while still leaking. The remaining findings are detection-signal quality and robustness notes.

## Critical Issues

### CR-01: Lazy browser launch races under concurrency 2 → orphaned Chromium leak (OOM)

**File:** `packages/render/src/renderSample.ts:59-66, 102-111`
**Issue:**
The default (non-injected) render closure launches the shared browser lazily:

```ts
let browser: ... | undefined;
const render: SnapshotFn =
  snapshot ??
  (async (url) => {
    if (!browser) browser = await launchBrowser();
    return snapshotPage(browser, url);
  });
```

Two lanes start concurrently via `Promise.all([lane(), lane()])`. Lane A enters `render`, evaluates `if (!browser)` (true), and suspends on `await launchBrowser()`. Control returns to lane B, which evaluates `if (!browser)` — still `undefined`, because A's launch has not resolved yet — and also calls `launchBrowser()`. **Two Chromium browsers launch.** `browser` ends up holding whichever assignment lands last; the other browser instance is never referenced again and never closed. The `finally` block closes only the single `browser` handle, so one Chromium process is orphaned on essentially every audit (whenever `sample.length >= 2`, i.e. the normal case).

This is exactly the zombie-process / OOM-under-concurrency risk the phase set out to prevent. Over repeated audits, leaked Chromium processes accumulate until the container OOMs. The bug is invisible to the suite because every test injects `snapshot`, so the real launch path is untested.

**Fix:** Memoize on the launch *promise*, not the resolved value, so concurrent callers share one launch; close via the same promise.

```ts
let browserPromise: Promise<Browser> | undefined;
const render: SnapshotFn =
  snapshot ??
  (async (url) => {
    browserPromise ??= launchBrowser();
    return snapshotPage(await browserPromise, url);
  });

// ...
} finally {
  if (browserPromise) {
    try {
      await (await browserPromise).close();
    } catch {
      // never mask the best-effort result
    }
  }
}
```

(Alternatively, launch the browser eagerly before spawning the lanes.) Add a test that drives the default path with a stubbed `launchBrowser`/`chromium.launch` and asserts it is called exactly once for a multi-page sample.

## Warnings

### WR-01: `waitUntil: "networkidle"` will time out on many legitimate pages → over-reports "undetermined"

**File:** `packages/render/src/browser.ts:83-85`
**Issue:** `page.goto(url, { waitUntil: "networkidle" })` waits for 500ms of network silence. Pages with analytics beacons, chat widgets, long-polling, or streaming never reach network-idle and will hit `RENDER_TIMEOUT_MS` (15s), degrading to "undetermined". Playwright's own docs discourage `networkidle` for exactly this reason. The failure is safe (degrades, does not crash), but it materially lowers the signal: many SSR/CSR pages that could be classified will silently become "no determinado", making the whole check low-yield.
**Fix:** Use `waitUntil: "load"` (or `"domcontentloaded"` plus a short, bounded settle) so the render captures the post-hydration DOM without depending on network quiescence. Keep the 15s hard cap as the outer bound.

### WR-02: Raw vs rendered text measured with two different extractors → skewed CSR ratio

**File:** `packages/render/src/detect.ts:19-23, 71-73` and `packages/render/src/browser.ts:107`
**Issue:** The raw side uses Cheerio `$body.text()` (concatenates ALL text nodes, including CSS-hidden / `display:none` / `aria-hidden` content, since Cheerio has no layout). The rendered side uses `document.body.innerText` (visible text only, respects CSS). These measure different things, so `rawText.length / renderedText.length` compares apples to oranges. A server-rendered page with a lot of hidden markup (mega-menus, accordions, tab panels) can have `rawText` >> `renderedText` (ratio > 1 → fine), but a page whose visible copy is injected while much boilerplate is hidden can land on the wrong side of the 0.60 threshold, producing false SSR or false CSR verdicts.
**Fix:** Normalize both sides with the same visibility model. Simplest: on the raw side also strip elements that would be hidden (or, more robustly, compare `innerText`-equivalent extraction on both). At minimum, document that the ratio is a coarse heuristic and lean on the `missingKeyContent` (title/H1 presence) signal, which is symmetric and reliable, as the primary discriminator.

### WR-03: `runRenderSample` docstring guarantees "NEVER rejects" but setup runs outside the guard

**File:** `packages/render/src/renderSample.ts:52-57`
**Issue:** `selectSample(pages, MAX_RENDER_PAGES)` and the sample setup execute before the `try { ... } finally { ... }`. An unexpected throw from `selectSample` (or the `.map`/cast) would propagate and reject `runRenderSample`, contradicting the "The whole function NEVER rejects" contract in the docstring (lines 45-47). In practice the worker's belt-and-suspenders `try/catch` (index.ts:356-370) catches it so the audit still completes — but the package-level guarantee is inaccurate and other callers might rely on it.
**Fix:** Move `selectSample` and setup inside the `try`, or soften the docstring to "never rejects for per-page render failures; relies on the caller to guard programming errors." Prefer the former to make the guarantee real.

### WR-04: Web-boundary Check C depends on brittle `pnpm why` text parsing

**File:** `scripts/assert-no-playwright-in-web.mjs:87-104`
**Issue:** The guardrail's core intent is sound and the boundary is genuinely correct today: `@auditor/render` (the only real, non-peer Playwright carrier) is worker-only and absent from the web graph (Check B), and the crawlee `playwright` peer edge is a pre-existing, tree-shaken concern — correctly out of Phase 12 scope. The risk is in Check C's implementation: it classifies edges as "real vs peer" by regex-matching pnpm's human-readable `why` output and a trailing `peer` marker. If a future pnpm version changes that output format (or drops the trailing `peer` word), the filter silently yields zero edges and the check passes green even if a real edge appeared. A guardrail that can fail-open is weaker than it looks.
**Fix:** Harden Check C against a stable source of truth — parse the `pnpm-lock.yaml` / the web package's resolved `node_modules/.pnpm` tree, or run `pnpm --filter @auditor/web why playwright --json` and inspect the structured `dependencyType`/`peer` fields rather than scraping formatted text. Keep the current output as a human-readable supplement only.

## Info

### IN-01: `RenderSeverityValue` includes `"critical"` though it is never emitted

**File:** `packages/render/src/types.ts:14`
**Issue:** The severity union carries `"critical"` for structural parity with `@auditor/checks` `IssueDraft`, but the phase contract forbids render from ever emitting `critical`. Nothing enforces that at the type level, so a future edit could add a `critical` return and typecheck clean.
**Fix:** Add a comment pinning the invariant (or a narrowed local type for what `detectRenderVerdict`/`undeterminedVerdict` may return, e.g. `"warning" | "ok"`), so the "never critical" rule is checked, not just conventional.

### IN-02: Fully-empty rendered snapshot classifies as SSR (`ok`)

**File:** `packages/render/src/detect.ts:66-76`
**Issue:** If the render returns empty title/H1/text (e.g. a page that rendered blank or was soft-blocked but still resolved), `missingKeyContent` is false (rendered side is empty) and `belowRatio` is false (`renderedText.length === 0` → ratio forced to 1), so the verdict is `ssr`/`ok`. A blank render is more honestly "undetermined" than "SSR healthy."
**Fix:** Treat `renderedTitle`/`renderedH1`/`renderedText` all-empty as `undetermined` before the SSR/CSR branch.

### IN-03: Raw title extraction concatenates every `<title>` in the document

**File:** `packages/render/src/detect.ts:57`
**Issue:** `$("title").text()` returns the text of ALL `<title>` elements, including inline SVG `<title>` nodes, not just the `<head>` document title. On pages with inline SVG icons this inflates `rawTitle` and can mask a genuinely missing head title (suppressing a CSR signal).
**Fix:** Scope to the head title: `$("head > title").first().text().trim()` (mirror the same scoping the rendered side gets for free via `document.title`).

---

_Reviewed: 2026-07-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
