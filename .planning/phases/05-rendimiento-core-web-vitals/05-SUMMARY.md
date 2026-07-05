---
phase: 5
plan: 1
subsystem: psi, db, worker, web
tags: [performance, core-web-vitals, pagespeed-insights, lcp, cls, inp, ttfb]
requires: [Phase 2 (Page rows/crawl), Phase 3 (@auditor/checks IssueDraft shape), Phase 3 (worker lockDuration fix)]
provides: [PERF-01, PERF-02, PERF-03, PERF-04, PerfMetric table, @auditor/psi package]
affects: [apps/worker post-crawl pipeline (JOB_TIMEOUT_MS raised), apps/web GET /api/audits/[id] response shape (new `perf` field), Audit.stats shape (new `perf` key)]
tech-stack:
  added: ["@auditor/psi (new workspace package)", ioredis (direct, decoupled from @auditor/queue)]
  patterns: [cache-first external API call with TTL, bounded-concurrency worker lanes (same pattern as network checks), best-effort/degrade-not-fail external dependency]
key-files:
  created:
    - packages/psi/package.json
    - packages/psi/tsconfig.json
    - packages/psi/src/types.ts
    - packages/psi/src/parser.ts
    - packages/psi/src/client.ts
    - packages/psi/src/thresholds.ts
    - packages/psi/src/cache.ts
    - packages/psi/src/sample.ts
    - packages/psi/src/issues.ts
    - packages/psi/src/index.ts
    - packages/psi/src/__fixtures__/psi-response-mobile.json
    - packages/psi/src/__fixtures__/psi-response-desktop-with-inp.json
    - unit tests: parser.test.ts, thresholds.test.ts, sample.test.ts, cache.test.ts, issues.test.ts
  modified:
    - packages/db/prisma/schema.prisma (new `PerfMetric` model + relations on Audit/Page)
    - apps/worker/src/index.ts (perf sample stage, JOB_TIMEOUT_MS 10min -> 20min)
    - apps/worker/package.json (added @auditor/psi dependency)
    - apps/web/app/api/audits/[id]/route.ts (new `perf` field: raw PerfMetric rows)
    - .env.example (documented optional PSI_API_KEY)
decisions:
  - "PSI client is keyless by default (PSI_API_KEY env optional) — matches CONTEXT.md decision; adding a key later needs zero code changes."
  - "Cache lives in Redis/Upstash (own ioredis connection in @auditor/psi, decoupled from @auditor/queue) rather than a DB cache table — native TTL, avoids extra Prisma round-trips."
  - "PerfMetric is a real table (not Audit.stats JSON) so per-page/per-strategy history and re-run idempotency (`deleteMany` + `createMany`, same pattern as Issue) are straightforward."
  - "Perf issues are computed by a helper (`mapPerfIssues`) inside @auditor/psi rather than a `PageCheck`/`SiteCheck` in @auditor/checks — perf checks operate on PSI API results, not on crawled HTML, so they don't fit the existing check interfaces cleanly."
  - "JOB_TIMEOUT_MS raised from 10 to 20 minutes to give the PSI sample stage room (up to 5 pages x 2 strategies, each PSI lab run up to 60s with retries); lockDuration/stalledInterval formula (JOB_TIMEOUT_MS + 60s) is unchanged, preserving the Phase 3 'Lock mismatch' fix."
metrics:
  duration: "~1 session"
  completed: 2026-07-05
---

# Phase 5 Plan 1: PageSpeed Insights performance + Core Web Vitals Summary

Sampled (max 5 pages), cache-first (Redis, 24h TTL), keyless PageSpeed Insights runs producing Performance Score + LCP/CLS/INP/TTFB per page/strategy, graded against official Google thresholds and persisted as both `PerfMetric` rows and `perf`-category Issues — all fault-tolerant so PSI outages never fail an audit.

## What was built

### 1. DB (`packages/db/prisma/schema.prisma`)
New `PerfMetric` model: `id, auditId, pageId?, url, strategy ("mobile"|"desktop"), performanceScore?, lcpMs?, cls?, inpMs?, ttfbMs?, fromCache, error?, fetchedAt`, with relations added on `Audit` and `Page`. Pushed to the live Neon DB via `prisma db push` + `generate` (no migration files — this project doesn't use `prisma migrate`, matches Phases 1-4).

### 2. `@auditor/psi` (new package)
- **`client.ts`** — `runPsi(url, strategy)` calls `GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=...&strategy=...&category=performance`, appending `&key=${PSI_API_KEY}` only when the env var is set. 60s timeout per attempt (PSI lab runs are slow), up to 3 attempts with backoff on 429/5xx, gives up immediately on other 4xx. Never throws — always returns `{ ok, metrics? , error? }`.
- **`parser.ts`** — `parsePsiResponse(raw)` extracts `performanceScore` (`categories.performance.score * 100`), `lcpMs`/`cls`/`ttfbMs` from Lighthouse `audits` (`largest-contentful-paint`, `cumulative-layout-shift`, `server-response-time`), and `inpMs` from CrUX `loadingExperience.metrics.INTERACTION_TO_NEXT_PAINT.percentile`, falling back to `originLoadingExperience` — all fields nullable, INP absence is expected (low-traffic sites), not an error.
- **`thresholds.ts`** — official Google thresholds: score >=90 ok / 50-89 warning / <50 critical; LCP <=2500/<=4000; INP <=200/<=500; CLS <=0.1/<=0.25; TTFB <=800/<=1800 (CrUX guidance, added since the plan asked for a TTFB issue with severity but didn't specify the number). `severityFor(metric, value)` is the single grading entry point.
- **`cache.ts`** — Redis cache keyed `psi:{strategy}:{normalizedUrl}` (trailing slash / hash stripped so URL variants share an entry), 24h TTL, own lazy ioredis connection (TLS auto-detected from `rediss://`, mirrors `@auditor/queue`'s pattern but kept independent so `@auditor/psi` has no dependency on `@auditor/queue`). `getCached`/`setCached`, plus `setPsiCacheConnection` for test injection.
- **`sample.ts`** — `selectSample(pages, max=5)`: filters to 2xx HTML pages, always includes the homepage first, then round-robins across distinct crawl depths for variety, dedupes by URL, caps at `max`.
- **`issues.ts`** — `mapPerfIssues({ url, pageId, mobile, desktop })` produces category `"perf"` issue drafts: one per Performance Score / LCP / CLS / TTFB combining both strategies in `measuredValue` (e.g. `"Móvil: 4876ms / Desktop: 1001ms"`), worst-of-both-strategies severity, plus a dedicated INP issue that reads `"no disponible (datos de campo insuficientes)"` with `severity: "ok"` when CrUX data is absent for both strategies (informational, never breaks anything). If PSI failed for both strategies, a single "no disponible" Performance Score issue is emitted instead of five empty ones.
- **`index.ts`** — barrel export.

### 3. Worker integration (`apps/worker/src/index.ts`)
After the existing crawl + `runAllChecks` pass, `runPerfSample(auditId, pages)`:
1. Selects the sample (max 5 pages).
2. Runs mobile + desktop PSI cache-first (bounded concurrency of 2, respecting keyless PSI's low rate limit) for each sampled page.
3. Persists one `PerfMetric` row per page/strategy (idempotent: `deleteMany` then `createMany`, same pattern as `Issue`).
4. Maps to `perf` Issue drafts via `mapPerfIssues`, merged with the existing SEO/AEO/schema issue drafts before the single `Issue.createMany` call.
5. Returns a `perfSummary` (sampled page count/URLs, average score/LCP/CLS/INP/TTFB per strategy) written into `Audit.stats.perf`.

The whole perf stage is wrapped in try/catch inside `crawlAndCheck()` — if it throws unexpectedly (beyond the per-request handling `runPsi`/`mapPerfIssues` already do), the audit still completes with the SEO checks already computed, just an empty perf summary. `JOB_TIMEOUT_MS` raised from 10 to 20 minutes to make room for the PSI stage; `lockDuration`/`stalledInterval` still derive from `JOB_TIMEOUT_MS + 60s`, so the Phase 3 "Lock mismatch" fix (lock duration above worst-case job duration) is preserved, just recalculated for the new budget.

### 4. Web (`apps/web/app/api/audits/[id]/route.ts`)
`GET /api/audits/[id]` now includes a `perf` array: the raw `PerfMetric` rows for the audit (url, strategy, scores, metrics, `fromCache`, `error`, `fetchedAt`), ordered by `fetchedAt`. This is a preview, same spirit as the existing `issuesByCategory` — full perf reporting/scoring UI is Phase 6.

### 5. Tests (`packages/psi`, vitest, no network)
25 tests across 5 files, all offline:
- `parser.test.ts` — two realistic trimmed PSI JSON fixtures (`__fixtures__/psi-response-mobile.json` with no INP, `psi-response-desktop-with-inp.json` with INP present): verifies score/LCP/CLS/TTFB extraction, missing-INP handling, `originLoadingExperience` fallback, and a fully-empty response.
- `thresholds.test.ts` — boundary values for every metric's ok/warning/critical cutoffs.
- `sample.test.ts` — homepage-first guarantee, cap at `max`, dedupe, depth spread, exclusion of non-2xx/non-HTML pages, empty-input handling.
- `cache.test.ts` — in-memory fake Redis (no real network) injected via `setPsiCacheConnection`: key namespacing, miss/hit, mobile/desktop independence.
- `issues.test.ts` — combined measuredValue formatting, worst-case severity across strategies, INP "not available" informational path, total-failure degradation, fingerprint stability across re-runs.

All commands green: `pnpm install`, `prisma db push`+`generate` (against the live Neon DB), `pnpm -r typecheck`, `pnpm -r build`, `pnpm -r test` (25 passed in `@auditor/psi`, existing 16 + 59 in `@auditor/crawler`/`@auditor/checks` still pass).

## How to verify live (keyless)

1. Ensure `.env` has `DATABASE_URL` and `REDIS_URL` set (already the case) and `PSI_API_KEY` left blank (keyless path).
2. Start the worker (`pnpm --filter @auditor/worker dev`) and web app, then enqueue an audit for `juan-tech.com` (small `urlLimit` recommended for a quick smoke test, e.g. 10-20).
3. After the audit finishes, `GET /api/audits/:id` should return a non-empty `perf` array with `performanceScore`/`lcpMs`/`cls`/`ttfbMs` populated for the sampled homepage (and any other sampled pages) for both `mobile` and `desktop`; `inpMs` will likely be `null` (low-traffic origin) but the corresponding `perf`-category Issue in the issues table should read severity `ok` with `"no disponible"`, not an error.
4. Re-running the same audit shortly after should show `fromCache: true` on the `PerfMetric` rows for URLs already sampled (Redis TTL 24h) — confirms PERF-03 cache-first behavior and quota protection.
5. To confirm graceful degradation, a transient PSI failure (e.g. genuinely unreachable page, or induced timeout) should still leave the audit `status: "done"` with the affected page/strategy showing `error` set on its `PerfMetric` row and an "not available" perf Issue, rather than the whole audit failing.

**Important:** keyless PSI is rate-limited (roughly 1 req/s, small burst quota) — this is exactly why the sample is capped at 5 pages and results are cached for 24h. Running audits back-to-back against the same domain within that window will mostly hit cache, which is intentional.

## Deviations from Plan

### Auto-fixed / discretionary additions (Rule 2 — filling gaps the plan left to discretion)

**1. [Discretion] Added a TTFB severity threshold**
- The plan asked for a TTFB perf issue with severity but the official Google Core Web Vitals thresholds only formally cover LCP/INP/CLS. Used the commonly-cited CrUX TTFB guidance (<=800ms good, <=1800ms needs improvement, else poor) so TTFB gets graded consistently with the other metrics instead of being unscored.
- **Files:** `packages/psi/src/thresholds.ts`, `packages/psi/src/issues.ts`

**2. [Discretion] Perf issue mapping lives in `@auditor/psi`, not as a `@auditor/checks` family**
- `PageCheck`/`SiteCheck`/`NetworkCheck` all operate on crawled `Page` rows (HTML/cheerio) or site-wide crawl metadata — perf issues are derived from PSI API responses per page+strategy, a different shape entirely. Kept `mapPerfIssues` self-contained in `@auditor/psi` (as the plan explicitly allowed: "familia `perf/`... o integración") and had the worker normalize both draft shapes into the same DB row before a single `Issue.createMany` call, rather than force an awkward `PageCheck` adapter.
- **Files:** `packages/psi/src/issues.ts`, `apps/worker/src/index.ts`

**3. [Discretion] Own Redis connection in `@auditor/psi` instead of reusing `@auditor/queue`'s**
- `@auditor/queue`'s `createRedisConnection` is BullMQ-specific (`maxRetriesPerRequest: null`, `enableReadyCheck: false`, tuned for Workers/blocking commands) — reusing it for a simple GET/SET cache would import queue-specific tuning into an unrelated concern and couple `@auditor/psi` to `@auditor/queue`. Wrote a minimal lazy connection in `cache.ts` that mirrors just the TLS auto-detection (`rediss://`).
- **Files:** `packages/psi/src/cache.ts`

**4. [Rule 2] Documented `PSI_API_KEY` in `.env.example`**
- The plan and CONTEXT.md reference this env var throughout but it wasn't in `.env.example` alongside `DATABASE_URL`/`REDIS_URL`. Added it (blank, optional) with a short explanation, matching the existing file's documentation style.
- **Files:** `.env.example`

No bugs found requiring Rule 1 fixes; no architectural (Rule 4) questions came up — the plan's design (Redis cache, `PerfMetric` table, sample-not-full-crawl) was followed as specified.

## Known Stubs

None. Every code path either returns real PSI data or an explicit, correctly-labeled "no disponible" degradation — there is no hardcoded/mock data flowing to the report.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: outbound-network-call | packages/psi/src/client.ts | New outbound call to a third-party API (`www.googleapis.com`) with a user-supplied URL as a query parameter. Low risk: PSI itself fetches the target URL server-side (SSRF surface is on Google's infrastructure, not ours), and the only secret involved (`PSI_API_KEY`) is optional and read from env, never logged. |

## Self-Check: PASSED

All created files verified present on disk (`packages/psi/src/{client,cache,sample,thresholds,issues,parser,index}.ts`, `packages/db/prisma/schema.prisma`, `apps/worker/src/index.ts`, `apps/web/app/api/audits/[id]/route.ts`, `.env.example`). `pnpm --filter @auditor/psi test` re-run: 5 test files, 25 tests, all passed.

