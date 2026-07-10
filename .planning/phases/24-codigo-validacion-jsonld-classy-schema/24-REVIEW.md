---
phase: 24-codigo-validacion-jsonld-classy-schema
reviewed: 2026-07-10T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - packages/checks/src/checks/schema/validateEntities.ts
  - packages/checks/src/checks/schema/validateEntities.test.ts
  - packages/checks/src/checks/schema/schemaValidate.ts
  - packages/checks/src/checks/schema/schemaEntityValidate.ts
  - packages/checks/src/checks/schema/schemaEntityValidate.test.ts
  - packages/checks/src/checks/schema/index.ts
  - packages/db/prisma/schema.prisma
  - packages/checks/src/registry.ts
  - apps/worker/src/index.ts
  - apps/web/app/components/SchemaEntities.tsx
  - apps/web/app/components/SchemaEntities.module.css
  - apps/web/app/audits/[id]/pages/[pageId]/page.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-07-10
**Depth:** standard
**Files Reviewed:** 12 (plus `packages/checks/src/validate.ts` and `packages/checks/src/checks/schema/danglingIds.ts` read for cross-reference, not modified this phase)
**Status:** issues_found

## Summary

Reviewed the pure validation engine (`validateEntities`), the SD-07 scoring check that wraps it, the `Page.schemaJson` persistence path (worker + registry), and the `SchemaEntities` UI panel + its wiring in the page-detail route. The core logic holds up: the engine is genuinely pure/deterministic, SD-07 never emits `critical` (verified by re-running the test suite, 16/16 green), the depth cap in `SchemaEntities.tsx` is applied correctly before recursing into both arrays and objects, and there's no `dangerouslySetInnerHTML`/`eval`/Playwright leak into the web bundle (confirmed against `assert-no-playwright-in-web.mjs` and `next.config.ts`'s `transpilePackages`). No blockers found. Three warnings worth fixing before this is considered fully closed: a live `CHECK_ID` collision left behind by retiring SD-04, unbounded breadth in the recursive property renderer (the declared T-24-06 mitigation only caps depth, not the number of entities/properties rendered per level), and an unconditional full-page-HTML fetch in the page-detail route that's only needed for the fallback path.

## Warnings

### WR-01: `CHECK_ID = "SD-04"` collision left dangling after retiring `schemaValidateCheck`

**File:** `packages/checks/src/checks/schema/schemaValidate.ts:5`, `packages/checks/src/checks/schema/danglingIds.ts:6`
**Issue:** `schemaValidateCheck` (no longer registered in `schemaPageChecks`, per `index.ts`) still hardcodes `CHECK_ID = "SD-04"` — but `danglingIdRefsCheck` (a *different*, still-registered site-level check in `schemaSiteChecks`) also hardcodes `CHECK_ID = "SD-04"`. Today this is silent because the two checks never run together in the same `IssueDraft` batch (`schemaValidateCheck` is dead in production), but the comment in `index.ts` explicitly says it's "kept exported for external consumers/tests" — meaning the collision is one accidental re-registration away (e.g. a future check that imports and re-adds `schemaValidateCheck` to any check array) from producing two unrelated checks emitting issues under the same `checkId`, breaking fingerprint-based diffing (`diffIssues`) and any UI/reporting that groups or displays by `checkId`.
**Fix:** Either delete `schemaValidateCheck`/`SCHEMA_RULES`'s per-property emission entirely (since SD-07 replaces it) or rename its `CHECK_ID` to something clearly retired (e.g. keep it but change the constant so it can never collide, or mark the export `@deprecated` and strip it from `index.ts`'s public re-exports so nothing outside its own test file can reach it). Minimal fix:
```ts
// schemaValidate.ts
const CHECK_ID = "SD-04-legacy"; // retired; do not re-register — collides with danglingIds.ts's SD-04
```

### WR-02: Recursive property tree has no breadth cap — only depth is bounded (partial T-24-06 mitigation)

**File:** `apps/web/app/components/SchemaEntities.tsx:65-79` (array branch of `PropertyValue`), `apps/web/app/components/SchemaEntities.tsx:108-139` (`PropertyRows`)
**Issue:** The threat model (24-03-PLAN.md, T-24-06) claims DoS mitigation via a depth cap, and the depth cap itself is implemented correctly. However, nothing caps the *number* of entities, properties, or array items rendered at each level. A page whose crawled HTML embeds a JSON-LD array with, say, 50,000 primitive strings (`allPrimitive` branch, `SchemaEntities.tsx:69-70`) or 50,000 nested objects at the same depth level will still fully map/join/render all of them synchronously in the React tree — the `depth >= MAX_DEPTH` guard never triggers because the objects never get deep enough, only wide. Since `Page.html`/`Page.schemaJson` content is untrusted third-party crawl output (not authored by the operator), this leaves a real (if narrow) resource-exhaustion vector on a public server component render, which the declared threat disposition ("mitigate") doesn't actually cover for the breadth dimension.
**Fix:** Cap the number of rendered items per level (e.g. show first N properties/array items and a "+K more" indicator, falling back to `<pre>{JSON.stringify(...)}</pre>` beyond the cap), mirroring the existing depth-cap pattern:
```ts
const MAX_ITEMS_PER_LEVEL = 50;
// in PropertyRows / the array-mapping branch of PropertyValue:
const visible = keys.slice(0, MAX_ITEMS_PER_LEVEL);
const overflow = keys.length - visible.length;
// render visible, then `+${overflow} más` if overflow > 0
```

### WR-03: Page detail route always fetches full `Page.html` even when `schemaJson` already covers the data

**File:** `apps/web/app/audits/[id]/pages/[pageId]/page.tsx:47-58` (`select`), `page.tsx:30-38` (`buildEntities`)
**Issue:** The `select` unconditionally includes `html: true` (a `@db.Text` column that can hold the full crawled HTML of the page, potentially hundreds of KB), even though `html` is only read as a fallback when `schemaJson` is `null` (old audits). For every audit created after Plan 24-02 shipped, `schemaJson` will be populated, making the `html` fetch dead weight on every single page-detail render — unnecessary DB I/O and payload size on a hot path (server component render), and needlessly widens what's pulled into the Next.js server runtime for a route that previously didn't select `html` at all.
**Fix:** Select `html` conditionally, or do a cheap first query to check `schemaJson` before deciding whether a second query for `html` is needed; simplest fix given Prisma's single-round-trip model — keep the field but only use/keep it referenced when actually null and accept as a known trade-off, OR:
```ts
const page = await prisma.page.findFirst({
  where: { id: pageId, auditId },
  select: { id: true, url: true, finalUrl: true, statusCode: true, schemaGraph: true, schemaJson: true },
});
if (!page) notFound();
let entities = buildEntities(page.schemaJson, null);
if (entities.length === 0 && page.schemaJson === null) {
  const withHtml = await prisma.page.findFirst({ where: { id: pageId }, select: { html: true } });
  entities = buildEntities(null, withHtml?.html ?? null);
}
```

## Info

### IN-01: Duplicate anti-pattern/type names not de-duplicated in SD-07's summary message

**File:** `packages/checks/src/checks/schema/schemaEntityValidate.ts:44`
**Issue:** `flagged.map((r) => r.type).filter(Boolean).join(", ")` does not dedupe — if three `Article` entities on a page all have warnings, the `measuredValue`/message will read `"Article, Article, Article"`.
**Fix:** `[...new Set(flagged.map((r) => r.type).filter(Boolean))].join(", ")`.

### IN-02: Unbounded `recommendation` string built from all flagged entities' messages

**File:** `packages/checks/src/checks/schema/schemaEntityValidate.ts:46-48`
**Issue:** `detalle` concatenates every issue message across every flagged entity with no cap. On a page with many entities/issues this produces a very long single-line `recommendation` string persisted to `Issue.recommendation`. Not a correctness bug (column is presumably `Text`), but hurts UI readability and log/DB row size for pathological pages.
**Fix:** Cap to first N messages plus a "y N más" suffix, consistent with how other checks in this package summarize multi-item findings.

### IN-03: Array index used as React `key` for entity list

**File:** `apps/web/app/components/SchemaEntities.tsx:208-210`
**Issue:** `entities.map((entity, i) => <EntityCard key={i} ... />)` uses the array index as key. Low risk here because the list is server-rendered once per page load from a stable order and never reordered/filtered client-side, but it's a recognized React anti-pattern that could bite if this component is later reused somewhere with client-side filtering/sorting.
**Fix:** Key by a stable identifier when available, e.g. `entity["@id"] as string ?? i`, falling back to index only when no `@id` exists.

---

_Reviewed: 2026-07-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
