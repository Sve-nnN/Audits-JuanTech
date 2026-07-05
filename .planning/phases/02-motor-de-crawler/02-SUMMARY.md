---
phase: 2
plan: 1
subsystem: crawler
tags: [crawlee, cheerio, robots-txt, sitemap, bullmq-worker, prisma]
dependency graph:
  requires: [phase-1-monorepo, phase-1-prisma-neon, phase-1-bullmq-worker]
  provides: [crawl-engine, page-persistence, audit-progress]
  affects: [apps/worker, apps/web, packages/db-schema]
tech-stack:
  added: ["@crawlee/cheerio@3.17.0", "crawlee@3.17.0", "cheerio@1.2.0", "robots-parser@3.0.1", "vitest@4.1.9"]
  patterns: ["sitemap-first discovery with link-crawl fallback", "per-origin robots.txt cache", "ephemeral in-memory Crawlee storage", "throttled progress writes to Audit.stats"]
key-files:
  created:
    - packages/crawler/src/normalizeUrl.ts
    - packages/crawler/src/robots.ts
    - packages/crawler/src/sitemap.ts
    - packages/crawler/src/crawl.ts
    - packages/crawler/src/index.ts
    - packages/crawler/src/normalizeUrl.test.ts
    - packages/crawler/src/sitemap.test.ts
    - packages/crawler/package.json
    - packages/crawler/tsconfig.json
  modified:
    - packages/db/prisma/schema.prisma
    - apps/worker/src/index.ts
    - apps/worker/package.json
    - apps/web/app/api/audits/route.ts
    - apps/web/app/api/audits/[id]/route.ts
    - apps/web/app/page.tsx
    - package.json
    - turbo.json
    - .gitignore
decisions:
  - "robots.txt fetch failure semantics: 404 -> allow-all; other 4xx -> allow-all (RFC 9309 convention); 5xx or network error/timeout -> disallow-all (fail-closed, conservative)"
  - "Sitemap parsing uses a lenient regex-based <loc> extractor instead of a strict XML parser, so malformed/truncated sitemap XML still yields whatever tags parse cleanly"
  - "Crawlee storage configured with persistStorage: false (fully in-memory) instead of a per-run temp CRAWLEE_STORAGE_DIR — simpler and safer for concurrent audits within one worker process, nothing ever touches disk"
  - "Link-crawl fallback extracts <a href> manually via Cheerio and filters through our own async isAllowed()/sameRegistrableDomain(), rather than Crawlee's enqueueLinks (its transformRequestFunction is synchronous, incompatible with our async robots check)"
  - "POST /api/audits now accepts { url } (full URL or bare domain) with backwards-compatible { domain } fallback, plus optional urlLimit (capped at 500)"
metrics:
  duration: "~90 min"
  completed: 2026-07-05
---

# Phase 2 Plan 1: Motor de crawler Summary

Bounded, polite web crawler (Crawlee CheerioCrawler) with sitemap-first discovery, robots.txt enforcement, and BullMQ worker integration — replaces the Phase 1 no-op job processor with a real crawl pipeline capped at 500 URLs.

## What was built

### 1. `Page` model expansion (`packages/db/prisma/schema.prisma`)

Added nullable columns: `html String? @db.Text`, `finalUrl String?`, `redirectChain Json?`, `contentType String?`, `depth Int?`, `fromSitemap Boolean @default(false)`, `fetchedAt DateTime?`, `error String?`. Pushed to Neon via `prisma db push` and regenerated the client — verified live against the real `DATABASE_URL`.

### 2. `packages/crawler` (`@auditor/crawler`)

- **`normalizeUrl.ts`** — `normalizeUrl(url, base?)`: lowercases protocol/host, strips fragment, drops known tracking params (`utm_*`, `gclid`, `fbclid`, etc.) and sorts remaining query keys, strips default ports, normalizes trailing slash (none except root). `sameRegistrableDomain(a, b)` / `registrableDomain(host)`: pragmatic last-two-labels heuristic (not a full Public Suffix List) — documented limitation, acceptable for MVP internal-link following.
- **`robots.ts`** — `isAllowed(url, userAgent)` with a per-origin cache (one fetch per origin per crawl). Semantics: 404 → allow-all; other 4xx → allow-all; 5xx/network error/timeout → disallow-all (fail-closed). `getSitemapsFromRobots(origin)` exposes `Sitemap:` directives for discovery.
- **`sitemap.ts`** — `discoverSitemapUrls(origin)`: seeds from robots.txt `Sitemap:` directives (or `/sitemap.xml` fallback), recurses into nested sitemap indexes (depth-capped at 3, fetch-capped at 50 sitemaps), transparently gunzips `.gz` sitemaps (via `content-encoding`, `.gz` extension, or gzip magic-byte sniffing). `parseSitemapXml` (exported for tests) uses a lenient regex `<loc>` extractor rather than a strict XML parser — malformed/truncated XML still yields whatever parses instead of throwing away the whole document.
- **`crawl.ts`** — `runCrawl({ auditId, startUrl, urlLimit, userAgent?, onProgress? })`:
  - Seeds from sitemap URLs when found; falls back to link-crawling from `startUrl` otherwise (manual `<a href>` extraction + async robots/same-domain filtering, since Crawlee's `enqueueLinks` transform is synchronous and can't call our async `isAllowed`).
  - All seed and discovered URLs are filtered through `isAllowed()` before being enqueued — disallowed URLs are never fetched.
  - `maxConcurrency: 5`, `maxRequestsPerMinute: 120`, `useSessionPool: true`, identifiable `User-Agent` (default `AuditorBot/1.0 (+https://juan-tech.com)`) set via `preNavigationHooks`.
  - `maxRequestsPerCrawl = min(urlLimit, 500)` — hard-capped, never exceeded.
  - Persists a `Page` row per crawled URL (upsert on `[auditId, url]`): status code, `finalUrl`, `redirectChain` (from `response.redirectUrls`), `contentType`, raw `html`, `depth`, `fromSitemap`.
  - `requestHandlerTimeoutSecs: 30`, `maxRequestRetries: 2` — a failing/hanging URL is retried then recorded via `failedRequestHandler` with `Page.error` set; the crawl continues.
  - `onProgress({ discovered, crawled, total })` throttled to at most once per 2s (plus forced calls at start/end).
  - Crawlee storage configured `persistStorage: false` (fully in-memory `Configuration` instance per call) — concurrent `runCrawl()` calls never collide and nothing is written to disk/repo.
- **`index.ts`** — barrel export of all public functions/types.

### 3. Worker integration (`apps/worker/src/index.ts`)

`processAuditJob` now: loads the `Audit` + its `Site`, builds `startUrl = https://${site.domain}`, calls `runCrawl({ auditId, startUrl, urlLimit: audit.urlLimit, onProgress })`. `onProgress` writes throttled updates to `Audit.stats` (JSON `{discovered, crawled, total}`). On completion, marks `done` with final stats (including `failed` count). `simulateFailure` test hook preserved (still throws before the crawl starts). `JOB_TIMEOUT_MS` raised from 15s to 10 minutes to accommodate a real bounded crawl, while BullMQ's `stalledInterval`/`maxStalledCount` (unchanged from Phase 1) still catch a genuinely dead worker.

### 4. Web (`apps/web`)

- `POST /api/audits`: accepts `{ url }` (full URL or bare domain — parsed via `new URL()` after prepending `https://` if no protocol), keeps `{ domain }` as a backwards-compatible alias. Optional `urlLimit` in the body (validated as a positive number, capped at 500) for testing with small crawls. Upserts `Site`, creates `Audit` with the resolved `urlLimit`, enqueues.
- `GET /api/audits/[id]`: now also returns `urlLimit`, `stats` (live progress JSON), and `pageCount` (via `_count.pages`).
- `app/page.tsx`: form now takes a full URL; polls `/api/audits/[id]` every 2s and displays `crawled/total` progress, discovered/failed counts, and saved page count while `status === "running"`.

### 5. Tests (vitest, offline/fast)

- `normalizeUrl.test.ts` — 8 cases: case normalization, fragment stripping, trailing slash, tracking-param removal + query sort, default port removal, relative resolution, invalid input, non-http(s) protocol rejection. Plus `registrableDomain`/`sameRegistrableDomain` (4 cases).
- `sitemap.test.ts` — 4 cases against inline XML fixtures (no network): `<urlset>` extraction, `<sitemapindex>` detection + nested loc extraction, malformed/truncated XML robustness (returns what parses), empty document.
- `pnpm --filter @auditor/crawler test` → **16/16 passing**.

## Verification performed (no live crawl run by this agent, per instructions)

- `pnpm install` — clean.
- `pnpm --filter @auditor/db exec prisma db push` + `prisma generate` — succeeded against the real Neon `DATABASE_URL`.
- `pnpm -r typecheck` — all 6 packages pass (db, queue, crawler, web, worker; root has no typecheck script).
- `pnpm -r build` — `apps/web` (`next build`) and `apps/worker` (`tsc`) both succeed.
- `pnpm -r test` — crawler package: 16/16 tests pass.

### Exact command for the orchestrator to run a live bounded verification crawl against juan-tech.com

```bash
# 1. Start the worker (separate terminal, keep running):
pnpm --filter @auditor/worker dev

# 2. Start the web app (separate terminal):
pnpm --filter @auditor/web dev

# 3. Enqueue a bounded audit (urlLimit=30) against juan-tech.com:
curl -X POST http://localhost:3000/api/audits \
  -H "Content-Type: application/json" \
  -d '{"url": "https://juan-tech.com", "urlLimit": 30}'
# -> { "auditId": "..." }

# 4. Poll progress/result:
curl http://localhost:3000/api/audits/<auditId>
# stats.crawled/stats.total should climb toward 30 (or fewer if the site has <30 sitemap URLs);
# fromSitemap should be true for juan-tech.com (it has a sitemap per project context, ~158 URLs).

# 5. Inspect persisted Page rows directly if desired:
pnpm --filter @auditor/db exec prisma studio
```

For the "site without a sitemap → link-crawl fallback" verification case, run the same POST against any small test site known to lack `/sitemap.xml` and confirm `Page.fromSitemap = false` rows appear with increasing `depth`, discovered via `<a href>` link-following from the home page.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking issue] `enqueueLinks`'s `transformRequestFunction` is synchronous, incompatible with async robots.txt checks**
- **Found during:** Task 2 (`crawl.ts`)
- **Issue:** The plan's fallback link-crawl needed to check `isAllowed()` (async, fetches/caches robots.txt) per discovered link before enqueueing, but Crawlee's `EnqueueLinksOptions.transformRequestFunction` type is `(original) => RequestOptions | false | undefined | null` — no `Promise` return allowed.
- **Fix:** Extract `<a href>` links manually via Cheerio inside `requestHandler`, filter them through `normalizeUrl` + `sameRegistrableDomain` + async `isAllowed`, then enqueue the survivors directly via `crawler.addRequests()` (which does support async call sites).
- **Files modified:** `packages/crawler/src/crawl.ts`
- **Commit:** see below (bundled into the crawler package's initial commit — this was resolved during first implementation, not a follow-up fix).

**2. [Rule 3 - blocking issue] `robots-parser`'s bundled `.d.ts` doesn't export its `Robot` interface**
- **Found during:** Task 2 (`robots.ts`)
- **Issue:** `import { type Robot } from "robots-parser"` fails to typecheck — the package's ambient `.d.ts` declares `interface Robot` without `export`.
- **Fix:** Derived the type locally via `type Robot = ReturnType<typeof robotsParser>` instead of importing it.
- **Files modified:** `packages/crawler/src/robots.ts`

**3. [Rule 1 - bug] Redirect chain was modeled on a nonexistent `Request.redirectChain` property**
- **Found during:** Task 2 (`crawl.ts`), while cross-checking Crawlee's actual `Request`/`Response` types
- **Issue:** Crawlee's `Request` object has no `redirectChain` field for `CheerioCrawler`. The actual hop-by-hop redirect history is exposed on the HTTP response object as `response.redirectUrls: URL[]` (from `got`, Crawlee's underlying HTTP client).
- **Fix:** Read `redirectChain` from `response.redirectUrls` (mapped to strings) instead.
- **Files modified:** `packages/crawler/src/crawl.ts`

**4. Root `package.json` accidentally gained crawler dependencies via a `pnpm add -w --filter` command**
- **Found during:** Task 2, right after installing crawler deps
- **Issue:** Running `pnpm add -w --filter @auditor/crawler ...` added the packages to *both* the root workspace `package.json` and `packages/crawler/package.json` (the `-w` and `--filter` flags conflicted). This left stray, unused dependencies at the monorepo root.
- **Fix:** Removed the stray `dependencies` block from the root `package.json` (kept in `packages/crawler/package.json` only, where they belong), then re-ran `pnpm install` to reconcile the lockfile.
- **Files modified:** `package.json`, `pnpm-lock.yaml`

No other deviations — the rest of the plan (schema, worker wiring, API routes, UI, tests) was implemented as specified.

## Known Stubs

None. All fields captured by the crawler (status, redirects, content-type, html, depth, fromSitemap, error) are wired to real Crawlee/robots/sitemap output — no hardcoded/placeholder values.

## Threat Flags

None beyond what's already covered by the plan's stated boundary (this phase does not add auth paths or new external-facing endpoints beyond the existing `POST/GET /api/audits`, which already existed in Phase 1 — only their request/response shapes changed). Worth flagging for a later phase: `POST /api/audits` triggers the worker to fetch an arbitrary user-submitted domain (SSRF-adjacent surface, already called out in `PITFALLS.md` Security Mistakes — no additional mitigation was added in this phase beyond robots.txt compliance and rate limiting; explicit SSRF IP-range validation is deferred, matching the plan's scope which only covers discovery/fetch/parse/persistence, not hardening).

## Self-Check: PASSED

All files listed under `key-files.created` verified present on disk. `pnpm -r typecheck` and `pnpm -r build` re-confirmed green after final edits (root `package.json` cleanup). No missing items.
