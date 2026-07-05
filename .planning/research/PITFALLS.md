# Pitfalls Research

**Domain:** SEO/technical web-audit crawler (SaaS lead magnet) — sitemap crawler + per-page checks + Lighthouse/PSI + scoring + email-gated free tier + background worker/queue
**Researched:** 2026-07-05
**Confidence:** MEDIUM-HIGH (mix of Context7/official docs for Lighthouse/PSI/GDPR, MEDIUM for crawler-engineering patterns based on well-established community consensus, LOW-flagged where noted)

## Critical Pitfalls

### Pitfall 1: Crawler gets blocked / IP-banned by target sites (no politeness controls)

**What goes wrong:**
A naive crawler firing concurrent requests at a site (especially shared hosting, WAF-protected sites like Cloudflare/Sucuri, or WordPress with security plugins) triggers rate-limit blocks, CAPTCHA challenges, or outright IP bans mid-crawl. The audit then returns garbage: hundreds of false "500 error" or "blocked" issues that make the tool look broken, not the target site.

**Why it happens:**
Teams build the crawler to maximize speed (concurrency = free win) and only discover the problem when auditing real-world sites behind Cloudflare/WAF, not on their own test sites which have no protection.

**How to avoid:**
- Enforce a configurable concurrency cap per-domain (not global) — e.g., max 2-5 concurrent requests to the same host regardless of overall worker concurrency.
- Respect `Crawl-delay` if present in robots.txt (even though Google ignores it, WAFs often act on request rate, not on Google's identity).
- Add exponential backoff on 429/503 responses, with a max-retry ceiling before marking the URL as "blocked" rather than "error" (different issue types — critical for report credibility).
- Set an honest, identifiable User-Agent (e.g., `JuanTechAuditorBot/1.0 (+https://juan-tech.com/bot)`) — anonymous or spoofed UAs increase ban probability and are an ethical/legal liability.
- Detect WAF challenge pages (Cloudflare "Checking your browser", CAPTCHA HTML signatures) and classify them as "crawler blocked" rather than counting them as broken pages in the score.

**Warning signs:**
- Audit runs against real client sites show clusters of 403/429/503 mid-crawl that didn't happen on smaller test sites.
- Support/feedback reports of "the tool says my site is down but it isn't."

**Phase to address:**
Core crawler engine phase (before scoring/report phase) — this is foundational, not a polish item. Must exist before the tool is trusted on real third-party sites.

---

### Pitfall 2: robots.txt parsed naively (wrong precedence, wildcard/`$` handling, or ignored per-bot rules)

**What goes wrong:**
Common bugs: not handling `*` and `$` wildcards in `Disallow`/`Allow`, picking the wrong (shortest vs. most-specific) matching rule, ignoring `User-agent: *` fallback vs. a specific bot's own rules, or not re-fetching robots.txt per subdomain (each subdomain/scheme/port has its own robots.txt per the RFC). A worse failure: not checking robots.txt at all before crawling, which is both a compliance and an ethical/legal problem.

**Why it happens:**
robots.txt parsing looks trivial ("split by lines, match prefixes") but the actual matching algorithm (longest-matching-rule-wins with wildcard support, per RFC 9309) is easy to get subtly wrong, and there's no immediate visible failure — it just silently crawls disallowed paths.

**How to avoid:**
- Use a maintained robots.txt parser library (e.g., Google's own open-sourced `robotstxt` parser semantics, or a well-tested npm package) instead of hand-rolling regex matching.
- Fetch and cache robots.txt per origin (scheme+host+port) at crawl start, with its own timeout and fallback (no robots.txt = allow all; robots.txt fetch error 5xx = treat conservatively).
- Respect the audit bot's own User-Agent rules if the site has bot-specific rules, falling back to `*`.
- Surface "robots.txt blocks X URLs from your own sitemap" as an issue in the report itself (this is a real, valuable SEO finding, not just internal crawl logic).

**Warning signs:**
- Crawler visits URLs listed in `Disallow` during QA against a site with a real robots.txt.
- Sitemap-declared URLs silently disappear from the report with no explanation (should instead be flagged as "blocked by robots.txt, excluded from crawl and audit").

**Phase to address:**
Core crawler engine phase, alongside sitemap discovery — should ship in the same phase as URL discovery, not bolted on later.

---

### Pitfall 3: Redirect chains and canonical logic conflated or mishandled

**What goes wrong:**
Two separate bugs frequently get merged into one: (1) not following/recording redirect chains correctly (losing the origin URL, not detecting redirect loops, not flagging chains >2 hops as an issue), and (2) treating the HTTP redirect target as if it were the canonical tag, or vice versa — when in reality a URL can redirect AND have a different rel=canonical than its redirect target, and these are different SEO signals that must be reported separately (redirect = server-level, canonical = page-level signal that Google may or may not honor).

**Why it happens:**
Both concepts collapse to "which URL does this really point to" in casual thinking, so implementations often store just one "resolved URL" field and lose the distinction, or infinite-loop on redirect cycles because there's no visited-set guard within the redirect-following logic itself (separate from the page-visited set).

**How to avoid:**
- Model redirects and canonicals as two independent fields per crawled URL: `redirectChain: string[]` (with status codes 301/302/307/308 per hop) and `canonicalUrl: string | null` (parsed from `<link rel=canonical>` and/or HTTP `Link` header).
- Cap redirect-following at a fixed hop limit (e.g., 5-10) and flag chains exceeding a shorter threshold (e.g., >2 hops) as a moderate SEO issue.
- Detect redirect loops via a per-crawl visited-set scoped to the redirect-following function, not the page-crawl queue's visited set (they serve different purposes).
- Report canonical mismatches explicitly: "self-referencing canonical," "canonical points elsewhere," "canonical points to non-200 URL," "canonical points to a URL blocked by robots.txt" — these are distinct, common real-world issues worth their own checks.

**Warning signs:**
- Report shows only one "final URL" per page with no visibility into intermediate hops.
- Crawler hangs or times out on a small number of URLs (likely a redirect loop with no guard).

**Phase to address:**
Core crawler engine + technical SEO checks phase.

---

### Pitfall 4: Duplicate/near-duplicate content detection is naively exact-match or algorithmically wrong (shingling/SimHash bugs)

**What goes wrong:**
Teams often start with exact-hash duplicate detection (MD5/SHA of raw HTML or extracted text), which misses near-duplicates (boilerplate-heavy pages, templated product pages differing only in a few words) — the actually valuable signal for SEO audits. When they move to shingling + SimHash/MinHash, common implementation bugs include: hashing the raw HTML (including nav/footer/header boilerplate) instead of extracted main content, using a shingle size (k) that's too small (creates false positives on any two pages sharing common phrases) or too large (misses genuine near-duplicates), and using a Hamming-distance threshold on SimHash fingerprints that hasn't been tuned/validated against real examples (arbitrary "distance < 3" without justification produces both false positives and negatives).

**Why it happens:**
Shingling/SimHash math is well-documented but the *practical* tuning (content extraction boilerplate removal, shingle size, similarity threshold) is domain- and corpus-specific and rarely covered in tutorials — teams copy the algorithm but not the tuning methodology.

**How to avoid:**
- Extract main content (strip nav, header, footer, sidebar, cookie banners) before shingling — use a readability-style content extraction pass, not raw HTML/text.
- Use word-level shingles (not character-level) of size 3-5 words for near-duplicate detection at the page level; validate against a manually-labeled sample of known-duplicate and known-distinct pages from real client sites before shipping.
- Prefer SimHash over MinHash for this use case (simpler, well-suited for near-duplicate web page detection at scale) but validate the Hamming distance threshold empirically (start around distance ≤ 3 out of 64 bits, then tune against false-positive reports).
- Report duplicate clusters (not just pairs) — group near-duplicate pages so the user sees "these 8 pages are near-duplicates" rather than 28 pairwise findings.
- Keep this as a MEDIUM-confidence area: if timeline is tight, ship exact-duplicate detection (hash of extracted main content) first as an honest v1, and treat near-duplicate/SimHash as a clearly separated, later enhancement rather than rushing an untuned version that produces noisy false positives (which directly damages report credibility — the stated core value).

**Warning signs:**
- Two obviously different pages (e.g., homepage vs. contact page) flagged as near-duplicates → shingle size/threshold too loose or boilerplate not stripped.
- Two obviously templated near-duplicate product pages NOT flagged → threshold too strict or content extraction stripped too much (leaving only boilerplate to compare).

**Phase to address:**
Should be a dedicated phase or clearly-scoped sub-phase after core crawling + basic technical checks are stable — don't bundle untuned near-duplicate detection into the first release of technical SEO checks.

---

### Pitfall 5: hreflang reciprocity and validation logic incomplete

**What goes wrong:**
hreflang is one of the most commonly mis-implemented SEO signals in the wild, and audit tools that just check "does hreflang exist" without validating reciprocity produce a shallow, low-value check. Real requirements: every hreflang annotation must be reciprocal (if page A declares `hreflang=de` pointing to page B, page B must declare a hreflang pointing back to page A), there must be a self-referencing hreflang entry, language/region codes must be valid ISO 639-1 (+ optional ISO 3166-1 region), and `x-default` is optional but commonly expected. Missing reciprocity checks, or checking only within a single page's declared list without cross-referencing the target pages, produces false "all good" reports on broken hreflang setups (the #1 real-world hreflang bug).

**Why it happens:**
Reciprocity checking requires crawling and cross-referencing potentially many other URLs (which may be on different subdomains/domains, e.g. site.com vs site.de), which is architecturally harder than a single-page check — teams either skip it or implement it against only the same-crawl page set and silently produce false negatives for cross-domain hreflang setups (e.g., site.com/en ↔ site.co.uk/en) that fall outside the crawled domain.

**How to avoid:**
- Build hreflang validation as a post-crawl aggregation step (after all pages are crawled), not a per-page synchronous check — collect all hreflang declarations crawl-wide, then validate the graph for reciprocity, self-reference, and valid language/region codes.
- Explicitly scope what's checked: if hreflang points to a URL outside the crawled domain/sitemap, flag it as "external hreflang target — not verified" rather than silently passing or failing it. Be honest in the report about this boundary.
- Validate codes against ISO 639-1/3166-1 lists, not just "is it a 2-5 character string."
- Treat this as a MEDIUM-confidence, moderate-complexity check — don't let it block the first release of the technical SEO category; ship without hreflang or with a clearly-labeled "basic presence check only" and expand to full reciprocity validation in a following phase.

**Warning signs:**
- hreflang check always passes on multi-language sites where reciprocity is known-broken (test against a real multi-language client site with a deliberately broken hreflang setup).

**Phase to address:**
Technical SEO checks phase, but flag for deeper research at implementation time (reciprocity graph logic is non-trivial).

---

### Pitfall 6: Lighthouse variance treated as ground truth without averaging, and cost/time at 500 URLs underestimated

**What goes wrong:**
Lighthouse scores vary run-to-run even on an unchanged page — Google's own docs and community sources report the median of 5 runs is roughly twice as stable as a single run, with typical swings of 5-10+ points from network jitter, third-party scripts, and CPU contention, and swings of 15+ points signaling a real non-deterministic factor worth isolating. Teams that run Lighthouse once per URL and treat that single score as authoritative will produce reports that look inconsistent or wrong when the user reruns the audit and gets a different score. Separately, running full Lighthouity audits (mobile + desktop, 4 categories incl. performance) against up to 500 URLs is expensive in both wall-clock time and compute — each Lighthouse run is itself 10-30+ seconds single-threaded (loads the page, throttles CPU/network, runs multiple trace passes), so 500 URLs × 2 device profiles run serially could take hours, and running many headless Chrome instances concurrently on a worker will blow memory/CPU on typical container sizes.

**Why it happens:**
Lighthouse variance is well-known within the performance-tooling community but easy to overlook when building against a handful of test URLs where variance is barely noticeable; the 500-URL cost problem is easy to underestimate because dev/test crawls are usually run against 10-20 URLs, not the full free-tier ceiling.

**How to avoid:**
- Do NOT run full Lighthouse (with its own network/CPU throttled page load) on all 500 URLs. Use PageSpeed Insights API (field data / CrUX where available) for URL-level performance scoring at scale, and reserve full local Lighthouse runs for a small representative sample (e.g., homepage + top N templates/page-types) — this is both cheaper and matches how the reference report likely works (PSI = Lighthouse + CrUX field data).
- If running Lighthouse directly (via unlighthouse or Playwright+Lighthouse), cap concurrency conservatively (Lighthouse itself is single-threaded CPU-heavy per run — 2-4 concurrent Chrome instances is a realistic ceiling per worker vCPU, verify empirically against actual container specs) and budget wall-clock time accordingly in queue/job-timeout design.
- Use simulated throttling (Lighthouse's default) rather than applied/RTT-based throttling for the bulk of pages — much faster, marginally less accurate.
- If reporting a single performance score per page, be transparent in the report about single-run variance (e.g., "Performance scores can vary ±5-10 points between runs due to network conditions") rather than presenting it as a precise measurement — this is a credibility/trust issue given "accurate and reliable" is the stated core value.
- Explicitly design the crawl/audit pipeline so performance auditing is decoupled from the page-content crawl (different concurrency limits, different queue, possibly different worker pool) — don't let Lighthouse's cost dictate crawl speed for the cheap technical/on-page checks.

**Warning signs:**
- Re-running the same audit on an unchanged site produces a visibly different performance score/grade (Bueno→Necesita mejora) between runs.
- A 500-URL audit takes many hours or times out / OOMs the worker in testing.

**Phase to address:**
Performance/CWV phase — flag explicitly for deeper research (this is exactly the kind of phase that needs its own focused technical spike given cost and reliability tradeoffs).

---

### Pitfall 7: PageSpeed Insights API rate limits/quota not architected around

**What goes wrong:**
The PSI API has a documented free quota (historically 25,000 requests/day, 400 requests per 100 seconds per API key/project) that seems generous until multiplied by mobile+desktop strategy calls per URL (2x) across concurrent audits from multiple users — a single 500-URL audit run with both strategies is already 1,000 PSI calls, so ~25 free full-500-URL audits/day system-wide is the real ceiling, not per-user. Teams building against this without accounting for the per-100-seconds burst limit (400 req/100s ≈ 4 req/s sustained) get sporadic 429s mid-audit that silently degrade the report (missing CWV data for some URLs) unless explicitly handled.

**Why it happens:**
The daily quota looks large in isolation; the burst/rate-per-100-seconds limit and the multiplication by (URLs × 2 strategies × concurrent users) is easy to miss until real usage patterns emerge (e.g., a spike after a marketing push).

**How to avoid:**
- Do not call PSI per-URL for full-crawl performance data at 500-URL scale — reserve PSI for a representative sample of pages (e.g., homepage, top templates, top N by internal link count) plus give the option to request full PSI data for specific pages the user cares about, and use local Lighthouse (or skip performance scoring) for the bulk.
- Implement request queuing/throttling client-side matching or staying under the 400/100s burst limit, with exponential backoff on 429.
- Cache PSI results per URL+strategy for a TTL (e.g., 24-72h) so re-audits or repeat requests for the same URL don't re-spend quota — directly useful given the "1 audit/week/email" free-tier design already implies re-audits of the same domains are common.
- Request a quota increase from Google Cloud Console early (documented as generally granted for legitimate use cases) rather than discovering the ceiling in production.
- Track quota consumption centrally (not per-worker) since multiple concurrent audit jobs share the same API key/project quota.

**Warning signs:**
- 429 responses from PSI appearing in logs during a single moderately-sized audit.
- CWV data silently missing for a subset of URLs in a report with no visible explanation to the user.

**Phase to address:**
Performance/CWV phase, alongside Pitfall 6 — same technical spike.

**Confidence:** MEDIUM (25,000/day, 400/100s figures confirmed via multiple 2025-dated sources; verify current values against official Google Cloud Console quota page at implementation time since these are self-service adjustable quotas that Google periodically revises).

---

### Pitfall 8: Cheerio-only extraction misses JS-rendered content, silently producing false negatives

**What goes wrong:**
Cheerio parses raw server-delivered HTML only — it never executes JavaScript. On any site using client-side rendering for meaningful content (React/Vue SPAs, JS-injected structured data, JS-rendered titles/meta via client-side routing, lazy-loaded content, JS-based canonical tags), Cheerio-based checks will report false negatives: "missing H1," "no structured data," "no canonical tag" — when the content exists once JS executes, which is what Googlebot actually sees (Google renders JS for indexing in most cases). This is a well-documented, extremely common SaaS-audit-tool failure mode and directly undermines the "accurate and reliable" core value if the tool flags issues that don't actually exist for real users/Googlebot.

**Why it happens:**
Cheerio is fast and cheap (no browser needed), so it's the default choice for bulk crawling; the JS-rendering gap only becomes visible when auditing a real client site built with a modern JS framework, not on typical server-rendered test sites (e.g., WordPress) used during development.

**How to avoid:**
- Explicitly detect raw-HTML vs. rendered-HTML divergence as a first-class feature (the project context already calls this out: "comparar HTML crudo vs renderizado") — this divergence itself is a valuable SEO finding to report ("your title tag differs between raw HTML and rendered DOM — this can cause indexing issues"), not just an internal implementation detail.
- Use Playwright (headless Chromium) for the checks that matter most for JS-rendering-sensitive signals (title, meta description, H1, canonical, structured data, main content for duplicate detection) at least on a sample, or make rendered-mode the default extraction path with Cheerio only as a fast pre-pass/fallback.
- Budget the cost: rendering with Playwright is far more expensive (memory, CPU, wall-clock) than Cheerio parsing — at 500 URLs this multiplies the same cost/scale problem as Lighthouse (Pitfall 6). Consider rendering only a sample or reusing Lighthouse's own Chrome trace/DOM snapshot (Lighthouse already renders the page) instead of a second separate Playwright pass, to avoid double-rendering every URL.
- Never present a Cheerio-only finding as definitive without disclosing extraction method, especially for structured-data/on-page checks on sites that show signs of CSR (near-empty initial HTML body, heavy `<script>` bundle presence, common SPA framework signatures in HTML).

**Warning signs:**
- Report flags a modern JS-framework site (Next.js/React/Vue) as missing structured data, H1, or meta tags that are visibly present when viewing the page in a browser.
- QA against a known SPA-based site produces a flood of false-positive "missing X" issues.

**Phase to address:**
Core crawler engine / extraction phase — decide the Cheerio-vs-rendered architecture early since it affects the crawl pipeline's cost model and worker sizing for every later phase (Lighthouse, on-page, structured data).

---

### Pitfall 9: Memory blowups on large crawls (unbounded queues, DOM/response accumulation, no backpressure)

**What goes wrong:**
Common OOM causes in Node.js crawlers at few-hundred-URL scale: holding full HTML/DOM of every crawled page in memory simultaneously (instead of processing and discarding per-page), unbounded in-memory work queues (all 500 URLs enqueued immediately with no concurrency-aware backpressure), accumulating all findings/results in a single in-memory array before writing to storage (instead of streaming/incrementally persisting), and headless browser instances (Playwright/Lighthouse's Chrome) not being properly closed/recycled between pages, leaking browser processes and memory across a long crawl.

**Why it happens:**
Works fine at 10-20 test URLs; the failure only appears at higher URL counts or during long-running worker processes that accumulate state over many audits without process restarts — exactly the free-tier ceiling (500 URLs) this project targets.

**How to avoid:**
- Process and persist per-page results incrementally (write to DB/queue immediately after each page, don't accumulate in a top-level array for the whole audit).
- Use a bounded queue with real backpressure (BullMQ concurrency settings, not just "enqueue everything and let promises resolve whenever") — cap concurrent in-flight page fetches independent of total URL count.
- Explicitly close/recycle Chrome/Playwright browser contexts per page or per N pages (don't open one context per URL without closing prior ones; reuse a browser instance across pages within one job, closing only pages/contexts, not the whole browser).
- Set and test actual memory limits on the worker container against a real 500-URL audit before considering this phase done — don't extrapolate from a 20-URL test.
- Consider streaming report generation (write issues to storage as detected) rather than building the full report object in memory and writing once at the end.

**Warning signs:**
- Worker container restarts/OOMs during audits above ~100-200 URLs even though small audits work fine.
- Memory usage graphs climbing monotonically through a long crawl instead of plateauing.

**Phase to address:**
Background worker/queue phase — should be validated with a load test against the actual 500-URL ceiling before that phase is considered complete.

---

### Pitfall 10: Queue jobs get stuck/zombied with no recovery path

**What goes wrong:**
Long-running audit jobs (background worker processing hundreds of URLs with external calls to Lighthouse/PSI) are exactly the kind of job that dies silently: worker process crashes/OOMs mid-job (see Pitfall 9) leaving the job "active" in the queue forever (BullMQ and similar queues need explicit stalled-job detection/requeue config), a job hangs on a single unresponsive URL with no per-URL or per-job timeout, or a deploy/restart of the worker container loses in-flight jobs that weren't idempotently resumable. Users are left with an audit that shows "in progress" forever with no way to know it failed, and no automatic retry — directly damaging trust in a tool whose core value is reliability.

**Why it happens:**
Job queues "just work" in happy-path testing (small crawls that finish in seconds); stuck-job handling only matters for the long-running, externally-dependent jobs this project specifically has (Lighthouse, PSI, third-party site fetches that can hang) — a class of failure that's easy to never trigger in dev.

**How to avoid:**
- Configure explicit per-job and per-URL timeouts (a single unresponsive target URL must not hang the entire audit job).
- Configure stalled-job detection and automatic requeue (BullMQ's `stalledInterval`/`maxStalledCount` or equivalent) so a crashed worker's job gets picked up again rather than stuck in "active" state indefinitely.
- Make job processing idempotent/resumable at the per-URL granularity (store progress per-URL, not just overall job status) so a requeued job doesn't restart the whole 500-URL crawl from zero.
- Build a dead-letter/failed-state path with a max retry count, after which the job is marked "failed" and the user is shown a clear, honest status (not an infinite spinner) with an option to retry.
- Add a heartbeat/progress mechanism so the frontend can show real progress and detect (from the user's perspective) a stalled audit versus a genuinely long one — directly relevant since the requirement is "report progress" for long audits.
- Monitor queue depth and job age in production (alerting on jobs older than expected max audit duration) — don't rely only on user reports to discover stuck jobs.

**Warning signs:**
- Audits occasionally sit at "in progress" indefinitely in manual testing, especially when deliberately killing the worker mid-job or pointing at a slow/hanging test URL.
- Queue dashboard (if using Bull Board or similar) shows jobs stuck in "active" long after they should have completed.

**Phase to address:**
Background worker/queue phase — this must be validated with deliberate failure-injection testing (kill worker mid-job, point at a hanging URL) before considering the phase done, not just happy-path testing.

---

### Pitfall 11: Email verification/double opt-in gate has abuse gaps (quota bypass via email variation, disposable emails, no rate limiting on the gate itself)

**What goes wrong:**
A free-tier gated by "1 audit/week/email" is trivially bypassable if the verification/quota logic doesn't account for: email aliasing (`user+audit1@gmail.com`, `user+audit2@gmail.com` — Gmail and many providers treat `+tag` addresses as the same inbox but a naive quota check treats them as different emails), disposable/temp-mail domains (10minutemail, etc. — anyone can generate infinite verified throwaway addresses), and no rate-limiting on the verification-request endpoint itself (an abuser can trigger thousands of verification emails to third-party addresses, which is both an abuse vector and a spam/deliverability risk that gets the sending domain blacklisted).

**Why it happens:**
The requirement "1 audit/week/email" is stated as a simple database constraint, but "email" as a uniqueness key is deceptively fuzzy — teams implement exact-string uniqueness and don't discover the plus-addressing/disposable-email bypass until the free tier is already being abused (URL-limit/compute cost, or the audited-site owner's server, absorbs the abuse).

**How to avoid:**
- Normalize email addresses before uniqueness checks: strip `+tag` subaddressing for known providers (Gmail, Outlook support this convention) and lowercase/trim before storing/comparing.
- Integrate a disposable-email-domain blocklist (maintained public lists exist, e.g., disposable-email-domains npm package) and reject or flag sign-ups from known temp-mail domains.
- Rate-limit the "send verification email" endpoint itself, independent of the audit-quota logic — by IP and by target email — to prevent it being used as an email-bombing vector against third parties.
- Consider CAPTCHA/bot-protection (e.g., Cloudflare Turnstile) on the initial audit-request form, since this is a public lead-magnet form that will attract scraping/abuse bots targeting the free compute (crawling + Lighthouse is expensive to run per request).
- Log and monitor abuse patterns (many verification requests from one IP, many distinct emails auditing the same domain) even if not blocked outright in v1 — gives visibility to tighten rules later without redesigning storage.

**Warning signs:**
- Same person appears able to audit the same site multiple times per week using trivially different email variants during adversarial QA.
- Verification email volume spikes disproportionately relative to completed audits (sign of email-bombing abuse rather than real usage).

**Phase to address:**
Email verification/quota phase — explicitly test with plus-addressing and a known disposable-domain during QA before shipping.

---

### Pitfall 12: GDPR/consent handling for stored emails treated as an afterthought

**What goes wrong:**
Storing emails + associated audit history + website ownership implication is personal data processing under GDPR (if any EU/UK visitors are expected, which is likely for any public web tool). Common gaps: no clear record of *what* the user consented to and *when* (GDPR requires provable consent — timestamp, IP, and the exact wording/version of terms shown at the time — not just "we have their email"), no data retention/deletion policy or mechanism (indefinite storage of emails + audit history with no way for a user to request deletion), and conflating "double opt-in confirms deliverability" with "double opt-in satisfies GDPR consent requirements" (they are related but not the same thing — GDPR does not technically mandate double opt-in, but it does mandate freely-given, specific, informed, unambiguous, and provable consent, which double opt-in helps evidence but doesn't automatically guarantee without proper consent-language and documentation).

**Why it happens:**
Double opt-in is implemented primarily as an anti-abuse/deliverability mechanism (Pitfall 11), and teams assume that mechanism alone "handles GDPR" without separately implementing consent records, retention policy, and deletion capability.

**How to avoid:**
- Store a consent record separate from the email itself: timestamp of consent, the specific purpose/wording shown ("receive your audit report and occasional related emails from juan-tech.com" or whatever the actual copy is), and ideally IP address at time of consent — versioned if the consent copy ever changes.
- Add a data retention policy (even a simple one, e.g., "unverified emails deleted after 7 days; verified emails + audit history retained until deletion requested") and implement the actual deletion mechanism, not just the policy document.
- Provide a self-service or low-friction way for a user to request their data be deleted (a link in emails, or documented manual process for v1 given it's a small lead-magnet tool) — GDPR's right-to-erasure applies regardless of company size.
- Do not silently reuse the "audit" email list for unrelated marketing without separate, specific consent for that purpose — GDPR requires purpose-specificity, so "consent to receive your audit" is not automatically "consent to receive a newsletter."
- This is legal risk, not just engineering risk — flag this explicitly for a lightweight legal/compliance review before public launch rather than treating it as pure implementation detail.

**Warning signs:**
- No dedicated consent-record table/field exists separate from the "email" column when reviewed at implementation time.
- No documented or implemented process for a user to request deletion of their stored email/history.

**Phase to address:**
Email verification/quota phase (data model) + explicit pre-launch compliance check as a gate before public release.

---

### Pitfall 13: Scoring model produces non-credible results (false positives, opaque weighting, score instability undermines trust)

**What goes wrong:**
The core value proposition is "accurate and reliable" — a scoring model that's internally inconsistent (e.g., re-running the same audit twice gives a different letter grade purely from Lighthouse variance — see Pitfall 6 — or from crawl non-determinism like timing out on different URLs each run) or opaque (a 0-100 score with no visible rationale for how category scores roll up, or issues weighted in ways that don't match real SEO impact, e.g., a missing alt attribute scored as severely as a missing canonical) destroys credibility fast, especially for an audience of SEO-savvy visitors (the target audience, given this is aimed at attracting clients to a technical SEO consultancy) who will immediately spot an inconsistent or naive scoring model and lose trust in the whole tool.

**Why it happens:**
Building a scoring model that "looks right" on a handful of demo sites is easy; building one that's stable, explainable, and matches expert SEO judgment across arbitrary real-world sites (different CMSs, different content types, different intentional tradeoffs like a site that deliberately blocks certain pages) is genuinely hard, and teams often ship a first-pass point-weighted system without validating it against sites where they already know the "correct" expert assessment.

**How to avoid:**
- Validate the scoring model against the existing reference report mentioned in project context (juan-tech.com audit, score 86/100) and against a handful of other real sites where Juan (as the domain expert) can sanity-check whether the score and issue severities match his own professional judgment — treat this as a required validation step, not optional polish.
- Make severity/weighting transparent in the report itself (show *why* a category scored as it did, what issues contributed and their individual weight) rather than a black-box number — this builds trust and is itself a differentiator for an SEO-consultant-branded tool.
- Decouple "flaky" signals (Lighthouse performance) from stable signals (structural technical SEO/on-page/schema checks) in how confidently they're presented — e.g., don't let performance-score noise from Pitfall 6 silently shift the overall score's "Bueno/Necesita mejora/Crítico" bucket between category boundaries on unchanged pages.
- Avoid absolute false positives above all — a wrong "critical" flag on something that's actually fine (e.g., misdetecting JS-rendered content as missing, see Pitfall 8) is worse for trust than a missed issue, since users can verify false positives themselves instantly by viewing source/inspecting the page.
- Build the score-diffing/persistence feature (comparing runs to detect fixed issues) with explicit tolerance for known-noisy metrics (e.g., don't report "performance regressed" based on a 3-point Lighthouse swing that's within normal variance).

**Warning signs:**
- Re-auditing the same unchanged site twice in a row produces a different score or bucket label.
- Manual expert review (Juan checking a report against his own knowledge of a site) disagrees with the tool's severity assignment or overall score direction.

**Phase to address:**
Scoring/report phase — should include an explicit validation pass against known real sites before launch, and the run-diffing feature needs noise-tolerance logic when it's built.

---

### Pitfall 14: Legal/ToS exposure of crawling third-party sites without permission ignored

**What goes wrong:**
This tool crawls arbitrary third-party websites at a user's request, not sites the operator owns — this raises real (if generally low-enforcement-risk in practice for a legitimate SEO audit tool) legal exposure: many sites' Terms of Service explicitly prohibit automated crawling/scraping, aggressive or unthrottled crawling that causes measurable load/cost to a target site could theoretically raise CFAA-adjacent or trespass-to-chattels type concerns in some jurisdictions (historically litigated in scraping cases, e.g., hiQ v. LinkedIn line of cases in the US, though the legal landscape has evolved and mostly protects access to *publicly available* data), and there's a reputational/deliverability risk if the tool becomes known for aggressive crawling that gets IPs blocklisted or triggers abuse complaints to hosting providers.

**Why it happens:**
The product model (auditing on behalf of the URL's owner) creates an implicit assumption of authorization that isn't actually verified — the tool has no way to confirm the person submitting a URL actually owns/controls that site, and this is easy to overlook because the friendly framing ("audit your website") obscures that nothing structurally prevents someone from auditing a competitor's or unrelated third party's site.

**How to avoid:**
- Add a lightweight ToS/acceptable-use statement the user agrees to when submitting a URL (asserting they have the right to have the site audited) — this doesn't eliminate risk but establishes reasonable-use intent and shifts some responsibility, standard practice for this category of tool (comparable public tools like PageSpeed Insights, GTmetrix, etc. operate this way).
- Keep crawling strictly polite and rate-limited (Pitfall 1) — most real-world legal/abuse friction from crawling tools comes from *aggressive* behavior (causing measurable load/cost or bypassing explicit blocks), not from the mere act of fetching publicly available pages respecting robots.txt.
- Respect robots.txt fully (Pitfall 2) as both a technical-quality and legal-hygiene measure — courts and platforms have generally treated robots.txt compliance as a meaningful signal of good-faith, non-abusive automated access.
- Provide an easy way for a site owner to report/block unwanted audits of their domain (e.g., an opt-out/blocklist mechanism keyed by domain) — reduces complaint volume and demonstrates good faith.
- This is a LOW-effort, LOW-complexity mitigation set (ToS checkbox + politeness + robots.txt respect + opt-out) that meaningfully reduces real-world risk without needing heavyweight legal engineering — flag for a brief actual-legal review (not just engineering judgment) before public launch given Juan's professional reputation is attached to the tool.

**Warning signs:**
- No ToS/acceptable-use text exists on the audit-submission form.
- No mechanism exists for a third party to request their domain be excluded from audits.

**Phase to address:**
Should be addressed at/before public launch (likely the same phase as the audit-submission UI) — low implementation cost, so no reason to defer.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|-----------------|
| Exact-hash duplicate detection instead of shingling/SimHash | Ships faster, no tuning needed | Misses the most valuable near-duplicate findings (templated pages) | Acceptable for v1 if clearly labeled as "exact duplicates only"; upgrade in a later phase |
| Cheerio-only extraction (no rendering) | Much cheaper/faster crawl | False negatives on any JS-framework site, directly hurts core "accurate" value prop | Never acceptable as the sole extraction method for on-page/structured-data checks; acceptable only as a fast first-pass with rendered fallback/comparison |
| Running full Lighthouse per URL at 500-URL scale | Simple, one code path for all performance data | Blows time/cost budget, high variance noise at scale | Only acceptable for small audits (e.g., <20 URLs) or a sampled subset; never as default for full-quota audits |
| Single Lighthouse run per URL, no averaging | Simpler pipeline, faster per-URL | Score instability undermines report credibility and run-diffing accuracy | Acceptable only if UI clearly discloses single-run variance; median-of-N preferred before general release |
| No hreflang reciprocity check, presence-only | Ships hreflang check faster | Silently passes the most common real-world hreflang bug, shallow/low-value check | Acceptable as an explicitly-labeled "basic" v1 check; must be upgraded before marketing hreflang validation as a differentiator |
| No stalled-job/timeout handling in queue (happy path only) | Faster to ship worker/queue phase | Audits silently hang forever on worker crash or hanging URL | Never acceptable beyond early internal dev/testing |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|-------------------|
| Google PageSpeed Insights API | Calling PSI per-URL for all 500 URLs per audit, ignoring 400/100s burst limit | Sample-based PSI usage + caching + backoff; request quota increase early |
| Lighthouse (local/unlighthouse) | Single run per page treated as ground truth | Median-of-N runs for critical pages; disclose variance in report |
| Sitemap.xml parsing | Not handling sitemap index files (nested sitemaps), gzip-compressed sitemaps, or malformed XML gracefully | Support sitemap index recursion, gzip decoding, and fall back to link-crawl on parse failure rather than failing the whole audit |
| robots.txt | Hand-rolled wildcard matching instead of RFC 9309-compliant longest-match logic | Use a maintained, spec-compliant parser library |
| Email delivery (double opt-in) | No rate-limit on verification-send endpoint; usable as email-bombing vector | Rate-limit by IP and target email independently from audit quota logic |
| BullMQ/Redis queue | Default stalled-job settings left unconfigured, assuming "it just retries" | Explicitly configure `stalledInterval`/`maxStalledCount`, per-job timeouts, and idempotent per-URL resumability |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Global (not per-domain) concurrency limit for page fetches | One slow/rate-limited target site starves the whole worker's throughput for unrelated audits sharing the worker | Per-domain concurrency cap independent of overall worker concurrency | Any multi-tenant worker running concurrent audits against different domains |
| Rendering every URL with Playwright/Chrome | Memory/CPU exhaustion, audit takes hours | Render only a sample or reuse Lighthouse's own page load instead of a second full render pass | Above roughly 50-100 URLs on typical worker container sizing |
| Accumulating all crawl results in memory before persisting | OOM crashes only on large audits, not small test ones | Incremental per-page persistence, streaming report generation | Around the 200-500 URL range depending on container memory |
| Unbounded/no-timeout page fetch | Single hanging URL blocks/delays entire job | Explicit per-request and per-job timeouts | Any crawl hitting a slow/misconfigured/hanging server |
| PSI called synchronously per URL in the main crawl loop | Crawl throughput bottlenecked by external API latency + rate limits, not by target site fetch speed | Decouple performance-data fetching into its own queue/step with independent concurrency and caching | As soon as audits scale beyond a handful of URLs needing PSI data |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No SSRF protection on user-submitted URLs | Crawler could be tricked into fetching internal/private network addresses (localhost, cloud metadata endpoints like 169.254.169.254, internal IP ranges) if a submitted URL redirects there | Validate and re-validate resolved IPs (including after each redirect hop) against a blocklist of private/internal ranges before fetching; block metadata-service IPs explicitly |
| Email verification token predictable or non-expiring | Account/quota takeover, replay of old verification links | Use cryptographically random, single-use, time-limited verification tokens |
| No CAPTCHA/bot protection on public audit-submission form | Automated abuse of expensive compute (crawl + Lighthouse) at scale, cost-based DoS | Add bot-protection (e.g., Turnstile) on submission and verification-request endpoints |
| Storing raw crawled HTML/content indefinitely without review | Could inadvertently store sensitive data scraped from a third-party site (e.g., exposed PII on the audited page) with no retention limit | Apply a retention/expiry policy to raw crawl artifacts, not just to the audit summary/scores |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| No visible progress during long (500-URL) audits | User assumes the tool is broken/hung and abandons, especially since audits can legitimately take many minutes to hours | Real progress indicator (URLs crawled / total, current phase: crawling → performance → scoring) fed by the worker's heartbeat |
| Presenting a single precise-looking score with no explanation of methodology | Erodes trust with SEO-savvy audience who can spot naive scoring | Show category breakdown, per-issue rationale/source, and explicit note on measurement variance for performance metrics |
| Treating "blocked by robots.txt/WAF" the same as "broken page" in the report | User panics about false "your site is down" findings | Distinct issue categories/messaging for crawler-blocked vs. genuinely broken pages |
| Silent quota rejection (no clear messaging on why a second audit this week is blocked) | Confusing dead-end, user thinks the tool is broken | Clear, specific message: "You can run another free audit for this email on [date]" |

## "Looks Done But Isn't" Checklist

- [ ] **robots.txt compliance:** Often missing wildcard (`*`, `$`) matching and per-subdomain fetching — verify against a real site with a non-trivial robots.txt (wildcards, multiple user-agent blocks).
- [ ] **Redirect/canonical handling:** Often missing redirect-loop guards and conflates redirect target with canonical — verify with a deliberately looping redirect and a page whose canonical differs from its redirect target.
- [ ] **JS-rendering coverage:** Often silently Cheerio-only for "done" checks like structured data/meta tags — verify against a real Next.js/React/Vue-rendered site, not just server-rendered test sites.
- [ ] **Lighthouse/PSI at scale:** Often only tested against 10-20 URLs — verify actual time, cost, and memory behavior against a real 500-URL sitemap before considering the phase done.
- [ ] **Queue reliability:** Often only tested happy-path — verify by deliberately killing the worker mid-job and pointing at a hanging/slow URL to confirm stalled-job recovery and timeouts actually work.
- [ ] **Email quota uniqueness:** Often only tested with distinct emails — verify plus-addressing (`user+1@gmail.com` vs `user+2@gmail.com`) and a disposable-email domain are handled as intended.
- [ ] **Scoring stability:** Often only validated once against one demo site — verify by re-running the same audit twice and confirming the score/bucket doesn't flip from measurement noise alone.
- [ ] **hreflang validation:** Often presence-only — verify reciprocity is actually checked against a real multi-language site with a deliberately broken (non-reciprocal) hreflang setup.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|------------------|
| Crawler gets blocked mid-launch on real client sites | LOW | Add per-domain concurrency caps, backoff, and blocked-vs-broken classification retroactively; largely additive, doesn't require re-architecture |
| Untuned/noisy near-duplicate detection shipped | MEDIUM | Re-tune shingle size/threshold against a labeled validation set; can be done without changing the crawl pipeline itself |
| Cheerio-only extraction found to miss JS-rendered sites post-launch | HIGH | Requires adding a rendering path (Playwright) into the extraction pipeline and re-running affected checks — meaningful architecture change and cost re-budgeting |
| Lighthouse/PSI cost blowup discovered post-launch | MEDIUM-HIGH | Retrofit sampling strategy (only audit a subset of URLs for performance) and caching; requires product-messaging change (explain why not every URL gets a full performance score) |
| Stuck/zombie jobs discovered in production | MEDIUM | Add stalled-job detection/requeue config and per-job timeouts; may need a one-time cleanup script for currently-stuck jobs and user notification for affected audits |
| Email quota bypass being actively exploited | LOW-MEDIUM | Add normalization + disposable-domain blocklist + rate limiting; retroactively can also add a manual review/ban list for already-abused emails/domains |
| GDPR consent records missing for already-collected emails | HIGH (legal) | Requires legal guidance; likely needs a re-consent campaign or data purge for records lacking adequate consent evidence — expensive to fix after the fact, cheap to build in from the start |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Crawler blocked/banned (politeness) | Core crawler engine | Run audit against a real Cloudflare/WAF-protected client site with no bans/false "broken" reports |
| robots.txt mishandling | Core crawler engine | Test against a site with wildcard rules and multiple user-agent blocks; verify blocked sitemap URLs are reported, not silently dropped |
| Redirect chain / canonical conflation | Core crawler engine + technical SEO checks | Test with a redirect loop and a page with mismatched redirect target vs. canonical |
| Duplicate/near-duplicate detection tuning | Dedicated sub-phase after core checks stabilize | Validate against a manually labeled set of known-duplicate and known-distinct real pages |
| hreflang reciprocity | Technical SEO checks (flag for deeper research) | Test against a real multi-language site with an intentionally broken (non-reciprocal) setup |
| Lighthouse variance & scale cost | Performance/CWV phase (flag for deeper research/spike) | Time and cost-test a full 500-URL audit before considering complete; re-run same audit twice, confirm acceptable score stability |
| PSI rate limits/quota | Performance/CWV phase (same spike as above) | Simulate concurrent audits hitting PSI and confirm graceful backoff, no silent data loss |
| Cheerio missing JS-rendered content | Core crawler engine / extraction phase | Audit a real Next.js/React/Vue site and confirm no false "missing" findings for rendered-only content |
| Memory blowups at scale | Background worker/queue phase | Load-test a full 500-URL audit against real worker container memory limits |
| Stuck/zombie queue jobs | Background worker/queue phase | Failure-inject: kill worker mid-job, use a hanging test URL, confirm recovery/requeue/timeout behavior |
| Email quota/verification abuse | Email verification/quota phase | Adversarial QA with plus-addressing and disposable-domain emails |
| GDPR/consent handling | Email verification/quota phase + pre-launch compliance gate | Confirm consent-record fields exist separate from email, retention policy documented, deletion path exists |
| Scoring model credibility | Scoring/report phase | Validate against reference report (juan-tech.com, 86/100) and expert (Juan) sanity review; re-run stability test |
| Legal/ToS of crawling third-party sites | Audit-submission UI phase (low-cost, address before public launch) | ToS/acceptable-use text present, opt-out/blocklist mechanism exists, robots.txt respected end-to-end |

## Sources

- [Lighthouse Variability — Google for Developers](https://developers.google.com/web/tools/lighthouse/variability) (HIGH confidence — official docs)
- [GoogleChrome/lighthouse variability.md — GitHub](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md) (HIGH confidence — official source)
- [How to reduce variance between Lighthouse tests — DebugBear](https://www.debugbear.com/docs/reduce-lighthouse-variance) (MEDIUM confidence — reputable performance-tooling vendor)
- [PageSpeed Insights API limits — Google Groups discussion](https://groups.google.com/g/pagespeed-insights-discuss/c/dB7hWmGAGsw) (MEDIUM confidence — community, cross-checked)
- [PageSpeed Insights API secret rate limit — bjb.dev](https://bjb.dev/log/20221009-pagespeed-api/) (MEDIUM confidence — practitioner report, dated; verify current values in Cloud Console at implementation time)
- [Building a Performance Monitoring Tool with PSI API — Positional](https://www.positional.com/blog/pagespeed-insights-api) (MEDIUM confidence)
- [Does GDPR require double opt-in? — iubenda](https://www.iubenda.com/en/blog/gdpr-double-opt-in-2/) (MEDIUM-HIGH confidence — compliance-focused vendor, aligns with general GDPR consent-proof requirements)
- [GDPR Double Opt-in for Email Marketing — TermsFeed](https://www.termsfeed.com/blog/gdpr-double-opt-in-email-marketing/) (MEDIUM confidence)
- Domain-expert/community-consensus knowledge on crawler engineering (robots.txt RFC 9309 matching semantics, SimHash/shingling for near-duplicate detection, hreflang reciprocity requirements, SSRF risks in URL-fetching services, BullMQ stalled-job configuration) — MEDIUM confidence, well-established engineering practice not tied to a single dated source; flagged where implementation specifics should be verified against current library docs (e.g., BullMQ docs, a chosen robots.txt parser library's test suite) at build time.

---
*Pitfalls research for: SEO/technical web-audit crawler SaaS lead magnet*
*Researched: 2026-07-05*
