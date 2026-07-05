# Architecture Research

**Domain:** Automated web-audit / SEO-technical crawler SaaS (lead magnet)
**Researched:** 2026-07-05
**Confidence:** HIGH (component boundaries, queue pattern, data model) / MEDIUM (Lighthouse orchestration specifics, PSI rate limits — verify against current Google docs before Phase implementing performance checks)

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│  VERCEL (Next.js App Router)                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────────┐    │
│  │  Public UI   │  │  API Routes   │  │  Report UI (SSR/RSC)      │    │
│  │  (form: URL  │  │  /api/audits  │  │  /audits/[id]             │    │
│  │  + email)    │  │  /api/verify  │  │  /audits/[id]/progress    │    │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┬────────────┘    │
│         │                 │                          │                │
└─────────┼─────────────────┼──────────────────────────┼────────────────┘
          │ POST                │ enqueue                  │ poll/SSE
          ▼                 ▼                          ▲
┌───────────────────────────────────────────────────────────────────────┐
│  SHARED STATE: Postgres + Redis                                       │
│  ┌───────────────────────┐   ┌───────────────────────────────────┐   │
│  │ Postgres (source of    │   │ Redis (BullMQ queue + job state    │   │
│  │ truth: audits, pages,  │   │  + PSI response cache + rate-limit │   │
│  │ issues, emails, quota) │   │  counters)                          │   │
│  └───────────────────────┘   └───────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
          ▲                                        │
          │ writes (progress + results)             │ pulls jobs
          │                                        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  WORKER CONTAINER (Railway/Fly/VPS) — long-running Node process       │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐ ┌────────────────┐ │
│  │ URL          │ │ Page fetch/  │ │ Check         │ │ Lighthouse/PSI │ │
│  │ Discovery    │ │ parse        │ │ engine        │ │ orchestrator   │ │
│  │ (sitemap +   │ │ (Cheerio +   │ │ (SEO/on-page/ │ │ (PSI API calls │ │
│  │ crawl        │ │ optional     │ │ schema/AEO     │ │ + optional     │ │
│  │ fallback)    │ │ Playwright)  │ │ rule set)      │ │ local LH)      │ │
│  └──────┬──────┘ └──────┬──────┘ └───────┬──────┘ └───────┬────────┘ │
│         └────────────────┴─────────────────┴─────────────────┘       │
│                              BullMQ Worker (processAudit job)         │
└───────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌───────────────────────────────────────────────────────────────────────┐
│  EXTERNAL SERVICES                                                     │
│  Google PageSpeed Insights API   │  Target site being audited (HTTP)   │
│  Email provider (Resend/Postmark - double opt-in)                      │
└───────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Next.js UI | Landing form (URL + email), double opt-in flow, report display, progress view | App Router pages + Server Actions/Route Handlers |
| Next.js API routes | Validate input, check quota, create `audit` + `email` rows, enqueue job, expose progress/report read endpoints | Route Handlers (`app/api/.../route.ts`), thin — no crawl logic here |
| Postgres | Durable source of truth: audits, pages, issues, emails, quota, run history | Managed Postgres (Neon/Supabase/Railway Postgres) accessed via Prisma or Drizzle |
| Redis | Queue transport (BullMQ), ephemeral job progress, PSI response cache, quota rate-limit counters | Managed Redis (Upstash/Railway Redis) |
| Worker container | Consumes queue, runs full crawl pipeline (discovery → fetch → parse → check → score → persist), pushes progress | Node long-running process (`worker.ts`) using BullMQ `Worker`, deployed as separate service from the web app |
| Google PSI API | Field/lab performance data (LCP, CLS, INP, TTFB, Performance score) per URL | REST calls from worker, rate-limited + cached |
| Email provider | Sends double opt-in verification email and (optionally) "audit ready" notification | Resend/Postmark transactional API |

**Critical boundary:** Vercel (Next.js) never runs the crawl. It only reads/writes Postgres and enqueues to Redis. All crawling, parsing, checking, and Lighthouse/PSI calls happen exclusively in the worker container. This is non-negotiable given the 500-URL/serverless-timeout constraint already decided in PROJECT.md — keep it enforced at the code-boundary level (no crawl/lighthouse imports in `app/`).

## Recommended Project Structure

Two deployables sharing one repo (monorepo) is the standard pattern here — shared types/schema, independent deploy lifecycle.

```
/
├── apps/
│   ├── web/                        # Next.js App Router → Vercel
│   │   ├── app/
│   │   │   ├── (marketing)/page.tsx        # landing + URL/email form
│   │   │   ├── api/audits/route.ts         # POST create audit + enqueue
│   │   │   ├── api/audits/[id]/route.ts    # GET status/progress (poll)
│   │   │   ├── api/audits/[id]/stream/route.ts # GET SSE stream (optional)
│   │   │   ├── api/verify/[token]/route.ts # double opt-in confirm
│   │   │   └── audits/[id]/page.tsx        # report UI (RSC, reads Postgres)
│   │   └── lib/
│   │       ├── db.ts                # Prisma/Drizzle client (read-mostly)
│   │       ├── queue.ts             # BullMQ Queue producer (enqueue only)
│   │       └── quota.ts             # quota check helper (reads Postgres/Redis)
│   │
│   └── worker/                      # Node process → Railway/Fly/VPS
│       ├── src/
│       │   ├── index.ts             # BullMQ Worker bootstrap, concurrency config
│       │   ├── pipeline/
│       │   │   ├── discover.ts      # sitemap.xml parse + crawl fallback (BFS via <a> links)
│       │   │   ├── fetch.ts         # HTTP fetch w/ concurrency limit, robots.txt respect
│       │   │   ├── render.ts        # optional Playwright render for JS-heavy pages
│       │   │   ├── parse.ts         # Cheerio extraction → structured page data
│       │   │   ├── checks/          # one file per check category
│       │   │   │   ├── technical-seo.ts
│       │   │   │   ├── on-page.ts
│       │   │   │   ├── structured-data.ts
│       │   │   │   ├── aeo.ts
│       │   │   │   └── index.ts     # registers all checks, runs against PageData
│       │   │   ├── performance.ts   # PSI API client + cache + score mapping
│       │   │   ├── score.ts         # category scores + overall score aggregation
│       │   │   └── diff.ts          # run-to-run comparison (issue fixed/new/persisting)
│       │   └── progress.ts          # job.updateProgress() + Postgres progress writes
│       └── package.json
│
├── packages/
│   ├── db/                          # shared Prisma/Drizzle schema + migrations
│   ├── shared-types/                # Audit, Page, Issue, Check types shared web↔worker
│   └── checks-catalog/              # check definitions + severity/scoring rules (pure logic, testable, importable by worker AND by a future CLI/test harness)
│
└── turbo.json / pnpm-workspace.yaml
```

### Structure Rationale

- **`apps/web` vs `apps/worker`:** enforces the architectural boundary physically, not just by convention — the worker's dependencies (Playwright, Lighthouse/puppeteer-core) never get bundled into the Vercel deploy, keeping cold starts and function size sane.
- **`packages/db`:** one schema, two consumers. Web reads (mostly `SELECT`) for report/progress display; worker writes (crawl results) and reads (quota check, previous run for diffing). Avoids schema drift between the two deployables.
- **`packages/checks-catalog`:** the check rule set is the core IP of the product. Isolating it as a pure-logic package (input: parsed page data, output: issues) makes it unit-testable without spinning up the queue/worker, and reusable if a CLI or test mode is added later.
- **`pipeline/` ordering mirrors the actual data flow** (discover → fetch → render → parse → checks → performance → score → diff), so a new engineer (or Claude in a future phase) can read the folder top-to-bottom and understand execution order.

## Architectural Patterns

### Pattern 1: Thin producer / fat consumer (Vercel enqueues, worker does everything)

**What:** Next.js API route only validates input, writes the initial `audit` row (status: `queued`), and calls `queue.add()`. All actual work happens in the worker.
**When to use:** Any time work exceeds serverless function time/CPU limits — exactly this project's stated reason for the split.
**Trade-offs:** Adds infra (a second deployable + Redis), but avoids timeouts entirely and lets you scale crawl concurrency independently of the web tier.

```typescript
// apps/web/app/api/audits/route.ts
export async function POST(req: Request) {
  const { url, email } = await req.json();
  await assertQuotaAvailable(email);           // reads Postgres
  const audit = await db.audit.create({ data: { url, emailId, status: "queued" } });
  await auditQueue.add("run-audit", { auditId: audit.id }, { jobId: audit.id });
  return Response.json({ auditId: audit.id });
}
```

### Pattern 2: Job progress via Postgres as system of record, Redis/BullMQ as transport

**What:** The worker calls `job.updateProgress()` for BullMQ's own bookkeeping (retries, stalled-job detection, dashboards like Bull Board), but ALSO writes progress fields directly to the `audit` row in Postgres (`pages_crawled`, `pages_total`, `current_stage`) at throttled intervals (e.g., every N pages or every 2s). The Next.js progress endpoint reads only from Postgres — never talks to Redis/BullMQ directly.
**When to use:** Whenever the read side (web tier) and write side (worker) are different deployables/processes — decouples them completely; if Redis or the worker restarts, Postgres still has last known progress.
**Trade-offs:** Slightly more writes to Postgres than pure Redis pub/sub, but eliminates a second read-path dependency from the web tier and means the report page and progress page use the exact same data access pattern (query Postgres by `auditId`).

```typescript
// apps/worker/src/progress.ts
export async function reportProgress(auditId: string, done: number, total: number, stage: Stage) {
  await job.updateProgress({ done, total, stage });           // BullMQ bookkeeping
  if (done % 10 === 0 || done === total) {                    // throttle DB writes
    await db.audit.update({ where: { id: auditId }, data: { pagesCrawled: done, pagesTotal: total, stage } });
  }
}
```

### Pattern 3: Progress streaming — poll first, SSE as upgrade, skip WebSockets

**What:** Client polls `GET /api/audits/[id]` every 2–3s for `{ stage, pagesCrawled, pagesTotal, status }` while `status === "running"`, then stops on `completed`/`failed`. An SSE route (`/api/audits/[id]/stream`) can be added later that itself polls Postgres server-side every 1–2s and pushes deltas — cheaper for the client, no bidirectional need, and trivial to run on Vercel (Route Handlers support streaming responses).
**When to use:** Polling is sufficient and simplest for a single free-tier lead magnet with a queue of at most a handful of concurrent audits. SSE is a pure UX upgrade (real-time feel) added once polling works, not a prerequisite. WebSockets are unjustified here — no client-to-server realtime need, and they don't map cleanly onto Vercel's serverless functions (would need a separate always-on socket server, which is the worker container itself — extra complexity for no material benefit over SSE).
**Trade-offs:** Polling has ~2-3s latency and slightly more request volume; negligible at this scale. SSE requires Route Handler `ReadableStream` boilerplate and reconnection handling on the client (`EventSource` auto-reconnects, but state resync on reconnect must be handled).

**Recommendation for build order:** ship polling in the phase that builds the audit flow end-to-end; treat SSE as an optional polish phase, not a blocking dependency.

## Data Flow

### Request Flow (enqueue → crawl → check → score → persist → report)

```
[User submits URL + email]
    ↓
[POST /api/audits] → validate email format, verify double opt-in status,
                      check quota (1/week/email via Postgres), check URL reachability
    ↓
[INSERT audit(status=queued)] + [INSERT/UPSERT email if new → send verification email]
    ↓  (if email already verified) 
[BullMQ: auditQueue.add({auditId})]  → Redis
    ↓
[Worker picks up job] → status=running, stage=discovering
    ↓
[Discovery] fetch /robots.txt → fetch /sitemap.xml (+ sitemap index recursion)
            → fallback: BFS crawl from homepage via <a href> if no sitemap
            → cap at 500 URLs (free tier), dedupe, normalize (trailing slash, query strip)
    ↓  INSERT page rows (status=pending) for each discovered URL
[stage=crawling] for each page (bounded concurrency, e.g. p-limit(5-10)):
    → fetch HTML (Cheerio parse) [+ optional Playwright render if configured]
    → run checks/ (technical-seo, on-page, structured-data, aeo) against parsed DOM
    → UPDATE page row: raw data snapshot + INSERT issue rows
    → reportProgress(auditId, done, total, "crawling")
    ↓
[stage=performance] for sampled/all pages (PSI has its own rate limits — sample
    top N pages by internal-link count / homepage + templates, not literally all 500):
    → call PSI API (mobile + desktop strategy) with Redis cache (key: url+strategy, TTL ~7d)
    → map to Performance category score + CWV fields on page row
    → reportProgress(auditId, done, total, "performance")
    ↓
[stage=scoring]
    → aggregate per-category scores (SEO Técnico, Rendimiento/CWV, On-Page,
      Datos Estructurados, AEO) from issue severities + PSI scores
    → compute overall score (weighted average, weights = product decision)
    → if previous completed audit exists for same site+email → diff.ts:
      compare issue fingerprints (checkId + pageUrl) across runs →
      classify each issue as new / persisting / fixed
    ↓
[stage=done] → UPDATE audit(status=completed, completedAt, overallScore, categoryScores)
    ↓
[Report UI] GET /audits/[id] → Postgres query (audit + pages + issues, joined)
                              → render score cards + issue table + diff badges
```

### Progress/State Machine

```
audit.status: queued → running → completed
                              ↘ failed (crawl error, PSI quota exhausted, target unreachable)
audit.stage (while running): discovering → crawling → performance → scoring → done
```

### Key Data Flows

1. **Enqueue flow:** Next.js writes to Postgres + Redis, never touches crawl logic. Guarantees the web tier stays fast and stateless regarding crawl work.
2. **Progress flow:** Worker → Redis (BullMQ bookkeeping) + Postgres (throttled writes) → Next.js reads only Postgres. Single read path for both "live progress" and "final report" pages simplifies the UI (same query shape, different `status`).
3. **Diffing flow:** Every completed audit's issues get a stable fingerprint (`hash(checkId + normalizedPageUrl)`). A new audit for the same `site` (keyed by root domain, not by email — so re-audits of the same site are comparable even across a different verified email, if that matters) looks up the most recent prior `completed` audit for that site and diffs fingerprint sets.

## Data Model

Minimum viable relational schema (Postgres). Names illustrative — align with chosen ORM conventions in the stack phase.

```
email
├─ id (uuid, pk)
├─ address (citext, unique)
├─ verified_at (timestamptz, nullable)
├─ verification_token (text, nullable)
├─ verification_sent_at (timestamptz)
└─ created_at

site
├─ id (uuid, pk)
├─ root_domain (text, unique)         -- normalizes URL to compare across audits
└─ created_at

audit
├─ id (uuid, pk)
├─ site_id (fk → site)
├─ email_id (fk → email)
├─ requested_url (text)               -- exact URL user submitted
├─ status (enum: queued|running|completed|failed)
├─ stage (enum: discovering|crawling|performance|scoring|done, nullable)
├─ pages_crawled (int, default 0)
├─ pages_total (int, nullable)
├─ overall_score (int, nullable)
├─ category_scores (jsonb, nullable)  -- {technicalSeo: 82, performance: 74, onPage: 90, ...}
├─ previous_audit_id (fk → audit, nullable) -- resolved at scoring time for diffing
├─ error_message (text, nullable)
├─ created_at, started_at, completed_at

page
├─ id (uuid, pk)
├─ audit_id (fk → audit)
├─ url (text)
├─ http_status (int, nullable)
├─ depth (int)                        -- click depth from homepage, for orphan detection
├─ raw_data (jsonb)                   -- title, meta, h1s, canonical, hreflang, schema found, CWV, etc.
├─ status (enum: pending|fetched|error)
└─ fetched_at

issue
├─ id (uuid, pk)
├─ audit_id (fk → audit)
├─ page_id (fk → page, nullable)      -- nullable for site-level issues (e.g. missing sitemap)
├─ check_id (text)                    -- stable identifier, e.g. "missing-meta-description"
├─ category (enum: technical-seo|on-page|structured-data|performance|aeo)
├─ severity (enum: critical|warning|info)
├─ measured_value (text, nullable)
├─ criterion (text)                   -- what "pass" looks like
├─ recommendation (text)
├─ fingerprint (text)                 -- hash(check_id + normalized page url), used for diffing
└─ created_at

quota_usage
├─ id (uuid, pk)
├─ email_id (fk → email)
├─ audit_id (fk → audit)
└─ created_at
-- query: COUNT(*) WHERE email_id = ? AND created_at > now() - interval '7 days' < 1
```

**Notes:**
- `site.root_domain` is the join key for run-to-run diffing — decouples "which site" from "which email requested it," matching the requirement to compare audits over time even if triggered independently.
- `quota_usage` as its own append-only table (rather than counting `audit` rows directly) keeps the rate-limit query simple and index-friendly (`email_id, created_at`), and survives audits being deleted/archived later without breaking quota history.
- `issue.fingerprint` is the single mechanism the diff engine needs — no separate diff table required for MVP; diff is computed at read time (or once at scoring time and cached into `audit.category_scores`-adjacent jsonb) by comparing fingerprint sets between `audit.id` and `audit.previous_audit_id`.
- Store `raw_data` as jsonb on `page` rather than one column per field — the check catalog will grow (SEO/on-page/schema/AEO/CWV fields differ a lot), and jsonb avoids constant migrations as checks are added through the roadmap's phases.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Lead-magnet MVP (dozens of audits/day) | Single worker process, BullMQ concurrency ~5-10 concurrent page fetches per job, one audit job at a time or small concurrency (2-3 audits in parallel). Single small Postgres + single Redis instance is plenty. |
| Growth (hundreds of audits/day) | Increase BullMQ worker concurrency and/or run 2 worker replicas (BullMQ handles multiple workers on the same queue natively — no code change). Add PSI response caching aggressively (URLs get re-audited weekly per quota rule, so cache hit rate is naturally high). |
| Scale-up (thousands/day, monetized v2) | Split "crawl+check" workers from "performance/PSI" workers into separate BullMQ queues so a PSI rate-limit backoff doesn't stall page-checking throughput. Consider read replica for Postgres if report pages get heavy traffic. |

### Scaling Priorities

1. **First bottleneck: Google PSI API rate limits**, not compute. PSI's free tier has per-key request quotas; running Lighthouse against 500 URLs per audit will hit them fast. Mitigate from day one by (a) sampling pages for performance checks (homepage + representative templates, not literally all 500 pages) and (b) caching PSI responses by URL+strategy for several days, since the free-tier quota rule (1 audit/week/email) means the same site is unlikely to need fresh PSI data more than weekly anyway.
2. **Second bottleneck: target-site fetch concurrency/politeness.** Crawling someone else's site fast can trip their rate limiting or look like abuse. Bound concurrency per audit (not just globally) and respect `robots.txt` crawl-delay if present, add a default per-host concurrency cap (e.g., 5) independent of overall worker concurrency.

## Anti-Patterns

### Anti-Pattern 1: Running Lighthouse/Chrome directly inside the Next.js deployment

**What people do:** Try to invoke `lighthouse`/`puppeteer` from a Vercel serverless/edge function to "keep it simple."
**Why it's wrong:** Vercel functions have execution time and package size limits incompatible with headless Chrome + a 500-page crawl; this is exactly the constraint the project already resolved by choosing a separate worker — reintroducing it during implementation (e.g., "just for a quick test") reintroduces timeouts and cold-start bloat.
**Instead:** Keep every Chrome/Playwright/Lighthouse dependency strictly inside `apps/worker`; the web app calls PSI's hosted API (no local Chrome needed) for the default path, and only uses local Lighthouse via the worker if/when PSI is insufficient.

### Anti-Pattern 2: Treating unlighthouse (the CLI tool) as a drop-in library for a custom pipeline

**What people do:** Import `unlighthouse` expecting a simple "give me Lighthouse scores for these URLs" function.
**Why it's wrong:** Unlighthouse is a full CLI/dashboard tool that does its own site crawling, its own server, and its own reporting UI — bolting it into a custom BullMQ pipeline means fighting its opinions about crawling and progress reporting, duplicating the discovery step this project already needs to do itself (for SEO/on-page checks via Cheerio).
**Instead:** Use Google PageSpeed Insights API directly (simple REST call, hosted infra, no local Chrome) as the primary performance-check mechanism, since URL discovery is already owned by this project's own crawler. Reserve unlighthouse (or raw `lighthouse` npm package + puppeteer-core) as an optional/future local-Lighthouse fallback for cases PSI can't reach (e.g., password-protected staging), not as the default path.

### Anti-Pattern 3: WebSockets for progress "because real-time"

**What people do:** Reach for Socket.io/WebSockets by default for any "live updating" feature.
**Why it's wrong:** Adds a stateful, always-connected server requirement that doesn't fit cleanly with Vercel's request/response model, and there's no bidirectional client→server realtime need here — progress is strictly server→client.
**Instead:** Poll or SSE (see Pattern 3 above); both work naturally with Vercel Route Handlers and Postgres as the single source of truth.

### Anti-Pattern 4: Diffing runs by exact issue text instead of a stable fingerprint

**What people do:** Compare human-readable issue descriptions or messages between two audits to determine "fixed" vs "new."
**Why it's wrong:** Any wording tweak to a recommendation string (a near-certain future edit as the product matures) silently breaks all historical diffing, making "did they fix it?" unreliable.
**Instead:** Fingerprint issues by `(check_id, normalized_page_url)` — stable identifiers independent of copy — and compute diffs off that.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google PageSpeed Insights API | REST call per URL+strategy from worker, cached in Redis (TTL days) | Verify current quota per API key at implementation time (Google's documented limits change); design the call path with retry/backoff and graceful degradation (mark performance category as "unavailable" rather than failing the whole audit) — MEDIUM confidence, re-verify against current Google docs in the phase that implements this. |
| Target site (arbitrary user-submitted URL) | Plain HTTP fetch (Cheerio) + optional Playwright render, from worker only | Respect `robots.txt`, set a descriptive `User-Agent` identifying the auditor tool + contact, bound concurrency per host. |
| Email provider (Resend/Postmark/etc.) | Transactional API call from Next.js API route (not worker) at signup + optionally "audit ready" notification triggered by worker via a lightweight webhook/API call back to a Next.js route or direct provider call from worker | Double opt-in token should be single-use, expiring (e.g., 24-48h). |
| Redis (Upstash/managed) | BullMQ transport + cache + rate-limit counters | One Redis instance serves three purposes at this scale; split only if usage patterns start to conflict (e.g., cache evictions affecting queue reliability). |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `apps/web` ↔ `apps/worker` | Async only, via BullMQ (Redis) for commands + Postgres for state reads | No direct HTTP/RPC between the two — keeps them independently deployable/restartable. |
| `pipeline/checks/*` ↔ `pipeline/parse.ts` | Direct function call, in-process | Checks receive a normalized `PageData` object; parse.ts owns all Cheerio/DOM logic so check modules stay DOM-library-agnostic (easier to test, easier to swap parser later). |
| `pipeline/performance.ts` ↔ rest of pipeline | Runs as a distinct stage after crawling, keyed by page URL | Decoupled so PSI rate-limit failures don't block or fail the SEO/on-page portion of the audit — partial results (score minus performance category, flagged "unavailable") are preferable to failing the whole audit. |
| `packages/checks-catalog` ↔ `apps/worker` | Imported as a library | Enables adding new checks without touching queue/orchestration code — new check = new file in the catalog + registration, not a pipeline change. |

## Suggested Build Order (dependency-driven)

1. **Data model + shared packages** (`packages/db`, `packages/shared-types`) — everything else depends on schema existing.
2. **Queue plumbing end-to-end with a no-op job** — Next.js enqueues, worker dequeues and marks `completed` after a fake delay. Proves the Vercel↔Redis↔worker↔Postgres wiring before any crawl logic exists. Ship polling-based progress here (Pattern 3) since it's simplest.
3. **URL discovery + fetch + Cheerio parse** (no checks yet) — worker crawls up to 500 URLs, persists `page` rows with raw HTML/data. This is the highest-risk piece (target-site variability, robots.txt, redirects, timeouts) — build and harden before layering checks on top.
4. **Check engine (`checks-catalog`) — technical SEO + on-page first** (highest-value, no external API dependency) — validates the checks/scoring architecture against real crawled data before adding Lighthouse/PSI complexity.
5. **Structured data + AEO checks** — same pattern as step 4, additive.
6. **Performance integration (PSI API + caching)** — deliberately last among check categories since it's the only external-API dependency with rate limits/cost; by this point the rest of the pipeline is stable and this becomes an isolated, independently-failing stage (per Anti-Pattern reasoning above).
7. **Scoring + report UI** — once all check categories produce `issue` rows, aggregate scores and build the report page.
8. **Email double opt-in + quota enforcement** — can be built in parallel with steps 3-7 (it only touches `email`/`quota_usage` tables and the enqueue endpoint), but gate the enqueue endpoint with it before any public launch.
9. **Run-to-run diffing** — requires at least two completed audits to test meaningfully; naturally last, and low-risk to bolt on since it only reads existing `issue.fingerprint` data.
10. **SSE upgrade for progress (optional polish)** — swap/augment the polling endpoint once the core flow is proven; not a blocker for launch.

## Sources

- [BullMQ official docs — Workers, job progress, QueueEvents](https://docs.bullmq.io/guide/workers) — HIGH confidence, official docs.
- [BullMQ homepage](https://bullmq.io/) — HIGH confidence.
- [Server-Sent Events in Node.js — monolith to distributed systems](https://www.chanalston.com/blog/nodejs-sse-monolith-to-distributed-system/) — MEDIUM confidence, community source, pattern cross-checked against BullMQ docs.
- [Unlighthouse — API Reference](https://unlighthouse.dev/api-doc) — MEDIUM confidence (used to confirm unlighthouse's architecture is CLI/crawl-first, informing the anti-pattern recommendation to use PSI API directly instead).
- [Unlighthouse — PageSpeed Insights API Guide](https://unlighthouse.dev/learn-lighthouse/pagespeed-insights-api) — MEDIUM confidence.
- [Unlighthouse — Bulk Lighthouse Testing for Large Sites](https://unlighthouse.dev/guide/recipes/large-sites) — MEDIUM confidence, informs the "sample pages for performance, don't run PSI on all 500" recommendation.
- Google PageSpeed Insights API quota specifics — NOT independently re-verified in this research pass; flagged LOW confidence, verify current documented limits at implementation time (Phase covering performance checks).

---
*Architecture research for: automated web-audit crawler SaaS (lead magnet)*
*Researched: 2026-07-05*
