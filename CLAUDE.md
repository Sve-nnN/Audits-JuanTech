<!-- GSD:project-start source:PROJECT.md -->

## Project

**Auditor Web (SEO/Técnico) — Lead Magnet para juan-tech.com**

Herramienta de auditoría web tipo "Screaming Frog pero más completo y automatizado". Un crawler entra a todas las páginas de un sitio (a partir del sitemap), las rastrea y detecta todo tipo de errores: SEO técnico, contenido, on-page, datos estructurados, rendimiento/Core Web Vitals (vía Lighthouse/unlighthouse) y visibilidad en IA (AEO). El resultado es un reporte con score general, scores por categoría e issues priorizados por severidad. Sirve como lead magnet para atraer clientes a juan-tech.com: las personas dejan su email, lo verifican, y ganan acceso a auditar una web.

**Core Value:** Que cualquier persona ingrese una URL y reciba una auditoría completa, precisa y accionable de su web (con errores reales priorizados por severidad), a cambio de su email verificado. Si todo lo demás falla, el crawler + reporte de auditoría debe funcionar y ser confiable.

### Constraints

- **Tech stack**: Frontend Next.js (App Router) desplegado en Vercel; el crawl corre en un worker de fondo con cola (BullMQ/Redis o equivalente) en un contenedor propio (Railway/Fly/VPS) — Decidido por el usuario. Razón: crawl + Lighthouse sobre 500 URLs excede los límites de duración/CPU de funciones serverless cortas.
- **Performance**: Una auditoría gratuita rastrea hasta 500 URLs; debe completar sin timeouts y reportar progreso.
- **Cuota**: 1 auditoría/semana/email en free tier — requiere rate limiting persistente por email.
- **Verificación**: acceso a auditar sólo tras verificar el email (double opt-in) para evitar abuso.
- **Datos**: almacenar email, website auditado, stats, historial de auditorías y estado de corrección de errores.
- **APIs externas**: Google PageSpeed Insights API (rate limits/clave); considerar caché.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Crawlee** (`crawlee`, `@crawlee/cheerio`, `@crawlee/playwright`) | 3.17.x | Crawler orchestration engine | Purpose-built for exactly this problem: request queue with dedup, concurrency/autoscaling, retry/backoff, session pools, and a shared interface across a plain-HTTP crawler (Cheerio) and a browser crawler (Playwright). Building this by hand (custom fetch + Cheerio) means re-implementing queueing, retries, politeness/rate-limiting and dedup that Crawlee already solved — not worth it for a 500-URL/site tool that needs to be reliable. HIGH confidence: official Apify project, actively maintained, this exact "mix HTTP and browser crawling under one interface" is its flagship use case. |
| **Cheerio** (bundled via `@crawlee/cheerio` or standalone `cheerio`) | 1.2.x | Fast HTML parsing (server-rendered HTML) | Default parser for every page. jQuery-like API, extremely fast, low memory (500+ pages/min on 1 CPU / 4GB RAM per Crawlee's own benchmarks). Use this for the first pass on every URL: status code, headers, canonical, meta tags, JSON-LD, internal links, robots directives. This matches what the reference report already uses (per PROJECT.md). |
| **Playwright** | 1.61.x | JS-rendered DOM capture + Lighthouse/CWV pages | Use selectively, not for every URL. Two triggers: (1) pages the sitemap says exist but where the raw-HTML pass shows suspiciously thin/empty content (likely CSR/SPA) — render and re-diff vs raw HTML; (2) the pages selected for the Lighthouse/CWV sample. Don't run Playwright over all 500 URLs — it's 5-10x the memory/CPU cost of Cheerio for HTML extraction alone. |
| **Next.js (App Router)** | 16.x | Frontend + thin API layer | Already decided by user. Runs on Vercel. Its role here is limited to: marketing pages, email capture form, audit report UI, and a small set of API routes/Server Actions that (a) enqueue jobs and (b) read audit results from Postgres. It never runs the crawl itself. |
| **BullMQ** + **Redis** (`bullmq` 5.x, `ioredis` 5.x) | bullmq 5.79.x | Job queue between frontend and worker | Industry-standard Node queue on Redis: atomic Lua-script-based job state machine, retries with backoff, rate limiting, job progress events, delayed jobs (for the "1 per week per email" cooldown), and flow/parent-child jobs (useful for "1 job per URL batch" fan-out under one audit). Vercel's own docs and community guidance converge on the same pattern: enqueue from a Next.js route, process in a persistent worker process outside Vercel — Vercel functions cannot host a long-lived BullMQ `Worker` (no persistent process, no arbitrary outbound long connections in Fluid Compute the same way, and job runtime would exceed serverless timeouts anyway). |
| **PostgreSQL** | 16/17 | Persistence: audits, issues, emails, verification tokens, rate-limit state | Relational data (audits → pages → issues, many-to-many categories/severities) with need for historical comparison queries (diffing two audits) is a textbook relational fit. Managed Postgres (Neon, Supabase, or Railway Postgres) gives you branching/pooling for the serverless Next.js side and a normal connection for the worker. |
| **Prisma** | 7.x | ORM / schema / migrations | Recommend Prisma over Drizzle for this project specifically **despite** the general 2026 ecosystem trend toward Drizzle, because: (1) both frontend (Vercel serverless) and worker (long-lived Node process) share the same schema — Prisma's migration tooling and generated client reduce the two-codebases-one-schema drift risk; (2) the data model has real relations (audits, runs, pages, issues, categories, emails) where Prisma's relation queries and cascading migrations pay off; (3) Prisma 7 removed the old binary-engine cold-start penalty that used to be the main argument against it in serverless — the historical objection is largely gone. If Juan prefers less abstraction and thinner bundles, Drizzle is a fully legitimate MEDIUM-confidence alternative (see Alternatives). |
| **Railway** (container hosting for worker) | — | Hosts the BullMQ worker + Playwright/Lighthouse container | Railway has first-class "background worker" service type (no HTTP port needed), a documented Playwright-in-Docker guide, usage-based billing that fits a bursty lead-magnet workload (idle most of the time, spikes during a crawl), and one-click Redis + Postgres add-ons in the same project. Fly.io is a reasonable alternative if Juan wants global edge placement or finer VM control; Render is more predictable/flat-priced but pricier for this bursty pattern and less battle-tested for Playwright specifically. Recommendation: Railway for MVP, revisit if the free-tier cost profile (many short bursts) makes Fly.io's per-second billing cheaper at scale. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fast-xml-parser` | 5.9.x | Parse sitemap.xml / sitemap indexes | Sitemap discovery step: fetch `sitemap.xml`, parse `<urlset>`/`<sitemapindex>`, recurse into nested sitemaps. Faster and lighter than `xml2js`. |
| `robots-parser` | 3.0.x | Parse and evaluate `robots.txt` | Needed both for crawl politeness (respect `Disallow`) and as a scored SEO check itself (robots.txt present/valid, sitemap referenced in robots.txt). Also reuse its group-matching logic to evaluate AI-crawler directives (GPTBot, Google-Extended, CCBot, etc.) for the AEO category. |
| `unlighthouse` | latest (core, `@unlighthouse/core`) | Multi-page Lighthouse orchestration | Runs Lighthouse across the crawled URL set with a browser pool, giving lab CWV data (Performance score, LCP, CLS, INP, TTFB) without you hand-rolling Lighthouse-over-Playwright orchestration. Run it as a step inside the worker container (it embeds Puppeteer/Chrome under the hood — expect the same memory profile as Playwright: budget ~1-2GB and cap concurrency). For 500 URLs, sample rather than run Lighthouse on every page (see Pitfalls research) — Unlighthouse supports route grouping/pattern sampling for this. |
| PageSpeed Insights API (`fetch` wrapper, no dedicated SDK needed) | v5 REST API | Field data (CrUX) + a second Lighthouse source | Free quota is 25,000 queries/day, 400 queries/100 seconds (per Google's published limits) — comfortably enough for occasional mobile+desktop checks on a sampled subset of URLs, not for 500 URLs × 2 strategies per audit. Use it for the audited site's home/representative pages to pull real CrUX field data (which Unlighthouse/local Lighthouse cannot provide, since that's lab-only). Cache results per (URL, strategy) with a TTL (e.g. 7 days) to respect quota and the weekly free-tier cadence. |
| `p-queue` or Crawlee's built-in `autoscaledPool` | p-queue 9.x | Local concurrency control for the Unlighthouse/PSI sampling step | Crawlee already manages crawl concurrency; you need a *separate* concurrency limiter for the Lighthouse/PSI sampling pass (much lower concurrency than the crawl itself, since each Lighthouse run is CPU/memory heavy). |
| `resend` (Resend SDK) | 6.x | Transactional email: double opt-in verification + audit-ready notification | Official Node SDK, has a documented double opt-in reference implementation (`resend/resend-double-opt-in-example` on GitHub) that matches this exact flow: submit email → send confirmation link → verify → unlock access. Also handles the "audit finished, here's your report" email for long-running crawls. |
| `jsonwebtoken` or Postgres-stored random token | — | Email verification token | Use a signed, short-expiry token (or a random token row in Postgres with `expiresAt`) for the double opt-in link — don't roll a custom crypto scheme. |
| `zod` | latest | Validate crawl input, API payloads, structured-data schema shapes | Validate the audit-submission form (URL, email) and validate/normalize JSON-LD extraction results before scoring against expected schema.org shapes. |
| `bullmq` `FlowProducer` | (bundled in bullmq) | Fan-out per-audit job into sub-jobs | One BullMQ "flow" per audit: parent job (discover URLs, aggregate score) with child jobs per URL batch or per category (crawl batch, Lighthouse sampling, PSI calls) — gives you retry isolation and progress reporting per phase without a second queue library. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Docker (multi-stage build) | Container for the worker (Crawlee + Playwright + Unlighthouse + BullMQ worker) | Use the official `mcr.microsoft.com/playwright:v1.61.1-noble` base image (pin the tag to match your installed Playwright version exactly — mismatches cause "browser executable not found" errors). Set `--ipc=host` or mount a larger `/dev/shm` (Chromium defaults to 64MB shm and crashes without it); pass `--disable-dev-shm-usage` as a fallback if you can't control the host's shm size on the hosting platform. |
| BullMQ Board / Bull Board | Queue observability dashboard | Cheap way to see in-flight/failed/delayed jobs during development and to debug stuck audits in production without extra tooling. |
| Railway CLI + `railway.json` | Deploy/config as code for the worker service | Keep the worker's Dockerfile and Railway service config in-repo alongside the Next.js app (monorepo) for atomic deploys of both when the shared Prisma schema changes. |

## Installation

# Frontend (Next.js app, Vercel)

# Worker (separate package/container)

# Playwright browsers (worker Dockerfile, not needed on Vercel side)

# Dev dependencies

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Crawlee | Custom `fetch` + Cheerio, hand-rolled queue | Only if you want zero framework dependency and are prepared to build your own retry/concurrency/dedup logic. Not recommended here — Crawlee's request queue and session pool solve exactly the "crawl 500 URLs politely and reliably" problem this product needs. |
| Crawlee (Playwright crawler for the render pass) | Puppeteer directly | Crawlee already wraps Puppeteer as an option; Playwright is preferred for multi-browser support (not needed here) but mainly for its more modern, actively developed API and first-class Lighthouse integration story via Unlighthouse. No strong reason to pick Puppeteer standalone. |
| Prisma | Drizzle ORM | If Juan prioritizes smallest possible bundle/cold-start on the Vercel side and is comfortable writing more SQL-like queries by hand, Drizzle (0.45.x) is a legitimate, increasingly popular choice — the 2026 ecosystem trend is moving Prisma-to-Drizzle for exactly this reason. Given this project's worker-heavy architecture (cold start matters far less on a long-lived Railway container than on Vercel functions), Prisma's DX and migration tooling edge out Drizzle's edge-runtime advantages. Revisit if the Vercel side grows heavy read traffic and cold starts become measurable. |
| Railway (worker hosting) | Fly.io | If you need multi-region placement (e.g., crawling from a region close to the audited site) or prefer machine-level control (start/stop VMs on demand, scale-to-zero more aggressively). Fly.io's per-second billing can beat Railway at very bursty/idle-heavy usage patterns. |
| Railway (worker hosting) | Render | If predictable flat monthly pricing matters more than usage-based billing, and you don't mind less battle-tested Playwright-in-Docker documentation compared to Railway's dedicated guide. |
| PageSpeed Insights API for field data | Direct CrUX API (`chromeuxreport.googleapis.com`) | If you only need raw CrUX field metrics without running Lighthouse at all (e.g., a lighter "just show me real CWV" mode) — same Google quota system, slightly different shape of response. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Running the crawl, Lighthouse, or Playwright inside a Vercel serverless/edge function | Vercel functions cap out around 300s by default (up to 800s only on Enterprise), have no persistent process, cap memory, and don't allow the long-lived BullMQ `Worker` loop or a Chromium/Lighthouse process at the scale a 500-URL audit needs. This is a hard architectural mismatch, confirmed by both Vercel's own docs and community threads on this exact pattern. | Run BullMQ producer (enqueue only) inside Next.js API routes/Server Actions on Vercel; run the BullMQ `Worker`, Crawlee, Playwright and Unlighthouse in the separate Railway/Fly container. |
| Running full Lighthouse (via Unlighthouse or otherwise) on all 500 URLs per audit | Each Lighthouse run is CPU/memory heavy (roughly 1-2GB, tens of seconds per page); at 500 URLs this turns a "free lead magnet audit" into a very expensive compute bill and a very slow report. | Sample a representative subset (homepage, top-level category pages, a handful of template-representative pages) for Lighthouse/PSI; run the lightweight Cheerio pass for the technical/on-page/structured-data checks across all 500 URLs. |
| Puppeteer as the primary rendering engine | Superseded by Playwright for new projects; Crawlee supports both, but Playwright has better multi-browser support and more active tooling ecosystem integration (Unlighthouse itself builds on Chrome via Lighthouse's own driver, not Puppeteer specifically, but the wider community default in 2026 is Playwright for new browser-automation code). | Playwright |
| Un-pinned `microsoft/playwright` Docker base image tag (e.g. `:latest`) | Playwright requires the installed npm package version and the browser binaries baked into the image to match exactly; drifting tags cause "executable doesn't exist" failures after redeploys. | Pin the Docker base image tag to the exact Playwright npm version in use (e.g. `mcr.microsoft.com/playwright:v1.61.1-noble`) and bump both together. |
| Hand-rolled cron/interval polling for the "1 audit/week/email" quota | Fragile, doesn't survive restarts cleanly, and duplicates what a database + delayed-job system already gives you for free. | Store `lastAuditAt` per verified email in Postgres and check/reject at enqueue time; optionally use a BullMQ delayed job or rate-limiter feature as a secondary guard against duplicate concurrent submissions. |
| Treating Domain Rating / third-party paid metrics as part of crawler output | Explicitly out of scope per PROJECT.md — avoids a hard dependency on Ahrefs/Moz paid APIs for the core scored audit. | Keep PSI/CrUX + your own crawl-derived checks as the only inputs to the score; third-party authority metrics (if ever added) stay as optional context, not scored inputs. |

## Stack Patterns by Variant

- Use Crawlee's `RequestQueue` with a hard `maxRequestsPerCrawl` cap set to 500, and prioritize sitemap-declared URLs over discovered/crawled ones so the cap is spent on canonical content, not incidental link-crawl discoveries.
- Because 500 pages of full Lighthouse would be prohibitively slow, sampling (see above) is not optional but required at this scale.
- Run the fast Cheerio pass first; if extracted content/title/meta looks empty or drastically shorter than the rendered `<body>` text length threshold, flag the page and re-fetch with the Playwright crawler for that URL only.
- Don't default every URL to Playwright — this is the "raw HTML vs rendered HTML" comparison the reference report already calls for (per PROJECT.md), used selectively, not universally.
- A single small Railway worker instance is sufficient; BullMQ concurrency can stay low (e.g. 2-3 concurrent Playwright/Lighthouse jobs) to control memory.
- Scale worker concurrency and/or instance count only once real usage data shows queue backlog.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `playwright@1.61.1` | `mcr.microsoft.com/playwright:v1.61.1-noble` Docker image | Must match exactly — Playwright's browser download version is tied 1:1 to the npm package version. |
| `crawlee@3.17.x` | `playwright@1.61.x`, `cheerio@1.2.x` | Crawlee's `@crawlee/playwright` and `@crawlee/cheerio` packages declare peer ranges on these — install via Crawlee's own package set rather than mixing arbitrary independent versions. |
| `bullmq@5.79.x` | `ioredis@5.11.x` or `redis@>=5.0.0` | If using the `redis` npm client instead of `ioredis`, BullMQ requires `redis` v5+; `ioredis` is the more common/stable choice for BullMQ specifically. |
| `prisma@7.x` | Node 18+ | Prisma 7 dropped the old binary-engine cold-start penalty; verify Railway's Node runtime version supports it (Node 20+ recommended for both frontend and worker for LTS alignment). |
| `next@16.x` | `prisma@7.x` client only, not the worker's Crawlee/Playwright deps | Keep the worker as a separate package/deployable (even in a monorepo) so Next.js's Vercel build never tries to bundle Playwright/Crawlee, which would break the Vercel build or bloat function size. |

## Sources

- [Crawlee GitHub](https://github.com/apify/crawlee) — crawler engine architecture, HIGH confidence (official repo)
- [Crawlee CheerioCrawler guide](https://crawlee.dev/js/docs/guides/cheerio-crawler-guide) — throughput/performance characteristics, HIGH confidence
- [Unlighthouse docs](https://unlighthouse.dev/) — multi-page Lighthouse orchestration, bulk testing/sampling via `--maxRoutes`, HIGH confidence (official docs)
- [BullMQ official site](https://bullmq.io/) and [npm](https://www.npmjs.com/package/bullmq) — current version 5.79.2, MIT license, no artificial concurrency limits, HIGH confidence
- [Vercel community discussion #5050](https://github.com/vercel/community/discussions/5050) and [Next.js discussion #33989](https://github.com/vercel/next.js/discussions/33989) — confirms BullMQ workers cannot run inside Vercel functions, MEDIUM-HIGH confidence (community consensus + Vercel's own documented function timeout limits)
- [Prisma vs Drizzle comparison](https://www.prisma.io/docs/orm/more/comparisons/prisma-and-drizzle) (official Prisma docs) — architecture/positioning, MEDIUM confidence (vendor-authored, cross-checked against independent 2026 comparison articles which agree on the general trend)
- [Railway Playwright guide](https://docs.railway.com/guides/playwright) — official Docker/Playwright deployment guidance, HIGH confidence
- [Railway vs Render vs Fly.io comparison articles, 2026](https://hostim.dev/blog/render-vs-railway-vs-fly-pricing/) — pricing/positioning, MEDIUM confidence (third-party, cross-checked across multiple independent sources that agree)
- [Google PageSpeed Insights API discussion](https://groups.google.com/g/pagespeed-insights-discuss/c/dB7hWmGAGsw) — 25,000/day, 400/100s quota, MEDIUM confidence (community-reported, consistent with Google's documented behavior, some undocumented additional throttling reported)
- [Playwright Docker docs](https://playwright.dev/docs/docker) — official image tagging/version-pinning guidance, HIGH confidence
- [Resend double opt-in example repo](https://github.com/resend/resend-double-opt-in-example) — official Resend reference implementation for this exact flow, HIGH confidence
- npm registry (`npm view <pkg> version`, checked 2026-07-05) — exact current published versions of crawlee, playwright, next, bullmq, ioredis, prisma, drizzle-orm, cheerio, resend, fast-xml-parser, robots-parser, p-queue, jsdom — HIGH confidence (live registry query)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
