# Feature Research

**Domain:** SEO/technical web-audit tool (lead magnet) — milestone v1.2 (render detection + report export)
**Researched:** 2026-07-06
**Confidence:** HIGH (checks/behavior verified against SEO-tool conventions + W3C/WCAG; export libs verified against live npm)

> Scope: only the 7 NEW v1.2 features. Existing crawl+checks+PSI+scoring+report+history+email are treated as fixed inputs. Categorization (table stakes / differentiator / anti-feature) is relative to what a "Screaming Frog but more complete and automated" audit is expected to deliver.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features an audit tool of this class is assumed to have. Missing = the report feels shallow next to Screaming Frog / Sitebulb / Semrush.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Deeper canonical checks** (extend TECH-04) | Canonical misconfig is a top-5 GSC technical issue (per J. Mueller). "Has a canonical" alone is table-stakes-minus; real auditors flag canonical→redirect, canonical→noindex, canonical→4xx, chains, cross-domain, conflicting tags. | **MEDIUM** | Some sub-checks are per-page (Cheerio-only): multiple/conflicting, relative-vs-absolute, cross-domain, canonical+noindex on same page. Others need the crawled page SET (canonical target's status/redirect/noindex) → must run as a **SiteCheck**, not the current PageCheck. Canonical targets outside the 500-URL crawl set can only be partially resolved. |
| **Heading hierarchy errors** (extend ONPAGE-03) | Every SEO+a11y auditor reports heading structure (Screaming Frog, Sitebulb, axe, Siteimprove, WAVE). Current check only counts H1s. Skipped levels / empty headings / order are standard. | **LOW** | Pure Cheerio PageCheck extension. Parse h1–h6 in document order; detect: missing H1, multiple H1, skipped level (e.g. H1→H3), empty heading, H1 duplicating `<title>`, excessively long heading. No new pipeline deps. |
| **PDF export (branded)** | A downloadable branded PDF is the default "deliverable" mental model for an audit. Clients expect something they can save/forward. Reinforces juan-tech.com branding on a lead magnet. | **MEDIUM** | On-demand in a Next.js **Node route** (not edge, not worker). Two viable engines: `@react-pdf/renderer` 4.5.1 (pure Node, no Chromium — best fit for Vercel serverless, but re-implements layout in its own primitives) vs headless-Chromium HTML→PDF (`puppeteer` 25.3.0 + `@sparticuz/chromium`, reuses report HTML/CSS but heavy cold start + bundle limits on Vercel). Recommend `@react-pdf/renderer`. |
| **Export button top-right + type selector** | Standard placement for report actions; a dropdown/menu to pick format is the expected interaction (Google Docs, Notion, Ahrefs all do top-right export menus). | **LOW** | Client component: a Button that opens a menu (PDF / Markdown / PPTX), each item hits `/audits/[id]/export?format=…`. Must be keyboard-accessible (v1.1 A11Y baseline already sets the bar: focus-visible, ARIA, keyboard nav). |

### Differentiators (Competitive Advantage)

Features that set this tool apart. These align with Core Value (accurate, actionable, and — for a technical-SEO consultant's lead magnet — modern).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **CSR vs SSR detection** (raw HTML vs Playwright-rendered DOM over a sample) | JavaScript-SEO auditing is a premium capability (Screaming Frog gates it behind JS-rendering mode; Prerender/Sitebulb market it heavily). Detecting "your main content only exists after JS runs" is a genuinely valuable, AEO-relevant finding — LLM crawlers and many bots don't execute JS. Strong fit for a technical-SEO expert's brand. | **HIGH** | Biggest architectural add. Current crawler is **CheerioCrawler (HTTP only)** — `Page.html` is raw server HTML, there is **no rendered DOM stored**. Requires a **Playwright render pass in the WORKER** over a *sample* (not all 500 — 5–10× cost), storing rendered HTML/text (new `Page.renderedHtml` or a sampled side-table), then a check that diffs raw vs rendered. PROJECT.md already anticipates this ("Agrega Playwright al worker … ENRICH"). Signals below. |
| **Markdown-for-LLM export** | This is the standout differentiator. A `.md` structured so an LLM (or the user's coding agent) can read the audit and *apply* fixes directly. No mainstream SEO tool ships this. Directly serves the "actionable" core value and the AEO positioning the product already has (v1 shipped `llms.txt` checks). | **MEDIUM** | Pure string assembly from the same Postgres data the report page reads — cheapest export to build, highest differentiation. Structure it per the `llms.txt` conventions (see design below): YAML front-matter metadata, H1 title, blockquote summary, grouped H2 sections, one issue block per finding with page/selector → measured value → criterion → recommendation, code-fence-able snippets. |
| **PPTX export (client-facing deck)** | Turns a self-serve report into a consultant-grade artifact. A prospect can walk their team through it — extends the lead-magnet's reach and screams "hire this person." Rare among self-serve tools. | **MEDIUM** | `pptxgenjs` 4.0.1 (pure Node, no Chromium — works in a Vercel Node route). Generate slides programmatically from scores/issues. Deck structure below. Keep it 7–12 slides (focused decks outperform 40-page dumps per practitioner consensus). |

### CSR/SSR detection — signals to report (design detail)

Report at **page level** but roll up to a **site/template-level verdict** (CSR is almost always a template property; per-page noise is unhelpful). Signals, strongest first:

1. **Raw-vs-rendered content-diff ratio** — main signal. Compare visible text (or word count) of raw `Page.html` vs Playwright-rendered DOM. Large positive delta (rendered ≫ raw) ⇒ content is client-injected. Mirrors Screaming Frog's "JS Word Count %" / "Word Count Change" and its "Show Differences".
2. **Near-empty raw `<body>`** — raw body has little/no text but rendered body is full ⇒ classic CSR/SPA.
3. **Framework root markers in raw HTML** — `<div id="__next">`, `<div id="root">`, `<div id="app">`, `ng-app` / `ng-version`, `data-reactroot`, `<astro-island>`, hydration markers. Informational corroboration, not proof on their own (Next.js SSR also has `__next`).
4. **`<title>` / meta present in raw vs only after render** — if title/meta description/canonical exist only in the rendered DOM, that is a concrete SEO risk (bots relying on raw HTML miss them).
5. **Main content / internal links only in rendered DOM** — links injected by JS may not be discovered by non-rendering crawlers.

**How to present / severity:**
- Frame as **informational-to-warning**, not automatically critical. Fully SSR/SSG ⇒ `ok` (positive signal). Content present in raw AND rendered ⇒ `ok`. Heavy CSR where **title/meta/canonical or primary content is missing from raw HTML** ⇒ **`warning`** (SEO + AEO risk: non-JS bots and most LLM crawlers see an empty page). Reserve `critical` only if the page is essentially blank without JS.
- This mirrors how Screaming Frog/Sitebulb present it: they *surface the difference* and let severity follow from what's missing, rather than declaring "CSR = bad."
- Emit a **site-level summary issue** ("N of M sampled pages rely on client-side rendering for primary content") plus per-sampled-page detail, consistent with the existing site-level vs page-level issue model (`scope` vs `pageId`).

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Render all 500 URLs with Playwright** | "Detect CSR everywhere / render everything for accuracy." | 5–10× memory/CPU vs Cheerio; blows the worker's memory budget and turns a free audit into an expensive, slow job. CSR is a template property — sampling captures it. | Render a **representative sample** (homepage + a few template-distinct URLs; can reuse the PSI sampling set). Flag template-level. |
| **Puppeteer/Chromium HTML→PDF on Vercel** | "Reuse the exact report HTML/CSS for pixel-perfect PDF." | Chromium in a Vercel serverless function needs `@sparticuz/chromium`, bloats bundle toward the 50MB limit, slow cold starts, fragile. | `@react-pdf/renderer` (pure Node) for PDF; keep visual parity by reusing design tokens/colors, not the DOM. |
| **Live-editable / WYSIWYG export builder** | "Let users customize the deck/PDF before download." | Huge scope, distracts from the lead-magnet's job (capture email, deliver value fast). | Fixed, well-branded templates. One good layout per format. |
| **Marking CSR as a hard failure / big score penalty** | "CSR is bad for SEO, tank the score." | False positives: Next.js/SSG sites carry framework markers yet are perfectly indexable; over-penalizing produces wrong, un-credible reports and undercuts trust in the lead magnet. | Report the *difference* and only warn when concrete signals (missing title/meta/content in raw) are present. Keep scoring impact modest. |
| **Async/queued export generation** | "Exports might be slow, offload to worker." | Adds queue/state/polling complexity for artifacts that are seconds to build from already-persisted data. PROJECT.md explicitly wants exports **on-demand in a Next.js Node route, no worker/queue**. | Synchronous Node route streaming the file; only revisit if a format proves slow. |
| **DOCX / XLSX / CSV export too** | "More formats = more value." | Format sprawl; each needs a maintained template. Three formats already cover save (PDF), machine/LLM (MD), present (PPTX). | Ship the 3 planned; defer others until asked. |

---

## Feature Dependencies

```
CSR/SSR detection
    └──requires──> Playwright render pass in WORKER (new)
                       └──requires──> stored rendered DOM/text (new Page field or side-table)
    └──enhances──> AEO category (non-JS/LLM-crawler visibility)

Deeper canonical (TECH-04+)
    └──requires──> crawled page SET lookup (SiteCheck) for canonical→target status/noindex/redirect
    └──reuses────> existing redirects / indexability checks' logic

Heading hierarchy (ONPAGE-03+)
    └──requires──> nothing new (Cheerio PageCheck only)

Export button + type selector
    └──requires──> export routes for each format

PDF export ───┐
Markdown-LLM ─┼──all require──> same persisted audit data the report page already queries
PPTX export ──┘                 (scores, issues, perf, diff) — read-only, on-demand Node route

New checks (CSR/canonical/headings) ──feed──> all 3 exports (more issues to render)
```

### Dependency Notes

- **CSR/SSR requires a worker render pass:** the crawler is HTTP-only (CheerioCrawler); `Page.html` = raw server HTML, no rendered DOM exists. This is the only v1.2 feature that touches the worker/pipeline and adds a Playwright dependency + a schema field. Sequence it before its check. Reuse the PSI sample selection to pick which pages to render.
- **Deeper canonical needs cross-page context:** canonical→noindex, canonical→4xx/redirect, and canonical-chain detection require looking up the canonical *target* among crawled pages (its `statusCode`, `redirectChain`, and noindex from its `html`). Current TECH-04 is a per-page check with no access to other pages → the deep checks should run as a **SiteCheck** (or a new TECH-04b site-level check) while per-page sub-checks (multiple/relative/cross-domain/canonical+noindex) can stay page-level. Targets outside the crawl set are unresolved — report as "not verified" rather than false-flagging.
- **Headings has no new deps:** cleanest, lowest-risk — ideal early/parallel work.
- **All three exports depend on the same read path:** they re-query the exact data the report page assembles (`Audit.scores`, `Issue` rows, `stats.perf`, diff). Build a shared server-side "audit report DTO" once, feed all three renderers. New v1.2 checks automatically enrich every export.
- **Export button depends on the routes existing** but can be built against a stub; low coupling.

---

## MVP Definition

### Launch With (v1.2 core)

- [ ] **Heading hierarchy checks** — lowest complexity, pure table-stakes gap, no pipeline risk.
- [ ] **Deeper canonical checks** — table-stakes credibility for a technical-SEO tool.
- [ ] **Markdown-for-LLM export** — highest differentiation per unit of effort (string assembly from existing data).
- [ ] **PDF export** — the expected "deliverable."
- [ ] **Export button + type selector** — required to expose the exports at all.

### Add After Validation (within v1.2, after the above land)

- [ ] **CSR/SSR detection** — highest complexity and the only worker/schema change; sequence after the lower-risk checks so the validated pipeline is touched last and deliberately. Gate behind the Playwright-in-worker addition.
- [ ] **PPTX export** — valuable but the least "expected"; ship after PDF/MD prove the export path.

### Future Consideration (v2+ / out of this milestone)

- [ ] Additional export formats (DOCX/CSV) — only on demand.
- [ ] Per-template CSR grouping UI in the on-screen report — start with export/issue reporting first.
- [ ] Rendering-based re-crawl of JS-only internal links — heavier; defer.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Heading hierarchy errors | MEDIUM | LOW | P1 |
| Deeper canonical checks | HIGH | MEDIUM | P1 |
| Markdown-for-LLM export | HIGH | MEDIUM | P1 |
| PDF export (branded) | HIGH | MEDIUM | P1 |
| Export button + type selector | HIGH (gates exports) | LOW | P1 |
| CSR/SSR detection | HIGH | HIGH | P2 |
| PPTX export | MEDIUM | MEDIUM | P2 |

**Priority key:** P1 = must have for the milestone · P2 = should have, sequence after P1 lands · P3 = defer.

---

## Design Detail: severities & layouts (for requirements + roadmapper)

### Canonical sub-checks — proposed severities

| Sub-check | Severity | Rationale |
|-----------|----------|-----------|
| Canonical → noindex target | **critical** | Conflicting signals; risks *no* version being indexed. |
| Canonical + `noindex` on same page | **critical** | Google may drop the page entirely; contradictory directives. |
| Canonical → 4xx/5xx target | **critical** | Points authority at a broken URL. |
| Canonical → redirect (not final URL) | **warning** | Wastes crawl/consolidation; should point to final 200 URL. |
| Canonical chain (target itself canonicalizes elsewhere) | **warning** | Google follows to chain end; ambiguous intent. |
| Cross-domain canonical (unintended) | **warning** | Often a migration/staging leak; verify intent. |
| Multiple conflicting canonicals | **warning** | Already partially handled; keep. |
| Relative (non-absolute) canonical href | **warning** | Google recommends absolute; relative can resolve wrong. |
| Missing self-referencing canonical | **warning** | Current TECH-04 behavior; keep. |
| Canonical → non-canonical (mismatch with resolved/final URL) | **warning** | Current "points to other URL" logic; keep. |

### Heading sub-checks — proposed severities

| Sub-check | Severity | Rationale |
|-----------|----------|-----------|
| Missing H1 | **critical** | Current ONPAGE-03 behavior; keep. |
| Multiple H1 | **warning** | Current behavior; bad practice but not a WCAG-AA failure. |
| Skipped heading level (e.g. H1→H3) | **warning** | Breaks outline for screen readers + crawlers/AI parsing. |
| Empty heading | **warning** | Usually CMS glitch; confuses AT and outline. |
| Headings out of document order | **warning** | Same outline-integrity concern. |
| H1 duplicates `<title>` verbatim | **ok (advisory)** | Minor; note, don't penalize hard. |
| Excessively long heading (> ~70 chars) | **ok (advisory)** | Readability/snippet hygiene; low severity. |

> Reuse the existing `severity ∈ {critical, warning, ok}` model. Where "advisory" is suggested above, emit `ok` with a non-empty recommendation (the model has no separate info tier).

### PDF layout (order)

1. **Cover** — audited domain, audit date, overall score gauge, juan-tech.com branding (Array/Khand fonts, brand colors from v1.1 tokens).
2. **Executive summary** — overall status + one-line per category, count of critical/warning/resolved.
3. **Category scorecard** — the 5 category scores with statuses.
4. **Prioritized issues table** — critical→warning, with page / measured value / criterion / recommendation (mirror on-screen "Issues prioritarios").
5. **Core Web Vitals** — mobile + desktop (score, LCP, CLS, INP, TTFB) from `stats.perf`, note it's a PSI sample.
6. **Changes vs previous audit** — new / persistent / resolved (if a prior audit exists).
7. **Recommendations / next steps + CTA** to juan-tech.com.

### Markdown-for-LLM structure

- **YAML front-matter**: domain, audit date, audit id, overall score + status, per-category scores, issue counts. Machine-parseable header.
- **H1** = "SEO/Technical Audit — {domain}"; **blockquote** one-paragraph summary (llms.txt convention).
- **H2 per category** (prefer grouping by category, then severity within), each issue as a compact block:
  `### {checkId} — {title}` then fields: **Page/URL**, **Selector** (where applicable, e.g. the offending heading/canonical), **Measured value**, **Criterion**, **Recommendation**. Keep recommendations imperative and concrete so an agent can act.
- Use fenced code blocks for any HTML snippet to fix (e.g. corrected `<link rel="canonical">`).
- Valid, plain Markdown parseable by standard libraries (no custom extensions) — the whole point of llms.txt-style formatting.
- MVP = the single structured `.md`; an `llms-full`-style variant can come later.

### PPTX deck (7–12 slides)

1. Title (domain + date + brand). 2. Executive summary (3 strengths / 3 problems / 3 priority actions). 3. Overall + category scorecard. 4–8. One slide per category (tech / perf-CWV / on-page / schema / AEO) with its top issues. 9. Top prioritized issues (quick wins vs bigger fixes by impact/effort). 10. Next steps + CTA. Keep it focused; a tight deck beats a 40-slide dump.

### Export UX

Top-right **Export** button on the report header → menu with PDF / Markdown / PPTX. Each triggers a download from `/audits/[id]/export?format=…` (Node route sets `Content-Disposition`). Show a lightweight loading state per item; keep keyboard/ARIA accessible per the v1.1 A11Y baseline.

---

## Competitor Feature Analysis

| Feature | Screaming Frog | Sitebulb / Semrush | Our Approach |
|---------|----------------|--------------------|--------------|
| CSR/SSR detection | JS-rendering mode + "Show Differences" / JS Word Count % (manual, gated) | Sitebulb JS-rendering audit; Prerender markets JS-SEO | Automated sample-based raw-vs-rendered diff, template-level verdict, AEO-framed |
| Canonical depth | Full canonical error set (chains, non-indexable, cross-domain) | Full set + prioritized | Extend TECH-04 toward parity via SiteCheck; honest "not verified" for off-crawl targets |
| Heading hierarchy | H1/H2 counts + structure | Structure + a11y overlap | Full h1–h6 order/skip/empty checks |
| Export | CSV/XLSX; Looker Studio; PDF (limited) | Branded PDF/HTML reports | Branded PDF + **LLM-Markdown (unique)** + PPTX deck |

---

## Sources

- Screaming Frog JS rendering / "Show Differences" / JS Word Count — https://www.screamingfrog.co.uk/seo-spider/user-guide/configuration/ , https://web.swipeinsight.app/posts/technical-seo-tip-screaming-frog-s-show-differences-highlights-javascript-loaded-content-6738 — MEDIUM-HIGH
- JS-SEO auditing (Screaming Frog vs Prerender) — https://prerender.io/blog/screaming-frog-vs-prerender-for-javascript-seo-auditing/ — MEDIUM
- Canonical issues (chain / →redirect / →noindex, top-5 GSC issue) — https://seranking.com/blog/canonical-tag-issues/ , https://www.atroposdigital.com/blog/seo-canonical-issues — MEDIUM
- Heading hierarchy a11y + SEO (skipped levels, empty, multiple H1, not a WCAG-AA violation) — https://www.w3.org/WAI/tutorials/page-structure/headings/ , https://equalizedigital.com/accessibility-checker/incorrect-heading-order/ , https://indexguru.com/blog/skipped-heading-levels-impact-on-seo-and-accessibility — HIGH (W3C) / MEDIUM
- llms.txt format spec (front-matter/H1/blockquote/H2 grouped links, machine-parseable) — https://llmstxt.org/ , https://www.answer.ai/posts/2024-09-03-llmstxt.html — HIGH
- SEO audit deck structure (7–12 slides, exec summary 3/3/3, scorecard) — https://prateeksha.com/blog/seo-audit-presentation-template-storytelling — MEDIUM
- Export library versions (live npm, 2026-07-06): `@react-pdf/renderer` 4.5.1, `pptxgenjs` 4.0.1, `puppeteer` 25.3.0, `playwright` 1.61.1, `docx` 9.7.1 — HIGH
- Codebase (verified by reading): CheerioCrawler HTTP-only, `Page.html` raw only (no rendered DOM), TECH-04 per-page canonical, ONPAGE-03 H1-count only, report page data shape (`Audit.scores`, `Issue`, `stats.perf`, diff) — HIGH

---
*Feature research for: SEO/technical web-audit tool — v1.2 (render detection + report export)*
*Researched: 2026-07-06*
