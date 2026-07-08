---
phase: 16-grafo-de-enlaces-compartido-profundidad-de-clics-real
reviewed: 2026-07-08T20:13:28Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - apps/worker/package.json
  - apps/worker/src/index.ts
  - packages/checks/package.json
  - packages/checks/src/checks/tech/depth.test.ts
  - packages/checks/src/checks/tech/depth.ts
  - packages/checks/src/checks/tech/index.ts
  - packages/checks/src/registry.ts
  - packages/checks/src/types.ts
  - packages/graph/package.json
  - packages/graph/src/buildLinkGraph.test.ts
  - packages/graph/src/buildLinkGraph.ts
  - packages/graph/src/index.ts
  - packages/graph/src/types.ts
  - packages/graph/tsconfig.json
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-07-08T20:13:28Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the new `@auditor/graph` package (BFS link-graph / real click-depth) and its wiring into `@auditor/checks` (TECH-14 `depthCheck`) and `apps/worker/src/index.ts`. The BFS/graph algorithm is well structured and the seven unit tests in `buildLinkGraph.test.ts` cover the happy path, orphan pages, missing HTML, external links, and a missing/unreachable home page well — but they never exercise a page whose `url` differs from its `finalUrl` (i.e. a redirected page). That gap hides a real correctness bug: the adjacency map is keyed only by each page's `finalUrl`, while BFS can (and, on any real site with internal redirects, will) discover a page via its pre-redirect `url` instead — at which point the adjacency lookup misses and that page's outgoing links are silently dropped from the graph. This directly undermines the phase's stated goal of computing "real click-depth" and will systematically undercount reachable pages on sites with even a single internal redirect (trailing-slash normalization, http→https, slug changes, etc. — all common). This is a BLOCKER.

Beyond that, there are three WARNING-level robustness/integration gaps (missing try/catch around the new graph computation breaking the file's own "never fail the whole audit" pattern; non-deterministic `pageId` selection for duplicate-URL pages; and the new accurate depth not being wired into the existing PSI/render sampling that still keys off the always-zero `Page.depth`), plus minor INFO-level code-quality notes.

## Critical Issues

### CR-01: BFS silently drops a page's outgoing links when it is reached via its pre-redirect URL

**File:** `packages/graph/src/buildLinkGraph.ts:18-24` and `packages/graph/src/buildLinkGraph.ts:29-49`

**Issue:**
`byUrl` is deliberately double-indexed by both `normalizeUrl(page.url)` and `normalizeUrl(page.finalUrl ?? page.url)` so that a link pointing at either the pre-redirect or post-redirect form of a URL resolves to the same crawled page (mirrors `canonicalDeep.ts`'s pattern, per the comment on line 16-17):

```ts
const keys = [normalizeUrl(page.url), normalizeUrl(page.finalUrl ?? page.url)];
for (const key of keys) {
  if (key && !byUrl.has(key)) byUrl.set(key, page);
}
```

However, the **adjacency map** (which drives BFS traversal) is keyed *only* by the post-redirect form:

```ts
for (const page of htmlPages) {
  const baseUrl = page.finalUrl ?? page.url;
  const sourceKey = normalizeUrl(baseUrl);
  ...
  adjacency.set(sourceKey, targets);
}
```

`@auditor/crawler`'s `crawl.ts` stores `url` as the originally-requested normalized URL and `finalUrl` as the post-redirect `loadedUrl` (`packages/crawler/src/crawl.ts:102-104`) — so `url !== finalUrl` on every page that was redirected (trailing-slash normalization, `http`→`https`, `www` canonicalization, slug renames with a 301, etc. — all common on real sites).

Concrete failure scenario:
- Home links to `https://example.com/old` (the pre-redirect form, as literally written in home's HTML).
- The Page row for `/old` has `url = "https://example.com/old"`, `finalUrl = "https://example.com/new"` (it redirected), and its stored `html` contains a link to `https://example.com/deep`.
- `byUrl` maps both `.../old` and `.../new` to this page — so home's link to `.../old` correctly resolves and BFS assigns it depth 1, pushing `"https://example.com/old"` onto the queue.
- But `adjacency` only has an entry keyed `"https://example.com/new"` (built from `baseUrl = finalUrl`). When BFS pops `"https://example.com/old"` off the queue and does `adjacency.get("https://example.com/old")`, it gets `undefined` and hits `if (!targets) continue;` (line 63) — the page's own outgoing links (`.../deep`) are never explored.
- `https://example.com/deep` is never added to `depthByUrl`, and is missing from `graph.nodes`/`graph.edges` even though it is genuinely reachable at depth 2.

Impact: `TECH-14` (depthCheck) undercounts truly-reachable pages and can misreport a page as "not counted" (excluded from the aggregate rather than flagged as deep), and the graph persisted to `Audit.stats.graph` (used by the future architecture visualizer, per the comment in `apps/worker/src/index.ts:317-320`) will have missing subtrees on any site with internal redirects. None of the 7 existing tests in `buildLinkGraph.test.ts` set `finalUrl` to a value different from `url`, so this path is completely untested.

**Fix:** Index `adjacency` the same dual-key way `byUrl` is indexed, so a lookup by either the pre- or post-redirect form finds the same target set:

```ts
const adjacency = new Map<string, Set<string>>();
for (const page of htmlPages) {
  const baseUrl = page.finalUrl ?? page.url;
  const sourceKey = normalizeUrl(baseUrl);
  if (!sourceKey) continue;

  const $ = cheerio.load(page.html!);
  const targets = adjacency.get(sourceKey) ?? new Set<string>();
  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const normalized = normalizeUrl(href, baseUrl);
    if (!normalized) return;
    if (!sameRegistrableDomain(normalized, origin)) return;
    if (!byUrl.has(normalized)) return;
    targets.add(normalized);
  });

  // Alias the same target set under BOTH the pre- and post-redirect key, so
  // BFS can find outgoing links regardless of which URL form discovered
  // this page.
  const preRedirectKey = normalizeUrl(page.url);
  for (const key of [sourceKey, preRedirectKey]) {
    if (key) adjacency.set(key, targets);
  }
}
```

Add a regression test with a page where `url !== finalUrl` and another page links to the pre-redirect `url`, asserting the redirected page's own outgoing links still get explored.

## Warnings

### WR-01: `buildLinkGraph()` call is not wrapped in try/catch, breaking the file's own "never fail the whole audit" pattern

**File:** `apps/worker/src/index.ts:321-324`

**Issue:** Every other non-essential computation added to `crawlAndCheck()` in this file (the PSI perf sample, the Playwright render sample) is explicitly wrapped in `try { ... } catch { ...degrade gracefully... }`, with comments stating the intent plainly (e.g. lines 335-338, 357-366: "Best-effort... must not lose the checks we already computed", "never fails the audit — the crawl/checks/PSI results we already have are preserved"). The new graph computation has no such guard:

```ts
const graph = buildLinkGraph(
  pages.map((p) => ({ id: p.id, url: p.url, finalUrl: p.finalUrl, html: p.html })),
  origin
);
```

`buildLinkGraph` calls `cheerio.load(page.html!)` once per crawled page with real, untrusted HTML from the target site. While Cheerio is generally lenient, a single page with pathological markup (e.g. extreme nesting causing a stack-depth error) throwing here propagates out of `crawlAndCheck()`, hits the outer `withTimeout`/`processAuditJob` catch, and fails the *entire* audit — losing the crawl, checks, and any PSI/render work already computed, contradicting the resiliency goal the rest of this function was clearly written to uphold.

**Fix:**
```ts
let graph: LinkGraph = { nodes: [], edges: [], depthByUrl: {} };
try {
  graph = buildLinkGraph(
    pages.map((p) => ({ id: p.id, url: p.url, finalUrl: p.finalUrl, html: p.html })),
    origin
  );
} catch (error) {
  console.error(`[worker] link graph build failed for audit ${auditId}:`, error);
}
```

### WR-02: Non-deterministic `node.pageId` when multiple Page rows normalize to the same URL

**File:** `packages/graph/src/buildLinkGraph.ts:18-24`, `apps/worker/src/index.ts:311-312`

**Issue:** `byUrl` uses first-write-wins (`if (key && !byUrl.has(key)) byUrl.set(key, page)`), so when two distinct Page rows normalize to the same URL (e.g. two different original request URLs that both redirect to the same canonical target), whichever page happens to appear first in the `htmlPages` array wins the `nodes[].pageId` assignment for that URL. The `pages` array itself comes from `prisma.page.findMany({ where: { auditId } })` in `apps/worker/src/index.ts:312` with **no `orderBy`**, so the "first" row is whatever order Postgres happens to return (not guaranteed stable across re-runs, vacuum, or plan changes). Since `graph.nodes[].pageId` is meant to be consumed by the future architecture visualizer, this can make the pageId displayed for a given URL flap between audit runs / re-audits of the same site.

**Fix:** Either add an explicit `orderBy: { id: "asc" }` (or `createdAt`) to the `findMany` call for determinism, or make the tie-break explicit in `buildLinkGraph` (e.g. prefer the page whose own `url` — not `finalUrl` — matches the key being indexed).

### WR-03: Newly-computed accurate depth is not wired into PSI/render sampling, which still keys off the always-zero `Page.depth`

**File:** `packages/psi/src/sample.ts:75`, `apps/worker/src/index.ts:369-378`, `packages/crawler/src/crawl.ts:215`

**Issue:** `@auditor/psi`'s `selectSample` (reused by both the PSI/CWV sample and, per the comment at `apps/worker/src/index.ts:357-361`, the Playwright render sample) buckets pages by `page.depth ?? "unknown"` to get a representative spread of depths. But `crawl.ts:215` seeds *every* initial request (including all sitemap-derived URLs) with `userData: { depth: 0, ... }` — so for a sitemap-seeded crawl (the common case), every page's `Page.depth` is `0`, and the "spread across distinct crawl depths" logic in `selectSample` effectively degrades to a single bucket. This phase computes a real, accurate BFS depth (`graph.depthByUrl`) immediately after the crawl, but it is only threaded into `depthCheck` (TECH-14) — it's never used to enrich the sample selection for PSI or render checks, even though those already exist and already try to use depth for representativeness. This isn't a regression introduced by this phase, but the phase is the natural place to close this gap since the accurate value now exists and is computed at exactly the point (`apps/worker/src/index.ts:317-333`) before both `runPerfSample` and `runRenderSample` are called.

**Fix:** Pass `graph.depthByUrl` (or a `Map<pageId, depth>` derived from it) into `selectSample`'s callers so sampling can bucket by real click-depth instead of the always-0 crawl depth. Out of scope for a blocking fix in this phase, but should be tracked as a follow-up.

## Info

### IN-01: Dead/unreachable `perf` filter in `categoryScores` loop

**File:** `apps/worker/src/index.ts:501`

**Issue:** `issuesByCategory` is built by explicitly skipping `perf` rows first (`apps/worker/src/index.ts:492`: `if (row.category === "perf") continue;`), so no `"perf"` key can ever exist in that `Map`. The second guard when iterating it is therefore dead code:

```ts
for (const [category, issues] of issuesByCategory) {
  if (category === "perf") continue; // unreachable
  ...
}
```

**Fix:** Remove the redundant check (or, if it's meant as defensive belt-and-suspenders, add a one-line comment saying so — as-is it reads like leftover code).

### IN-02: Page HTML is parsed with Cheerio twice per page, once in each package, with no shared cache

**File:** `packages/graph/src/buildLinkGraph.ts:35`, `packages/checks/src/registry.ts:48`

**Issue:** `buildLinkGraph` calls `cheerio.load(page.html!)` for every page to extract `<a href>`, and immediately afterwards (same request, same `page.html` string, back-to-back in `crawlAndCheck`) `runAllChecks` in `registry.ts` calls `cheerio.load(page.html)` again for the same page to run the page-level check battery. This is purely a maintainability/DRY observation (not flagged for its CPU cost, which is out of this review's scope) — but the duplicated construction of the `$` object is one more place that has to stay behaviorally in sync (e.g. link-extraction rules living in two different files: `buildLinkGraph.ts` vs. `orphanPages.ts`/`canonicalDeep.ts`).

**Fix:** Consider having the worker parse each page's HTML once and pass the `CheerioAPI` instance into both `buildLinkGraph` and `runAllChecks`, or have `buildLinkGraph` accept a pre-parsed map. Not required for this phase, worth a follow-up ticket.

### IN-03: `depthCheck` can report "(0%)" for a page count that is nonetheless flagged as a warning

**File:** `packages/checks/src/checks/tech/depth.ts:21,28`

**Issue:** `pct = Math.round((over / total) * 100)` rounds down to `0` whenever `over/total` is under 0.5%, e.g. 1 page over-depth out of 500 total pages. The issue is still emitted with `severity: "warning"` and a `measuredValue` string like `"1/500 páginas a más de 3 clics de home (0%)"`, which can read as self-contradictory in the report UI ("0%... but it's a warning?").

**Fix:** Either show one decimal of precision for small percentages (e.g. `0.2%`) or drop the percentage from the message when it rounds to 0, keeping the raw `over/total` count as the primary signal.

---

_Reviewed: 2026-07-08T20:13:28Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
