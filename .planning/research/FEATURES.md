# Feature Research

**Domain:** Web-audit / SEO-crawler SaaS (lead magnet)
**Researched:** 2026-07-05
**Confidence:** HIGH for table stakes (well-established category, cross-verified across Screaming Frog / Sitebulb / Ahrefs / Semrush / Lighthouse docs), MEDIUM for AEO/AI-visibility checks (fast-moving, less standardized), MEDIUM for lead-magnet gating mechanics (verified against email-marketing best-practice sources, not audit-tool specific).

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in *any* credible site-audit tool. Missing these makes the report feel incomplete or the score feel untrustworthy — directly threatens Core Value ("auditoría completa, precisa y accionable").

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Sitemap-based URL discovery + link-crawl fallback | Every competitor (Screaming Frog, Sitebulb, Ahrefs, Semrush) starts from sitemap.xml or robots.txt-declared sitemaps, falls back to following `<a href>` links when no sitemap exists | MEDIUM | Auto-discover via `robots.txt` `Sitemap:` directive first, then `/sitemap.xml` convention, then crawl-by-links if both fail. Already in PROJECT.md Active scope. |
| robots.txt respect (politeness) | Legal/ethical baseline; all major crawlers respect `Disallow` by default and offer an explicit override switch for advanced users | LOW | Screaming Frog defaults to respecting robots.txt and will not crawl disallowed sites unless the user overrides it. Match this default. |
| Configurable crawl rate limiting | Prevents auditor from DoS-ing the target site / getting IP-banned; industry norm is concurrency + delay knobs | LOW-MEDIUM | Screaming Frog exposes "Speed" config (max threads, max URI/sec). For a hosted SaaS crawling *other people's* sites without prior arrangement, a conservative default (e.g. 1-2 req/sec, low concurrency) is non-negotiable — this is the biggest abuse/legal risk in the whole product. |
| Crawl depth / URL count limits | Needed to bound cost and crawl time; matches the 500-URL free-tier cap already decided | LOW | Depth limit + total-URL limit + max query-param depth (avoid infinite faceted-nav crawl traps). |
| HTTP status / redirect chain detection | Core technical SEO signal in every tool: 4xx, 5xx, redirect chains/loops | LOW-MEDIUM | Already in Active scope. |
| Canonical tag validation | Table stakes technical SEO check across all competitors | LOW | Self-referencing canonical, canonical to non-indexable page, missing canonical, conflicting canonical vs. rel=canonical HTTP header. |
| Indexability / meta robots / X-Robots-Tag detection | Universal check — flags noindex, nofollow at page/directive level | LOW | |
| Broken internal/external links & broken resources (images/CSS/JS) | Universal; directly actionable, high perceived value | MEDIUM | External link checking requires following off-site links just for status (not full crawl) — rate-limit-sensitive. |
| Duplicate / near-duplicate content detection | Standard in Screaming Frog (near-duplicate via similarity hashing), Sitebulb, Ahrefs | MEDIUM-HIGH | Near-duplicate detection (vs. exact) needs a similarity algorithm (e.g. shingling/minhash on visible text) — meaningfully harder than exact-hash duplicate title/meta detection. Exact-duplicate title/meta is LOW complexity and should ship first; near-duplicate content can be a fast-follow. |
| Orphan pages / click-depth analysis | Universal technical SEO check, requires sitemap-vs-crawl-graph comparison | MEDIUM | Needs URLs from sitemap that were never reached by internal-link crawl — depends on both sitemap discovery AND link-graph crawl being implemented. |
| hreflang validation | Present in Ahrefs/Semrush/Sitebulb for any site with intl variants | LOW-MEDIUM | Return-tag validation (bidirectional hreflang), missing x-default. Lower priority if target audience is mostly single-language SMB sites, but cheap to include as a pass/skip check. |
| Mixed content detection (HTTP resources on HTTPS page) | Universal, cheap check | LOW | |
| Title / meta description / H1 presence, length, duplication | THE most basic on-page check across every tool ever built in this category | LOW | |
| Image alt text presence | Universal on-page + accessibility signal | LOW | |
| Open Graph / social meta tags | Standard in on-page audits (Sitebulb, Semrush) | LOW | |
| `lang` attribute presence/validity | Common on-page check | LOW | |
| Structured data (JSON-LD) presence + schema.org validation | Table stakes in modern audits (Ahrefs, Semrush, Sitebulb all validate schema); Google's Rich Results eligibility depends on it | MEDIUM | Validate against schema.org vocab + required/recommended properties per type; flag syntax errors (invalid JSON) separately from semantic errors (missing required fields). |
| Core Web Vitals (LCP, CLS, INP) + Performance score, mobile + desktop | Table stakes since 2021 Page Experience update; every serious tool surfaces CWV | MEDIUM-HIGH | Already decided: Lighthouse/unlighthouse (lab data) + PSI API (lab + CrUX field data). Field data (CrUX) requires enough real traffic on the audited site — origin-fallback needed for low-traffic sites, and PSI has documented rate limits. |
| Overall score (0-100) + per-category scores with status bands | Universal report structure (Ahrefs "Health Score", Semrush "Site Health", Sitebulb "Audit Score"/"SEO Score") | MEDIUM | Scoring model itself is a design decision, not a fixed fact — see Architecture doc. Table stakes is *having* a score; the exact formula is a differentiator lever. |
| Severity classification (Critical/Warning/Notice or similar 3-tier) | Universal — Ahrefs uses Error/Warning/Notice, Semrush Errors/Warnings/Notices, Sitebulb similar tiers | LOW | Confirmed via Ahrefs and Semrush help docs (see Sources). 3-tier severity is the de facto standard; don't invent a 5-tier scheme without strong reason. |
| Per-issue detail: measured value, source/criterion, recommendation | This is explicitly the target output format per the reference report (juan-tech.com 86/100) | LOW-MEDIUM | Already defined by reference report — treat as fixed requirement, not open question. |
| Prioritized issues table (sortable/filterable by severity, category, affected-URL-count) | Universal UX pattern in every competitor's report UI | MEDIUM | |
| Progress reporting for long-running crawls | Any crawl over ~30 seconds needs visible progress or users assume it's broken/abandon | MEDIUM | Directly required by 500-URL/background-worker architecture already decided (queue + worker). Needs at minimum: URLs discovered vs. crawled count, current phase (crawling / running Lighthouse / scoring), ETA or live percentage. |
| Email capture + verification before running audit | Explicit requirement in PROJECT.md; also the fraud/abuse control for a free crawler-as-a-service | LOW-MEDIUM | Double opt-in confirmation rates typically run 65-85%; expect real signups to be materially lower than raw form submissions — factor into growth expectations, not a build risk. |
| Quota enforcement (1 audit/week/email, 500 URL cap) | Explicit requirement; needed to control infra cost (Lighthouse runs are the expensive part) | MEDIUM | Requires persistent state keyed by verified email (not just cookie/IP, which is trivially bypassed) — ties directly to the "Persistence" feature below. |

### Differentiators (Competitive Advantage)

Features that set this product apart from the big incumbents, or that specifically serve the lead-magnet growth loop. Should align with Core Value and the "AI Visibility/AEO" category already in scope.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI Visibility / AEO category (AI-crawler access, llms.txt, AI-oriented structured data, content format) | Incumbent generalist tools (Screaming Frog, Sitebulb) don't ship this as a first-class *scored category* yet; positions juan-tech.com as ahead of the curve on a hot 2026 topic | MEDIUM | Verified: audits should check explicit allow/disallow for GPTBot, ClaudeBot, PerplexityBot, Google-Extended in robots.txt — this is the single highest-impact AEO check (a blocking robots.txt rule nullifies everything else). llms.txt presence is a much weaker signal in practice — Ahrefs' own June 2026 study of 137K sites found 97% of llms.txt files get zero AI-crawler requests, and Google states llms.txt isn't needed for AI Search visibility. **Recommendation: score llms.txt presence as a low-weight/informational check, not a heavily-weighted one — don't let a hyped-but-low-impact signal skew the category score.** FAQPage/HowTo schema and E-E-A-T-adjacent content signals are the more defensible AEO checks. |
| Run comparison / diffing (has an issue been fixed since last audit?) | Nobody in the free/lead-magnet tier space does this well; turns a one-off report into a reason to come back weekly, which is the whole point of the "1/week" quota | MEDIUM-HIGH | Requires persistence of full issue-level results per audit run keyed to (email, domain), then a diff algorithm comparing issue IDs + affected URLs between two runs (fixed / new / persisting / regressed). This is explicitly called out in PROJECT.md as an Active requirement — treat as core, not optional polish. |
| Raw HTML vs. rendered HTML comparison (Cheerio vs. Playwright) | Surfaces JS-dependent SEO problems (content/links only visible after JS execution) that Cheerio-only tools miss entirely — a genuine technical differentiator vs. cheap "SEO checker" clones | HIGH | PROJECT.md flags this as "deseable," not committed. Running a full headless browser (Playwright) per URL at 500-URL scale is materially more expensive in worker CPU/time than Cheerio parsing of raw fetched HTML — this is a real cost/latency tradeoff for the free tier, not just an engineering nice-to-have. Consider limiting rendered-HTML comparison to a sample of URLs (e.g. homepage + top N by depth) rather than the full crawl in v1. |
| Historical trend view per verified email/domain (score over time across audits) | Natural extension of run-diffing; reinforces weekly-return habit and gives Juan a longitudinal case study for sales conversations | LOW-MEDIUM | Falls out almost for free once persistence + diffing exist — mostly a reporting/UI feature on top of already-stored data. |
| Branded, consultant-credible report design matching reference report format | Differentiates from generic "SEO checker" spam tools; report format is explicitly the sales artifact for juan-tech.com | LOW-MEDIUM | Reference report already defines the target format — this is really a design/fidelity task, not new feature scope. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create disproportionate cost, risk, or scope creep relative to a v1 lead-magnet.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Paid tiers / unlimited audits / unlimited URLs | Obvious monetization path, "why not build it now" | Adds billing, plan-gating, upgrade UX, and pricing-strategy risk before the free-tier lead-magnet hypothesis is even validated; already explicitly Out of Scope in PROJECT.md | Ship free tier only in v1, instrument usage/conversion, revisit pricing in v2 once demand is proven |
| Auto-fixing detected errors on the user's site | Feels like the "ultimate" value-add, natural extension of "we found the problem, why not fix it" | Requires write access to someone else's production site (impossible for a lead magnet auditing arbitrary domains), massive liability if a "fix" breaks something, totally out of scope for a detect-and-recommend tool | Detect + prioritized recommendation only (already the stated Core Value); recommendations link to juan-tech.com services as the "fix" |
| Domain Rating / backlink data / other paid third-party metrics baked into the score | Looks like it makes the score more "authoritative" (like Ahrefs DR) | Creates a hard dependency on a paid third-party API for the *core* scoring loop, contradicts PROJECT.md's explicit Out of Scope decision, and couples audit availability to a vendor's uptime/pricing | Keep third-party paid metrics (DR, backlinks) as optional *contextual* enrichment shown outside the score, never as a scoring input |
| Real-time live progress via websockets with per-URL streaming detail | Feels more "premium" / impressive UX | Meaningful added infra complexity (persistent connections, reconnect handling) for marginal UX gain over polling; background worker + queue architecture already fits polling better | Poll-based progress (percentage + phase + counts) refreshed every few seconds is sufficient for a crawl that takes minutes, not seconds |
| Unlimited crawl depth / no URL cap even on free tier | "More thorough = better audit" intuition | Directly contradicts the explicit 500-URL cap decision, and uncapped crawls are the single biggest cost/abuse vector (arbitrary URL submitted by anonymous-ish users hitting your Lighthouse-running worker) | Hard 500-URL cap + configurable depth limit, already decided |
| Crawling disallowed/robots.txt-blocked sections by default | "We want the most complete audit possible" | Ethically and often legally risky when auditing arbitrary third-party sites the user doesn't necessarily own/control (unlike Screaming Frog run locally by the site owner); reputational risk for juan-tech.com as a consultant brand | Respect robots.txt by default; if an override is ever offered, gate it behind proof of domain ownership (e.g. same email-verification pattern extended, or DNS/meta-tag verification) |
| Native mobile app | Perceived legitimacy / "real product" signal | Explicit Out of Scope in PROJECT.md; no evidence users expect a mobile app for what is fundamentally a "paste URL, wait, read report" workflow | Responsive web report is sufficient; email delivery of report link covers the "check it later on phone" use case |
| Auditing IP addresses / arbitrary non-owned domains without any ownership signal, unlimited targets | "Frictionless, just try it on any URL" | Turns the tool into a free, unauthenticated scanning proxy — abuse vector for scanning third parties' sites anonymously (SSRF-adjacent risk, reputational risk if used against sites the requester doesn't own) | Email verification (already required) + reasonable rate limiting is the minimum viable guard; consider a lightweight domain-ownership signal before generalizing beyond "your own site" positioning |

## Feature Dependencies

```
Sitemap discovery + link-crawl fallback
    └──requires──> robots.txt parsing (for sitemap location + crawl politeness)

Orphan page / click-depth analysis
    └──requires──> Sitemap discovery (full URL universe)
    └──requires──> Link-graph crawl (which URLs were actually reached, and at what depth)

Near-duplicate content detection
    └──enhances──> Duplicate title/meta detection (exact-match version ships first, cheaper)

Core Web Vitals / Performance category
    └──requires──> Background worker + queue (Lighthouse runs are slow/CPU-heavy, can't run in a serverless request)

Progress reporting for long crawls
    └──requires──> Background worker + queue (nothing to report progress on without async execution)

Quota enforcement (1/week/email, 500 URL cap)
    └──requires──> Email capture + verification (double opt-in)
                       └──requires──> Persistence layer (verified emails table)

Run comparison / diffing
    └──requires──> Persistence of full per-run issue data keyed to (email, domain)
    └──requires──> Quota/email system (need a stable identity — verified email — to compare "this site over time")

Historical trend view
    └──enhances──> Run comparison / diffing (same stored data, different view)

Raw HTML vs. rendered HTML comparison
    └──requires──> Cheerio-based extraction (baseline, already decided)
    └──requires──> Playwright rendering (optional/sampled — HIGH cost, conflicts with 500-URL free-tier cost budget if applied to every URL)

AI Visibility / AEO category
    └──requires──> robots.txt parsing (AI-crawler allow/disallow is the highest-weight AEO check)
    └──enhances──> Structured data validation (FAQPage/HowTo schema checks overlap with the Structured Data category)

Overall score + per-category scores
    └──requires──> Severity classification (score formula consumes issue severities)
    └──requires──> All check categories implemented (score is a function of check results, not a standalone feature)
```

### Dependency Notes

- **Orphan-page detection requires both sitemap discovery and link-graph crawl:** you can only call a page "orphaned" if it's in the declared sitemap but was never reached by following internal links during the crawl — both data sources must exist before this check is meaningful.
- **Quota enforcement requires email verification, which requires persistence:** the 1-audit/week rule is only enforceable against a durable identity (verified email in a database), not a request-scoped signal like IP or cookie — this pulls the persistence layer earlier in the roadmap than it might otherwise land.
- **Run-diffing requires the same persistence + identity system as quota enforcement:** these two requirements should likely land in the same phase since they share the underlying data model (audits keyed by verified email + domain, with full issue-level detail retained, not just summary scores).
- **Rendered-HTML comparison (Playwright) conflicts with the 500-URL cost budget if applied indiscriminately:** running headless Chrome per URL at scale is an order of magnitude more expensive than Cheerio parsing; recommend sampling (e.g., top N URLs by internal PageRank/depth) rather than full-crawl rendering in v1, or deferring entirely to v1.x once real cost data exists.
- **AEO category and Structured Data category overlap on FAQPage/HowTo schema:** implementation can likely share a JSON-LD parsing/validation utility between the two scored categories rather than duplicating schema-parsing logic.
- **Scoring model depends on severity classification being finalized first:** don't build the 0-100 formula before locking the 3-tier (or similar) severity taxonomy, since the score is arithmetic over severities/weights.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept and match the reference-report bar (already largely mirrors PROJECT.md's Active scope).

- [ ] Sitemap discovery + link-crawl fallback, robots.txt-respecting, rate-limited — essential: without it there's no crawl, and without politeness defaults it's a liability
- [ ] Core technical SEO checks (status codes, redirects, canonical, indexability, broken links/resources, mixed content, hreflang) — essential: this is the bulk of what makes a "technical SEO audit" credible
- [ ] Exact-match on-page checks (title/meta/H1/alt/OG/lang length & presence) — essential, cheapest high-value category
- [ ] Structured data presence + schema validation — essential per reference report's 5-category structure
- [ ] Core Web Vitals via Lighthouse/unlighthouse + PSI (mobile + desktop) — essential per reference report; already architecturally committed (background worker)
- [ ] AI Visibility/AEO checks — at minimum: AI-crawler robots.txt access, llms.txt presence (low weight), FAQPage/HowTo schema presence — essential per reference report's 5th category and the product's key differentiator
- [ ] Overall score + per-category scores with status bands (Bueno/Necesita mejora/Crítico) — essential, this is the headline deliverable
- [ ] Severity-classified, prioritized issues table + per-issue detail (measured value, source, criterion, recommendation) — essential, matches reference report format exactly
- [ ] Email capture + double opt-in verification gating audit access — essential, explicit requirement and core abuse control
- [ ] Quota enforcement (1/week/email, 500 URL cap) — essential, explicit requirement and cost control
- [ ] Persistence of audits keyed to verified email + domain — essential, underpins quota AND diffing
- [ ] Background worker/queue execution with progress reporting — essential, required by the 500-URL scale and explicit no-timeout requirement
- [ ] Basic run comparison (fixed / new / persisting issues between two runs for the same domain+email) — essential per explicit PROJECT.md requirement, don't defer since persistence model must support it from day one anyway

### Add After Validation (v1.x)

Features to add once the core loop (crawl → score → report → email capture → return next week) is proven.

- [ ] Near-duplicate content detection (similarity-based, beyond exact title/meta match) — add once exact-match duplicate detection is shipped and there's evidence users want finer-grained content-quality signals
- [ ] Rendered-HTML vs. raw-HTML comparison via Playwright, sampled subset of URLs — add once cost/latency budget for the free tier is well understood from real crawl data; too risky to commit blind in v1 given 500-URL scale
- [ ] Historical trend charts (score over time, multi-run) — add once several weeks of repeat-audit data exist per user to make a trend meaningful
- [ ] Expanded AEO signal set (E-E-A-T content markers, citation-readiness heuristics) — add as the AEO/AI-search space matures and stabilizes; currently too volatile to over-invest in v1 (see llms.txt research finding above)
- [ ] Export formats (PDF/CSV download of the report) — add once report UI itself is validated; not required for the initial "view report in browser + email link" loop

### Future Consideration (v2+)

Features to defer until product-market fit (lead-to-client conversion) is established.

- [ ] Paid tiers / unlimited audits — explicitly deferred in PROJECT.md until free-tier hypothesis validated
- [ ] Domain-ownership verification flow (for any future robots.txt-override or deeper-crawl option) — only needed if/when the product ever offers more-than-default crawl permissions
- [ ] Multi-user/team accounts, white-label reports for agencies — not relevant to a single-consultant lead-magnet positioning until there's demand signal
- [ ] API access to audit results — v2 monetization lever, not a v1 concern

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Sitemap discovery + crawl (rate-limited, robots.txt-respecting) | HIGH | MEDIUM | P1 |
| Technical SEO checks (status/redirects/canonical/broken links) | HIGH | MEDIUM | P1 |
| On-page checks (title/meta/H1/alt/OG) | HIGH | LOW | P1 |
| Structured data validation | HIGH | MEDIUM | P1 |
| Core Web Vitals (Lighthouse + PSI) | HIGH | MEDIUM-HIGH | P1 |
| AEO category (AI-crawler access, llms.txt, FAQ schema) | HIGH (differentiator) | MEDIUM | P1 |
| Scoring model (overall + per-category) | HIGH | MEDIUM | P1 |
| Prioritized issues + per-issue detail | HIGH | LOW-MEDIUM | P1 |
| Email capture + double opt-in | HIGH | LOW-MEDIUM | P1 |
| Quota enforcement | HIGH | MEDIUM | P1 |
| Persistence (audits, emails, history) | HIGH | MEDIUM | P1 |
| Background worker + progress reporting | HIGH | MEDIUM | P1 |
| Run comparison / diffing | HIGH (differentiator) | MEDIUM-HIGH | P1 |
| Near-duplicate content detection | MEDIUM | MEDIUM-HIGH | P2 |
| Raw vs. rendered HTML comparison | MEDIUM (differentiator) | HIGH | P2 |
| Historical trend view | MEDIUM (differentiator) | LOW-MEDIUM | P2 |
| Expanded AEO signals (E-E-A-T, citation-readiness) | MEDIUM | MEDIUM-HIGH | P3 |
| PDF/CSV export | LOW-MEDIUM | LOW | P3 |
| Paid tiers | HIGH (business) | HIGH | P3 (deferred by decision, not by value) |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Screaming Frog | Sitebulb | Ahrefs Site Audit | Semrush Site Audit | Our Approach |
|---------|-----------------|----------|--------------------|--------------------|--------------|
| Scoring model | No single score (desktop tool, issue list only) | Two scores: "Audit Score" (all issues) + "SEO Score" (SEO-only), plus per-area scores | Single "Health Score" = errors-only, `(pages without errors / total pages) * 100` — warnings/notices excluded | "Site Health"/Total Score = weighted combination of errors (heavier) and warnings against total possible checks | Single overall 0-100 + per-category scores (Technical SEO, Performance, On-Page, Structured Data, AEO) with status bands — closer to Sitebulb's multi-score approach, adapted to 5 fixed categories per reference report |
| Severity tiers | Issue-type tabs, no formal 3-tier severity label | Priority-tagged issues | Error / Warning / Notice (3-tier) | Errors / Warnings / Notices (3-tier) | 3-tier (Critical/Warning/Notice or equivalent) — matches industry norm, avoids inventing a bespoke taxonomy |
| Crawl politeness | Respects robots.txt by default, configurable speed (threads/URLs-per-sec), user-agent switching | Similar configurable crawl settings | Cloud-based, own crawler infra, presumably rate-limited server-side | Cloud-based, own crawler infra | Respect robots.txt by default; conservative fixed rate limit (not user-configurable in v1, since our users are auditing *others'* — or their own — arbitrary sites via a hosted lead magnet, not running a desktop tool against their own infra) |
| AI/AEO checks | Not a native scored category (as of latest known docs) | Not a native scored category | Not a native scored category | Not a native scored category | Native 5th scored category — genuine differentiator vs. all four incumbents |
| Run comparison/diffing | Local crawl comparison feature exists (desktop, manual) | Change detection between crawls exists (paid feature) | Historical trend graphs of Health Score over time | Historical trend graphs over time | Explicit issue-level diff (fixed/new/persisting) tied to free-tier weekly cadence — positions the "weekly re-audit" quota as a feature, not just a limit |
| Access model | One-time desktop license / subscription, no email-gating | Subscription SaaS | Subscription SaaS | Subscription SaaS | Free, email-gated, quota-limited lead magnet — no incumbent uses this access model, which is the entire point of the product (lead gen, not a competing paid SEO tool) |

## Sources

- [Ahrefs — What is Health Score and how is it calculated in Ahrefs Site Audit?](https://help.ahrefs.com/en/articles/1424673-what-is-health-score-and-how-is-it-calculated-in-ahrefs-site-audit) — MEDIUM-HIGH confidence, official vendor help doc
- [Semrush — How is Site Health Score calculated in the Site Audit tool?](https://www.semrush.com/kb/114-total-score) — MEDIUM-HIGH confidence, official vendor help doc
- [Semrush — Site Audit Overview Report](https://www.semrush.com/kb/540-site-audit-overview)
- [Screaming Frog — SEO Spider Configuration (official user guide)](https://www.screamingfrog.co.uk/seo-spider/user-guide/configuration/) — HIGH confidence, official docs; robots.txt handling, speed/crawl-depth/sitemap-discovery settings
- [Screaming Frog — SEO Spider General](https://www.screamingfrog.co.uk/seo-spider/user-guide/general/)
- [AI Rank Lab — AEO Checklist: 40 Answer Engine Optimization Signals (2026)](https://www.airanklab.com/blog/answer-engine-optimization-checklist-40-signals) — MEDIUM confidence, industry blog, cross-checked with the Digital Applied / Ahrefs study below
- [Digital Applied — Google Says llms.txt Does Nothing for SEO Rankings](https://www.digitalapplied.com/blog/google-llms-txt-no-seo-value-lighthouse-audit-2026) — MEDIUM confidence, references Google's own official AI-search documentation stance
- [Emarketed — 97% Of llms.txt Files Go Unread](https://emarketed.com/aeo/llmstxt-files-go-unread-2026/) — MEDIUM confidence, cites Ahrefs' 137K-site study (June 2026); used to justify low-weighting llms.txt in scoring
- [Customer.io — Double Opt-In for Emails: Best Practices + Examples](https://customer.io/learn/deliverability/double-opt-in-best-practices) — MEDIUM confidence, industry best-practice source (email marketing domain, not audit-tool specific); used for expected confirmation-rate benchmarks
- Reference report (juan-tech.com, 86/100) — internal artifact, HIGH confidence as the binding source of truth for report structure/categories per PROJECT.md
- PROJECT.md — internal artifact defining explicit Active scope and Out of Scope decisions used to anchor table-stakes vs. anti-feature classification

---
*Feature research for: Web-audit / SEO-crawler SaaS lead magnet*
*Researched: 2026-07-05*
