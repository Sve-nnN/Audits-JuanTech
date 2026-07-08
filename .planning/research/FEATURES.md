# Feature Research

**Domain:** SEO/technical web auditor — v1.3 additions (schema-content, click-depth, Lighthouse diagnostics, template grouping, architecture visualizer)
**Researched:** 2026-07-08
**Confidence:** MEDIUM-HIGH (mix of official Google docs, established SEO-tool conventions, and direct codebase inspection)

## Feature Landscape

### Table Stakes (Users Expect These)

Features any competent technical SEO audit tool already covers; missing them makes the "profundizar checks" milestone feel incomplete against the reference SEO-Skills methodology.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Click-depth (3-click) check | Every mainstream site-audit tool (Semrush, Screaming Frog, Sitebulb, Ahrefs Site Audit) surfaces "pages >3 clicks from home" as a standard architecture check; `Page.depth` is already persisted (BFS from crawl seeding), so *not* having a check on top of it is a visible gap | LOW | Pure read of existing `Page.depth`; no new crawl/extraction work. New `SiteCheck` (or `PageCheck`) in `packages/checks/src/checks/tech/`, one issue per page over threshold or one aggregate issue with a distribution |
| Lighthouse diagnostics surfaced from PSI (WebP/modern formats, render-blocking, unused CSS/JS, text compression) | These are exactly what Screaming Frog + PageSpeed's own UI foreground as "Opportunities/Diagnostics" — a perf category with only score+4 metrics (current PERF-01/02) feels shallow next to any competitor report, and the data is already paid for (PSI response) | LOW-MEDIUM | Existing `packages/psi/src/parser.ts` **discards** most of `lighthouseResult.audits` — only reads 3 numericValues. Need to extend the parser to pull `score`/`numericValue`/`details.overallSavingsMs` for a fixed allowlist of audit IDs, then map to new `PERF-0x` issues in `issues.ts`. Zero extra PSI calls |
| Template-based issue grouping (home/category/product/article/other) | Screaming Frog "page type" filters, Sitebulb "Content Grouping", and the SEO-Skills architecture curriculum all classify URLs into templates as a second grouping axis; v1.2 (Phase 15) already shipped grouping-by-issue-type, so grouping-by-template is the natural complementary axis practitioners expect next | LOW-MEDIUM | Pure derivation from `Page.url`/`Page.finalUrl` path segments — no new crawl data. New pure function in `@auditor/report-model` (sibling to `grouping.ts`), consumed by report UI as a second accordion/filter axis |

### Differentiators (Competitive Advantage)

Features that go beyond "check exists" into genuinely useful signal or visualization; these are where this milestone earns its "más completo" positioning against generic checkers.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Schema-content mismatch detection (FAQPage/HowTo/Product+AggregateRating/Review declared without matching visible content) | Most audit tools validate JSON-LD *shape* (schema.org conformance) but stop there — very few flag "declared but not actually present," which is precisely the pattern Google's own Spammy Structured Data policy penalizes with a **manual action** (rich-result eligibility loss, not a ranking check). Surfacing this is a real differentiator: it's the difference between "your schema is valid" and "your schema could get you manually actioned" | MEDIUM-HIGH | Needs new heuristic DOM-pattern detectors per type (see Feature Dependencies below) layered on top of the existing `schemaTypesCheck`/`extractJsonLdBlocks` extraction in `packages/checks/src/checks/schema/`. Runs on the Cheerio-parsed raw HTML already stored per page — no new fetch. Real false-positive risk: JS-rendered FAQ/Review content that's invisible in raw HTML but present after render (mitigated by the existing CSR/SSR sample from v1.2's `@auditor/render` — cross-reference before flagging as a hard "no content" case) |
| Site architecture visualizer (Octopus.do-style depth-grouped tree) | Turns an abstract `Page.depth` distribution into an at-a-glance mental model of the site's shape — orphans, over-deep sections, and template composition per level are things practitioners currently have to infer from a flat page list. This is the single most "wow" visual deliverable of the milestone for a lead-magnet product (screenshot-worthy) | MEDIUM | LOCKED decision: depth-grouped tree, NOT a full interactive link graph with persisted edges — computed on-demand reusing the `orphanPages.ts` pattern (parse stored HTML for internal links at report-render time, no new storage/migration). Minimum useful node info per page: URL/title, depth, template badge, orphan flag, ">3 clicks" flag. Grouping is by depth level (rows), not a force-directed graph |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Full interactive link graph (force-directed, all edges, drag/zoom) | "Cool visualization," matches some paid tools (Sitebulb's crawl map) | Requires persisting the full internal link graph (new migration), is expensive to compute/render for 500 URLs, and is explicitly out of scope per this milestone's LOCKED decision — it would balloon phase scope and storage without adding audit signal beyond what the depth tree already conveys | Depth-grouped tree computed on-demand (this milestone's actual scope) |
| Running full Lighthouse "opportunity" audits for every single URL (all 500) | "More data is better," mirrors what Lighthouse CLI would show per-page | v1.2's own constraint stands: Lighthouse/PSI is sampled, not run on all 500 URLs, for cost/time reasons (documented in STACK.md "What NOT to Use"). Surfacing *every* diagnostic audit ID (Lighthouse has 40+ in the Diagnostics/Opportunities groups) for even the sampled pages would drown a lead-magnet audience in minutiae they can't act on | Cap to a fixed, curated top-N allowlist (5-7 audit IDs: `uses-webp-images`/`modern-image-formats`, `unused-css-rules`, `render-blocking-resources`, `uses-text-compression`, `unminified-css`, `unminified-javascript`) surfaced only for the already-sampled pages, each as a distinct new `PERF-0x` checkId |
| Auto-classifying every URL into a rigid, CMS-specific template taxonomy (e.g. WordPress post types, Shopify collection/product paths) | Feels "smarter," matches what a CMS-aware crawler (e.g. a WordPress-only plugin) could do | This is a general-purpose auditor with no CMS knowledge of the target site — hardcoding CMS-specific path conventions creates false confidence and breaks silently on sites that don't follow them | Heuristic, pattern-based classification (path segment count + common keyword patterns like `/blog/`, `/product/`, `/category/`, home = depth 0) with an explicit "Otras" fallback bucket for anything unclassifiable — good enough signal, no CMS assumption |
| Treating schema-content mismatch as a hard scoring failure (critical, always) | "Google can manually action you, so it must be critical" | Manual actions are rare and heuristic detection of "no matching content" has real false-positive risk (thin-content edge cases, JS-rendered content not visible in raw HTML, partial content that's arguably "enough"). Auto-critical on a heuristic with known false positives would erode trust in the whole score, similar to why v1.2 chose CSR/SSR as informational not a score-zeroing failure | Warning severity by default (matches the project's existing precedent: CSR/SSR risk is `warning`/`ok`, not `critical`); reserve `critical` only for the clearest cases (e.g., zero matching DOM elements at all, no CSR sample ambiguity) |

## Feature Dependencies

```
[Click-depth check]
    └──requires──> [Page.depth already persisted] (DONE, no dependency risk)

[Template-based grouping]
    └──requires──> [Page.url / Page.finalUrl] (already persisted)
    └──enhances──> [groupIssuesByType] (v1.2 Phase 15) — becomes second grouping axis in report UI

[Schema-content mismatch check]
    └──requires──> [extractJsonLdBlocks / typesOf / flattenNodes] (existing, packages/checks/src/checks/schema/extract.ts)
    └──requires──> [Cheerio-parsed raw HTML per page] (existing, already stored)
    └──enhances──> [RENDER-01..03 CSR/SSR sample from v1.2] — cross-check before flagging false positives on JS-rendered content

[Lighthouse diagnostics as perf issues]
    └──requires──> [existing PSI response] (already fetched, packages/psi/src/parser.ts currently discards most of it)
    └──enhances──> [PERF-01/02 existing perf category] — new sibling checkIds, same category

[Site architecture visualizer]
    └──requires──> [Page.depth] (persisted)
    └──requires──> [orphanPages.ts on-demand internal-link parsing pattern] (existing, reused not duplicated)
    └──enhances──> [Template-based grouping] — template badge per node in the tree
    └──enhances──> [Click-depth check] — visually surfaces the ">3 clicks" flag per node
```

### Dependency Notes

- **Click-depth check requires `Page.depth`:** zero new crawl/storage work — this is purely a new `SiteCheck`/`PageCheck` reading already-persisted data. Lowest-risk feature of the five; good candidate for an early phase.
- **Template-based grouping enhances `groupIssuesByType`:** it does not replace the v1.2 type-based grouping, it's a second, independent axis (by template) alongside it. Both derive from `ReportIssue`/`Page` — a shared `pageId → template` map is the natural interface point.
- **Schema-content mismatch enhances the CSR/SSR sample (v1.2):** the biggest named false-positive risk (FAQ content rendered client-side after page load) is exactly the ambiguity the existing render-detection sample already resolves for a subset of pages. Cross-referencing avoids re-inventing render detection for this one check.
- **Lighthouse diagnostics enhances PERF-01/02:** requires touching `packages/psi/src/parser.ts` (extend the audits read from PSI's response), `packages/psi/src/types.ts` (extend `PsiMetrics`), and `packages/psi/src/issues.ts` (new `METRIC_SPECS`-like entries or a parallel mapper) — same package, additive, no new external call.
- **Site architecture visualizer depends on three other features for full richness** (depth, template, click-depth flag) but its MVP (bare depth-grouped tree with orphan flag only) can ship without waiting on template classification — sequence template grouping before the visualizer if richness is prioritized, or ship the visualizer first as a bare tree and enhance it once template grouping lands.

## MVP Definition

### Launch With (v1.3)

Minimum viable set for this milestone — all 5 are already locked as milestone scope, so "MVP" here means the leanest correct version of each:

- [ ] Click-depth check (`SITE-0x` or similar): flag pages with `Page.depth > 3` as `warning` (this is architecture guidance, not a hard technical failure — matches the project's existing informational-severity precedent for RENDER-01..03); consider a secondary aggregate issue ("N% of pages beyond 3 clicks") rather than one issue per page to avoid flooding the priority list on large sites
- [ ] Lighthouse diagnostics from PSI (top 5-7 curated audit IDs): new `PERF-0x` issues, `warning`/`ok` severity based on Lighthouse's own audit score, capped list so the perf category doesn't drown users in minutiae
- [ ] Template-based grouping (home/category/product/article/otras): pure derivation function + new grouping surface in report UI, second axis alongside `groupIssuesByType`
- [ ] Schema-content mismatch check (FAQPage, HowTo, Product+AggregateRating, Review): `warning` severity by default; cross-reference CSR/SSR sample to suppress false positives on pages confirmed CSR-rendered
- [ ] Site architecture visualizer (depth-grouped tree): reuses `orphanPages.ts`-style on-demand internal-link parsing at report-render time, no storage migration; minimum node info = URL/title + depth + orphan flag + >3-click flag

### Add After Validation (v1.3.x / v2)

- [ ] Template badge on visualizer nodes — trivial once template grouping ships, defer only if sequencing forces it
- [ ] Additional schema types for content-mismatch (Recipe, Event, JobPosting) — defer until the 4 locked types prove valuable and false-positive rate is acceptable
- [ ] Configurable click-depth threshold (currently hardcoded 3) — defer until there's user demand to tune it per site type

### Future Consideration (v2+)

- [ ] Full interactive link graph with persisted edges — explicitly out of scope this milestone (anti-feature above); revisit only if users request beyond what the depth tree provides
- [ ] Full Lighthouse diagnostics (all 40+ audit IDs) rather than curated top-N — defer indefinitely; contradicts the "don't drown a lead-magnet audience" principle unless a future paid/pro tier targets performance engineers specifically

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Click-depth check | MEDIUM | LOW | P1 |
| Lighthouse diagnostics (curated) | HIGH | LOW-MEDIUM | P1 |
| Template-based grouping | MEDIUM | LOW-MEDIUM | P1 |
| Schema-content mismatch | HIGH | MEDIUM-HIGH | P1 |
| Site architecture visualizer | HIGH | MEDIUM | P2 (highest visual payoff, best sequenced after depth/template land) |

**Priority key:**
- P1: Core milestone scope, all locked as "must ship" per PROJECT.md
- P2: Highest polish/differentiation item, sequence after its dependencies (depth check, template grouping) for maximum richness — but a bare-tree MVP could also ship in parallel if phase ordering favors it

## Competitor Feature Analysis

| Feature | Screaming Frog | Semrush Site Audit | Sitebulb | Our Approach |
|---------|-----------------|---------------------|----------|--------------|
| Click depth | Crawl Depth column + filter, no severity grading | Explicit "pages >3 clicks" check surfaced in Site Audit report, warning-tier | "Crawl Depth" visualization + distribution chart | Warning-severity check on existing `Page.depth`, plus aggregate % metric; visualized in the architecture tree |
| Lighthouse/PSI diagnostics | Integrates PSI API, surfaces full Lighthouse audit list (assumes technical user) | Curated "Core Web Vitals" + top opportunities, not exhaustive | Full Lighthouse audit detail per page (technical audience) | Curated top 5-7 IDs only — deliberately narrower than Frog/Sitebulb because our audience is lead-magnet-general, not technical SEO specialists |
| Schema-content correspondence | Not checked (only schema validity) | Not checked (only schema validity/presence) | Not checked | Genuine differentiator — none of the three majors flag this specific Google manual-action risk pattern |
| Template/page-type grouping | "Page Type" custom extraction (manual regex config required) | Automatic "content groups" by URL pattern | "Content Groups" — configurable pattern rules | Automatic heuristic classification (no manual config required), simpler than Frog/Sitebulb's config-first approach, fits a self-serve lead magnet |
| Architecture visualization | Crawl "Visualisations" tab — force-directed graph, technical/dense | No native visual site tree (table-based only) | "Visualizations" — directory tree + crawl map, technical audience | Depth-grouped tree only (no full graph) — simpler, more approachable for a non-technical lead-magnet user, matches Octopus.do's audience-friendly style rather than Frog/Sitebulb's technical-audience graphs |

## Sources

- [Google Search Central — General Structured Data Guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) — official policy: marking up content not visible to users is against guidelines; confirms this is a real, documented manual-action risk. HIGH confidence.
- [Google Search Central — FAQPage structured data docs](https://developers.google.com/search/docs/appearance/structured-data/faqpage) — official visibility requirement for FAQ markup. HIGH confidence.
- [Search Engine Journal — Google Allows FAQ Structured Data for Non-FAQ Content](https://www.searchenginejournal.com/google-allows-faq-markup-for-non-faq-content/450080/) — nuance on FAQ policy evolution, MEDIUM confidence (secondary source, cross-checked against official docs).
- [Search Console Help — Manual actions report](https://support.google.com/webmasters/answer/9044175?hl=en) — confirms structured-data manual actions affect rich-result eligibility, not core ranking. HIGH confidence (official).
- WebSearch aggregate on "3-click rule" as SEO-tool convention (Semrush, general SEO-audit-tool practice) — click depth reported as a distribution/threshold check, typically warning-tier not critical. MEDIUM confidence (community/vendor consensus across multiple independent sources, not a single official spec since "3 clicks" is a heuristic best-practice, not a technical requirement).
- Direct codebase inspection: `packages/checks/src/checks/tech/orphanPages.ts` (on-demand internal-link parsing pattern reused for the visualizer), `packages/checks/src/checks/schema/schemaTypes.ts` + `extract.ts` (existing JSON-LD extraction to build on), `packages/report-model/src/grouping.ts` (existing type-based grouping to complement), `packages/psi/src/parser.ts` + `issues.ts` (confirms most Lighthouse audit data is currently discarded, zero extra API cost to surface more), `.planning/PROJECT.md` Key Decisions (precedent for informational/warning severity on architecture-guidance-type checks, e.g. CSR/SSR). HIGH confidence (ground truth, not inferred).

---
*Feature research for: SEO/technical web auditor (v1.3 milestone)*
*Researched: 2026-07-08*
