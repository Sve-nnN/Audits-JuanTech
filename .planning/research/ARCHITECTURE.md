# Architecture Research

**Domain:** Tech-stack fingerprinting + CMS-personalized fix recommendations, integrated into an existing Crawlee + BullMQ + Prisma audit pipeline (monorepo pnpm/Turborepo)
**Researched:** 2026-07-21
**Confidence:** HIGH (codebase-derived: read `packages/db/prisma/schema.prisma`, `apps/worker/src/index.ts`, `packages/crawler/src/crawl.ts`, `packages/checks/src/{types,registry}.ts`, `packages/report-model/src/{model,build}.ts`. MEDIUM on the specific fingerprint signature list, cross-checked against Wappalyzer's published detection methodology.)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│  apps/worker (Railway container, BullMQ Worker, processAuditJob)         │
│                                                                            │
│  resolveCanonicalUrl → runCrawl (Crawlee) → Page[] persisted (+headers)  │
│                              │                                            │
│                              ▼                                           │
│              prisma.page.findMany({ auditId })  ── same Page[] reused ── │
│                for: buildLinkGraph · runRenderSample · runAllChecks       │
│                     ▼                          ▼                         │
│         ┌─────────────────────┐   ┌─────────────────────────────┐        │
│         │ @auditor/fingerprint │   │ @auditor/checks (unchanged) │        │
│         │  detectStack(pages)  │   │  runAllChecks → IssueDraft[]│        │
│         │  → DetectedStack     │   │  (checkId + generic rec.)   │        │
│         └──────────┬───────────┘   └──────────────┬───────────────┘        │
│                    │                               │                      │
│                    ▼                               ▼                      │
│         Audit.stack (new Json col)        Issue rows (schema unchanged)   │
└──────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  packages/report-model (buildReportModel — single source of truth)       │
│                                                                            │
│   audit.stack (Json) ──► DetectedStack ──► ReportModel.stack             │
│                               │                                          │
│                               ▼                                          │
│                  @auditor/cms-adapters.resolveCmsRecommendation(         │
│                     stack, issue.checkId, issue.recommendation )         │
│                               │                                          │
│                               ▼                                          │
│              ReportIssue.recommendation ← personalized-or-generic text   │
└──────────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴────────────────┐
              ▼                                ▼
   apps/web report route                packages/export
   <StackTable stack={model.stack}/>    (PDF/Markdown/PPTX — reads the
   IssuesTable (recommendation already  same ReportModel; needs its own
   personalized, zero extra plumbing)   stack-table section added)
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|-----------------|-------------------------|
| `packages/fingerprint` (**new**) | Detect CMS, page-builder, CDN/proxy, hosting/server, JS framework, analytics — from already-crawled `Page.html` + `Page.responseHeaders`. Pure, sync, no network calls. | Signal-registry of small rule objects (regex/substring on HTML + header lookups), scored per independent axis, run once over the full `Page[]` array after the crawl completes. |
| `packages/cms-adapters` (**new**) | Map `(checkId, DetectedStack.cms)` → a CMS-specific fix instruction; fall back to the check's existing generic `recommendation` when no adapter or no per-check entry exists. | One module per platform (`wordpress/`, `shopify/`, `webflow/`, `wix-squarespace/`) exporting a `Record<checkId, string>` lookup table, aggregated into a registry + `resolveCmsRecommendation()`. |
| `packages/crawler` (**modified**) | Capture a small allowlisted subset of response headers per crawled page (already has `response` in hand during `requestHandler` — no new requests). | Extend `Page.create/update` payload in `crawl.ts` with `responseHeaders: pickHeaders(response.headers)`. |
| `packages/db` (**modified**) | Persist `Page.responseHeaders Json?` and `Audit.stack Json?` — both additive/nullable, same pattern as existing `schemaGraph`/`schemaJson`/`scores`/`stats`. | Prisma migration, no backfill (old rows simply have `null`, UI degrades gracefully — same precedent as `Audit.resolvedUrl`). |
| `apps/worker` (**modified**) | Call `detectStack(pages, origin)` once per audit, right after the crawl's `Page[]` load (same array already used for `buildLinkGraph`/`runAllChecks`); persist the result on `Audit.stack` in the existing final `prisma.audit.update`. | One extra sync function call + one extra field in an update payload that already exists — no new DB round-trip, no new BullMQ sub-job. |
| `packages/report-model` (**modified**) | Parse `Audit.stack`, expose it as `ReportModel.stack`; resolve each `ReportIssue.recommendation` through `@auditor/cms-adapters` before returning it. | `buildReportModel()` gains one parse + one map-over-issues call; `ReportModel`/`ReportIssue` gain one field each. |
| `apps/web` (**modified**) | Render a `StackTable` at the top of the report (right after/alongside the score gauge); everything else in the report (IssuesTable, exports) already reads `ReportIssue.recommendation`, so personalization needs zero extra wiring there. | New tokens-only component, same pattern as `CategoryCard`/`Badge`. |
| `packages/export` (**optional, flag as follow-up**) | Add a stack-table section to PDF/Markdown/PPTX so the personalized report is complete outside the browser too. | Reads `ReportModel.stack` the same way `apps/web` does; recommendation text is already personalized for free. |

## Recommended Project Structure

```
packages/
├── fingerprint/                  # NEW — pure detection, zero platform coupling
│   ├── src/
│   │   ├── types.ts              # DetectedStack, StackAxis, Evidence, FingerprintInput
│   │   ├── rules/
│   │   │   ├── cms.ts            # WordPress/Shopify/Webflow/Wix/Squarespace/Drupal/…
│   │   │   ├── cdn.ts            # Cloudflare/Vercel/CloudFront/Fastly/Akamai
│   │   │   ├── hosting.ts        # Server header heuristics (nginx/Apache/LiteSpeed/…)
│   │   │   ├── jsFramework.ts    # Next.js/__NEXT_DATA__, React, Vue data-v-*, Nuxt
│   │   │   └── analytics.ts      # GA4/GTM/Meta Pixel/Hotjar/Segment
│   │   ├── detectStack.ts        # orchestrator: scores each axis independently
│   │   └── index.ts
│   └── package.json              # deps: cheerio only — no @auditor/db, no network
├── cms-adapters/                 # NEW — recommendation resolution, zero check coupling
│   ├── src/
│   │   ├── types.ts              # CmsAdapter, CmsPlatform (re-exported from fingerprint, type-only)
│   │   ├── wordpress/{onpage,tech,schema}.ts
│   │   ├── shopify/{onpage,tech,schema}.ts
│   │   ├── webflow/{onpage,tech,schema}.ts
│   │   ├── wix-squarespace/{onpage,tech,schema}.ts
│   │   ├── registry.ts           # Record<CmsPlatform, CmsAdapter | undefined>
│   │   ├── resolveCmsRecommendation.ts
│   │   └── index.ts
│   └── package.json              # deps: @auditor/fingerprint (type-only import)
├── checks/                        # UNCHANGED — never imports fingerprint or cms-adapters
├── crawler/
│   └── src/crawl.ts              # MODIFIED — + pickHeaders(), + Page.responseHeaders
├── db/
│   └── prisma/schema.prisma      # MODIFIED — + Page.responseHeaders, + Audit.stack
└── report-model/
    └── src/build.ts              # MODIFIED — + stack parse, + resolveCmsRecommendation call

apps/
├── worker/src/index.ts           # MODIFIED — + detectStack() call, + Audit.stack persist
└── web/app/
    ├── audits/[id]/page.tsx      # MODIFIED — renders <StackTable/>
    └── components/ui/
        ├── StackTable.tsx        # NEW
        └── StackTable.module.css # NEW — tokens-only, mirrors CategoryCard/Badge
```

### Structure Rationale

- **`packages/fingerprint` has zero dependency on `@auditor/db`, `@auditor/crawler` or `@auditor/checks`.** It accepts a locally-declared minimal input type (`{ url, html, responseHeaders }[]`), exactly mirroring how `packages/checks/src/types.ts` already redeclares `RenderVerdictValue` locally instead of importing `@auditor/render` — the codebase already has this "don't pull in a sibling package just for a type" convention; fingerprint should follow it too, and additionally must stay import-free of anything platform-specific.
- **`packages/cms-adapters` imports only a *type* from `@auditor/fingerprint`**, never a runtime function. It has no dependency on `@auditor/checks` in either direction — the adapter registry is keyed by the plain `checkId` string (`"ONPAGE-04"`, `"TECH-04"`, …) that is already a stable, persisted field on every `Issue` row. This is what satisfies "sin acoplar `packages/checks` a paquetes de plataformas específicas": the coupling point is a string key, not an import.
- **One adapter module per platform, one file per check-category inside it** (`onpage.ts`/`tech.ts`/`schema.ts`), mirroring `packages/checks/src/checks/{onpage,tech,schema}/` — same mental model for whoever maintains both sides, and matches the milestone's explicit scope ("cobertura … en on-page, SEO técnico y datos estructurados").
- **`wix` and `squarespace` are two distinct `CmsPlatform` detection values** (for accurate on-screen labeling — Juan will see "Wix" or "Squarespace", not a merged label) **but both route to the same `wix-squarespace` adapter module** in the registry, matching the milestone's own grouping of the two under one adapter target.

## Architectural Patterns

### Pattern 1: Compute-once-and-thread-through (already established, reused verbatim)

**What:** A derived artifact that costs real CPU/IO is computed exactly once per audit, right after the crawl, from the already-persisted `Page[]` array — never per-check, never per-request.
**When to use:** Any cross-page analysis a check battery would otherwise redundantly recompute. The codebase already does this twice: `buildLinkGraph` (BFS depth, Phase 16) and `runRenderSample` (SSR/CSR verdict, Phase 12) are both computed once in `apps/worker/src/index.ts` and passed into `runAllChecks` via `SiteCheckCtx`.
**Trade-offs:** Requires the worker to hold the full `Page[]` in memory once more (already does, for the checks pass) — no extra Postgres round-trip. Con: the worker function grows another local variable/step; acceptable given the existing precedent already has three (`graph`, `renderVerdictByPageId`, and now `detectedStack`).

**Example:**
```typescript
// apps/worker/src/index.ts — inserted right after `pages` loads, alongside
// the existing buildLinkGraph call. Sync, no I/O — reuses Page.html/headers
// that the crawl already fetched. Runs once, not per check, not per page.
const detectedStack: DetectedStack = detectStack(
  pages.map((p) => ({
    url: p.finalUrl ?? p.url,
    html: p.html,
    responseHeaders: p.responseHeaders as Record<string, string> | null,
  })),
  origin
);
```

### Pattern 2: Independent-axis detection, not a single mutually-exclusive winner

**What:** `DetectedStack` is a struct with independent fields (`cms`, `builder`, `cdn`, `hosting`, `jsFramework`, `analytics: string[]`), each resolved by its own rule set. A WordPress+Elementor site behind Cloudflare using Google Analytics is a completely normal, simultaneous result across four axes — it is never "first matching rule wins and stops everything else."
**When to use:** Any fingerprinting/technology-detection problem where categories aren't mutually exclusive (this is exactly how Wappalyzer's own rule categories work — CMS, CDN, analytics, and JS framework are separate buckets evaluated independently).
**Trade-offs:** Slightly more code (one rule module per axis) than a flat "first CMS pattern that matches, return it" chain, but avoids the real failure mode of the naive approach: a Cloudflare-fronted WordPress site would otherwise risk the CDN signal (which is often the *strongest, most unambiguous* signal — `cf-ray` header) clobbering or preventing the CMS signal from being evaluated at all.

**Example:**
```typescript
// packages/fingerprint/src/types.ts
export type CmsPlatform = "wordpress" | "shopify" | "webflow" | "wix" | "squarespace" | "unknown";

export interface DetectedStack {
  cms: { platform: CmsPlatform; confidence: "high" | "medium" | "low"; builder?: string | null };
  cdn: { name: string; confidence: "high" | "medium" | "low" } | null;
  hosting: { server: string | null } | null;
  jsFramework: { name: string; confidence: "high" | "medium" | "low" } | null;
  analytics: string[]; // e.g. ["Google Analytics 4", "Meta Pixel"]
}
```

### Pattern 3: Recommendation resolution is a report-time concern, not a persist-time one

**What:** `Issue.recommendation` (the generic text a check already emits, e.g. ONPAGE-04's `"Agrega el atributo alt descriptivo a esta imagen."`) is **never rewritten in the database**. `packages/report-model` resolves the CMS-specific variant lazily, at `buildReportModel()` time, by calling `resolveCmsRecommendation(stack, issue.checkId, issue.recommendation)` and putting the result into `ReportIssue.recommendation`.
**When to use:** Whenever personalization logic might change independently of the underlying detection (you'll want to tweak WordPress wording without re-running any audit) and whenever the same personalization needs to reach multiple consumers (on-screen report + PDF/Markdown/PPTX exports) that already read a single shared model (`ReportModel`/`ReportIssue`) — matches the existing v1.2 decision "`buildReportModel` as single source of truth (report UI + exports + grouping)."
**Trade-offs:** Adds a small amount of work to every `buildReportModel()` call (bounded — it's a map lookup per issue, not I/O). The alternative (persisting the resolved text at worker-run time) would require re-running the whole audit just to fix a typo in a WordPress instruction, and would silently diverge for old `Issue` rows saved under an older wording — resolving at read time avoids both problems.

**Example:**
```typescript
// packages/report-model/src/build.ts — inside toReportIssue(), given `stack`
// already parsed from audit.stack earlier in buildReportModel()
function toReportIssue(issue: IssueRow, stack: DetectedStack | null): ReportIssue {
  const resolved = resolveCmsRecommendation(stack, issue.checkId, issue.recommendation);
  return {
    ...,
    recommendation: resolved.text,      // CMS-specific text, or the original generic one
    recommendationSource: resolved.source, // "cms" | "generic" — lets the UI show a small badge
  };
}
```

## Data Flow

### Request Flow (fingerprinting + personalized recommendations)

```
runCrawl() persists Page rows (html + NEW responseHeaders)
    ↓
apps/worker loads Page[] once (already does, for checks/graph/render)
    ↓
detectStack(pages, origin)  →  DetectedStack (sync, in-memory, no I/O)
    ↓
prisma.audit.update({ data: { stack: detectedStack, ...existing fields } })
    ↓ (report request, later)
buildReportModel(auditId): reads audit.stack + Issue rows
    ↓
resolveCmsRecommendation(stack, issue.checkId, issue.recommendation) per issue
    ↓
ReportModel { stack, priorityIssues[with personalized recommendation], ... }
    ↓
apps/web renders <StackTable> + <IssuesTable> (recommendation already resolved)
packages/export renders PDF/Markdown/PPTX from the SAME ReportModel
```

### Key Data Flows

1. **Detection flow:** Crawl → `Page.html`/`Page.responseHeaders` (already fetched, zero extra requests) → one `detectStack()` call per audit → `Audit.stack` (new Json column). Never touches `packages/checks`.
2. **Personalization flow:** `Issue.checkId` (already persisted, unchanged) + `Audit.stack` (read at report-build time) → `packages/cms-adapters` lookup → `ReportIssue.recommendation` (resolved, never persisted back to `Issue`).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (free tier, ≤500 URLs/audit) | `detectStack` scans all crawled pages in memory — negligible cost (string/regex over already-loaded HTML, no new network or DB round-trip). Fine as-is. |
| More CMS platforms added later | Pure Open/Closed growth: one new rule file in `packages/fingerprint/src/rules/cms.ts` + one new adapter module in `packages/cms-adapters/src/<platform>/`, registered in the two registries. No change to `packages/checks`, `apps/worker` orchestration, or `report-model`'s call site. |
| Cross-audit analytics (e.g. "% of audits that are WordPress") | `Audit.stack` as Json is queryable via Postgres JSON operators / Prisma's `path`/`equals` filters for light aggregate queries. If heavier reporting emerges (dashboards, filtering audits by CMS at scale), promote to a normalized `Stack` table — the `ReportModel.stack` shape stays the same, so this migration is invisible to `apps/web`/`packages/export`. |

### Scaling Priorities

1. **First likely friction:** wording/coverage of adapter lookup tables (needs real content authoring per checkId, not an engineering bottleneck) — not a performance concern.
2. **Second:** if fingerprint rules grow to dozens of signals per axis, consider a small scoring threshold config instead of ad-hoc booleans, but this is a content/tuning concern, not a structural one — the `rules/*.ts` file-per-axis structure already scales to that.

## Anti-Patterns

### Anti-Pattern 1: Coupling `packages/checks` to CMS knowledge

**What people do:** Add `if (stack.cms === "wordpress") { recommendation = "..." }` directly inside a check file (e.g. inside `altText.ts`), because "it's right there and the check already knows the issue."
**Why it's wrong:** Violates the explicit constraint of this milestone, makes `packages/checks` depend on a platform-specific package (breaking its current zero-platform-dependency status, verified by the existing convention of redeclaring types rather than importing sibling packages), and means every future CMS addition requires touching every check file instead of adding one adapter module.
**Instead:** Checks keep emitting exactly what they emit today (generic `recommendation` + stable `checkId`). Resolution happens once, downstream, in `packages/report-model`, via `packages/cms-adapters`.

### Anti-Pattern 2: Per-page/per-request fingerprinting inside the Crawlee `requestHandler`

**What people do:** Try to detect the CMS incrementally, request-by-request, inside `packages/crawler`'s `requestHandler` (since "cookies and paths are visible right there").
**Why it's wrong:** Couples the generic, reusable crawling engine (`packages/crawler`) to CMS-detection knowledge it has no business knowing about, and buys no real performance benefit — Crawlee already fetches and stores every page's HTML regardless; a post-crawl scan over the same in-memory/DB data costs nothing extra a per-request hook would have saved.
**Instead:** `packages/crawler` only captures raw signal (an allowlisted header subset), nothing more. All interpretation (turning headers/HTML into "this is Shopify") lives in `packages/fingerprint`, run once after the crawl.

### Anti-Pattern 3: Winner-take-all technology detection

**What people do:** Build a single ordered rule chain ("check WordPress markers, else Shopify markers, else Webflow markers, else …, first match wins") and store one flat `stack: string` value.
**Why it's wrong:** CDN, hosting, CMS, JS framework and analytics are independent facts that regularly co-occur (a WordPress site is very often *also* behind Cloudflare *and* using GA4). A single winner-take-all match either mislabels the CDN as the CMS or silently drops information the report table is supposed to show.
**Instead:** Score each axis (`cms`, `cdn`, `hosting`, `jsFramework`, `analytics`) independently (Pattern 2 above); only the `cms` axis feeds `packages/cms-adapters`' single-adapter-per-issue selection, because fix instructions genuinely are platform-exclusive (you don't show WordPress AND Shopify instructions for the same issue).

### Anti-Pattern 4: Persisting raw cookie values for fingerprinting

**What people do:** Store the full `Set-Cookie` header value (e.g. `wordpress_logged_in_abc123=<session-hash>; …`) because "the cookie name tells you the CMS."
**Why it's wrong:** Session/auth cookie values are exactly the kind of data the project's own deploy checklist flags for GDPR review; storing them serves no fingerprinting purpose (only the cookie *name* is a useful signal) and creates an unnecessary PII/security liability in `Page.responseHeaders`.
**Instead:** When capturing `Set-Cookie`, extract and persist only the cookie **names** (split on the first `=`), never the value.

## Integration Points

### External Services

None new. Fingerprinting is derived entirely from data the crawl already fetches — no new PSI/Lighthouse/third-party calls, matching the milestone's own constraint ("vía fingerprint propio … sin servicios pagos de terceros").

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|----------------|-------|
| `packages/crawler` → `packages/db` | Direct Prisma write (`Page.responseHeaders`) | Additive column; requires the `packages/db` migration to land first (build-order dependency). |
| `apps/worker` → `packages/fingerprint` | Direct function call, sync, in-process | No BullMQ sub-job needed — this is cheap post-processing, not a separate long-running task; keep it inside the same `crawlAndCheck()` closure that already runs `buildLinkGraph`/`runAllChecks`. |
| `apps/worker` → `packages/db` | Direct Prisma write (`Audit.stack`) | Folded into the existing final `prisma.audit.update` call — zero extra round-trips. |
| `packages/report-model` → `packages/cms-adapters` | Direct function call, sync, in-process | `resolveCmsRecommendation` is a pure lookup, called once per `Issue` row inside the existing `toReportIssue()` mapper — no new query. |
| `packages/cms-adapters` → `packages/fingerprint` | **Type-only** import of `CmsPlatform`/`DetectedStack` | No runtime dependency; keeps `cms-adapters` free of `cheerio` and any HTML-parsing weight. |
| `packages/checks` ↔ `packages/fingerprint` / `packages/cms-adapters` | **None, by design** | This is the hard boundary the milestone asks to preserve. The only shared surface is the plain-string `checkId`, which `Issue`/`IssueDraft` already carry today — no import in either direction. |
| `apps/web` → `packages/report-model` | Already-existing read path (`buildReportModel`) | `ReportModel.stack` is simply a new field on an interface the report route already consumes; no new API route, no new fetch. |
| `packages/export` → `packages/report-model` | Already-existing read path | Recommendation personalization is free (same `ReportIssue.recommendation` field the serializers already read); the stack table itself needs an explicit new section added to `pdf.tsx`/`markdown.ts`/`pptx.ts` if Juan wants parity in exports (flagged as a follow-up, not implicit). |

## Suggested Build Order (dependency-respecting)

1. **`packages/db`** — Prisma migration: `Page.responseHeaders Json?`, `Audit.stack Json?` (additive, nullable, no backfill — same precedent as `resolvedUrl`/`schemaGraph`). Everything downstream needs the generated Prisma types.
2. **`packages/fingerprint`** (new) — can be built in parallel with step 1 (its input type is locally declared, not `@auditor/db`-derived); needs step 1 only when wired into the worker.
3. **`packages/crawler`** (modified: header capture) — depends on step 1 (needs the new column to write into).
4. **`packages/cms-adapters`** (new) — depends only on step 2's exported types; can be authored in parallel with step 3.
5. **`apps/worker`** (wire `detectStack` + persist `Audit.stack`) — depends on 1, 2, 3.
6. **`packages/report-model`** (parse `Audit.stack`, call `resolveCmsRecommendation`) — depends on 1, 2, 4.
7. **`apps/web`** (`StackTable` component + report page wiring) — depends on 6.
8. **`packages/export`** (optional parity: stack-table section in PDF/Markdown/PPTX) — depends on 6; can ship in a later phase without blocking 1–7.

## Sources

- Direct codebase inspection (HIGH confidence, primary source for all integration points): `packages/db/prisma/schema.prisma`, `apps/worker/src/index.ts`, `packages/crawler/src/crawl.ts`, `packages/checks/src/types.ts`, `packages/checks/src/registry.ts`, `packages/checks/src/checks/onpage/altText.ts`, `packages/checks/src/checks/tech/canonical.ts`, `packages/report-model/src/model.ts`, `packages/report-model/src/build.ts`, `.planning/PROJECT.md`.
- [How to identify the technologies used on a website — Wappalyzer](https://www.wappalyzer.com/articles/find-out-what-cms-or-framework-a-website-is-using/) — confirms HTML `<meta name="generator">`, HTTP response headers, and cookie names as the standard, no-extra-request fingerprinting signal categories; MEDIUM confidence (vendor-authored, but methodology is well-established and cross-checked against multiple independent CMS-detector write-ups returned in the same search).
- [tomnomnom/wappalyzer on GitHub](https://github.com/tomnomnom/wappalyzer) — confirms categorized (non-mutually-exclusive) rule buckets (CMS, CDN, analytics, JS framework) as the standard architecture for this class of tool; MEDIUM confidence.

---
*Architecture research for: tech-stack fingerprinting + CMS-personalized recommendations integration*
*Researched: 2026-07-21*
