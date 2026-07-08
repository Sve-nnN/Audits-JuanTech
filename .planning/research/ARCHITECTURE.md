# Architecture Research — Milestone v1.3 (Deeper checks + architecture visualizer)

**Domain:** SEO/technical web-audit tool — subsequent-milestone feature integration
**Researched:** 2026-07-08
**Confidence:** HIGH (grounded in direct reading of the current v1.0-v1.2 codebase, not greenfield guesswork)

> Scope note: this is **integration research** for 5 new features, not a re-design.
> The existing pipeline (crawl → `runAllChecks` → PSI sample → render sample →
> persist → `buildReportModel` → report UI/exports) is validated and MUST NOT
> change. Everything below is additive. Where a recommendation touches an
> existing file it says **MODIFY**; where it introduces something new it says
> **NEW**.

---

## Standard Architecture (current, unchanged)

### System Overview

```
apps/worker (Crawlee)          packages/checks                packages/psi
   crawl → runAllChecks() ──►    registry.ts orquesta            client.ts (fetch PSI)
   → PSI sample → render         PageCheck/SiteCheck/            parser.ts (extrae subset
   sample → persist              NetworkCheck                    de Lighthouse JSON)
        │                        checks/{tech,onpage,               │
        │                         schema,aeo}/*.ts                 issues.ts (mapea a
        ▼                            │                              PerfIssueDraft)
   Postgres/Prisma (Page, Issue,      ▼
   Audit.scores/stats)          IssueDraft[] (checkId,
        │                        category, severity,
        │                        fingerprint, pageId|scope)
        ▼
packages/report-model                                          apps/web
   buildReportModel(auditId) ────────────────────────────────►  audits/[id]/page.tsx
   lee SOLO datos persistidos                                   audits/[id]/pages/page.tsx
   (Audit.scores/stats, Issue[])                                 (usa CategoryAccordion,
   expone ReportModel                                            IssueTypeGroup, JsonLdBadge)
   (issuesByCategory, priorityCandidates,
   grouping.ts, jsonld.ts = pure helpers)                       packages/export
                                                                  (PDF/MD/PPTX, mismo
                                                                  ReportModel)
```

### Component Responsibilities (verified in code)

| Component | Responsibility | Verified detail |
|-----------|----------------|------------------|
| `packages/checks/src/types.ts` | Defines `PageCheck`/`SiteCheck`/`NetworkCheck` contracts | `PageCheck.run({page, $})` gets one crawled `Page` + Cheerio-loaded HTML; `SiteCheck.run({pages, origin, robotsTxt, sitemapUrls})` gets the whole crawled set. No pre-computed "template" or "link graph" is passed — checks that need that compute it ad-hoc from `page.html` (pattern: `orphanPages.ts`). |
| `packages/checks/src/registry.ts` | Aggregates all check arrays by category | Reads from each category's `checks/{cat}/index.ts` (e.g. `techPageChecks`, `schemaSiteChecks`). Adding a check = create file → export from that category's `index.ts` → already included, no edit to `registry.ts` itself needed. |
| `packages/db` (Prisma) `Page` model | Stores crawled page HTML + crawl metadata | `Page.depth: Int?` already exists and is already populated by the crawler — **no check or UI reads it yet** (confirmed via repo-wide grep: only appears in schema + crawler). `Page.html: String? @db.Text` is the only raw-HTML source; no separate link table exists. |
| `packages/psi` | Fetches + parses PageSpeed Insights, maps to issues | `PsiMetrics` (types.ts) is a closed 5-field type (`performanceScore, lcpMs, cls, inpMs, ttfbMs`) built by hand in `parser.ts` from `RawPsiResponse.lighthouseResult.audits`. Lighthouse's `audits` object already contains far more (`uses-webp-images`, `render-blocking-resources`, `unused-css-rules`, `unused-javascript`, etc.) that is currently discarded. `issues.ts`'s `mapPerfIssues` maps `PsiMetrics` → `PerfIssueDraft[]` via a `METRIC_SPECS` array (numeric-threshold shape). |
| `packages/report-model` | Single source of truth for report UI + exports | `buildReportModel(auditId)` explicitly **never recomputes checks** — reads only `Audit.scores`, `Audit.stats`, `Issue` rows (own JSDoc: "no checks are recomputed"). `grouping.ts` (`groupIssuesByType`) and `jsonld.ts` (`jsonLdStateForPage`) are pure, dependency-free helper functions — the established pattern for any new derived/grouped view. |
| `apps/web/app/components/ui/IssueTypeGroup.tsx` | Renders issue groups | Calls `groupIssuesByType(issues)` **internally** — does not accept pre-computed groups as a prop. Coupled to that one grouping function today. |
| `apps/web/app/audits/[id]/pages/page.tsx` | Lists crawled pages | Direct `prisma.page.findMany({select:...})` + `prisma.issue.findMany` — bypasses `report-model` (a known, already-documented fragility from v1.2: "parallel JSON-LD query in pages/page.tsx outside report-model"). Do not repeat this pattern for new features. |
| `packages/checks/src/checks/tech/orphanPages.ts` | Reference pattern for link-graph computation | 100% on-demand: `cheerio.load(page.html)` per crawled `Page`, extracts `a[href]`, normalizes with `normalizeUrl`/`sameRegistrableDomain` from `@auditor/crawler`, no persistence, no migration. This is the exact pattern requested for the architecture visualizer's link graph. |
| Existing "pages + grafo" screen (v1.1 SCREEN list) | JSON-LD entity-graph badge, NOT a link-graph visualizer | Confirmed: no link-graph/architecture-tree UI exists anywhere in `apps/web`. Feature 5 is genuinely new UI surface, not an extension of an existing graph screen. |

## Feature-by-Feature Integration

### Feature 1 — Schema-content mismatch check (FAQPage/HowTo/Product without matching visible content)

**Type:** new `PageCheck`.
**Location (NEW):** `packages/checks/src/checks/schema/schemaContentMismatch.ts` (same folder as `schemaTypes.ts`, `schemaValidate.ts`).

- Reuses `extractJsonLdBlocks`, `flattenNodes`, `typesOf`, `hasProp` from `schema/extract.ts` — no changes needed there for the basic case; may need 1-2 additional helpers (e.g. counting `FAQPage.mainEntity` questions, walking `HowTo.step`) — add these to `extract.ts` if generic/reusable, otherwise keep private to the new check file.
- Needs the page's visible text — reuse whatever helper `onpage/contentLength.ts` already uses for visible-text extraction (avoid a second implementation of "visible text vs raw HTML").
- Registration (MODIFY): `checks/schema/index.ts` — add to `schemaPageChecks` array and export list. `registry.ts` itself untouched.
- New `checkId` (e.g. next available `SD-0x`), `category: "schema"`.
- No dependency on any other v1.3 feature — buildable first/independently.

**New:** `schemaContentMismatch.ts` (+ test).
**Modified:** `checks/schema/index.ts`; possibly `extract.ts` (generic sub-property helpers only).

### Feature 2 — Click-depth check (3-click rule)

**Type:** new `PageCheck` (simplest option — `ctx.page.depth` is already on the `Page` object `PageCheckCtx` receives; no need for `SiteCheck`'s full-set context unless a site-wide aggregate like "% of pages beyond 3 clicks" is wanted later).
**Location (NEW):** `packages/checks/src/checks/tech/clickDepth.ts` (folder `tech`, same domain as `orphanPages.ts`).

- Reads `ctx.page.depth` directly — zero HTML parsing, cheapest of the 5 features.
- `depth` is nullable (`Int?`) — check MUST degrade clean (`return []`) when `depth == null`, matching the project's established best-effort degradation pattern (worker `try/catch`, PSI's "no disponible").
- New `checkId` (e.g. `TECH-10`), `category: "tech"`, severity by threshold (e.g. `<=3` ok, `4` warning, `>=5` critical — confirm exact thresholds with Juan if needed).
- Registration (MODIFY): `checks/tech/index.ts` — add to `techPageChecks`.
- **"Surface in the report"**: the requirement text implies showing depth directly, not just via the issue. Two places this can land:
  1. The issue itself already flows through `issuesByCategory`/`priorityCandidates` automatically (no `report-model` change needed — it's a normal `IssueDraft` with `pageId`).
  2. If depth should also show as a raw value/badge on the pages list (`apps/web/app/audits/[id]/pages/page.tsx`), that page does a direct Prisma `select` — just add `depth` to the existing `select` and render it (MODIFY), no `report-model` involvement since it's a raw `Page` field, not derived issue data.

**New:** `clickDepth.ts` (+ test).
**Modified:** `checks/tech/index.ts`; optionally `apps/web/app/audits/[id]/pages/page.tsx` (select + render `depth`).
**Dependencies:** none — buildable in parallel with Feature 1.

### Feature 3 — Lighthouse diagnostics (WebP, render-blocking, unused CSS/JS)

**Type:** extension of `packages/psi`, not `packages/checks`.

- **`parser.ts` (MODIFY):** extract the relevant Lighthouse audits (`uses-webp-images`, `render-blocking-resources`, `unused-css-rules`, `unused-javascript`, etc.) from `RawPsiResponse.lighthouseResult.audits` — will need to widen the audit-entry type (today only `numericValue` is typed; these audits carry `score`/`details.items` with wasted-bytes info).
- **New file `packages/psi/src/diagnostics.ts`:** a sibling to `issues.ts`, exposing `mapDiagnosticIssues(diagnostics)`. Recommend a **separate function**, not folding diagnostics into `mapPerfIssues`'s `METRIC_SPECS` — `METRIC_SPECS` assumes "numeric value + threshold" (LCP/CLS/TTFB shape); Lighthouse diagnostics are "pass/fail + list of offending resources", a different shape.
- **Does this change `PsiMetrics`'s shape?** No — recommend a **parallel structure**, not new fields on `PsiMetrics`. `PsiMetrics` is what gets cached (`cache.ts`) and averaged across mobile/desktop and across sampled pages (`ReportStrategyPerf.avg*` in report-model) — a diagnostic like "uses WebP: yes/no" has no sensible average/cache semantics and would pollute a type already used in 4+ places. Add `PsiDiagnostics` to `types.ts` and extend `PsiRunResult` (`{ metrics, diagnostics, ok, error, fromCache }`) so diagnostics ride alongside metrics without entering the averaging/caching path used for `ReportPerf`.
- **Worker (MODIFY) `apps/worker/src/index.ts`:** the existing PSI loop that calls `runPsi`/maps to `PerfIssueDraft` gets a parallel call to `mapDiagnosticIssues` and pushes the results into the same issues array, same pattern already used for `renderIssues` (Phase 12).
- `category: "perf"` — flows into existing `issuesByCategory`/scoring untouched; `scorePerfCategory` already treats "perf" as one aggregated category, no scoring changes needed.
- **Cost:** zero extra API calls — this is data PSI already returns and today's 4-field parser discards. Low risk, high value.

**New:** `packages/psi/src/diagnostics.ts` (+ test).
**Modified:** `packages/psi/src/types.ts`, `packages/psi/src/parser.ts`, `apps/worker/src/index.ts`.
**Dependencies:** none functionally; touches the same worker file as Features 1/2 (sequence to avoid merge conflicts, not because of a real dependency).

### Feature 4 — Template-based issue grouping (home/category/product/article)

**Where does template classification live?** Recommend **`packages/report-model`**, as a new pure helper (same pattern as `grouping.ts`/`jsonld.ts`), NOT `apps/web`. Reason: `report-model` is explicitly documented as the single source of truth "consumed by report UI AND export serializers" — if template classification lived only in `apps/web`, the PDF/Markdown/PPTX exports (`packages/export`) couldn't reuse it without duplicating logic. This is exactly the mistake the project already flagged as a v1.2 latent fragility (parallel JSON-LD query outside `report-model`) — don't repeat it.

**Concrete design:**
- **New file `packages/report-model/src/template.ts`:**
  - `classifyTemplate(url: string, ...): PageTemplate` — a pure heuristic classifier (URL pattern matching, e.g. `/producto/`, `/categoria/`, `/blog/`; possibly cross-referenced with dominant schema.org type if available via `schemaGraph`).
  - `groupIssuesByTemplate(issues: ReportIssue[]): TemplateGroup[]` — analogous to `groupIssuesByType` but keyed by `classifyTemplate(issue.url)`.
- **Open design risk to resolve before building:** `ReportIssue.url` alone may not carry enough signal for reliable classification (URL patterns vary per site). If more robust classification is needed (e.g. dominant schema type, or depth+content heuristics), that's a product-research question, not just an architecture one — flag as an open question for the phase that builds this.

**Report UI — new component or reuse `IssueTypeGroup`?**
`IssueTypeGroup.tsx` today calls `groupIssuesByType(issues)` internally and does not accept pre-computed groups — it's coupled to one specific grouping function. Two options:
1. **New component `TemplateGroup.tsx`** replicating ~90% of the JSX/CSS module, calling `groupIssuesByTemplate` instead — fast but duplicates a component (and any future fix/accessibility change needs to be applied twice).
2. **Recommended: generalize the existing component** to accept pre-computed `groups: IssueTypeGroup[]` (rename the shared type more generically, e.g. `IssueGroup`) as an optional prop, defaulting to `issues` + `groupIssuesByType` for backward compatibility. Both grouping functions already return a compatible shape (`{key/title, severity, count, issues}`), making this a low-risk refactor. **This decision should be made before or alongside building Feature 4** — it's the only one of the 5 features with a shared-component reuse decision that affects build order.

**New:** `packages/report-model/src/template.ts` (+ test), exported from `report-model/src/index.ts`.
**Modified (recommended):** `apps/web/app/components/ui/IssueTypeGroup.tsx` (generalize props) — or a new standalone `TemplateGroup.tsx` if avoiding touching the shared component is preferred for time/risk reasons.
**Modified:** `apps/web/app/audits/[id]/page.tsx` (add the template-grouped section/tab alongside the existing `CategoryAccordion`+`IssueTypeGroup` axis).
**Out of scope unless requested:** extending `packages/export` serializers to also group by template — the milestone scope says "grouping... in the report", not exports.

### Feature 5 — Architecture visualizer (Octopus.do-style)

**Route (NEW):** `apps/web/app/audits/[id]/architecture/page.tsx` — a Server Component following the exact pattern of `pages/page.tsx` (direct `prisma.*.findMany` + render), **not a new API route**. There is no precedent in this codebase for API routes reading existing-audit data (`apps/web/app/api/audits/route.ts` is for creation/enqueueing, not reading an existing audit's tree) — stay consistent with the established pattern rather than introduce a new one.

**Computing the graph — server-side, on-demand, no migration:**
- Reuse the `orphanPages.ts` pattern literally: `prisma.page.findMany({ where: { auditId }, select: { id, url, finalUrl, html, depth } })`, then `cheerio.load(page.html)` per page to extract internal `a[href]` links and build edges (`normalizeUrl` + `sameRegistrableDomain` from `@auditor/crawler`, the same helpers `orphanPages.ts` already uses).
- **Layer decision:** this "compute graph from raw HTML" logic is a candidate for `packages/report-model` (e.g. `packages/report-model/src/linkGraph.ts`, a pure `buildLinkGraph(pages, origin): LinkGraph` function) for the same centralization reason as Feature 4. **However**, unlike `buildReportModel` (which only reads `Audit.scores/stats` + `Issue`), this needs each `Page.html` — a heavy field (`@db.Text`) that `buildReportModel` deliberately never fetches (to avoid inflating the main report query). **Recommendation: a separate helper/query path, NOT merged into `ReportModel` or `buildReportModel`** — a standalone pure helper in `report-model` (or its own small module) invoked only by the `/architecture` route, with its own Prisma query that fetches `html` only there, never in the main report's query.
- The internal-link-extraction fragment (~10 lines: `a[href]` + `normalizeUrl` + `sameRegistrableDomain`) currently lives inline inside `orphanPages.ts` in `packages/checks`. If `report-model` doesn't depend on `packages/checks`, decide: (a) duplicate the small fragment (acceptable given its size, avoids a new cross-package dependency), or (b) extract it to a shared utility package. Given the fragment's size, **duplication is the pragmatic choice** here.
- **Hierarchical tree by depth:** uses `Page.depth` directly — same field as Feature 2. This creates a **data dependency** between Feature 2 and Feature 5 (both read `Page.depth`) but **not a build dependency** — Feature 5 can read `Page.depth` straight from Prisma regardless of whether Feature 2's check exists yet. They're independent in code; they just share an existing schema field.

**Visualization component:** genuinely new — nothing in the current design system (`ScoreGauge`, `CategoryCard`, `IssuesTable`, `CategoryAccordion`) is graph/tree-oriented; all existing components are tabular/score-oriented. A graph-rendering library choice (e.g. `react-flow`/`@xyflow/react`, or a hand-rolled SVG/CSS hierarchical layout to avoid a new heavy dependency) is an **open stack decision, not resolved by this architecture research** — flag for a dedicated library-research pass in whichever phase builds this feature.

**New:** `apps/web/app/audits/[id]/architecture/page.tsx` (+ CSS module, + new graph/tree component(s) in `apps/web/app/components/ui/`); `packages/report-model/src/linkGraph.ts` (or a standalone module, per the layering decision above).
**Modified:** app navigation (add an "Arquitectura" link near the existing "Páginas rastreadas" link).
**No Prisma migration** — `html` and `depth` both already exist, satisfying the milestone's explicit no-migration constraint.

## Dependencies and Recommended Build Order

There are no strong **functional** dependencies between the 5 features — all read already-persisted data (`Page.html`, `Page.depth`, PSI JSON) without requiring another new feature to exist first. The real dependencies are about **shared design decisions and risk**, not data:

1. **Feature 2 (click-depth)** — build first. Simplest (reads an already-persisted field, zero HTML parsing, near-zero risk); validates the "new check → registry → surfaced in report" pattern the others reuse.
2. **Feature 1 (schema-content mismatch)** — second. Same `PageCheck` pattern as Feature 2 but more logic (JSON-LD vs visible-text cross-reference); reuses the already-mature `extract.ts`, no dependency on the others.
3. **Feature 3 (Lighthouse diagnostics)** — third, buildable in parallel with 1/2 since it touches a different package (`psi`, not `checks`). The only shared touch-point is `apps/worker/src/index.ts` (where 1 and 2 also add issue-pushes) — sequence the worker edits to avoid merge conflicts, not because of a functional dependency.
4. **Feature 4 (template grouping)** — fourth, AFTER deciding the `IssueTypeGroup` generalization (or committing to a standalone `TemplateGroup` to avoid touching the shared component). This is the only feature with a UI-component-reuse decision worth resolving before writing the final UI, to avoid rework.
5. **Feature 5 (architecture visualizer)** — last. Largest surface (new route, new graph component(s), an open visualization-library decision) and the one with the most genuinely new risk (only feature introducing a potentially heavy new UI dependency). Building it last lets Feature 2's `Page.depth` usage and the link-extraction pattern be validated/stable first, even though there's no hard build dependency.

**Suggested phase grouping:**
- Phase A: Features 2 + 1 (both `PageCheck`s in `packages/checks`, low risk, same pattern).
- Phase B: Feature 3 (isolated in `packages/psi`).
- Phase C: Feature 4 (report-model helper + UI component-reuse decision).
- Phase D: Feature 5 (new route + dedicated graph-library research — likely candidate for its own research-flagged phase).

## Anti-Patterns to Avoid (specific to this milestone)

### Anti-Pattern 1: Template classification or link-graph logic living only in `apps/web`
**What people would do:** write `classifyTemplate`/`buildLinkGraph` directly inside the `apps/web` Server Component.
**Why it's wrong:** repeats the already-documented v1.2 fragility ("parallel JSON-LD query in pages/page.tsx" outside `report-model`) — business logic outside the single source of truth, unavailable to future exports, harder to unit-test than a pure function.
**Do this instead:** pure helpers in `packages/report-model`, consumed by the Server Component.

### Anti-Pattern 2: Folding Lighthouse diagnostics into `PsiMetrics`
**What people would do:** add fields like `usesWebp: boolean` directly onto the `PsiMetrics` interface.
**Why it's wrong:** `PsiMetrics` is what gets cached (`cache.ts`) and averaged across mobile/desktop and across sampled pages (`ReportStrategyPerf.avg*`) — averaging/caching a pass/fail diagnostic makes no semantic sense and pollutes a type already relied on in 4+ places.
**Do this instead:** a parallel `PsiDiagnostics` structure, mapped to issues by a separate function (`mapDiagnosticIssues`), matching the same "shape-compatible with IssueDraft" pattern `PerfIssueDraft` already uses.

### Anti-Pattern 3: Duplicating `IssueTypeGroup` without generalizing it
**What people would do:** copy/paste `IssueTypeGroup.tsx` into `TemplateGroup.tsx`, changing only the grouping function call.
**Why it's wrong:** duplicates CSS module + JSX + tests; any future visual/accessibility fix must be applied twice.
**Do this instead (if time allows):** generalize `IssueTypeGroup` to accept pre-computed groups in a shared shape (`{title, severity, count, issues}`), reused by both grouping axes.

### Anti-Pattern 4: Fetching `Page.html` inside `buildReportModel`
**What people would do:** add `html` to `buildReportModel`'s query so the architecture visualizer can reuse the same `ReportModel`.
**Why it's wrong:** `html` is `@db.Text` (potentially large, ×500 pages) and `buildReportModel` feeds both the report page load and all 3 exports — inflating that query for a feature used only on one isolated new route degrades everything else.
**Do this instead:** a dedicated Prisma query (with `html` in the `select`) scoped only to the architecture-visualizer route/helper.

## Scaling Considerations

| Concern | At current scale (≤500 URLs/audit) | Notes |
|---------|--------------------------------------|-------|
| Link-graph computation (Feature 5) | Fine — `orphanPages.ts` already does the same `cheerio.load` × N pages work today with no reported performance issue | If audits ever grow past 500 URLs, revisit whether the graph computation should be cached/persisted instead of on-demand; out of scope for v1.3. |
| Lighthouse diagnostics (Feature 3) | Zero extra cost — parsed from data already fetched | No new PSI quota consumption. |
| Template classification (Feature 4) | Cheap — pure string/regex classification per issue, O(n) | Revisit only if classification needs cross-referencing schema data at scale. |

## Sources

- Direct source-code reading (HIGH confidence, no external verification needed):
  - `packages/checks/src/types.ts`, `registry.ts`, `checks/tech/{index,orphanPages}.ts`, `checks/schema/{extract,schemaTypes}.ts`
  - `packages/psi/src/{types,parser,issues}.ts`
  - `packages/report-model/src/{model,build,grouping,jsonld,index}.ts`
  - `apps/web/app/audits/[id]/{page.tsx,pages/page.tsx}`, `apps/web/app/components/ui/IssueTypeGroup.tsx`
  - `apps/worker/src/index.ts`
  - `packages/db/prisma/schema.prisma` (`Page` model, `depth` field)
  - `.planning/PROJECT.md` (v1.3 milestone context and prior key decisions)

---
*Architecture research for: 5-feature integration (v1.3) onto the existing SEO-auditor monorepo*
*Researched: 2026-07-08*
