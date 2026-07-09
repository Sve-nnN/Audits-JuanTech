---
phase: 20-visualizador-de-arquitectura
reviewed: 2026-07-09T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - apps/web/app/audits/[id]/page.tsx
  - apps/web/app/components/ArchitectureTreeSvg.module.css
  - apps/web/app/components/ArchitectureTreeSvg.tsx
  - packages/crawler/src/crawl.ts
  - packages/db/prisma/schema.prisma
  - packages/report-model/src/build.test.ts
  - packages/report-model/src/build.ts
  - packages/report-model/src/index.ts
  - packages/report-model/src/model.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-07-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the site-architecture assembly (`build.ts`), the pure-SVG tree
(`ArchitectureTreeSvg.tsx` + CSS module), the report page wiring, the crawler
title extraction, and the Prisma schema. To validate the orphan/depth logic I
also traced the upstream graph builder (`packages/graph/src/buildLinkGraph.ts`),
which is the source of `Audit.stats.graph`.

**Security / XSS (focus area 2): clean.** `ArchitectureTreeSvg` renders every
label (`node.title ?? node.url`, template labels) as JSX text children, so React
escapes them. No `dangerouslySetInnerHTML`, no `eval`, no user data placed into
SVG attributes (`href`/`xlink:href`) or inline `style`. The CSS module is
tokens-only (`var(--...)`, `currentColor`) with zero raw hex — CSP-safe as
required by DS-01. No secrets anywhere in scope.

**Depth bucketing / orphan mechanics (focus area 1): correct, given the
builder's invariant.** `buildLinkGraph` derives `nodes` directly from
`Object.keys(depthByUrl)`, so every graph node is guaranteed to have a depth,
and `nodes` contains only home-reachable pages. That makes the `nodePageIds`
set-difference an accurate orphan detector and the `?? 0` depth fallback dead in
practice. The `3+` collapse and `isDeep = depth > 3` boundary match the tests.

**The real defects are upstream of that logic:** `build.ts` loads *every* `Page`
row for the audit with no status/`html` filter, so failed and non-2xx pages leak
into the architecture model — as bogus orphans (WR-01) and as legitimate-looking
tree nodes (WR-02). Both misrepresent the crawled site. Remaining items are
robustness/quality INFO notes.

## Warnings

### WR-01: Failed/uncrawlable pages are mislabeled as content orphans

**File:** `packages/report-model/src/build.ts:209-220`
**Issue:** The orphan loop iterates *all* `Page` rows and treats any page absent
from the graph as an orphan (`isOrphan: true`, badge "sin ruta / huérfana").
But `buildLinkGraph` excludes any page with `html === null`
(`buildLinkGraph.ts:14`, confirmed by graph Test 4). A page that failed to
fetch is persisted by the crawler's `failedRequestHandler` with **no `html` and
a non-null `error`** (`crawl.ts:189-203`). Such broken pages therefore land in
`orphans` and are drawn as "huérfana / sin ruta" nodes — telling the user a page
has no inbound link path when in reality the crawler never even loaded it. An
orphan (a reachable-content page with no link path) and a fetch failure are
distinct conditions and must not share a bucket.
**Fix:** Exclude non-crawled pages from the orphan set. Either filter in the
query or in the loop, e.g.:
```ts
hasGraph
  ? prisma.page.findMany({
      where: { auditId, error: null, html: { not: null } },
      select: { id: true, url: true, title: true, finalUrl: true },
    })
  : Promise.resolve([]),
```
(Alternatively keep loading them but `continue` when `page.error != null` /
`page.html == null` before pushing an orphan.)

### WR-02: Broken (4xx/5xx) pages are shown as legitimate architecture nodes

**File:** `packages/report-model/src/build.ts:147-152, 195-207`
**Issue:** The crawler routes the full 400–599 range to `requestHandler` and
stores the error page's `body` as `html` (`crawl.ts:20, 109, 114-139`). So a
404/410/500 page that is linked from the site becomes a normal `byUrl` entry,
gets a BFS depth, and is emitted as a graph node — then rendered in the tree as a
real page (with its "404 Not Found" `<title>` as the card label). `build.ts`
applies no `statusCode` filter when building `nodesByDepth`, so the
"Arquitectura del sitio" view silently presents broken URLs as valid site
structure. This undermines the section's purpose (mapping real reachable
content) and can double-count a broken URL: linked 404s appear as depth nodes,
sitemap-only 404s appear as orphans (WR-01).
**Fix:** Carry `statusCode` into `ArchPageRow` and exclude non-2xx pages from the
architecture model (both the depth buckets and orphans), or filter them out at
graph-build time. Minimum: add `statusCode: true` to the `page.findMany` select
and skip nodes whose page has a `statusCode` outside 200–299 when building
`nodesByDepth`.

## Info

### IN-01: Redundant `audit.findUnique` — the audit row is fetched twice

**File:** `apps/web/app/audits/[id]/page.tsx:56-59` and `packages/report-model/src/build.ts:111-114`
**Issue:** `AuditReportPage` runs `prisma.audit.findUnique({ where:{id}, include:{site} })`,
then calls `buildReportModel(auditId)`, which issues the *same* query again.
Every completed-report render does two identical round-trips for the same row.
**Fix:** Either pass the already-loaded `audit` into `buildReportModel`, or have
the page rely solely on the model (the model already exposes `audit.domain`,
`finishedAt`, `urlLimit`, `status`) and drop the page-level query once the
`status !== "done"` branch is handled.

### IN-02: Unguarded `graph.depthByUrl` access relies on persisted-shape invariant

**File:** `packages/report-model/src/build.ts:122, 196`
**Issue:** `hasGraph` only checks `graph.nodes.length > 0`; it never verifies
`depthByUrl` exists. `graph.depthByUrl[node.url] ?? 0` throws
`Cannot read properties of undefined` if a persisted (or legacy/malformed)
`stats.graph` ever has `nodes` without `depthByUrl` — which would 500 the whole
report page rather than degrading. Safe today because the current builder always
writes all three keys together, but the `as unknown as AuditStats` cast gives no
runtime guarantee.
**Fix:** Include `depthByUrl` in the guard: `const hasGraph = !!graph && Array.isArray(graph.nodes) && graph.nodes.length > 0 && !!graph.depthByUrl;`

### IN-03: Title selector not scoped to `head > title`

**File:** `packages/crawler/src/crawl.ts:112`
**Issue:** `$("title").first().text().trim()` matches *any* `<title>` in the
document, including inline SVG `<title>` accessibility labels. In practice the
document `<head><title>` is virtually always first in source order so the risk is
low, but the selector expresses a looser intent than "the page title" and could
capture an icon's title on malformed markup.
**Fix:** Scope it: `$("head > title").first().text().trim() || null`.

### IN-04: Depth-bucket cast hides the "depth ≥ 0" assumption

**File:** `packages/report-model/src/build.ts:197`
**Issue:** `const bucket = depth >= 3 ? "3+" : (String(depth) as "0" | "1" | "2")`
would produce a key like `"-1"` for any negative/NaN depth, and
`nodesByDepth["-1"].push(...)` would then throw on `undefined`. Currently safe
because `depthByUrl` values are BFS integers ≥ 0, but the `as` cast silences the
compiler check that would otherwise flag it.
**Fix:** Clamp/validate explicitly, e.g. `const bucket = depth <= 0 ? "0" : depth === 1 ? "1" : depth === 2 ? "2" : "3+";` so out-of-range values fall into a defined bucket instead of crashing.

---

_Reviewed: 2026-07-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
