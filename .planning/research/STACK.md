# Stack Research — v1.2 (render detection + report exports)

**Domain:** SEO/technical web-audit tool (lead magnet) — additive milestone on a shipped app
**Researched:** 2026-07-06
**Confidence:** HIGH (versions verified live via `npm view` 2026-07-06; integration verified against actual repo code)

## Scope of this research

ONLY the net-new capabilities for v1.2. Everything from v1.0/v1.1 (Crawlee crawl, checks, PSI, scoring, email, quota, design system) is validated and out of scope. Two axes of new stack:

1. **Worker side** — add a selective Playwright render pass for CSR-vs-SSR detection (canonical/heading checks are pure logic on already-stored data, NO new deps).
2. **Web side** — three export generators (PDF, PPTX, Markdown) inside an on-demand Next.js Node API route, reading from Postgres. NO Chromium on the web side.

**Key repo facts that constrain the choices (verified in code):**
- Raw HTML is *already persisted*: `Page.html String? @db.Text` (schema.prisma:101), written by the CheerioCrawler pass (crawl.ts:122). CSR/SSR detection only needs the *rendered* side — the raw side is free.
- Sampling is already solved: `selectSample(pages, max)` in `packages/psi/src/sample.ts` (homepage-first + depth-spread, dedup, capped). Reuse it verbatim for the render sample — do NOT write a second sampler.
- Report data all lives in Postgres: `Audit.scores`, `Audit.stats`, `Issue` rows, `PerfMetric` rows. Exports are pure read → serialize. No new tables, no blob storage.
- Worker is a long-lived container (concurrency 2) — Chromium is fine there. Web is Vercel serverless — Chromium is NOT fine there.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **playwright** | 1.61.1 | Render the CSR/SSR sample in the worker (headless Chromium) | Already the planned ENRICH engine; pin to **exactly** 1.61.1 to match the Docker base image `mcr.microsoft.com/playwright:v1.61.1-noble` (browser binaries are tied 1:1 to the npm version — a drift causes "executable doesn't exist" at runtime). Use the **raw `playwright` API** (`chromium.launch()` + one `BrowserContext`/page per sampled URL), **not** Crawlee's `PlaywrightCrawler` — see rationale below. HIGH. |
| **@react-pdf/renderer** | 4.5.1 | Branded PDF export, generated in the Next.js Node API route | Pure-JS (no Chromium, no native binaries) → safe inside a Vercel serverless function, tiny cold start, well under the 250 MB unzipped bundle cap. React/JSX component model with flexbox layout + `Font.register` fits a branded, data-dense report (score gauge, category cards, issues table) far better than low-level PDF drawing. Renders straight to a Node stream/`Buffer` you return as the download `Response`. HIGH. |
| **pptxgenjs** | 4.0.1 | PPTX (presentation) export in the same API route | The de-facto standard, actively maintained, **pure JS with zero native deps** (Vercel-safe). Produces `.pptx` as a Node `Buffer`/base64 in-process. Full feature set needed for a slide report: text, tables, images, and native charts (bar/pie/line) for the category scores. HIGH. |
| **Markdown export** | — (hand-rolled) | LLM-optimized `.md` export | This is a serialization concern, not a library concern. Build the string directly from the DB rows (scores → headings, issues grouped by category/severity → sections with checkId, measuredValue, criterion, recommendation). A generic HTML→MD converter is the wrong tool — the source is structured data, not HTML. HIGH. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **p-limit** (or reuse the worker's existing lane pattern) | 7.x (optional) | Cap render concurrency in the CSR/SSR pass | The render sample is only ~5 pages; the existing manual "lane" concurrency pattern in `apps/worker/src/index.ts` (see `runPerfSample`) already does this without a dep. Add `p-limit` only if you prefer it over hand-rolled lanes. Keep render concurrency at 1–2 (Chromium is memory-heavy). |
| **turndown** | 7.2.4 | HTML→Markdown | **Probably NOT needed.** Listed only to explicitly reject it: the Markdown export is built from structured DB data, not by converting HTML. Include only if a future feature must serialize a raw HTML fragment to MD. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Docker base image `mcr.microsoft.com/playwright:v1.61.1-noble` | Worker container base with Chromium + system deps preinstalled | Pin the tag to the exact `playwright` npm version. Chromium defaults to a 64 MB `/dev/shm` and crashes under load → run with `--ipc=host` (or mount larger `/dev/shm`), and pass `--disable-dev-shm-usage` as a launch arg fallback when you can't control host shm (Railway/Fly). Budget ~1–2 GB RAM headroom for the render pass on top of the crawl. |
| Brand font files (Array / Khand / Geist) bundled in `apps/web` | `Font.register()` sources for @react-pdf so exported PDFs match the on-screen brand | Ship the `.ttf`/`.otf` in the app (the fonts already exist for v1.1). @react-pdf needs a file/URL it can load at render time inside the function. |

---

## Installation

```bash
# Worker (apps/worker) — render pass
pnpm --filter @auditor/worker add playwright@1.61.1
# (browsers come from the Docker base image; no `playwright install` needed in prod)

# Web (apps/web) — export generators (pure JS, Vercel-safe)
pnpm --filter @auditor/web add @react-pdf/renderer@4.5.1 pptxgenjs@4.0.1

# Optional
pnpm --filter @auditor/worker add p-limit@7      # only if not reusing the lane pattern
```

No new packages for canonical checks, heading checks, or Markdown export.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Raw `playwright` for the render sample | Crawlee `PlaywrightCrawler` (`@crawlee/playwright` 3.17.0) | Only if the render pass grows into a *second crawl* (link-discovery, dedup, retries, autoscaling over many URLs). For a **fixed 3–5 URL sample coming out of `selectSample`**, PlaywrightCrawler's request queue / autoscaled pool is pure overhead — one browser + a context per URL is simpler, lighter, and easier to reason about. Crawlee stays the engine for the *actual* 500-URL crawl (CheerioCrawler); it does not need to also own the tiny render sample. |
| @react-pdf/renderer (PDF) | **Playwright/Chromium HTML→PDF** | Only on the **worker** side, never on Vercel. If you ever need pixel-perfect HTML/CSS fidelity to the live report page, render it in the worker container (which already has Chromium) and store the PDF — but that contradicts the user's "on-demand in the web route, not pre-generated" decision, so it stays a non-goal here. |
| @react-pdf/renderer (PDF) | **pdfmake** 0.3.11 | If the report becomes dominated by very large, complex auto-paginating tables and you prefer a declarative document-definition JSON over JSX components. pdfmake's table engine is strong; @react-pdf wins on brand fonts + custom component layout (gauges, cards). |
| @react-pdf/renderer (PDF) | **pdf-lib** 1.17.1 | Only for low-level PDF manipulation (stamping, merging, editing an existing PDF). Building a full multi-page report by manually positioning text/rects is far too tedious for this use case. |
| @react-pdf/renderer (PDF) | **jsPDF** 4.2.1 | Client-side/browser PDF generation. Weaker server-side layout story and manual positioning; no advantage over @react-pdf for a server route. |
| Hand-rolled Markdown | Any HTML→MD lib (turndown) | Only if serializing a raw HTML blob. The export source here is structured DB data. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Chromium/Playwright/Puppeteer inside the Vercel export route** | Bundling `@sparticuz/chromium` (~50 MB+) + `puppeteer-core` blows up cold start and eats into the 250 MB unzipped function cap for zero benefit when a pure-JS lib produces the same download. The web function only reads DB + serializes. | @react-pdf/renderer + pptxgenjs (pure JS) |
| **Pre-generating / storing export files** | User decision: exports are on-demand (click → generate → stream download). Adds storage, invalidation, and staleness problems for no gain. | Generate in-request from the DB, return as a streamed/`Buffer` `Response` with `Content-Disposition: attachment`. |
| **`PlaywrightCrawler` for the render sample** | Request-queue/dedup/autoscaling machinery is unnecessary for a fixed <=5 URL list already produced by `selectSample`. | Raw `playwright` `chromium.launch()` + one context/page per URL, concurrency 1–2. |
| **Un-pinned Playwright / mismatched Docker tag** | `playwright` npm version and the browser binaries in `mcr.microsoft.com/playwright:*` must match exactly or Chromium won't launch after a redeploy. | Pin both to `1.61.1` / `v1.61.1-noble`; bump them together. |
| **Running Playwright over all 500 crawled URLs** | 5–10× the CPU/memory of the Cheerio pass; turns a free lead-magnet audit into a huge compute bill and a slow report. | Render only `selectSample(pages, N)` (reuse the PSI sampler); compare rendered DOM vs the already-stored `Page.html`. |
| **A second sampler for the render pass** | Duplicates logic and risks divergence from the PSI sample. | Reuse `selectSample` from `@auditor/psi` (or lift it to a shared util if you don't want the psi dep in the render step). |
| **New DB columns/tables for exports** | Exports are ephemeral reads. | Read existing `Audit.scores` / `Audit.stats` / `Issue` / `PerfMetric`. (A render-detection *check* will emit `Issue` rows through the existing pipeline — no schema change; optionally a boolean/summary on the page, but not required for exports.) |

---

## Stack Patterns by Variant

**CSR/SSR render pass (worker):**
- Slot it as a new step in `crawlAndCheck()` after the crawl, alongside the PSI sample (both consume `pages` and both use `selectSample`). Consider running render-detection and PSI over the *same* sample to launch Chromium once.
- Compare rendered DOM against the stored `Page.html` (raw). Signal for CSR: rendered visible text / DOM node count materially exceeds the raw-HTML equivalent (e.g. raw `<body>` text length far below rendered `document.body.innerText`). Emit a normal `Issue` (new check id in `@auditor/checks`) so it flows through scoring/diff/reporting unchanged.
- Launch args: `--disable-dev-shm-usage`; container run with `--ipc=host`. Reuse a single `Browser`, new `BrowserContext` per page, `context.close()` between pages to bound memory.
- Keep it best-effort like the PSI pass: a render failure degrades that page's detection to "unknown", never fails the audit (mirror the try/catch around `runPerfSample`).

**Export route (web):**
- One Node-runtime API route (`export const runtime = "nodejs"`), query param or path segment selects `pdf | md | pptx`. Fetch the audit + issues + perf metrics once, branch to the matching generator, return the `Buffer`/stream with `Content-Disposition: attachment; filename="..."`.
- @react-pdf: build a `<Document>` component tree, `renderToBuffer(doc)` → `Response`. Register brand fonts from bundled files.
- pptxgenjs: `new pptxgen()`, add slides, `pptx.write({ outputType: "nodebuffer" })` → `Response`.
- Markdown: template-string builder from the same fetched data; set `Content-Type: text/markdown`.
- Generation is fast (seconds); default Vercel function duration is sufficient — no `maxDuration` bump expected, but set it explicitly if a very large issues table pushes render time.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `playwright@1.61.1` | `mcr.microsoft.com/playwright:v1.61.1-noble` | Must match exactly (browser binary ↔ npm version). |
| `playwright@1.61.1` | `crawlee@3.17.0` (CheerioCrawler, existing) | Coexist fine — Crawlee does the HTTP crawl, raw Playwright does the render sample independently. No `@crawlee/playwright` needed unless you switch to PlaywrightCrawler. |
| `@react-pdf/renderer@4.5.1` | `react@19` / `next@15` (web) | v4 supports React 19. Runs in the Node runtime, not edge. Pure JS — no bundler/native-binary issues on Vercel. |
| `pptxgenjs@4.0.1` | Node 20+ | Pure JS, `outputType: "nodebuffer"` for server use. No native deps. |
| Web function bundle | Vercel 250 MB unzipped cap | @react-pdf + pptxgenjs + fonts are a few MB total — comfortably within cap (the whole point of avoiding Chromium here). |

---

## Sources

- `npm view <pkg> version` (live, 2026-07-06): playwright 1.61.1, crawlee/@crawlee/playwright 3.17.0, @react-pdf/renderer 4.5.1, pptxgenjs 4.0.1, pdfmake 0.3.11, pdf-lib 1.17.1, jspdf 4.2.1, turndown 7.2.4, @sparticuz/chromium 149.0.0 — HIGH (registry)
- Repo code: `packages/db/prisma/schema.prisma` (Page.html, Issue, PerfMetric), `packages/psi/src/sample.ts` (selectSample), `apps/worker/src/index.ts` (runPerfSample pattern, best-effort/lane concurrency), `packages/crawler/src/crawl.ts` (raw HTML persisted) — HIGH (direct read)
- Root `CLAUDE.md` stack table — Playwright Docker pinning + shm pitfalls, Vercel-vs-worker split — HIGH (project-authored, carried forward)
- Playwright Docker docs (image tagging/version pinning), pptxgenjs / @react-pdf/renderer project docs — HIGH (official)

---
*Stack research for: v1.2 render detection + report exports (additive milestone)*
*Researched: 2026-07-06*
</content>
