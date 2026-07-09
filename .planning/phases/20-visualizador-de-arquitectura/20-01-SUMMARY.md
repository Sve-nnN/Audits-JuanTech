---
phase: 20-visualizador-de-arquitectura
plan: 01
subsystem: data-model + crawler
tags: [prisma, crawler, cheerio, arch-02]
requires:
  - "@auditor/db Page model"
  - "@auditor/crawler CheerioCrawler requestHandler"
provides:
  - "Page.title String? column (queryable page title)"
  - "crawler persists HTML <title> on every crawled page"
affects:
  - "Plan 02 (report-model) can read Page.title without re-parsing HTML"
  - "Plan 03 (SVG tree) can render URL/title per node (ARCH-02)"
tech-stack:
  added: []
  patterns:
    - "Nullable additive schema column via schema-first prisma generate (no migrations folder)"
    - "Single-parse title extraction from already-loaded Cheerio $ (ARCH-03 respected)"
key-files:
  created: []
  modified:
    - packages/db/prisma/schema.prisma
    - packages/crawler/src/crawl.ts
decisions:
  - "Option A (Juan): add a real nullable Page.title column instead of degrading ARCH-02"
  - "Title extracted once in crawl where Cheerio $ is already loaded — no report-time re-parse"
metrics:
  duration: ~3m
  completed: 2026-07-09
---

# Phase 20 Plan 01: Page.title Data Foundation Summary

Added a nullable `Page.title` column and wired the crawler to persist the HTML `<title>` on every page, unblocking ARCH-02 (each architecture node shows URL/título) without report-time HTML re-parsing.

## What Was Built

- **Schema (`packages/db/prisma/schema.prisma`):** Added `title String?` to the `Page` model between `url` and `statusCode`. Nullable + additive — existing rows and pre-change audits keep `title = null`, no data migration. Prisma client regenerated (v6.19.3), no migrations folder created (schema-first convention preserved).
- **Crawler (`packages/crawler/src/crawl.ts`):** In `requestHandler`, extract the title once from the already-loaded Cheerio `$`: `const title = $("title").first().text().trim() || null;`. Written to `Page.title` on BOTH the `create` and `update` branches of the existing `prisma.page.upsert`, so re-crawled pages refresh their title. Empty/missing `<title>` stores NULL.

## Verification

- `pnpm --filter @auditor/db db:generate` — exit 0 (client regenerated with Page.title).
- `pnpm --filter @auditor/db typecheck` — exit 0.
- `pnpm --filter @auditor/crawler typecheck` — exit 0 (proves Page.title is a real column on the generated client, not phantom).
- `grep -c 'title,' packages/crawler/src/crawl.ts` = 2 (create + update branches).
- `test ! -d packages/db/prisma/migrations` — passed (no spurious migrations folder).

## Deviations from Plan

None - plan executed exactly as written.

## Tasks & Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Add title String? to Page model + regenerate client | 74fc14d |
| 2 | Persist HTML <title> during crawl (both upsert branches) | 5fdd30d |

## Threat Notes

Per plan threat model (T-20-05): the `<title>` originates from an audited third-party site and is stored verbatim as plain text via Prisma's parameterized write (no SQL injection). Downstream consumers (Plan 03 SVG) must render it as an escaped React text child, never `dangerouslySetInnerHTML`, and truncate for display. No new threat surface beyond what the plan registered.

## Self-Check: PASSED
- packages/db/prisma/schema.prisma — title column present, typecheck green.
- packages/crawler/src/crawl.ts — $("title") extraction + both upsert branches, typecheck green.
- Commit 74fc14d — FOUND.
- Commit 5fdd30d — FOUND.
