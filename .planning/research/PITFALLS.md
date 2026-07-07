# Pitfalls Research

**Domain:** Adding CSR/SSR detection + deeper canonical/heading checks + on-demand report export (PDF/Markdown-for-LLM/PPTX) to an existing pnpm+Turborepo SEO-audit tool (Next.js 15 web on Vercel + long-running BullMQ worker container) — milestone v1.2
**Researched:** 2026-07-06
**Confidence:** HIGH for the integration/architecture pitfalls (grounded in the actual repo: `apps/worker/src/index.ts`, `packages/checks/src/util.ts`, `packages/scoring/*`, Prisma schema, the report API route, and the pre-documented Playwright pitfalls in root `CLAUDE.md`). MEDIUM for external-library specifics (Playwright memory profile, PDF/PPTX lib i18n) which are ecosystem-standard but version-sensitive.

---

## System facts this analysis is built on (verified in-repo)

- **Fingerprint format** (`packages/checks/src/util.ts`): `pageFingerprint(checkId, url)` = `` `${checkId}:${url}` ``; `siteFingerprint(checkId, scope)` = `` `${checkId}:${scope}` ``. There is **NO unique constraint** on `Issue.fingerprint` (schema only indexes `auditId`/`pageId`). The diff (`packages/scoring/src/diff.ts`) keys a `Map` by fingerprint — duplicate fingerprints silently collapse (last wins).
- **Scoring** (`packages/scoring/src/categoryScore.ts`): health-ratio = average of per-issue health (ok=1, warning=0.5, critical=0), size-independent. Every existing check emits **one issue per page even when the result is "ok"** (see `canonical.ts` returning an `ok` row). Category weights (`overallScore.ts`): tech 0.30, perf 0.30, onpage 0.15, schema 0.10, aeo 0.15.
- **Worker** (`apps/worker/src/index.ts`): `CONCURRENCY = 2`, `JOB_TIMEOUT_MS = 20min`, `lockDuration`/`stalledInterval` = JOB_TIMEOUT+60s. Graceful shutdown closes the BullMQ `Worker` and Prisma — **nothing closes a browser**. PSI already runs up to `MAX_PSI_PAGES=5` × 2 strategies at `PSI_CONCURRENCY=2` (Lighthouse = Chromium load) concurrently with 2 audit jobs.
- **No Dockerfile exists anywhere** in the repo (`find -iname Dockerfile*` → empty). Worker currently runs as a plain Node process; there is no container definition to add Playwright to.
- **`Page.html`** stores raw (Cheerio-pass) HTML as `@db.Text`. There is no rendered-HTML column.
- **Report is public-by-ID**: `apps/web/app/api/audits/[id]/route.ts` and `/audits/[id]/page.tsx` do a bare `prisma.audit.findUnique({ where: { id } })` with **no email/ownership/verification check**. Anyone with the audit id sees the full report.

---

## Critical Pitfalls

### Pitfall 1: Playwright Docker base-image tag not matching the installed `playwright` npm version

**What goes wrong:**
Worker deploy crashes at runtime with `browserType.launch: Executable doesn't exist at /ms-playwright/chromium-XXXX/...`. The audit that triggers CSR detection dies; because CSR runs inside `crawlAndCheck()` under `withTimeout`, a throw there fails the whole job (unless isolated — see Pitfall 4).

**Why it happens:**
Playwright's browser binaries are pinned 1:1 to the npm package version. The `mcr.microsoft.com/playwright:vX.Y.Z-noble` image ships only the browsers for that exact version. Using `:latest`, or bumping `playwright` in `package.json` without bumping the Dockerfile tag (or vice-versa), drifts them apart. Root `CLAUDE.md` already flags this as HIGH-confidence, but there is **no Dockerfile yet**, so this must be built correctly from scratch rather than maintained.

**How to avoid:**
- Create `apps/worker/Dockerfile` FROM `mcr.microsoft.com/playwright:v<exact>-noble`, pinned to the `playwright` version in `apps/worker/package.json`. Pin `playwright` (not `^`) and treat the two as one atomic bump.
- Add a build-time assertion (script comparing `npx playwright --version` to the image tag) or a CI check.

**Warning signs:**
"Executable doesn't exist" / "browser not found" only after a redeploy; works locally (host has a matching browser cache) but fails in the container.

**Phase to address:** The Playwright-infrastructure phase (worker containerization) — must land the Dockerfile before or with CSR detection.

---

### Pitfall 2: Chromium `/dev/shm` default (64MB) → tab crashes; container memory OOM with concurrency=2 + PSI

**What goes wrong:**
Chromium crashes mid-render with `Target closed` / `Page crashed` (shm exhaustion), or the whole container is OOM-killed. This is amplified here: the worker runs **2 audit jobs concurrently**, and each already spins PSI/Lighthouse (Chromium-class load) at `PSI_CONCURRENCY=2`. Adding a Playwright browser per job on top can mean 4+ Chromium-ish processes at 1–2GB each on one small instance.

**Why it happens:**
Chromium defaults `/dev/shm` to 64MB in containers; Playwright browsers are 1–2GB resident each. Nobody sizes the instance for *CSR render + PSI running simultaneously* because in dev they run serially with lots of RAM.

**How to avoid:**
- Run browser with `--disable-dev-shm-usage` (or `--ipc=host` / larger `/dev/shm` if the host allows) — already documented in root `CLAUDE.md`.
- **Gate total Chromium concurrency across the whole worker, not per-job.** Use a single shared `p-queue`/semaphore (concurrency 1–2) that BOTH the PSI pass and the CSR render pass draw from, so 2 audit jobs can't independently launch browsers. Or launch ONE shared browser and open contexts/pages per job.
- Right-size the Railway/Fly instance for the worst case (2 jobs × render + PSI). Prefer **launching Playwright once per audit for the small sample, then closing it**, rather than a long-lived pool.

**Warning signs:**
`Page crashed`/`Target closed` under load but not in isolation; container restarts during the "analyzing" phase; memory graph sawtoothing to the ceiling when two audits overlap.

**Phase to address:** Playwright-infrastructure phase (container + concurrency gating), verified in the CSR-detection phase.

---

### Pitfall 3: Running Playwright on all 500 URLs instead of a small sample

**What goes wrong:**
A "free lead-magnet audit" turns into a 30–60min, high-cost compute job; likely blows `JOB_TIMEOUT_MS` (20min) and gets killed. Rendering 500 pages at ~2–10s each serially is minutes-to-hours.

**Why it happens:**
CSR detection conceptually applies to "every page", so the naive implementation renders the whole crawl. Root `CLAUDE.md` explicitly forbids this but the temptation is structural.

**How to avoid:**
- Reuse the existing sampling pattern (`selectSample` / `MAX_PSI_PAGES` in `apps/worker/src/index.ts`) — render a small representative set (homepage + a few template-representative pages), NOT the full crawl.
- Better: **detect CSR at the template level, not per-page.** Render one representative page per URL-pattern group and generalize the verdict (see Pitfall 5).
- Hard-cap rendered pages with a constant (mirror `MAX_PSI_PAGES`); make it configurable but low (e.g. 5–10).

**Warning signs:**
Audit duration jumps from minutes to tens of minutes after CSR lands; jobs start hitting the 20min timeout; Chromium instance count scales with crawl size.

**Phase to address:** CSR-detection phase.

---

### Pitfall 4: Zombie browser processes — Playwright not closed on job failure/timeout/shutdown

**What goes wrong:**
Browser processes leak. `withTimeout` rejects the crawl+checks promise but does NOT kill work still running underneath it (the timeout only wins the `Promise.race`) — an in-flight `browser.launch()`/render keeps going with no handle to close it. Over hours the worker accumulates dead Chromium processes → memory climbs → OOM. Graceful shutdown (`worker.close()` + `prisma.$disconnect()`) never closes browsers, so SIGTERM during a render orphans them.

**Why it happens:**
The current worker has no browser lifecycle because it has no browser. `withTimeout` was designed for cancel-agnostic async (crawl/PSI degrade gracefully); a browser is a real OS resource that must be explicitly closed in `finally`.

**How to avoid:**
- Wrap every browser in `try { ... } finally { await browser.close() }` **inside** the CSR step, not around the whole job. Guarantee close on the success, throw, AND timeout paths.
- Prefer a **single browser launched and closed within the CSR sample function** (like `runPerfSample` scopes PSI), so its lifetime is bounded by that function.
- Extend `shutdown()` to close any active browser before `process.exit`.
- Add an `AbortSignal`/deadline to the render calls (`page.goto(url, { timeout })`) so a hung render self-terminates instead of relying on the outer `withTimeout`.

**Warning signs:**
`ps` shows accumulating `chrome`/`headless_shell` processes; memory never returns to baseline between audits; OOM after N audits rather than during any single one.

**Phase to address:** CSR-detection phase (lifecycle), Playwright-infrastructure phase (shutdown hook).

---

### Pitfall 5: CSR/SSR false positives — arbitrary raw-vs-rendered diff threshold, per-page noise

**What goes wrong:**
A mostly-SSR page with one JS-hydrated widget (or lazy-loaded below-the-fold content) gets flagged "client-side rendered", producing a wrong, embarrassing issue in a lead-magnet report. Or the verdict is noisy: the same page flips CSR↔SSR between runs because render timing/hydration is non-deterministic.

**Why it happens:**
The naive check compares raw HTML length vs rendered DOM length and thresholds it. Any threshold is arbitrary; hydration, lazy-loading, cookie banners, and A/B scripts all inflate the rendered side without meaning "CSR". This is the same "empirically pick a threshold" problem the project already solved once with the SimHash `threshold=3` decision in Phase 3 — it needs the same disciplined, documented calibration.

**How to avoid:**
- Compare **meaningful content**, not raw byte length: diff `extractVisibleText($raw)` vs the rendered visible text (reuse `extractVisibleText` from `packages/checks/src/util.ts`), and look at whether the *primary content* (title, H1, main text, structured data) exists in raw HTML — not total node count.
- Calibrate the ratio threshold empirically against known SSR (juan-tech.com) and known CSR fixtures; **document the chosen threshold and rationale in a decision log**, exactly like the SimHash=3 precedent.
- Report a **template-level verdict** ("this section of the site renders client-side"), not a per-page critical, to avoid one-off noise.
- Grade severity conservatively: "content present in raw HTML but enhanced by JS" ≠ "content absent without JS". Only flag critical when meaningful content is genuinely missing pre-JS.

**Warning signs:**
SSR reference sites showing CSR flags; verdict flips between two audits of an unchanged site; complaints that "my site IS server-rendered".

**Phase to address:** CSR-detection phase (threshold calibration + template-level verdict).

---

### Pitfall 6: New multi-condition checks colliding fingerprints → wrong diff + swallowed issues

**What goes wrong:**
Deeper canonical (chains, canonical→non-indexable, cross-domain, mismatch-with-final-URL) and heading checks (multiple H1, level skips, empty headings, wrong order) naturally emit **several distinct problems on the same page**. If they all reuse `pageFingerprint(CHECK_ID, url)` (as the current single-issue `canonical.ts` does), every sub-issue for a page shares one fingerprint. Consequences: (a) in the diff `Map` they collapse (last wins) so "3 new heading problems" counts as 1; (b) even without a DB unique constraint, `Issue.diffStatus` and the priority table treat them as one logical issue; (c) resolving one of three sub-problems can't be reflected in the diff.

**Why it happens:**
The existing checks return exactly one issue per page (early-return style), so the current fingerprint scheme has never needed sub-typing. Deeper checks break that assumption.

**How to avoid:**
- Give each distinct condition its own **stable sub-typed fingerprint**: e.g. `` `${CHECK_ID}:${subtype}:${url}` `` (`TECH-04:chain`, `TECH-04:cross-domain`, `ONPAGE-03:multiple-h1`, `ONPAGE-03:level-skip`). Add a `subtype` helper to `util.ts` rather than hand-concatenating.
- Keep the subtype label **stable and content-independent** — do NOT embed the measured value (e.g. the offending heading text) in the fingerprint, or fixing one typo churns the diff.
- Since there's no unique constraint, collisions fail silently — add a dev-time assertion/test that a single page-check run never returns two issues with identical fingerprints.

**Warning signs:**
Diff counts lower than the visible issue count; fixing one of several page problems doesn't show as "resolved"; two issues in the priority table that "feel" like one row.

**Phase to address:** Canonical-deepening phase and Heading-hierarchy phase (fingerprint design), with a shared util change up front.

---

### Pitfall 7: Score dilution — new per-page "ok" issues swamp the tech/onpage categories

**What goes wrong:**
Because every check emits an `ok` row per page (verified in `canonical.ts`), adding 2–3 new per-page checks over a 500-page crawl injects ~1000–1500 `ok` rows into the `tech` (0.30) and `onpage` (0.15) categories. The health-ratio average is size-independent but **not check-count-independent**: a category with a handful of criticals plus a flood of new `ok` rows scores *higher* (criticals get diluted). Adding "more thorough" checks can paradoxically **raise** the score and hide real problems — or, if the new checks surface many criticals, sharply move the score in a way that makes v1.2 audits non-comparable to v1.0/v1.1 history.

**Why it happens:**
The health-ratio model averages across *all* emitted check results including passes. More checks = more denominator. Nobody re-tunes weights when adding checks because scoring "just works".

**How to avoid:**
- Decide deliberately whether new checks emit `ok` rows. Two consistent options: (a) keep emitting `ok` per page for UI completeness but accept/verify the dilution effect on a fixture; or (b) collapse a per-page check to **one aggregate result per category** so it contributes one denominator unit, not 500.
- Re-run scoring against the juan-tech.com reference fixture BEFORE/AFTER adding checks and confirm the overall score doesn't drift unexpectedly (there's precedent: overall 91 vs reference 86 was a tracked decision).
- If the new checks materially change category composition, revisit `CATEGORY_WEIGHTS` and **log the decision**.
- Warn users/roadmap that v1.2 scores may not be directly comparable to pre-v1.2 audit history for the same site.

**Warning signs:**
Overall score moves several points on an unchanged site after adding checks; a category with new criticals barely moves because ok-dilution absorbs them; historical diff shows a score jump with no site change.

**Phase to address:** Each new-check phase (verify score impact on fixture); a scoring-recalibration checkpoint before milestone close.

---

### Pitfall 8: Vercel export route exceeds serverless timeout / memory / bundle limits

**What goes wrong:**
Generating a PDF/PPTX for a large audit inside a Next.js Node API route on Vercel hits the function timeout (default ~10–60s depending on plan; 300s max only on higher tiers) or memory cap, returning a 504/OOM mid-download. Or the deploy itself breaks: pulling a heavy renderer into the web bundle blows the function size limit.

**Why it happens:**
On-demand export reads hundreds of issues from Postgres and renders them synchronously in a short-lived function. Buffering a whole multi-hundred-page PDF/PPTX in memory before responding spikes RAM. And the classic trap: someone reaches for **Puppeteer/Chromium-based HTML→PDF**, which cannot and must not be bundled into a Vercel function (this is the exact serverless mismatch root `CLAUDE.md` calls out for the worker).

**How to avoid:**
- **Do NOT bundle Chromium/Playwright into the web deploy.** Use pure-JS generators: `pdfkit` or `@react-pdf/renderer` for PDF, `pptxgenjs` for PPTX, plain string building for Markdown. Keep them out of any shared package the worker also uses (see Pitfall 11).
- Bound the work by **truncating/summarizing to top-N** (Pitfall 9) so the document is small and fast regardless of audit size.
- **Stream** the response where the library supports it (pipe the generator to the Response body) instead of buffering the whole file; set `export const runtime = "nodejs"` (already the pattern in the report API route) and configure `maxDuration`.
- Set correct download headers: `Content-Type` (`application/pdf`, `text/markdown; charset=utf-8`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`) and `Content-Disposition: attachment; filename="..."`.

**Warning signs:**
504s on large-site exports but fine on small ones; Vercel "Function size exceeds limit" at build; cold-start latency spikes; `chromium` appearing in the web deploy's dependency tree.

**Phase to address:** Export-infrastructure phase (route + library choice); revisited per export-format phase.

---

### Pitfall 9: Export data volume — hundreds of issues → useless hundred-page PDF / over-long LLM Markdown

**What goes wrong:**
A 500-page audit can have hundreds of issues. A faithful PDF/PPTX becomes a 200-page document or a 150-slide deck nobody reads. The Markdown-for-LLM export blows past model context windows, so the LLM silently truncates and gives partial fixes. Silent truncation is worse — the user thinks they got everything.

**Why it happens:**
"Export the report" is read as "dump every row". No summarization layer exists between the DB and the document.

**How to avoid:**
- Design each export around **prioritization, not completeness**: top-N issues by severity/impact, grouped by category, with counts ("+142 more warnings"). PPTX especially should be an executive summary (score, category gauges, top issues), not per-issue slides.
- For Markdown-for-LLM: budget a token ceiling, prefer critical+warning, structure as compact grouped sections, and **state explicitly in the document what was omitted** ("Showing top 50 of 312 issues") rather than truncating silently.
- **Log/record what was dropped** so it's auditable, and expose the full count in the UI.

**Warning signs:**
Exports with dozens of pages/slides; LLM given the .md returns fixes for only the first few issues; users asking "where are the rest of my issues".

**Phase to address:** Each export-format phase (define the top-N/summarization contract in the export-infrastructure phase so all three formats share it).

---

### Pitfall 10: Export route inherits public-by-ID access with no ownership/verification check

**What goes wrong:**
The report is currently public-by-ID (no auth in `apps/web/app/api/audits/[id]/route.ts`). If the export route follows the same pattern, anyone with an audit id can download a branded PDF/PPTX of someone else's audit — including the audited domain and, depending on export contents, the requester's email. Worse, a scriptable export endpoint is a cheap way to harvest/DoS (each call is heavier than a JSON read).

**Why it happens:**
Copy-pasting the existing report route pattern carries its (deliberate, for public reports) lack of auth into a heavier, more sensitive surface.

**How to avoid:**
- **Make an explicit product decision** and log it: are reports intentionally public-by-ID (shareable link, ids are unguessable cuids) or should export require the owning verified email? Given this is a lead magnet, public-by-shareable-link is defensible for the *report*, but exports should at minimum be rate-limited.
- Do NOT include PII (the requester's email, verification tokens) in any export body regardless.
- Add lightweight abuse protection on the export route (per-IP/per-audit rate limit) since it's compute-heavier than the JSON report.
- If ownership is required, gate on the verified-email → audit relationship already in the schema.

**Warning signs:**
Export endpoint enumerable; exports containing emails; export traffic disproportionate to audit creation.

**Phase to address:** Export-infrastructure phase (access-control decision before wiring the button).

---

### Pitfall 11: Boundary violation — worker-only deps (Crawlee/Playwright) leaking into `apps/web` via a shared export/types package

**What goes wrong:**
A shared package (e.g. a new `@auditor/export` or reusing `@auditor/checks`/`@auditor/scoring` types) transitively imports Crawlee or Playwright, so the Vercel build tries to bundle them → build failure or a bloated function. Root `CLAUDE.md` explicitly warns Next.js's Vercel build must never pull in Playwright/Crawlee.

**Why it happens:**
Export logic needs the audit's data *shapes* (issue/category/score types), which live in packages that ALSO contain crawl logic. A single deep import (`import { ... } from "@auditor/checks"`) can drag the whole dependency graph.

**How to avoid:**
- Keep the export package **pure**: it should depend only on `@auditor/db` (Prisma types) and pure-JS document libs — never on `@auditor/crawler`, `@auditor/checks` runtime, `@auditor/psi`, or `playwright`.
- Import only **types** from shared packages (`import type`), and ensure those type modules don't re-export runtime crawl code. Split a `types-only` entry point if needed.
- Add a CI/build guard: assert the web bundle's dependency graph contains no `playwright`/`crawlee` (e.g. `pnpm why playwright` in the web workspace must be empty).

**Warning signs:**
Vercel build errors referencing Playwright/Chromium or native modules; web function bundle size jumping; `pnpm why crawlee` resolving inside `apps/web`.

**Phase to address:** Export-infrastructure phase (package boundary), enforced by a build guard.

---

### Pitfall 12: PDF/PPTX not rendering Spanish accents/ñ (font/encoding gotcha)

**What goes wrong:**
Report copy is Spanish-neutral with accents and ñ. Default PDF core fonts (PDFKit's Helvetica/WinAnsi) and careless PPTX text handling drop or mojibake `á é í ó ú ñ ¿ ¡` — the branded lead-magnet deliverable looks broken.

**Why it happens:**
PDFKit's built-in AFM fonts are WinAnsi-encoded and don't cover the full range; you must embed a Unicode TTF. Some libs need explicit UTF-8 handling. The bug only shows on accented characters, which English-first testing misses.

**How to avoid:**
- **Embed a Unicode TTF** in the PDF (the project already self-hosts brand fonts — Array/Khand/Geist; register the Geist/appropriate TTF with the PDF lib) rather than relying on core fonts.
- Verify with a fixture string containing `áéíóúñ¿¡` in every export format before shipping.
- Ensure Markdown export sets `charset=utf-8` in `Content-Type`.

**Warning signs:**
Missing glyphs, boxes, or garbled accents in generated PDFs/decks; only ASCII text renders correctly.

**Phase to address:** PDF export phase and PPTX export phase (font embedding + accent fixture).

---

### Pitfall 13: Non-deterministic CSR verdict churning the diff (new/resolved flapping)

**What goes wrong:**
If the CSR check only emits an issue *when CSR is detected* (problem-only, unlike the existing checks that always emit an `ok` row), then a page whose render is timing-sensitive can be flagged CSR in one audit and not the next. Because the diff is fingerprint-only, the issue appears as **`new`** one week and **`resolved`** the next on an unchanged site — false "you fixed it / it regressed" churn.

**Why it happens:**
Playwright rendering isn't perfectly deterministic (network, hydration timing, lazy-load). Combined with an arbitrary threshold (Pitfall 5), the boundary cases flip.

**How to avoid:**
- Follow the existing convention: **always emit a stable issue row per sampled page** (ok OR critical) with a stable `pageFingerprint`, so the fingerprint persists across runs and only the severity changes (severity changes don't churn the fingerprint-based diff).
- Render deterministically: wait for `networkidle`/a stable signal, fixed viewport, disable animations, consistent timeout.
- Make the verdict template-level so a single flaky page doesn't flip a whole pattern.

**Warning signs:**
Diff shows CSR issues as new/resolved on sites that didn't change; the same page's CSR verdict differs between two consecutive audits.

**Phase to address:** CSR-detection phase.

---

### Pitfall 14: Bot detection / sites blocking headless Chromium

**What goes wrong:**
Some sites serve a challenge page, block, or serve different HTML to headless Chromium (Cloudflare, bot walls). The CSR check then compares raw HTML against a challenge/blocked page and produces a meaningless verdict (e.g. "all content is client-rendered" because the rendered DOM is a CAPTCHA).

**Why it happens:**
Playwright's default headless UA/fingerprint is detectable; the crawl (Cheerio) uses `DEFAULT_USER_AGENT` and may pass where headless render doesn't.

**How to avoid:**
- Use a consistent, honest UA (align with `DEFAULT_USER_AGENT`) and reasonable headers on the Playwright context.
- **Detect the failure mode**: if the rendered page looks like a challenge (title/markers), or the render 403s/times out, **degrade gracefully** — emit "render unavailable, CSR not determined" rather than a false CSR flag (mirror how PSI degrades to "not available" instead of failing the audit).
- Never let a blocked render fail the whole job (isolate like `runPerfSample`'s try/catch).

**Warning signs:**
CSR flagged on well-known SSR sites behind Cloudflare; render results that look like CAPTCHA/challenge text; sudden 403s only on the render pass.

**Phase to address:** CSR-detection phase (graceful-degradation path).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Render all 500 URLs "just to be safe" | Simplest to reason about | Timeouts, huge compute bill, killed jobs | Never — sample/template-level only |
| Store full rendered HTML for every sampled page in a new DB column | Easy re-analysis/debug | `@db.Text` bloat on Neon; only need the diff result | Only if capped to the sample size AND actually needed; prefer storing the verdict + small diff metric, not the full DOM |
| Reuse `pageFingerprint(CHECK_ID, url)` for multi-condition checks | Copy the existing check pattern | Diff collapse, swallowed sub-issues (Pitfall 6) | Never for multi-condition checks — sub-type the fingerprint |
| Buffer the whole PDF/PPTX in memory then return | Trivial route code | Vercel memory spikes on large sites | Only with hard top-N truncation keeping docs small |
| Copy the public-by-ID report pattern into the export route | Fast to ship | Unauthenticated heavy endpoint, possible PII exposure | Only after an explicit logged access-control decision + rate limit |
| Long-lived Playwright browser pool in the worker | Avoids per-audit launch cost | Zombie/OOM risk with concurrency=2 + PSI | Prefer launch-per-audit-sample-then-close until real load data justifies pooling |
| Emit `ok` rows for every new per-page check without checking score impact | Consistent with existing checks | Silent score dilution (Pitfall 7) | Only after verifying score drift on the reference fixture |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Playwright + Docker | `:latest` or drifting image/npm versions | Pin `mcr.microsoft.com/playwright:v<exact>-noble` = installed `playwright` version; bump atomically |
| Playwright + existing PSI load | Counting browser concurrency per-job | Global semaphore shared by PSI + CSR passes; size instance for 2 jobs × (render + PSI) |
| Playwright + `withTimeout` | Assuming the outer race cancels the render | Explicit `page.goto` timeout + `finally { browser.close() }`; add browser close to `shutdown()` |
| Vercel Node route + PDF | Reaching for Puppeteer/Chromium HTML→PDF | Pure-JS `pdfkit`/`@react-pdf/renderer`; never bundle Chromium into web |
| Vercel route + large file | Buffer entire file, no `maxDuration` | Stream response, set `maxDuration`, truncate to top-N |
| pnpm workspace imports | Deep-importing `@auditor/checks`/`crawler` for types | `import type` only from a pure types entry; CI guard `pnpm why playwright` empty in web |
| PDF lib + Spanish copy | Rely on core WinAnsi fonts | Embed Unicode TTF (reuse brand Geist TTF); test `áéíóúñ¿¡` |
| Neon Postgres + rendered HTML | New `@db.Text` column per page | Store verdict/metric, not full DOM; cap to sample |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Playwright over full crawl | 20min timeout hits, cost spike | Sample/template-level render (≤5–10 pages) | Any site >~50 pages |
| Concurrent browsers (2 jobs × render + PSI) | OOM, `Target closed` | Global Chromium semaphore, right-sized instance | As soon as 2 audits overlap |
| Buffered large-audit export | Route 504/OOM | Stream + top-N truncation | Audits with hundreds of issues |
| Markdown-for-LLM full dump | LLM silently truncates | Token budget + explicit omission note | Sites with >~50–100 issues |
| Score dilution from new ok-rows | Score drifts up on unchanged site | Verify on fixture; consider aggregate rows | Large crawls (hundreds of pages) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Export endpoint unauthenticated + unthrottled | Enumeration, cheap DoS (heavier than JSON), scraping | Explicit access-control decision + per-IP/per-audit rate limit |
| PII (requester email, verification token) in export body | Data leak via shareable/enumerable link | Never include PII in exports; exports contain audit data only |
| Rendering attacker-influenced URLs in Playwright | SSRF-ish/local-file access if `file://`/internal URLs slip in | Only render http(s) URLs already in the crawl set; block internal/loopback targets |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 200-page PDF / 150-slide PPTX | Unusable deliverable, hurts lead-magnet credibility | Executive summary + top-N with "+N more" |
| Silent truncation of issues | User trusts an incomplete fix list | State "top N of M" in the document + UI |
| Broken accents in branded PDF | Looks unprofessional in Spanish | Embed Unicode font; accent fixture test |
| No loading/disabled state on export button while generating | Double-clicks, duplicate heavy requests | Disable button + spinner during generation |
| CSR false positive on user's SSR site | User distrusts the whole audit | Conservative threshold + template-level verdict + "not determined" fallback |

## "Looks Done But Isn't" Checklist

- [ ] **Playwright container:** Often missing exact image/npm version pin — verify `browser.launch()` works in the deployed container, not just locally.
- [ ] **Browser lifecycle:** Often missing `finally { browser.close() }` on timeout/failure paths and in `shutdown()` — verify no Chromium survives a failed/aborted job.
- [ ] **CSR threshold:** Often missing empirical calibration + decision log — verify against a known SSR (juan-tech.com) and known CSR fixture.
- [ ] **New checks' fingerprints:** Often reuse one fingerprint per page — verify each distinct condition has a stable sub-typed fingerprint and the diff counts them separately.
- [ ] **Score impact:** Often unverified — run the reference fixture before/after and confirm intended score movement.
- [ ] **Export route deps:** Often silently pull Chromium/Crawlee — verify `pnpm why playwright`/`crawlee` is empty in `apps/web`.
- [ ] **Export volume:** Often dumps everything — verify top-N truncation and an explicit "omitted" note.
- [ ] **Export headers:** Often missing `Content-Disposition`/correct `Content-Type` — verify the file actually downloads with a sane filename.
- [ ] **Accents:** Often broken — verify `áéíóúñ¿¡` render in PDF and PPTX.
- [ ] **Export auth:** Often copies public-by-ID blindly — verify the access-control decision is made and rate-limiting exists.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Image/npm version drift | LOW | Re-pin Dockerfile tag to installed `playwright`, redeploy |
| Zombie browsers / OOM | MEDIUM | Add `finally`-close + shutdown hook + global semaphore; restart worker |
| CSR false positives shipped | MEDIUM | Recalibrate threshold, switch to template-level, re-run affected audits |
| Fingerprint collisions shipped | MEDIUM | Sub-type fingerprints; historical diffs before the fix stay slightly off (data migration usually not worth it) |
| Score drift from new checks | LOW–MEDIUM | Re-tune weights or collapse ok-rows; recompute is per-new-audit only |
| Chromium bundled into Vercel | LOW | Swap to pure-JS PDF lib, purge dep, redeploy |
| Broken accents in a shipped PDF | LOW | Embed Unicode font, regenerate on next export (exports are on-demand, no backfill needed) |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Image/npm version mismatch | Playwright-infrastructure (Dockerfile) | Container `browser.launch()` succeeds post-deploy; CI version-match check |
| 2 shm/OOM with concurrency+PSI | Playwright-infrastructure | Two overlapping audits stay under memory ceiling |
| 3 Render all 500 URLs | CSR-detection | Audit duration unchanged materially; rendered-page count capped |
| 4 Zombie browsers | CSR-detection + shutdown hook | No Chromium survives failed/aborted/SIGTERM job |
| 5 CSR false positives / threshold | CSR-detection | SSR fixture not flagged; threshold documented in decision log |
| 6 Fingerprint collisions | Canonical-deepening + Heading-hierarchy (shared util first) | Test: no duplicate fingerprints per page; diff counts sub-issues separately |
| 7 Score dilution | Each new-check phase + scoring checkpoint | Reference-fixture score drift within expected bounds |
| 8 Vercel route limits | Export-infrastructure | Large-audit export completes under `maxDuration`; no Chromium in bundle |
| 9 Export data volume | Export-infrastructure (shared top-N contract) | Docs stay small; omission note present |
| 10 Export access control | Export-infrastructure | Access-control decision logged; rate limit active; no PII in body |
| 11 Boundary violation | Export-infrastructure | `pnpm why playwright/crawlee` empty in web; build guard green |
| 12 PDF/PPTX accents | PDF export + PPTX export | `áéíóúñ¿¡` fixture renders correctly |
| 13 Non-deterministic CSR diff churn | CSR-detection | Stable per-page issue rows; unchanged site shows no CSR churn |
| 14 Bot detection / blocked render | CSR-detection | Blocked render degrades to "not determined", never a false CSR flag or job failure |

## Sources

- Repo, HIGH confidence: `apps/worker/src/index.ts` (concurrency, timeout, shutdown, PSI pattern), `packages/checks/src/util.ts` (fingerprint format), `packages/checks/src/checks/tech/canonical.ts` (single-issue-per-page pattern + ok-row emission), `packages/scoring/src/{categoryScore,overallScore,diff}.ts` (health-ratio, weights, fingerprint-keyed diff), `packages/db/prisma/schema.prisma` (no unique on `Issue.fingerprint`, `Page.html` Text column), `apps/web/app/api/audits/[id]/route.ts` (public-by-ID, no auth).
- Root `CLAUDE.md`, HIGH confidence (project-authored, pre-verified): Playwright Docker version pinning, `/dev/shm`/`--ipc=host`, Chromium 1–2GB memory, sampling-not-all-500, "never run Playwright/Lighthouse in a Vercel function", keep worker deps out of the Vercel bundle.
- `.planning/PROJECT.md`, HIGH confidence: v1.2 scope, "aditivo, no romper pipeline", exports on-demand in Next.js Node route, SimHash threshold=3 empirical-calibration precedent, size-independent health-ratio scoring decision, Spanish-neutral copy constraint.
- Playwright/Chromium container memory + headless detection behavior, MEDIUM confidence: ecosystem-standard, version-sensitive.
- Pure-JS PDF/PPTX i18n (PDFKit WinAnsi core-font limitation, need embedded Unicode TTF), MEDIUM confidence: well-known library gotcha, verify against chosen lib version.

---
*Pitfalls research for: adding CSR/SSR detection + deeper canonical/heading checks + report export to the Auditor v1.2 milestone*
*Researched: 2026-07-06*
