---
phase: 18-diagnosticos-de-lighthouse-desde-psi
reviewed: 2026-07-09T15:41:26Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - apps/worker/src/index.ts
  - packages/psi/src/cache.test.ts
  - packages/psi/src/client.test.ts
  - packages/psi/src/client.ts
  - packages/psi/src/index.ts
  - packages/psi/src/issues.test.ts
  - packages/psi/src/issues.ts
  - packages/psi/src/parser.test.ts
  - packages/psi/src/parser.ts
  - packages/psi/src/types.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-07-09T15:41:26Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the PSI diagnostics wiring (PERF-05..PERF-09), the underlying `@auditor/psi` package (client, parser, issues mapper, cache), and its integration into the worker's PSI sample pass. Core logic — thresholds, severity grading, fingerprinting, cache namespacing, and the "never throw, degrade to not-available" contract — is sound and well covered by tests. No critical/security-blocking defects found, but there are a handful of correctness edge cases and quality issues worth fixing before this ships: a silent-drop edge case in `mapPerfIssues` when PSI returns a technically-"ok" but internally-empty Lighthouse result, a potential API-key leak path through persisted error strings, an unsafe double type-cast in the worker that defeats compile-time safety, and a test that burns real wall-clock time on retry backoff instead of using fake timers.

## Warnings

### WR-01: `mapPerfIssues` silently drops PERF-01/LCP/CLS/TTFB when a strategy's metrics object is present but internally empty

**File:** `packages/psi/src/issues.ts:111-134`
**Issue:** The "both strategies failed" fallback (`!mobile && !desktop`) only fires when `mobile`/`desktop` are `null`/`undefined`. If PSI returns HTTP 200 with a `lighthouseResult` whose `categories.performance.score` and all lab audits are missing/null (e.g. a Lighthouse `runtimeError` embedded in an otherwise-200 response, or a partially-successful PSI run), `parsePsiResponse` still returns a truthy `PsiMetrics` object with every field `null`. `mapPerfIssues` then enters the per-metric loop, and every `spec.pick(...)` returns `null` for both strategies, so the `continue` at line 134 skips PERF-01, PERF-02-LCP, PERF-02-CLS and PERF-02-TTFB entirely — with no "not available" fallback issue emitted for any of them (only the INP block still emits its own "no disponible" issue, since it has an unconditional else-branch). The report then silently shows fewer perf checks than expected for that page, with no signal to the user or in the data that PSI actually attempted and failed for those metrics.
**Fix:** Track whether a metric's spec found any picked value across the whole `METRIC_SPECS` loop and, if none did (all four core metrics null) even though `mobile`/`desktop` objects existed, emit the same "no disponible" fallback used for the `!mobile && !desktop` case — or make `pickAudit`-style detection explicit per spec:
```ts
if (mobileValue === null && desktopValue === null) {
  issues.push({
    checkId: spec.checkId,
    category: "perf",
    title: spec.title,
    severity: "ok",
    measuredValue: "no disponible (PSI no devolvió esta métrica)",
    criterion: spec.criterion,
    recommendation: spec.recommendation,
    pageId,
    source: url,
    fingerprint: `${spec.checkId}-unavailable:${url}`,
  });
  continue;
}
```

### WR-02: PSI API key can leak into persisted/logged error strings

**File:** `packages/psi/src/client.ts:20-29`, `apps/worker/src/index.ts:189-206`
**Issue:** `buildUrl` appends `PSI_API_KEY` as a `key` query parameter to the request URL. On a network-level failure (DNS error, malformed URL, some `fetch`/undici `TypeError`s), the thrown error's `.message` can include the full request URL (including the `key` param). `runPsi` surfaces that message verbatim via `lastError`/`result.error`, and the worker persists it as-is into `PerfMetric.error` (`apps/worker/src/index.ts:190,205`) and, on a `runPsi` throw, even into `caught.message` directly. If any admin UI, log aggregator, or export surfaces `PerfMetric.error`, the PSI API key could be exposed.
**Fix:** Redact the `key` param before using an error message anywhere it might be persisted or logged, e.g. add a small `sanitizeError(message: string): string` in `client.ts` that strips `[?&]key=[^&]+` before it's ever assigned to `lastError`, or build the URL without the key in a way that's never echoed back in error text (use a header/`Authorization`-style delivery isn't supported by PSI, so redaction is the practical fix).

### WR-03: Unsafe double cast bypasses type safety for the PSI sample

**File:** `apps/worker/src/index.ts:142`
**Issue:** `const sample = selectSample(pages, MAX_PSI_PAGES) as unknown as PageRow[];` forces `selectSample`'s return type (`SamplePageInput[]`, which only declares `url`/`finalUrl`/`statusCode`/`contentType`/`depth`) back into `PageRow[]`, purely so `sample[cursor].id` and `.html`-adjacent fields keep type-checking downstream. This currently works at runtime only because `selectSample` happens to pass through the exact same object references it was given — but nothing enforces that invariant at the type level. A future refactor of `selectSample` (e.g. to map/clone into a lighter DTO, which is exactly what its narrower declared return type invites) would silently turn `page.id` into `undefined` at runtime with no compiler error, since the `as unknown as` cast suppresses the mismatch entirely.
**Fix:** Either widen `SamplePageInput` to include `id: string` and `html` (if `selectSample` is meant to operate on full page rows), or have the worker map `pages` to a `Map<url, PageRow>` and re-resolve from the ids/urls in the `selectSample` output rather than casting the sample array back to `PageRow[]`.

### WR-04: `client.test.ts` retry test sleeps on real timers, adding ~6s of wall-clock time per run

**File:** `packages/psi/src/client.test.ts:37-45`
**Issue:** `runPsi`'s retry backoff (`RETRY_BASE_DELAY_MS = 2_000`, `MAX_ATTEMPTS = 3`) is exercised with the real `setTimeout`/`sleep`, not mocked timers. The "does not touch the existing error path" test triggers two retries on a 500 response, which sleeps for real for `2000ms + 4000ms ≈ 6s`, forcing the test's own explicit `15_000` timeout override. This slows the suite and is a latent source of CI flakiness if the runner is under load (default vitest timeout for other tests in this file is the unmocked default, e.g. 5s, and would fail without the explicit override applied here).
**Fix:** Use `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(...)` around the retry path, or inject the retry delay as a configurable parameter/env var for tests, so the retry behavior is verified without real sleeps.

## Info

### IN-01: Inconsistent fingerprint string construction (template literal vs concatenation)

**File:** `packages/psi/src/issues.ts:190` vs `packages/psi/src/issues.ts:204`
**Issue:** The "has data" INP branch builds the fingerprint with a template literal (`` `PERF-02-INP:${url}` `` — implicit, via the shared `spec`-less inline object) while the "no data" branch uses string concatenation (`"PERF-02-INP:" + url`). Functionally identical, but inconsistent style within the same function.
**Fix:** Use the template-literal form in both branches for consistency.

### IN-02: PERF-09's "worst score wins" merge silently drops the non-chosen diagnostic's `displayValue`

**File:** `packages/psi/src/issues.ts:268-276`
**Issue:** When both `unminifiedCss` and `unminifiedJavascript` are present, `pick` returns whichever has the lower (worse) score, discarding the other diagnostic's `displayValue` entirely (e.g. if JS is worse but CSS also has meaningful savings text, the CSS message is lost). Minor loss of detail in the recommendation shown to the end user.
**Fix:** Consider combining both `displayValue`s (e.g. `"CSS: ...; JS: ..."`) when both are present, similar to how `combineMeasured` combines mobile/desktop.

### IN-03: `PsiRunResult` is not a discriminated union

**File:** `packages/psi/src/types.ts:48-54`
**Issue:** `PsiRunResult` declares `ok: boolean`, `metrics?: PsiMetrics`, `error?: string` as independent optional fields rather than a discriminated union (`{ ok: true; metrics: PsiMetrics; fromCache?: boolean } | { ok: false; error: string }`). Current call sites (`client.ts`, `apps/worker/src/index.ts:182`) correctly guard with `result.ok && result.metrics`, but the type itself doesn't enforce that `ok: true` implies `metrics` is present, leaving room for a future caller to skip the guard and hit an `undefined` metrics object at runtime without a compile error.
**Fix:** Model as a discriminated union so `result.ok === true` narrows `result.metrics` to non-optional.

---

_Reviewed: 2026-07-09T15:41:26Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
