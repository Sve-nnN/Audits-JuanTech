---
phase: 17-check-schema-contenido-mismatch
reviewed: 2026-07-09T15:18:25Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - apps/worker/src/index.ts
  - packages/checks/src/checks/schema/contentMismatch.test.ts
  - packages/checks/src/checks/schema/contentMismatch.ts
  - packages/checks/src/checks/schema/index.ts
  - packages/checks/src/registry.ts
  - packages/checks/src/types.ts
  - packages/render/src/detect.test.ts
  - packages/render/src/detect.ts
  - packages/render/src/types.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-07-09T15:18:25Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the SD-06 "schema content mismatch" check (`contentMismatch.ts` + tests), the render-verdict wiring it depends on (`@auditor/render` `detect.ts` + tests), the shared check types/registry, and the worker orchestration that threads the render verdict into the check battery (`apps/worker/src/index.ts`). The new SD-06 logic itself is careful, well-tested (13 unit tests, all passing), and consistently non-critical (`severity: "warning"` only, matched by a guardrail test) — no bugs found in the mismatch-detection algorithm proper. The two `warning`-level findings below are in the worker orchestration file: one is a progress-reporting gap directly caused by this phase's re-ordering of the render sample step (17-02), the other is a pre-existing `Promise.race`-based timeout pattern that lets background DB writes continue after a job is already marked failed. Two `info`-level items note heuristic coverage gaps in the SD-06 signal extraction (not exploitable, just incomplete signal coverage for nested schema shapes).

Ran the two directly-relevant test files (`contentMismatch.test.ts`, `detect.test.ts`) — 21/21 passing.

## Warnings

### WR-01: Render sample step has no progress-phase marker, leaving the UI showing stale "crawling" stats during it

**File:** `apps/worker/src/index.ts:284, 350-365, 376`
**Issue:** `writePhase` only accepts `"analyzing" | "performance"` (line 284). The 17-02 change explicitly moved the Playwright render sample (`runRenderSample`, lines 350-365) to run *before* `runAllChecks`/`writePhase("analyzing")` (line 376), specifically so its per-page verdict could feed SD-06. But no phase marker is written before or during the render sample step itself. The render sample launches a real Chromium browser and renders up to `MAX_RENDER_PAGES` (10) pages — a non-trivial duration. During that window `Audit.stats.phase` still reads `"crawling"` with the crawl's final (now stale) counts, which is exactly the "progress bar looks frozen" problem the `writePhase` doc comment (lines 278-283) warns against. This gap already existed when the render sample ran last (after `performance`), but the 17-02 reorder makes it worse: the render step now sits directly after the crawl finishes, when users are most likely to be watching the progress UI for the "crawl complete" transition.
**Fix:**
```ts
async function writePhase(phase: "rendering" | "analyzing" | "performance"): Promise<void> {
  await prisma.audit.update({
    where: { id: auditId },
    data: { stats: { ...lastCrawlProgress, phase } },
  });
}
// ...
await writePhase("rendering");
try {
  renderIssues = await runRenderSample({ auditId, pages: renderPages });
} catch (error) { ... }
```

### WR-02: `withTimeout` does not cancel `crawlAndCheck()` — DB writes can continue after the job is marked "failed"

**File:** `apps/worker/src/index.ts:88-96, 550-554`
**Issue:** `withTimeout` is implemented as `Promise.race([promise, timeoutPromise])`. When the timeout wins the race, `crawlAndCheck()` itself is never cancelled or awaited-and-discarded — it keeps running in the background with all its side effects: `prisma.issue.deleteMany`/`createMany`, `prisma.perfMetric.deleteMany`/`createMany`, and `prisma.page.update` (schemaGraph) for the same `auditId` (lines 229-234, 483-502). Meanwhile the outer `processAuditJob` throws, BullMQ's `failed` handler fires and sets `Audit.status = "failed"` (index.ts:607-637). If the background `crawlAndCheck()` call finishes later, it will still perform its deletes/inserts against `auditId`, silently repopulating `Issue`/`PerfMetric` rows for an audit the UI/API already reports as failed. If a retry or a second manual run is triggered for the same audit while the first is still finishing in the background, the two executions' `deleteMany`+`createMany` pairs can interleave and produce a partial/duplicated Issue set (data integrity risk, not just a cosmetic one). The generous `lockDuration`/`stalledInterval` (set to `JOB_TIMEOUT_MS + 60_000`, lines 594-595) reduces the chance of BullMQ retrying while the original run is still alive, but does not eliminate the window between "job throws on timeout" and "background promise finally settles".
**Fix:** Either make the crawl/check pipeline genuinely cancellable (pass an `AbortSignal` through `runCrawl`/`runAllChecks`/`runPerfSample`/`runRenderSample` and check it between phases), or at minimum guard the terminal writes with a status check immediately before they run, e.g.:
```ts
async function crawlAndCheck(signal: { timedOut: boolean }) { ... }
const timeoutState = { timedOut: false };
const timeoutPromise = new Promise<never>((_, reject) =>
  setTimeout(() => { timeoutState.timedOut = true; reject(new Error(...)); }, JOB_TIMEOUT_MS)
);
// before each destructive write inside crawlAndCheck:
if (timeoutState.timedOut) return; // abandon further persistence
```

## Info

### IN-01: SD-06 HowTo signal extraction does not recurse into `HowToSection`

**File:** `packages/checks/src/checks/schema/contentMismatch.ts:47-61`
**Issue:** `howToSignals` only reads `data.step` items that are `HowToStep`-shaped (`name`/`text` directly on the item). Real-world `HowTo` markup frequently nests steps inside `HowToSection` (`step: [{ "@type": "HowToSection", itemListElement: [...] }]`). For such pages, `step` items won't have a top-level `name`/`text`, so `howToSignals` returns `[]`, and `hasVisibleTextMatch` treats an empty signal list as "not mismatched" (line 74: `if (signals.length === 0) return true;`). This is a false-negative coverage gap (SD-06 silently skips these pages) rather than a false positive, so it doesn't break the "always warning, never critical" guarantee, but it does mean a class of legitimately-mismatched `HowTo` pages using sectioned steps will never be flagged.
**Fix:** Recurse into `HowToSection.itemListElement` (and its own possible nested `HowToStep`/`HowToSection` entries) when collecting signals, mirroring the flattening already done for `@graph` in `extract.ts`.

### IN-02: Product/Review "visible rating" heuristic only checks the flat node, not nested `offers`/`review` shapes

**File:** `packages/checks/src/checks/schema/contentMismatch.ts:116-127`
**Issue:** The mismatch check for `Product` requires `aggregateRating` directly on the `Product` node (`hasProp(node.data, "aggregateRating")`). Some sites nest `aggregateRating` under `offers` or attach it to a related `Review` node referenced by `@id` rather than embedding it on the `Product` node itself. Those shapes won't trigger the `Product+AggregateRating` mismatch check at all (another false-negative coverage gap, same risk direction as IN-01 — under-flagging rather than over-flagging).
**Fix:** Not urgent given the heuristic nature and warning-only severity documented in the check's own comment (lines 79-87), but worth a follow-up ticket if false negatives on real audited sites turn out to be common.

---

_Reviewed: 2026-07-09T15:18:25Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
