---
phase: 4
plan: 1
subsystem: checks (schema + aeo), db, web
tags: [structured-data, json-ld, schema.org, aeo, entity-graph]
requires: [Phase 2 (Page.html), Phase 3 (@auditor/checks framework)]
provides: [SD-01, SD-02, SD-03, SD-04, SD-05, AEO-01, AEO-02, AEO-03, AEO-04, Page.schemaGraph, entity-graph UI]
affects: [apps/worker post-crawl checks, apps/web audit report]
tech-stack:
  added: [robots-parser (in @auditor/checks, already used in @auditor/crawler)]
  patterns: [PageCheck/SiteCheck/NetworkCheck registry pattern (Phase 3), self-contained SVG rendering (no CDN, CSP-safe)]
key-files:
  created:
    - packages/checks/src/checks/schema/extract.ts
    - packages/checks/src/checks/schema/jsonldPresence.ts
    - packages/checks/src/checks/schema/jsonldValidity.ts
    - packages/checks/src/checks/schema/schemaTypes.ts
    - packages/checks/src/checks/schema/schemaValidate.ts
    - packages/checks/src/checks/schema/entityGraph.ts
    - packages/checks/src/checks/schema/index.ts
    - packages/checks/src/checks/aeo/aiCrawlers.ts
    - packages/checks/src/checks/aeo/llmsTxt.ts
    - packages/checks/src/checks/aeo/aiStructuredData.ts
    - packages/checks/src/checks/aeo/contentFormat.ts
    - packages/checks/src/checks/aeo/index.ts
    - apps/web/app/api/audits/[id]/pages/route.ts
    - apps/web/app/audits/[id]/pages/page.tsx
    - apps/web/app/audits/[id]/pages/[pageId]/page.tsx
    - apps/web/app/components/EntityGraphSvg.tsx
    - unit tests: extract.test.ts, jsonldValidity.test.ts, schemaValidate.test.ts, entityGraph.test.ts, aiCrawlers.test.ts, contentFormat.test.ts
  modified:
    - packages/db/prisma/schema.prisma (Page.schemaGraph Json?)
    - packages/checks/src/registry.ts (new families registered, runAllChecks returns { issues, pageSchemaGraphs })
    - packages/checks/src/index.ts (re-exports)
    - packages/checks/package.json (robots-parser dependency)
    - apps/worker/src/index.ts (persist schemaGraph per page, consume new runAllChecks shape)
    - apps/web/package.json (@auditor/checks dependency, type-only usage)
    - apps/web/app/page.tsx (link to /audits/[id]/pages when done)
decisions:
  - "Entity graph persisted as Page.schemaGraph Json (not a separate table) — v1 scope is per-page, no cross-page graph needed yet."
  - "SD-04 uses a local pragmatic SCHEMA_RULES map (Classy Schema style) covering 11 common types + generic @id/sameAs handling; not an exhaustive schema.org vocabulary validator (documented as extensible)."
  - "AEO-01 reuses the site-level robotsTxt already fetched by the worker (no extra network call); AEO-02 (llms.txt) is a NetworkCheck since it needs its own fetch."
  - "sameAs targets that aren't local JSON-LD @id's are rendered as 'External' leaf nodes in the entity graph so the visualization shows real connections instead of dangling edges."
  - "Entity graph SVG uses a simple deterministic circular layout (no force-simulation library) to stay dependency-free and CSP-safe."
metrics:
  duration: single session
  completed: 2026-07-05
---

# Phase 4 Plan 1: Datos Estructurados + AEO Summary

JSON-LD structured-data validation (Classy Schema style) + per-page entity-graph visualization + AEO (AI-crawler/AEO) checks, following the existing PageCheck/SiteCheck/NetworkCheck registry pattern from Phase 3.

## What was built

### `packages/checks/src/checks/schema/` (SD-01..05)

- **`extract.ts`** — shared low-level parsing: `extractJsonLdBlocks($)` pulls every `<script type="application/ld+json">` block (capturing parse errors instead of throwing), `flattenNodes(blocks)` flattens top-level arrays and `@graph` arrays into a flat entity list. Also exports `typesOf()`/`hasProp()` helpers reused by schemaValidate, schemaTypes and the AEO checks.
- **`jsonldPresence.ts` (SD-01)** — page-level: warns if zero JSON-LD blocks found, otherwise ok with block count.
- **`jsonldValidity.ts` (SD-02)** — page-level: critical if any block fails `JSON.parse`, reporting the block index + parser error message.
- **`schemaTypes.ts` (SD-03)** — page-level: classifies detected `@type`s (with counts) and flags which ones are on a "high-impact" list (Organization, Article, FAQPage, Product, etc.) for rich-result/AEO eligibility.
- **`schemaValidate.ts` (SD-04, Classy Schema style)** — the semantic validator. A local `SCHEMA_RULES: Record<string, {required, recommended}>` map covers Organization, WebSite, WebPage, FAQPage, Person, Article, BlogPosting, ProfessionalService, BreadcrumbList, Product, Offer. For every node matching a known `@type`: missing `required` props → critical issue; missing `recommended` props → warning. Separately, walks every node's properties for `{ "@id": "..." }` reference objects and flags any `@id` that isn't defined as a node anywhere on the page ("dangling reference", warning). Fully offline — no network calls, no external schema.org vocabulary fetch.
- **`entityGraph.ts` (SD-05)** — `buildEntityGraph(nodes)` builds `{ nodes: [{id,type,label}], edges: [{from,to,rel}] }`: nodes are keyed by `@id` (or a synthetic `#Type-index` id when absent); edges come from (a) any property whose value is a resolvable `{"@id": ...}` reference, and (b) `sameAs` values — which also spawn an "External" leaf node (labeled by URL) so social/other-domain connections are visible instead of silently dropped. `computeSchemaGraph($)` composes extract+flatten+build for a page's HTML and returns `null` when there's no JSON-LD (nothing to persist). The `entityGraphCheck` PageCheck emits an informational `ok` issue with node/edge counts.

### `packages/checks/src/checks/aeo/` (AEO-01..04)

- **`aiCrawlers.ts` (AEO-01, SiteCheck)** — parses the already-fetched `robotsTxt` string (via `robots-parser`, no extra network call) for 9 AI user-agents (GPTBot, ChatGPT-User, ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended, CCBot, Bytespider, Applebot-Extended). Reports allowed/blocked bots; blocked is `warning` (informational — may be intentional).
- **`llmsTxt.ts` (AEO-02, NetworkCheck)** — fetches `/llms.txt` and `/llms-full.txt` (own fetch, 8s timeout). Absence → `warning` (explicitly low weight per the research note: near-zero AI crawler traffic on sites that publish it). Presence → `ok`, checks for Markdown heading structure.
- **`aiStructuredData.ts` (AEO-03, PageCheck)** — reuses `schema/extract`: flags FAQPage without `mainEntity`, Article/BlogPosting missing `headline`/`author`/`datePublished`, and Organization/Person missing `sameAs`. `ok` when no gaps, `warning` otherwise.
- **`contentFormat.ts` (AEO-04, PageCheck)** — counts H2/H3 phrased as questions (ends with `?` or starts with an interrogative word, ES+EN), counts lists/tables, computes average paragraph word length. `ok` when there's at least one extractable structure (question heading, list or table) and paragraphs average ≤150 words.

### Registry + worker

- `registry.ts`: new families registered alongside onpage/tech (`schemaPageChecks`, `aeoPageChecks` → `pageChecks`; `aeoSiteChecks` → `siteChecks`; `aeoNetworkChecks` → `networkChecks`). `runAllChecks()` now returns `{ issues, pageSchemaGraphs }` — `pageSchemaGraphs` is a `Map<pageId, EntityGraph>` computed once per page alongside the existing check pass (no extra HTML re-parse).
- `apps/worker/src/index.ts`: consumes the new return shape; after the idempotent Issue wipe+recreate, persists each page's graph via `prisma.page.update({ schemaGraph })` (only pages with JSON-LD get an update). The lockDuration fix from Phase 3 is untouched; worker still has no Next.js imports.
- Issue counts by category (including the new `schema`/`aeo` categories) are already covered by `apps/web/app/api/audits/[id]/route.ts`'s existing generic `groupBy(["category","severity"])` — no change needed there, it picks up new categories automatically.

### Web — entity graph visualization

- `apps/web/app/components/EntityGraphSvg.tsx` — self-contained inline SVG (no CDN, no external graph library — CSP-safe). Deterministic circular layout: nodes placed evenly around a circle sized to fit ~10-15 entities comfortably, colored by `@type`, labeled with type + truncated name; edges are lines with a small `rel` label at the midpoint and an arrowhead marker.
- `GET /api/audits/[id]/pages` — lists crawled pages with a JSON-LD presence indicator (node/edge counts from `Page.schemaGraph`).
- `app/audits/[id]/pages/page.tsx` — page list linking to each page's detail.
- `app/audits/[id]/pages/[pageId]/page.tsx` — server component rendering the entity graph + that page's schema/aeo issues (severity-colored list with measured value + recommendation).
- Home page (`app/page.tsx`) links to `/audits/[id]/pages` once an audit reaches `done`.

## How schema validation + entity graph work (quick reference)

1. Worker crawls pages (Phase 2), persists `Page.html`.
2. `runAllChecks` re-parses each page's HTML with cheerio once, runs every registered PageCheck (including the 5 schema + 2 aeo page checks) against it, and separately calls `computeSchemaGraph($)` to build that page's entity graph.
3. SD-04 validation and SD-05 graph-building both start from the same `extractJsonLdBlocks` → `flattenNodes` pipeline, so they see identical entities.
4. The graph is a plain `{nodes, edges}` JSON object; the worker persists it to `Page.schemaGraph` (Prisma `Json?`).
5. The web app reads that column directly (no re-parsing) and renders it as SVG.

## Deviations from Plan

### Auto-fixed / discretionary (Rule 2 / Claude's Discretion per CONTEXT.md)

**1. [Discretion] SVG layout algorithm** — CONTEXT.md left the graph library choice to Claude's discretion, explicitly ruling out external/CDN dependencies (CSP). Implemented a deterministic circular layout instead of a force-directed simulation — no extra dependency, fully server-renderable, sufficient for the expected small per-page entity counts (juan-tech.com reference has 6 JSON-LD blocks).

**2. [Discretion] sameAs → External nodes** — the plan describes edges "from properties that reference entities" plus `sameAs`; `sameAs` values are almost always external URLs (social profiles), not local `@id`s. To make those connections visible in the graph (rather than silently dropping them, which would make Organization↔Person `sameAs` links invisible), external sameAs targets are added as lightweight "External" leaf nodes.

**3. [Rule 3 - blocking] `runAllChecks` return-shape change** — persisting the entity graph per page required the registry to hand the graphs back to the worker. Changed `runAllChecks` from returning `IssueDraft[]` to `{ issues, pageSchemaGraphs }`. Only consumer was `apps/worker/src/index.ts`, updated accordingly; no other call sites existed.

**4. [Rule 3 - blocking] Prisma JSON type cast** — `EntityGraph` (a plain interface) isn't structurally assignable to Prisma's `InputJsonValue` (which requires an index signature). Cast with `as unknown as Prisma.InputJsonValue` at the single write site in the worker.

None of these required schema/architecture decisions beyond what CONTEXT.md already delegated to discretion.

## How to verify live (orchestrator)

1. Run a live audit against `https://juan-tech.com` (worker must be running, `.env` has real `DATABASE_URL`/`REDIS_URL`).
2. Confirm the worker log shows `issues=...` including `schema`/`aeo` categories.
3. `GET /api/audits/[id]` → `issuesByCategory.schema` and `issuesByCategory.aeo` should be present.
4. Visit `/audits/[id]/pages` → the homepage should show 1 entity-graph-bearing page (or however many pages carry JSON-LD) with a non-zero "entidad(es) JSON-LD" count.
5. Visit that page's detail route → should render 6 nodes (Organization, WebSite, FAQPage, Person, ProfessionalService, ItemList) with `sameAs`/`@id` edges connecting Organization↔Person↔ProfessionalService, no critical schemaValidate issues (reference site is described as "100/100" / all valid), AEO: llms.txt absent (warning, low severity), AI crawlers allowed (ok), content format ok.

## Known Stubs

None — every check produces real issues from real page HTML; the entity graph is built from real JSON-LD data, no mock/placeholder data paths.

## Threat Flags

None — no new network surface beyond what CONTEXT.md scoped (llms.txt fetch + robots.txt, both already same-origin-ish outbound fetches consistent with Phase 2/3 patterns; both timeout-bounded and best-effort/non-throwing).

## Self-Check: PASSED

- All 15 created/modified files verified present on disk.
- `pnpm --filter @auditor/checks test`: 15 test files, 59 tests passed.
- `pnpm -r typecheck`: all 6 packages/apps pass.
- `pnpm -r build`: all packages/apps build successfully.
- `prisma db push` + `generate` applied `Page.schemaGraph` to the live Neon database.

