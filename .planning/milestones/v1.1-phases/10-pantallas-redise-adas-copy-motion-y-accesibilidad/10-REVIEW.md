---
phase: 10-pantallas-redise-adas-copy-motion-y-accesibilidad
reviewed: 2026-07-06T00:00:00Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - apps/web/app/layout.tsx
  - apps/web/app/HomeClient.tsx
  - apps/web/app/verify/page.tsx
  - apps/web/app/verify/VerifyClient.tsx
  - apps/web/app/audits/[id]/page.tsx
  - apps/web/app/audits/[id]/AuditProgress.tsx
  - apps/web/app/audits/[id]/ScoreGaugeAnimated.tsx
  - apps/web/app/audits/[id]/pages/page.tsx
  - apps/web/app/audits/[id]/pages/[pageId]/page.tsx
  - apps/web/app/components/EntityGraphSvg.tsx
  - apps/web/app/components/motion/useCountUp.ts
  - apps/web/app/components/motion/useReveal.ts
  - apps/web/app/components/ui/CategoryAccordion.tsx
  - apps/web/app/history/page.tsx
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-07-06T00:00:00Z
**Depth:** deep
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the Phase 10 screen-redesign diff (base `d92a38e` → HEAD): motion hooks, screen assembly, and the a11y sweep. The motion primitives are solid — `useCountUp`/`useReveal` are correctly mounted-guarded (no hydration mismatch), disconnect the IntersectionObserver, `cancelAnimationFrame`, and `.cancel()` the WAAPI animation on unmount; reduced-motion is honored both in JS and via the global CSS safety net; reveal content always lives in the DOM (AT/no-JS safe). Server components render all crawled data (URLs, titles, JSON-LD types/labels, `edge.rel`) as escaped text/SVG children — **no XSS**; `href` outputs are guarded with an `^https?://` scheme check. Data-fetching state machines in HomeClient/VerifyClient/history were preserved intact.

Key concerns: one BLOCKER — the preserved `window.location.reload()` on a `failed` poll combined with the server always rendering `<AuditProgress>` for any non-`done` status produces an **infinite reload loop** for failed audits, and makes the newly-added failed-state UI unreachable. Plus duplicate/nested `<main>` landmarks that undercut the very skip-link this phase added, a status badge that falsely reads "Crítico" when an audit has no scores, and unguarded polling that leaks unhandled promise rejections.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Failed audits enter an infinite page-reload loop; new failed-state UI is unreachable

**File:** `apps/web/app/audits/[id]/AuditProgress.tsx:46-49` (with `apps/web/app/audits/[id]/page.tsx:118` and `AuditProgress.tsx:147-152`)
**Issue:** `tick()` calls `window.location.reload()` when `data.status === "failed"`. The server component renders `<AuditProgress>` for **any** non-terminal-success status: `if (audit.status !== "done")` (page.tsx:118) — which includes `"failed"`. So a failed audit reloads into the same progress page → mounts `AuditProgress` → polls → sees `"failed"` again → reloads again → infinite loop. This phase also ADDED a full failed-state UI (`AuditProgress.tsx:147-152`, `role="alert"` with the error message), but it is dead/unreachable code because the reload fires before that branch can persist. The `segmentFailed` styling and `failed` branch of `segmentClass` are likewise never seen. Reload should only happen on `"done"`; `"failed"` should stop polling and let the component render its error UI.
**Fix:**
```tsx
setPoll(data);
if (data.status === "done") {
  if (intervalRef.current) clearInterval(intervalRef.current);
  window.location.reload();
} else if (data.status === "failed") {
  // Terminal, but keep the SPA: stop polling and render the failed branch.
  if (intervalRef.current) clearInterval(intervalRef.current);
}
```

## Warnings

### WR-01: Nested/duplicate `<main>` landmarks defeat the phase's own skip-link

**File:** `apps/web/app/layout.tsx:34` (plus every page: `HomeClient.tsx:149`, `verify/page.tsx:13`, `audits/[id]/page.tsx:120` & `:211`, `audits/[id]/pages/page.tsx:28`, `audits/[id]/pages/[pageId]/page.tsx:51`, `history/page.tsx:59`)
**Issue:** `layout.tsx` now wraps `{children}` in `<main id="main-content">`, but every page still renders its own `<main>`. This nests `<main>` inside `<main>` — invalid HTML (the spec forbids nested `main`) and yields two `main` landmarks per screen. That confuses screen-reader landmark navigation and undermines the A11Y-03 skip-to-content link added in this same phase (the link targets the outer wrapper, not the page's own main region).
**Fix:** Keep exactly one `main`. Simplest: change the page-level `<main className={styles.*}>` elements to `<div>`/`<section>` and rely on the layout's `<main id="main-content">`. (Alternatively drop the layout `main` and give each page's `<main>` the `id="main-content"`, but that duplicates the id across routes — the single-layout-main approach is cleaner.)

### WR-02: Report hero shows a "Crítico" status badge when the audit has no scores

**File:** `apps/web/app/audits/[id]/page.tsx:256-258` (with `:175` and `:235-248`)
**Issue:** `overallStatus = scores?.status ?? "critical"` (line 175). The status Badge at 256-258 renders unconditionally with `STATUS_LABEL[overallStatus]`. When a `done` audit has `scores === null` (scoring produced nothing), the gauge correctly falls back to the "sin datos" state (line 242, `overall === null`), yet the badge still reads "Crítico". Result: the gauge says "no data" while the badge asserts a critical score — a misleading contradiction for the user.
**Fix:** Gate the badge on real data, mirroring the gauge:
```tsx
{scores ? (
  <Badge variant={STATUS_BADGE_VARIANT[overallStatus]}>
    {STATUS_LABEL[overallStatus]}
  </Badge>
) : null}
```

### WR-03: Polling `tick()` has no error handling — unhandled promise rejections on network/JSON failure

**File:** `apps/web/app/audits/[id]/AuditProgress.tsx:41-50`
**Issue:** `tick()` guards only `if (!res.ok) return;`. A transient network failure (`fetch` rejects) or a non-JSON body (`res.json()` throws) escapes as an unhandled promise rejection, because the function is invoked fire-and-forget via `void tick()` and `setInterval(() => void tick())`. The interval self-heals on the next tick, but the rejections are noisy in the console and can trip global error handlers / error-reporting during the normal window where the worker hasn't produced a response yet.
**Fix:** Wrap the body in try/catch and swallow-and-continue:
```tsx
async function tick() {
  try {
    const res = await fetch(`/api/audits/${auditId}`);
    if (!res.ok) return;
    const data: AuditPollResponse = await res.json();
    setPoll(data);
    if (data.status === "done") { /* reload */ }
    else if (data.status === "failed") { /* stop, see CR-01 */ }
  } catch {
    // transient; next interval retries
  }
}
```

## Info

### IN-01: Dead gauge/WAAPI path in useCountUp — no consumer passes `gauge`

**File:** `apps/web/app/components/motion/useCountUp.ts:116-129` (and `apps/web/app/globals.css:73-77`)
**Issue:** The only consumer, `ScoreGaugeAnimated.tsx:26`, calls `useCountUp(value, { duration: 900 })` without a `gauge` option, and `ScoreGauge` recomputes `--gauge-offset` from the animated `value` each render. So `runGauge()`, the `GaugeArc` interface, and the `@property --gauge-offset` registration in `globals.css` are never exercised in this phase. Not a bug (the arc still animates via the count-up), but it's unused machinery that reads as intentional and can mislead future maintainers.
**Fix:** Either wire the `gauge` arc through `ScoreGaugeAnimated`, or drop the `gauge`/`GaugeArc`/`runGauge` code and the `@property` block until a consumer needs them.

### IN-02: VerifyClient error state announces the same heading twice

**File:** `apps/web/app/verify/VerifyClient.tsx:113-120`
**Issue:** The error branch renders a visually-hidden `<h2 className={styles.srTitle}>{title}</h2>` (focus target) immediately followed by `<ErrorState title={title} ... />`, which renders its own visible heading with the identical text. A screen reader encounters the same title twice (once on focus move, once in the landmark/heading list).
**Fix:** Let `ErrorState` own the heading and move focus to it (e.g. via its title element / a forwarded ref), or keep the sr-only h2 but pass an empty/omitted title to `ErrorState` so the text isn't duplicated.

### IN-03: Unreachable fallback in phase label lookup

**File:** `apps/web/app/audits/[id]/AuditProgress.tsx:71`
**Issue:** `PHASE_LABEL[phase] ?? "Procesando"` — `phase` is narrowed to the exhaustive `Phase` union (`stats?.phase ?? "crawling"`, line 60), so `PHASE_LABEL[phase]` is always defined and the `?? "Procesando"` fallback is dead. Harmless, but signals the type already guarantees the key.
**Fix:** Drop the `?? "Procesando"`, or keep it only if `phase` may ever be an untrusted string from the API (in which case validate it against `PHASE_ORDER` at the boundary instead).

---

_Reviewed: 2026-07-06T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
