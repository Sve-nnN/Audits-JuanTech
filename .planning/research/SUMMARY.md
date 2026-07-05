# Project Research Summary

**Project:** Auditor Web (SEO/Técnico) — Lead Magnet para juan-tech.com
**Domain:** Automated SEO/technical web-audit crawler SaaS (lead magnet), Screaming-Frog-like
**Researched:** 2026-07-05
**Confidence:** HIGH

## Executive Summary

This is a well-established product category (technical SEO audit crawler à la Screaming Frog / Sitebulb / Ahrefs Site Audit / Semrush Site Audit) with two genuine twists: it's given away free as a lead-gen mechanism (email-gated, quota-limited) rather than sold as a subscription tool, and it adds a native "AI Visibility/AEO" scored category that none of the big incumbents ship yet. Experts build this category with a purpose-built crawler engine (Crawlee) doing sitemap-first discovery with link-crawl fallback, a fast Cheerio pass for the bulk of pages, selective Playwright rendering only where JS-rendering risk is detected, Lighthouse/PageSpeed Insights sampled (never run in full across every URL), and a background worker + queue architecture because a 500-URL audit with Lighthouse cannot fit inside serverless function limits. Vercel/Next.js hosts only the thin frontend and enqueues work; a separate long-lived container (Railway/Fly) runs the actual crawl.

The recommended approach is: Next.js (App Router, Vercel) for UI + thin API routes that only validate, check quota, and enqueue; a BullMQ+Redis queue; a Node worker container running Crawlee (Cheerio primary, Playwright selectively), Unlighthouse/PSI for performance (sampled, cached), and a pure-logic `checks-catalog` package for the actual SEO/on-page/schema/AEO rule set; Postgres (via Prisma) as the single source of truth for audits, pages, issues, emails, and quota, with progress written by the worker and read-only by the web tier (polling, upgrading to SSE later — no WebSockets). This mirrors the reference report's 5-category structure (Technical SEO, On-Page, Structured Data, Performance/CWV, AEO) and the explicit requirement to persist audits and diff runs.

The dominant risks are not stack-selection risks (that part is HIGH confidence and well-trodden) but correctness/credibility risks: a naive crawler getting IP-banned by WAF-protected real sites and reporting false "site is down" errors; Cheerio-only extraction producing false negatives on JS-rendered sites (directly undermining the "accurate and reliable" core value with an SEO-savvy target audience); Lighthouse's run-to-run variance and PSI's rate limits making the scoring model look unstable if not sampled/cached/averaged deliberately; and abuse of the free-tier gate (email plus-addressing, disposable domains, no rate limiting on verification) burning compute and email-sending reputation. All of these have clear, well-documented mitigations that should be built in from the start rather than retrofitted — retrofitting the Cheerio→Playwright gap and GDPR consent records post-launch are explicitly flagged as HIGH-cost fixes if skipped now.

## Key Findings

### Recommended Stack

Frontend: Next.js (App Router) on Vercel, doing only UI, thin API routes/Server Actions, and BullMQ producer calls — it never runs crawl/Lighthouse logic. Worker: a separate Node container (Railway recommended, Fly.io as an alternative for multi-region/finer VM control) running Crawlee (Cheerio primary engine, Playwright for selective JS-rendering checks and Lighthouse sampling), BullMQ `Worker` consuming jobs from Redis, Unlighthouse/PSI for Core Web Vitals, and Prisma against Postgres for persistence. This split exists because a 500-URL crawl + Lighthouse categorically exceeds Vercel serverless function time/memory/process-lifetime limits — confirmed by Vercel's own docs and community consensus, not just inferred.

**Core technologies:**
- Crawlee (Cheerio + Playwright crawlers) — purpose-built request queue, dedup, retries, session pools; avoids hand-rolling a politeness/concurrency engine
- BullMQ + Redis — job queue between Vercel and the worker, supports delayed jobs (weekly quota), flow/parent-child jobs (per-audit fan-out), progress events
- PostgreSQL + Prisma — relational fit for audits→pages→issues with historical diff queries; Prisma chosen over Drizzle specifically because both deployables share one schema and Prisma 7 removed the old serverless cold-start penalty
- Railway (worker hosting) — first-class background-worker service type, documented Playwright-in-Docker guide, usage-based billing fits a bursty lead-magnet load
- unlighthouse + Google PageSpeed Insights API — sampled Lighthouse orchestration plus real CrUX field data; never run full Lighthouse across all 500 URLs (cost/variance both prohibitive)
- Resend — transactional email with a documented double opt-in reference flow matching this exact requirement

### Expected Features

**Must have (table stakes):** sitemap discovery + link-crawl fallback (robots.txt-respecting, rate-limited); core technical SEO checks (status codes, redirects, canonical, indexability, broken links/resources, mixed content, hreflang); on-page checks (title/meta/H1/alt/OG/lang); structured data (JSON-LD) presence + validation; Core Web Vitals via Lighthouse/PSI (sampled, mobile+desktop); overall + per-category scores with 3-tier severity (Critical/Warning/Notice, matching industry norm); prioritized issues table with measured value/source/criterion/recommendation per issue (fixed by the reference report format); email capture + double opt-in gating; quota enforcement (1/week/email, 500-URL cap); persistence of audits keyed to verified email + domain; background worker with progress reporting; basic run-to-run diffing (fixed/new/persisting issues).

**Should have (competitive differentiators):** native AI Visibility/AEO scored category (AI-crawler robots.txt access is the highest-weight check; llms.txt should be low-weight/informational only — research shows 97% of llms.txt files get zero AI-crawler requests); run comparison/diffing as a weekly-return hook (no free-tier competitor does this well); raw-HTML-vs-rendered-HTML comparison (genuine technical differentiator, but expensive at scale — sample, don't run on all 500 URLs); historical trend view (falls out nearly free once diffing exists); branded, consultant-credible report design matching the reference report.

**Defer (v2+):** paid tiers/unlimited audits; near-duplicate content detection (ship exact-match first); domain-ownership verification flow; multi-user/team accounts, white-label; API access; expanded AEO signals (E-E-A-T, citation-readiness — space too volatile to over-invest now); PDF/CSV export.

### Architecture Approach

Two deployables in one monorepo (`apps/web`, `apps/worker`, shared `packages/db` + `packages/shared-types` + `packages/checks-catalog`), communicating only asynchronously via Redis (commands) and Postgres (state reads) — never direct HTTP/RPC between them. The "thin producer / fat consumer" pattern is non-negotiable: Vercel only validates, checks quota, writes the initial `audit` row, and enqueues; 100% of crawling, parsing, checking, and Lighthouse/PSI calls happen in the worker. Progress uses Postgres as the system of record (worker writes throttled progress fields; BullMQ/Redis is just transport) so the web tier has a single read path for both live-progress and final-report views. Polling is the shipped mechanism; SSE is an optional later upgrade; WebSockets are explicitly rejected as unjustified complexity.

**Major components:**
1. URL Discovery — sitemap.xml (+ index recursion, gzip) parsing with robots.txt-aware fallback to link-crawl BFS, capped at 500 URLs
2. Page fetch/parse — Cheerio-first extraction, selective Playwright rendering for JS-heavy/CSR pages detected by thin-content heuristics
3. Check engine (`checks-catalog`) — pure-logic, testable rule set consuming normalized page data, producing severity-classified issues per category (technical-seo, on-page, structured-data, performance, aeo)
4. Lighthouse/PSI orchestrator — sampled subset of URLs, cached by URL+strategy, decoupled from the main crawl so PSI rate-limit failures degrade gracefully rather than failing the whole audit
5. Scoring + diff engine — aggregates category/overall scores from issue severities + PSI scores, computes run-to-run diffs via stable `(check_id, normalized_url)` fingerprints

### Critical Pitfalls

1. **Crawler gets IP-banned/blocked by WAF-protected real sites** — enforce per-domain (not global) concurrency caps, honest identifiable User-Agent, exponential backoff on 429/503, and classify WAF-challenge pages as "crawler blocked" rather than "broken page" in the report.
2. **Cheerio-only extraction produces false negatives on JS-rendered sites** — this directly threatens the "accurate and reliable" core value with an SEO-savvy audience; detect raw-vs-rendered divergence as a first-class reportable finding, not just an internal fallback decision, and never present a Cheerio-only structured-data/on-page finding as definitive without disclosing extraction method.
3. **Lighthouse variance + PSI rate limits treated naively** — single Lighthouse runs vary 5-10+ points run-to-run; running full Lighthouse across 500 URLs is both cost-prohibitive and rate-limit-prohibitive (PSI: 400 req/100s burst, ~25 free full-audits/day system-wide at 2 strategies × 500 URLs). Sample representative pages, cache aggressively by URL+strategy, disclose variance in the UI.
4. **Queue jobs get stuck/zombied with no recovery path** — long external calls (target-site fetch, Lighthouse, PSI) are exactly the failure mode queues don't handle by default; requires explicit per-job/per-URL timeouts, stalled-job detection/requeue, and per-URL-granular resumability, validated via deliberate failure-injection (kill worker mid-job), not just happy-path testing.
5. **Free-tier quota gate has abuse gaps** — plus-addressing, disposable-email domains, and no rate limiting on the verification-send endpoint itself all trivially bypass "1 audit/week/email"; normalize emails, blocklist disposable domains, rate-limit the verification endpoint independently of audit quota, and consider Turnstile on the public form.

## Implications for Roadmap

Based on research, suggested phase structure (dependency-driven, matches Architecture doc's "Suggested Build Order" and Feature doc's dependency graph):

### Phase 1: Foundations — data model, monorepo, queue plumbing
**Rationale:** Everything else depends on the shared schema existing, and proving the Vercel↔Redis↔worker↔Postgres wiring end-to-end (with a no-op job) de-risks the entire architecture before any crawl logic is written.
**Delivers:** `packages/db` (Prisma schema: email, site, audit, page, issue, quota_usage), `packages/shared-types`, monorepo scaffolding (`apps/web`, `apps/worker`), a working enqueue→dequeue→mark-completed loop with polling-based progress.
**Addresses:** Background worker/queue execution requirement.
**Avoids:** Pitfall 10 (stuck/zombied jobs) — build stalled-job detection and per-job timeouts in from the start, not retrofitted.

### Phase 2: Core crawler engine — discovery, fetch, parse
**Rationale:** Highest-risk piece of the whole product (real-world target-site variability, robots.txt edge cases, redirects, WAF blocking) — must be built and hardened against real sites before any checks are layered on top.
**Delivers:** Sitemap discovery (+ index recursion, gzip, link-crawl fallback), robots.txt-compliant politeness with per-domain concurrency caps, redirect-chain + canonical tracking, Cheerio extraction with selective Playwright rendering for CSR-detected pages.
**Uses:** Crawlee, Cheerio, Playwright, `fast-xml-parser`, `robots-parser`.
**Avoids:** Pitfall 1 (IP bans), Pitfall 2 (robots.txt mishandling), Pitfall 3 (redirect/canonical conflation), Pitfall 8 (Cheerio-only false negatives), Pitfall 9 (memory blowups — validate against a real 500-URL load test before calling this phase done).

### Phase 3: Technical SEO + on-page checks
**Rationale:** No external API dependency, validates the checks-catalog architecture and scoring inputs against real crawled data before adding Lighthouse/PSI complexity.
**Delivers:** `packages/checks-catalog` technical-seo and on-page rule sets (status/redirects/canonical/broken links/duplicate title-meta/hreflang basic-presence/mixed content; title/meta/H1/alt/OG/lang).
**Implements:** Check engine component.
**Addresses:** Table-stakes technical SEO + on-page features from FEATURES.md.

### Phase 4: Structured data + AEO checks
**Rationale:** Additive, same pattern as Phase 3; shares JSON-LD parsing utility with the Structured Data category, and AEO is the product's key differentiator per FEATURES.md.
**Delivers:** JSON-LD presence/validity checks, AI-crawler robots.txt directive checks (highest-weight AEO signal), llms.txt presence (low-weight/informational only), FAQPage/HowTo schema checks.
**Addresses:** AEO differentiator category.

### Phase 5: Performance/CWV integration
**Rationale:** Deliberately last among check categories — it's the only external-API-dependent, rate-limited, cost-sensitive stage; by this point the rest of the pipeline is stable enough to isolate this as an independently-failing stage.
**Delivers:** PSI API client with Redis caching (TTL ~7 days) and sampled-page selection (homepage + representative templates, not all 500 URLs); local Lighthouse/unlighthouse reserved as fallback only.
**Avoids:** Pitfall 6 (Lighthouse variance/scale cost) and Pitfall 7 (PSI rate limits) — flagged for a dedicated technical spike, not just implementation.

### Phase 6: Scoring, diffing, and report UI
**Rationale:** Requires all check categories producing issue rows before a meaningful score/report can be built; run-diffing requires at least two completed audits and only reads existing `issue.fingerprint` data, so it's naturally late and low-risk to add.
**Delivers:** Overall + per-category scores with status bands, severity-weighted scoring formula validated against the reference report (86/100) and Juan's expert sanity check, prioritized issues table UI, run-to-run diff (fixed/new/persisting) via `(check_id, normalized_url)` fingerprints.
**Avoids:** Pitfall 13 (non-credible/unstable scoring) — explicit validation pass required before launch.

### Phase 7: Email verification, quota, and compliance gate
**Rationale:** Can be built in parallel with Phases 2-6 (only touches email/quota_usage tables and the enqueue endpoint), but must gate public launch.
**Delivers:** Double opt-in flow (Resend), email normalization (+tag stripping, disposable-domain blocklist), rate-limited verification endpoint, GDPR consent record (separate from email field, versioned, with retention/deletion mechanism), ToS/acceptable-use text + domain opt-out mechanism on the submission form.
**Avoids:** Pitfall 11 (quota bypass abuse), Pitfall 12 (GDPR afterthought — HIGH cost to fix post-launch), Pitfall 14 (legal/ToS exposure of crawling third-party sites).

### Phase Ordering Rationale

- Crawler correctness (Phase 2) must precede checks (Phases 3-4) because every check consumes parsed page data — building checks against an unreliable crawler wastes effort re-validating against moving ground truth.
- Performance/CWV (Phase 5) is deliberately last among check categories because it's the only stage with hard external rate limits and cost/variance risk — isolating it late means the rest of the pipeline is proven stable first, and a PSI outage or quota exhaustion degrades gracefully (partial report) instead of blocking everything.
- Scoring/diffing (Phase 6) structurally requires every check category to exist first (score is a function of issue severities across all categories) and requires two completed audits to test diffing meaningfully.
- Email/quota/compliance (Phase 7) is parallelizable with the core pipeline work but is a hard gate before any public launch — sequencing it last in the list doesn't mean building it last in time, it means treating it as a launch gate.

### Research Flags

Phases likely needing deeper research during planning (`/gsd:plan-phase --research-phase <N>`):
- **Phase 5 (Performance/CWV):** Lighthouse variance tuning and current PSI quota figures are explicitly flagged MEDIUM confidence and self-service-adjustable by Google — verify current documented limits at implementation time, and this is called out by the Pitfalls research as needing its own technical spike.
- **Phase 3/4 (hreflang reciprocity check specifically):** reciprocity-graph validation logic is non-trivial (cross-domain/cross-subdomain target validation) — flagged MEDIUM confidence, needs deeper research before committing to a "full" implementation vs. a labeled "presence-only" v1.
- **Phase 4 (near-duplicate content detection, if pulled into v1 scope):** shingling/SimHash tuning (shingle size, Hamming threshold) is domain-specific and needs empirical validation against labeled real-page samples — currently scoped to v1.x/defer, but flag if pulled earlier.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundations):** BullMQ + Prisma + Next.js monorepo wiring is a well-documented, HIGH-confidence pattern (official docs, community consensus).
- **Phase 2 (Core crawler):** Crawlee's Cheerio/Playwright split and robots.txt/sitemap handling are HIGH-confidence, well-established crawler-engineering patterns.
- **Phase 7 (Email/quota):** double opt-in via Resend has an official reference implementation; the abuse-mitigation patterns (normalization, disposable-domain blocklists, rate limiting) are well-documented community practice.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core architecture (Crawlee, BullMQ, Vercel/worker split) verified against official docs and live npm registry queries. ORM choice (Prisma vs Drizzle) and AEO-specific tooling are MEDIUM — no established standard yet for AEO checks specifically. |
| Features | HIGH for table stakes | Cross-verified across Screaming Frog/Sitebulb/Ahrefs/Semrush official docs. MEDIUM for AEO/AI-visibility checks (fast-moving, less standardized — llms.txt low-impact finding is well-sourced though) and for lead-magnet gating mechanics (verified against general email-marketing best practice, not audit-tool-specific sources). |
| Architecture | HIGH for component boundaries, queue pattern, data model. MEDIUM for Lighthouse orchestration specifics and PSI rate limits — explicitly flagged to re-verify against current Google docs at implementation time. |
| Pitfalls | MEDIUM-HIGH | Mix of official docs (Lighthouse variability, GDPR) and well-established community consensus (crawler engineering, robots.txt RFC 9309, SimHash/shingling, BullMQ stalled-job config) — individually sourced and cross-checked, not single-source guesses. |

**Overall confidence:** HIGH

### Gaps to Address

- **PSI/Google Cloud quota figures:** self-service-adjustable by Google and only community-verified (MEDIUM confidence) — re-verify exact current limits in the Google Cloud Console before finalizing the Performance/CWV phase's sampling/caching design.
- **hreflang reciprocity validation depth:** decide during Phase 3/4 planning whether v1 ships a "basic presence-only" check (cheaper, lower value) or invests in full reciprocity-graph validation (higher value, non-trivial cross-domain logic) — currently recommended as presence-only for v1 with explicit "basic check" labeling.
- **Scoring formula weights:** table stakes is *having* a score; the exact category-weighting formula is explicitly called out as a product decision, not a researched fact — must be validated against the reference report (86/100) and Juan's own expert judgment before launch, per Pitfall 13.
- **Rendered-HTML-vs-raw comparison scope:** PROJECT.md marks this "deseable," not committed; Feature/Architecture/Pitfalls research all converge on "sample, don't run on all 500 URLs" but the exact sampling strategy (which URLs, how many) is not yet decided — resolve during Phase 2 planning.
- **GDPR/legal review:** flagged repeatedly as needing an actual (lightweight) legal review, not just engineering judgment, before public launch — schedule this explicitly as a pre-launch gate, not something GSD planning alone can close out.

## Sources

### Primary (HIGH confidence)
- [Crawlee GitHub / official docs](https://github.com/apify/crawlee) — crawler engine architecture
- [BullMQ official docs](https://docs.bullmq.io/guide/workers) — queue/worker/progress patterns
- [Lighthouse Variability — Google for Developers](https://developers.google.com/web/tools/lighthouse/variability) and [GoogleChrome/lighthouse variability.md](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md) — official Lighthouse variance documentation
- [Railway Playwright guide](https://docs.railway.com/guides/playwright) — official Docker/Playwright deployment guidance
- [Playwright Docker docs](https://playwright.dev/docs/docker) — image tagging/version-pinning
- [Resend double opt-in example repo](https://github.com/resend/resend-double-opt-in-example) — official reference implementation
- [Screaming Frog SEO Spider Configuration/General user guides](https://www.screamingfrog.co.uk/seo-spider/user-guide/configuration/) — official docs on robots.txt/crawl-speed/sitemap handling
- [Ahrefs Health Score](https://help.ahrefs.com/en/articles/1424673-what-is-health-score-and-how-is-it-calculated-in-ahrefs-site-audit) and [Semrush Site Health Score](https://www.semrush.com/kb/114-total-score) — official vendor docs on scoring models
- Reference report (juan-tech.com, 86/100) and PROJECT.md — internal artifacts, binding source of truth for report structure/scope

### Secondary (MEDIUM confidence)
- [Vercel community discussion #5050](https://github.com/vercel/community/discussions/5050) / [Next.js discussion #33989](https://github.com/vercel/next.js/discussions/33989) — BullMQ-cannot-run-on-Vercel-functions consensus
- [Prisma vs Drizzle comparison](https://www.prisma.io/docs/orm/more/comparisons/prisma-and-drizzle) — vendor-authored, cross-checked against independent articles
- [Railway vs Render vs Fly.io pricing comparisons, 2026](https://hostim.dev/blog/render-vs-railway-vs-fly-pricing/) — third-party, cross-checked
- [Google PageSpeed Insights API quota discussions](https://groups.google.com/g/pagespeed-insights-discuss/c/dB7hWmGAGsw) and [bjb.dev practitioner report](https://bjb.dev/log/20221009-pagespeed-api/) — community-reported quota figures, flagged for re-verification
- [Unlighthouse docs](https://unlighthouse.dev/) (API reference, PSI guide, bulk-testing recipe) — official docs, informs the anti-pattern of not treating unlighthouse as a drop-in library
- [AI Rank Lab AEO Checklist](https://www.airanklab.com/blog/answer-engine-optimization-checklist-40-signals), [Digital Applied — Google on llms.txt](https://www.digitalapplied.com/blog/google-llms-txt-no-seo-value-lighthouse-audit-2026), [Emarketed — 97% of llms.txt unread](https://emarketed.com/aeo/llmstxt-files-go-unread-2026/) — cross-checked AEO/llms.txt findings
- [Customer.io double opt-in best practices](https://customer.io/learn/deliverability/double-opt-in-best-practices), [iubenda](https://www.iubenda.com/en/blog/gdpr-double-opt-in-2/) and [TermsFeed](https://www.termsfeed.com/blog/gdpr-double-opt-in-email-marketing/) GDPR articles — compliance-focused, industry best-practice sources

### Tertiary (LOW confidence)
- Domain-expert/community-consensus engineering knowledge (robots.txt RFC 9309 matching semantics, SimHash/shingling tuning, hreflang reciprocity requirements, SSRF risks) — well-established but not tied to a single dated source; verify against chosen library docs at build time

---
*Research completed: 2026-07-05*
*Ready for roadmap: yes*
