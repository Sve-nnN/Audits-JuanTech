# Architecture Research — Milestone v1.2 (Render detection + report exports)

**Domain:** SEO/technical web-audit tool — subsequent-milestone feature integration
**Researched:** 2026-07-06
**Confidence:** HIGH (grounded in the existing v1.0/v1.1 codebase, not greenfield guesswork)

> Scope note: this is **integration research**, not a re-design. The v1.0 pipeline
> (crawl → checks → PSI → diff → score → persist) and the strict `apps/web` ↔
> `apps/worker` boundary are validated and MUST NOT change. Everything below is
> **additive**. Where a recommendation touches an existing file, it says "MODIFY";
> where it introduces something, it says "NEW".

---

## Standard Architecture (current, unchanged)

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  apps/web  (Next.js 15, Vercel, runtime="nodejs")                  │
│  ┌───────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
│  │ report page   │  │ /api/audits/[id] │  │ enqueue routes     │   │
│  │ (RSC, Prisma) │  │ (read Postgres)  │  │ (BullMQ producer)  │   │
│  └───────┬───────┘  └────────┬─────────┘  └─────────┬──────────┘   │
│          │  reads            │ reads                │ enqueue only  │
├──────────┼───────────────────┼──────────────────────┼──────────────┤
│          ▼                   ▼                      ▼               │
│                     Postgres (Neon)          Redis / BullMQ         │
│          ▲                                          ▲               │
├──────────┼──────────────────────────────────────────┼──────────────┤
│          │ writes                                    │ consumes     │
│  apps/worker  (long-running Node container — Railway/VPS)           │
│  runCrawl → runAllChecks → runPerfSample → diff → score → persist   │
│  concurrency=2 · JOB_TIMEOUT 20min · lockDuration > job duration    │
└──────────────────────────────────────────────────────────────────┘
```

### Hard boundary rules (the reason this milestone stays safe)

| Rule | Why it exists | v1.2 consequence |
|------|---------------|------------------|
| `apps/web` NEVER imports the crawler / browser stack | Playwright/Crawlee would bloat or break the Vercel build | The new **render pass** must live in a package the web app never imports |
| `apps/worker` NEVER imports Next.js | Worker is a plain Node process | Export serializers must not depend on `next/*` |
| **Checks are pure** functions over already-fetched HTML (`{page, $}` → `IssueDraft[]`) | Deterministic, unit-testable, no I/O | A "render check" must **consume** render data, never trigger rendering itself |
| `@auditor/checks` already imports `@auditor/crawler` (`normalizeUrl` in `canonical.ts`) | Shared URL logic | **CRITICAL:** do NOT add Playwright to `@auditor/crawler` — web → checks → crawler would drag a browser into Vercel |

---

## Feature-by-feature integration

### Feature 1 — CSR vs SSR detection (Playwright render pass)

**Verdict on the core question:** the **worker performs the render and produces a
"render sample" artifact; a new pure check consumes it.** The check never launches a
browser. This is the only design that respects "checks stay pure."

#### Where it slots into the pipeline (`apps/worker/src/index.ts`)

Insert one new pass **after `runCrawl` completes and before `runAllChecks`**, mirroring
how `runPerfSample` already samples pages. Sequence inside `crawlAndCheck()`:

```
runCrawl(...)                          // unchanged — persists Page.html (raw)
  ↓
prisma.page.findMany({ auditId })      // unchanged
  ↓
writePhase("analyzing")                // (add a "rendering" phase marker, optional)
  ↓
NEW: renderSignals = runRenderSample(pages)   // Playwright over selectSample()
  ↓
runAllChecks({ pages, origin, ..., renderSignals })   // MODIFY: pass artifact in
  ↓
runPerfSample(...)  → diff → score → persist          // unchanged
```

Why **before** `runAllChecks` (not a separate later step): the CSR verdict must become an
`Issue` through the same registry/persist path as every other check, so it flows into
scoring, the diff-by-fingerprint machinery, and the report table **for free**. Producing the
artifact first and feeding it into the existing check loop reuses all of that.

#### Sampling — reuse the existing pattern, don't invent one

`selectSample(pages, max)` from `@auditor/psi` is the exact primitive needed (homepage-first,
depth-spread, 2xx-HTML only, dedup). Two options:

- **Reuse `selectSample` directly** (import it into the render step). Simplest, and the render
  sample and PSI sample overlapping is fine — arguably desirable (same representative pages).
- If render needs a different budget than PSI's `MAX_PSI_PAGES = 5`, call
  `selectSample(pages, MAX_RENDER_PAGES)` with its own cap. Recommend a small cap (5–10) —
  Playwright is 5–10× the memory/CPU of the Cheerio pass.

Do **not** render all 500 URLs. Same rule as Lighthouse: sample.

#### What the render pass computes

For each sampled page: navigate with Playwright, wait for network-idle, read the rendered DOM,
and compare against the **already-stored raw `Page.html`** (no re-fetch of raw — it's in Postgres).
The comparison signal is a text-length / node-count ratio:

```ts
// produced by @auditor/render, shape OWNED by @auditor/checks (see below)
interface RenderSignal {
  pageId: string;
  rawTextLength: number;       // from stored Page.html (Cheerio)
  renderedTextLength: number;  // from Playwright DOM
  ratio: number;               // rendered / max(raw, 1)
  verdict: "ssr" | "hydrated" | "csr";  // csr = raw near-empty, rendered full
  error?: string;              // best-effort: a render failure degrades, never fails the audit
}
```

`verdict` heuristic (tune during build): raw text ≈ rendered text → `ssr`; raw has meaningful
content but rendered adds a lot → `hydrated`; raw near-empty and rendered full → `csr` (the
finding that matters for SEO/AEO).

#### How a pure check consumes it (keeping the PageCheck contract)

**MODIFY `@auditor/checks/src/types.ts`:**
- Define `RenderSignal` here (checks owns the contract; the render package produces this shape).
- Extend `PageCheckCtx` with an optional field: `renderSignal?: RenderSignal`.

**MODIFY `runAllChecks` (registry.ts):** accept `renderSignals?: Map<string, RenderSignal>` in
`RunAllChecksOptions`; inside the per-page loop pass `renderSignal: renderSignals?.get(page.id)`
into the check ctx. Pages without a signal (the un-sampled majority) simply get `undefined`.

**NEW check `RENDER-01`** (a normal `PageCheck` in `packages/checks/src/checks/tech/` or a new
`render/` folder, category `"tech"`): reads `ctx.renderSignal`. If absent → returns `[]` (page
wasn't sampled). If present → emits an `IssueDraft` (`critical`/`warning` for `csr`, `ok` for
`ssr`) with `measuredValue` = the ratio, stable `pageFingerprint(CHECK_ID, url)`. It is a pure
function of its input — identical to every existing check.

This is the crux: **the browser lives in the worker; the check is pure data-in → IssueDraft-out.**

#### Where the Playwright code lives — NEW package `@auditor/render`

- **NEW package `@auditor/render`** with the single `playwright` dependency, exporting
  `runRenderSample(pages, opts): Promise<Map<string, RenderSignal>>`.
- Imported **only by `apps/worker`**. Never by `@auditor/checks`, never by `@auditor/crawler`
  (see the CRITICAL boundary rule above — checks transitively reaches web).
- Why a dedicated package and not inline in the worker: keeps Playwright launch/pool/teardown
  logic unit-testable and isolated, and makes the "worker-only browser dep" boundary explicit
  and greppable. Inline-in-worker is acceptable but muddier.

#### Storage decision — emit as Issue, migration OPTIONAL

- **Source of truth = the `RENDER-01` Issue.** Zero schema change: it persists through the
  existing `Issue.createMany`, scores, and diffs like any other check. **No migration required.**
- **Optional** convenience column `Page.renderVerdict String?` (nullable, additive) *only if*
  the `/audits/[id]/pages` view wants a per-page CSR/SSR badge without querying Issues. This is a
  trivial additive migration (nullable column, no backfill). Recommend deferring it — start
  Issue-only; add the column later if the pages UI needs it.

#### Infra impact (this is the real cost of Feature 1)

- Worker Docker image must switch to / add the pinned Playwright base
  (`mcr.microsoft.com/playwright:v1.61.1-noble`, tag == npm version exactly).
- Set `--ipc=host` or enlarge `/dev/shm` (Chromium's 64MB default crashes it).
- Keep render concurrency low (2–3) — the worker already runs `concurrency=2` audits;
  Playwright memory stacks on top of that.
- Best-effort semantics: wrap `runRenderSample` in try/catch exactly like `runPerfSample` — a
  render failure degrades to "no render signal" and must never fail the audit.

---

### Feature 2 — Deeper canonical checks (extend TECH-04)

**No architecture change. Pure IssueDraft logic. No new Page data.** Confirmed by reading
`canonical.ts`: it already operates entirely on `$` (raw HTML) plus `page.finalUrl` — both
already stored. The new cases (canonical chains, cross-domain canonical, mismatch with final
URL) are all derivable from data already present.

One nuance: **canonical → non-indexable target** and **canonical chain resolution** need to know
the *target* page's state (its robots-meta / its own canonical). That is cross-page knowledge the
per-page `PageCheck` ctx doesn't have. Two clean options, both within the existing contract:

- Keep self-referential/format checks in the existing `TECH-04` **PageCheck**.
- Add the cross-page cases as a **SiteCheck** (which already receives the whole `pages[]` set) —
  e.g. `TECH-04b` that builds a URL→page map and validates canonical targets against it.

Either way: **zero schema change, zero migration, all data is in the stored raw HTML.**

### Feature 3 — Heading hierarchy checks (extend ONPAGE-03)

**No architecture change. Pure. No new Page data.** `h1.ts` already reads `$("h1")`. The new
rules (multiple H1, level skips h2→h4, empty headings, document order) are pure DOM traversal
over the same `$`. Extend the existing `ONPAGE-03` PageCheck (or add sibling `ONPAGE-03b/c`
PageChecks with their own stable fingerprints so the diff engine tracks them independently).
No column, no migration.

> Recommendation on fingerprints: when splitting one check into several distinct findings, give
> each finding its **own `checkId`/fingerprint** rather than overloading one — the diff engine
> keys on fingerprint, so distinct findings must be distinctly fingerprinted to diff correctly.

---

### Features 4/5/6 — Export as PDF / Markdown-for-LLM / PPTX (on-demand, Next.js route)

**Verdict:** one Node-runtime API route, a **shared report view-model**, and a **new pure
`@auditor/export` package** with three serializers. No worker involvement, nothing pre-generated.

#### Route shape

```
GET /api/audits/[id]/export?format=pdf|md|pptx     // runtime = "nodejs"
```

- Validate `id` + `format` (`zod`), 404 if audit missing / not `done`.
- Build the view-model once, hand it to the requested serializer, stream back with
  `Content-Type` (`application/pdf` | `text/markdown` |
  `application/vnd.openxmlformats-officedocument.presentationml.presentation`)
  and `Content-Disposition: attachment; filename="audit-<domain>-<date>.<ext>"`.
- Lives next to the existing `apps/web/app/api/audits/[id]/route.ts` (same `runtime = "nodejs"`
  convention already in place).

#### Shared report view-model — extract the fetch (DO THIS FIRST)

Right now the report page (`app/audits/[id]/page.tsx`) fetches Audit + Issues (priority, detail,
resolved) + PerfMetric inline. The export route needs the **same** data. Duplicating those
Prisma queries would drift.

- **NEW `apps/web/lib/reportModel.ts`** exporting
  `buildReportModel(auditId): Promise<ReportModel | null>` that runs the Prisma queries currently
  inlined in the page (audit + scores + stats + issues + perf) and returns a **plain serializable
  object** (`ReportModel`).
- **MODIFY `app/audits/[id]/page.tsx`** to call `buildReportModel` instead of its inline queries
  (pure refactor, no UI change).
- The export route calls the same `buildReportModel`.

Keep the Prisma access in `apps/web` (it has the web DB connection + `@auditor/db`); keep the
**serializers pure** (model-in, bytes-out). This split is what makes the serializers trivially
unit-testable without a database.

#### NEW package `@auditor/export` — argue for/against

**Recommendation: YES, a new `@auditor/export` package.**

| For | Against |
|-----|---------|
| Pure (model → `Buffer`/`string`), no `next/*`, no `@auditor/db`, no worker deps → fully unit-testable | Slightly more monorepo wiring than colocating in `apps/web/lib` |
| Three serializers share one `ReportModel` type + formatting helpers (severity labels, category order already exist in web's `labels.ts` — move the shared bits in) | PDF/PPTX libs are heavyish deps, but they're **Node-only server deps in a route** — fine on Vercel Node runtime, and they never reach the client bundle |
| Enforces the boundary: the package's `package.json` simply doesn't list Next/worker deps, so accidental coupling fails at install/typecheck | — |
| Reusable later (e.g. email-attached report, v2 features) | — |

**Contents:** `ReportModel` type (the contract, owned here), `toMarkdown(model): string`,
`toPdf(model): Promise<Buffer>`, `toPptx(model): Promise<Buffer>`. Web imports it; the route is a
thin adapter. `buildReportModel` (Prisma) stays in web and returns this package's `ReportModel`
shape — so the **type** lives in `@auditor/export`, the **fetch** lives in web.

**Library note (STACK territory, flagged not decided here):** PDF must be a **pure-JS** generator
(`pdf-lib`, `pdfkit`, or `@react-pdf/renderer`) — NOT headless-Chrome-to-PDF, because the web
side has no browser (that's the whole point of the boundary). PPTX → `pptxgenjs`. Markdown →
hand-rolled template string (best for the "LLM-optimized" format: stable headings, issue tables,
criterion+recommendation per issue so an LLM can apply fixes).

#### Feature 7 — Export button

Client component, top-right of the report page, format selector (dropdown/segmented). Each option
is a link/fetch to `/api/audits/[id]/export?format=…`. Pure UI wired to the route; no new data
flow. Uses the existing v1.1 component library (Button, etc.).

---

## Data-flow & migration summary

| Feature | New Prisma column? | Migration? |
|---------|--------------------|------------|
| CSR/SSR render | **No** (emit `RENDER-01` Issue). Optional `Page.renderVerdict String?` only if pages-view badge wanted | **Not required** (optional additive nullable column if UI later needs it) |
| Canonical (TECH-04 deeper) | No | No |
| Headings (ONPAGE-03 deeper) | No | No |
| Exports (PDF/MD/PPTX) | No — reads existing Audit/Issue/PerfMetric/Page | No |

**Net: the milestone needs no mandatory migration.** The single optional column is nullable and
additive (safe, no backfill).

---

## New vs modified components

### NEW

| Component | Type | Boundary | Purpose |
|-----------|------|----------|---------|
| `@auditor/render` | package (playwright) | worker-only | `runRenderSample(pages) → Map<pageId, RenderSignal>` |
| `RENDER-01` check | PageCheck in `@auditor/checks` | pure | consumes `ctx.renderSignal`, emits CSR/SSR Issue |
| `@auditor/export` | package (pdf/pptx/md libs) | web-only, pure | `ReportModel` type + `toPdf/toMarkdown/toPptx` |
| `apps/web/lib/reportModel.ts` | web module | web | `buildReportModel(auditId)` shared fetch → `ReportModel` |
| `app/api/audits/[id]/export/route.ts` | Node API route | web | format param → serializer → download |
| Export button + selector | client component | web | trigger downloads |
| (optional) canonical `SiteCheck` | check | pure | cross-page canonical target validation |

### MODIFIED

| Component | Change |
|-----------|--------|
| `apps/worker/src/index.ts` | add `runRenderSample` step between crawl and `runAllChecks`; pass `renderSignals` in; optional `"rendering"` phase marker |
| `@auditor/checks/src/types.ts` | add `RenderSignal`; extend `PageCheckCtx` with `renderSignal?` |
| `@auditor/checks/src/registry.ts` | `RunAllChecksOptions.renderSignals?`; pass per-page signal into ctx |
| `checks/tech/canonical.ts` | deeper canonical rules (pure) |
| `checks/onpage/h1.ts` (+ siblings) | heading-hierarchy rules (pure) |
| `app/audits/[id]/page.tsx` | swap inline queries → `buildReportModel` (pure refactor); add export button |
| worker `Dockerfile` | pinned Playwright base image, `/dev/shm`/`--ipc=host` |
| `apps/worker/package.json` | add `@auditor/render` |
| `apps/web/package.json` | add `@auditor/export` |

---

## Integration points

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| worker → render | direct import `@auditor/render` | worker-only; keeps Playwright out of web via `checks→crawler` path |
| render → checks | shared **type** `RenderSignal` (defined in checks) | worker passes the produced map into `runAllChecks`; check stays pure |
| web page ↔ export route | shared `buildReportModel` + `ReportModel` type | single source of truth for report data; no query drift |
| export route → `@auditor/export` | direct import | pure serializers, no DB/Next/worker deps |

### External services

| Service | Integration | Notes |
|---------|-------------|-------|
| Playwright/Chromium (worker container) | in-process browser launch | pin base image to npm version; shm sizing; low concurrency |
| PDF/PPTX libs (Vercel Node route) | pure-JS, in-process | must NOT be Chrome-based; server-only, never client bundle |

---

## Anti-patterns to avoid (specific to this milestone)

**Putting Playwright in `@auditor/crawler`.** `@auditor/checks` imports `@auditor/crawler`
(`normalizeUrl`), and `apps/web` imports `@auditor/checks` — so a browser dep in crawler can be
pulled into the Vercel build. Use the isolated `@auditor/render` package instead.

**Making the render check trigger rendering.** Breaks purity, adds I/O + browser to the check
layer, makes checks non-deterministic and un-unit-testable. The worker renders; the check reads.

**Rendering all 500 URLs.** Same mistake as Lighthouse-on-everything. Sample via `selectSample`.

**Chrome-to-PDF on the web side.** There is no browser on Vercel (by design). Use pure-JS PDF.

**Duplicating the report Prisma queries in the export route.** Extract `buildReportModel` first;
both the page and the route consume it.

**Pre-generating exports in the worker / storing them.** Explicitly out of scope — exports are
on-demand in the Node route reading existing Postgres data.

---

## Suggested build order (phases continue from 11)

Dependency logic: check extensions are independent and pure (fastest, safest); the render pass
touches the worker + Docker (highest infra risk); exports read existing data and benefit from the
render findings already existing, so they come after render; the UI button is last.

| Phase | Scope | Why here | Risk |
|-------|-------|----------|------|
| **11 — Deeper checks** | Canonical (TECH-04) + heading hierarchy (ONPAGE-03) extensions | Pure, unit-testable, no infra, immediate value, zero migration. Independent of everything else. Ship first. | Low |
| **12 — CSR/SSR render pass** | `@auditor/render` package + worker step + `RENDER-01` check + `PageCheckCtx`/registry plumbing + Docker Playwright base | Touches worker + container (Docker, shm, memory, concurrency) — the real integration risk. Do after the safe checks are in. | High (infra) |
| **13 — Export foundation + serializers** | extract `buildReportModel`; `@auditor/export` (do **MD** first — simplest & the LLM format; then **PDF**; then **PPTX**) | Depends only on existing report data; sequencing after 12 means exports already include CSR findings | Medium |
| **14 — Export UI** | button + format selector on report page, wired to the route | Depends on 13's route existing | Low |

Notes:
- 12 and 13 are technically independent (exports don't require render), so they **could** run in
  parallel — but ordering render before exports means the first exported reports already carry the
  CSR/SSR findings. Sequence by risk: get the risky worker/Docker change (12) landed and verified
  before the export surface area.
- Within 13, build serializers in ascending complexity (MD → PDF → PPTX) so the shared
  `ReportModel` + route are validated by the cheapest format before investing in binary formats.

---

## Sources

- Existing codebase (HIGH — direct reads): `apps/worker/src/index.ts`,
  `packages/checks/src/{types,registry}.ts`, `packages/checks/src/checks/tech/canonical.ts`,
  `packages/checks/src/checks/onpage/h1.ts`, `packages/db/prisma/schema.prisma`,
  `apps/web/app/audits/[id]/page.tsx`, `apps/web/app/api/audits/[id]/route.ts`,
  `packages/psi/src/sample.ts`, package.json boundary graph (`web → checks → crawler`).
- Project `CLAUDE.md` STACK (HIGH — user-authored): Playwright base-image pinning, shm/`--ipc`,
  sample-don't-render-all, worker/web boundary rationale.
- `.planning/PROJECT.md` v1.2 milestone definition (HIGH — user-authored scope).

---
*Architecture research for: SEO/technical audit tool — v1.2 render-detection + report-export integration*
*Researched: 2026-07-06*
