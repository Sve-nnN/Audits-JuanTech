# Project Research Summary

**Project:** Auditor Web (SEO/Técnico) — milestone v1.2 (render detection + report exports)
**Domain:** SEO/technical web-audit tool (lead magnet) — additive milestone on a shipped app
**Researched:** 2026-07-06
**Confidence:** HIGH

## Executive Summary

v1.2 is an **additive** milestone on an already-shipped, validated pipeline (crawl → checks → PSI → diff → score → persist) with a strict `apps/web` (Vercel) ↔ `apps/worker` (Railway/VPS container) boundary. Nothing about v1.0/v1.1 changes. The milestone bolts on four capabilities: CSR/SSR render detection (selective Playwright pass in the worker over a small sample), deeper canonical checks, heading-hierarchy checks, and on-demand report exports (PDF, Markdown-for-LLM, PPTX) generated in a Next.js Node API route with a top-right export button + type selector. All four research files were written by reading the actual repo, so confidence is high and grounded, not greenfield guesswork.

The recommended approach is deliberately conservative about the boundary. The two check extensions (canonical, headings) are **pure Cheerio logic over already-stored HTML** — zero infra, zero migration, lowest risk, so they ship first. CSR/SSR detection is the only feature that touches the worker and Docker: it needs a pinned Playwright base image, a new isolated `@auditor/render` package (worker-only, so Playwright never leaks into the Vercel build via the existing `web → checks → crawler` import path), and it must render only a small sample (reuse the existing `selectSample`), never all 500 URLs. The check itself stays pure — the worker renders and produces a `RenderSignal` artifact, a new `RENDER-01` check consumes it. Exports are pure reads: extract a shared `buildReportModel` first, then three pure serializers in a new `@auditor/export` package using **pure-JS libraries only** (`@react-pdf/renderer`, `pptxgenjs`, hand-rolled Markdown) — no Chromium anywhere near Vercel.

The key risks are all concentrated in CSR/SSR and exports. For rendering: image/npm version drift, Chromium `/dev/shm` OOM under concurrency=2 + existing PSI load, zombie browser processes on timeout/shutdown, and — most insidious — CSR false positives from an arbitrary raw-vs-rendered threshold that would embarrass the lead magnet by flagging SSR sites. Mitigate with pinned images, a global Chromium semaphore, `finally { browser.close() }`, empirically calibrated + documented thresholds (the SimHash=3 precedent), template-level verdicts, and always emitting a stable per-page `ok`/`warning` row so the diff doesn't churn. For exports: don't bundle Chromium into Vercel, truncate to top-N (a 200-page PDF is useless), embed a Unicode TTF for Spanish accents (`áéíóúñ¿¡`), and make an explicit access-control decision since the report is currently public-by-ID. A subtle cross-cutting risk: new multi-condition checks must **sub-type their fingerprints** or the fingerprint-keyed diff silently collapses distinct findings, and new per-page `ok` rows can dilute category scores — verify score drift on the juan-tech.com fixture.

## Key Findings

### Recommended Stack

Only net-new dependencies; everything else is validated and out of scope. Two axes: a worker-side render pass and web-side export generators. All versions verified live via `npm view` on 2026-07-06 and cross-checked against actual repo code.

**Core technologies:**
- **playwright 1.61.1** (worker) — render the CSR/SSR sample in headless Chromium. Use the **raw `playwright` API** (`chromium.launch()` + one context/page per sampled URL), NOT `PlaywrightCrawler` (request-queue/autoscaling is pure overhead for a fixed ≤5-URL sample). Pin **exactly** to match Docker base `mcr.microsoft.com/playwright:v1.61.1-noble`.
- **@react-pdf/renderer 4.5.1** (web) — branded PDF in the Node API route. Pure-JS, no Chromium, tiny cold start, well under Vercel's 250 MB cap. JSX/flexbox layout fits a data-dense branded report; register brand fonts (Array/Khand/Geist) via `Font.register`.
- **pptxgenjs 4.0.1** (web) — PPTX deck export. Pure-JS, zero native deps, native charts for category scores, `outputType: "nodebuffer"`.
- **Markdown export** — hand-rolled string builder from DB rows (NOT an HTML→MD converter; the source is structured data). No dependency.

No new packages for canonical checks, heading checks, or Markdown export. Optional `p-limit@7` only if not reusing the worker's existing lane concurrency pattern. See [STACK.md](./STACK.md).

### Expected Features

Categorized relative to a "Screaming Frog but more complete and automated" audit. See [FEATURES.md](./FEATURES.md).

**Must have (table stakes):**
- **Heading hierarchy errors** (extend ONPAGE-03) — LOW complexity, pure Cheerio; every SEO+a11y tool reports this.
- **Deeper canonical checks** (extend TECH-04) — MEDIUM; canonical→noindex/4xx/redirect/chains/cross-domain. Credibility for a technical-SEO tool.
- **PDF export (branded)** — the default "deliverable" mental model for an audit.
- **Export button top-right + type selector** — gates all exports; LOW, keyboard/ARIA accessible per the v1.1 baseline.

**Should have (competitive differentiators):**
- **Markdown-for-LLM export** — the standout. No mainstream SEO tool ships this; serves the "actionable" + AEO positioning directly. Cheapest to build, highest differentiation.
- **CSR vs SSR detection** — premium JS-SEO capability, AEO-relevant (LLM crawlers don't run JS). Highest complexity, only worker/schema-touching feature.
- **PPTX export (client-facing deck)** — turns a self-serve report into a consultant-grade artifact; 7–12 focused slides.

**Defer (v2+):**
- Additional export formats (DOCX/CSV) — format sprawl, only on demand.
- Per-template CSR grouping UI in the on-screen report — start with export/issue reporting.
- Rendering-based re-crawl of JS-only internal links — heavier, defer.

**Explicit anti-features:** rendering all 500 URLs with Playwright, Chromium HTML→PDF on Vercel, WYSIWYG export builder, marking CSR as a hard score failure, async/queued export generation.

### Architecture Approach

Integration, not re-design. The pipeline and the web/worker boundary MUST NOT change; everything is additive. CSR detection slots as a new pass **after `runCrawl`, before `runAllChecks`** so the verdict becomes an `Issue` through the existing registry/scoring/diff path for free. The worker renders and produces the artifact; a new pure `RENDER-01` check consumes it (browser lives in the worker, check stays pure data-in → IssueDraft-out). Exports extract a shared `buildReportModel` (used by both the report page and the export route to avoid query drift) feeding three pure serializers. See [ARCHITECTURE.md](./ARCHITECTURE.md).

**Major components:**
1. **`@auditor/render`** (NEW, worker-only) — `runRenderSample(pages) → Map<pageId, RenderSignal>`; isolates Playwright so it never reaches Vercel via `web → checks → crawler`.
2. **`RENDER-01` check** (NEW, pure) — consumes `ctx.renderSignal`, emits CSR/SSR Issue; `PageCheckCtx`/registry get an optional `renderSignal` field.
3. **`@auditor/export`** (NEW, web-only, pure) — owns `ReportModel` type + `toPdf/toMarkdown/toPptx`; depends only on pure-JS doc libs, never on crawler/checks-runtime/playwright.
4. **`apps/web/lib/reportModel.ts`** (NEW) + **`/api/audits/[id]/export/route.ts`** (NEW, Node runtime) — shared fetch + thin format-dispatch adapter with download headers.
5. **Extended `canonical.ts` / `h1.ts`** (MODIFIED, pure) — deeper rules; cross-page canonical cases as a SiteCheck.

**Migrations: none mandatory.** Optional nullable `Page.renderVerdict` only if the pages-view wants a badge.

### Critical Pitfalls

Top risks from [PITFALLS.md](./PITFALLS.md) (14 total documented, grounded in repo facts):

1. **CSR false positives from an arbitrary threshold** — compare *meaningful content* (`extractVisibleText`, title/H1/main text presence in raw HTML), not byte length; calibrate empirically against known SSR (juan-tech.com) and CSR fixtures and **document the threshold** (SimHash=3 precedent); report a template-level verdict; only flag critical when content is genuinely absent pre-JS.
2. **Chromium OOM / zombie browsers under concurrency=2 + PSI** — the worker already runs 2 jobs × PSI/Lighthouse. Use a **global Chromium semaphore** shared by PSI and CSR, `--disable-dev-shm-usage`, launch-per-sample-then-close, `finally { browser.close() }` on all paths, and extend `shutdown()` to close browsers.
3. **Playwright Docker image/npm version drift** — no Dockerfile exists yet; build it FROM the exact pinned `mcr.microsoft.com/playwright:v1.61.1-noble`, bump image + npm atomically, add a CI version-match check.
4. **Fingerprint collisions on multi-condition checks** — deeper canonical/heading checks emit several findings per page; reusing `pageFingerprint(CHECK_ID, url)` collapses them in the fingerprint-keyed diff (last wins, no unique constraint). **Sub-type fingerprints** (`TECH-04:chain`, `ONPAGE-03:level-skip`) via a shared util; keep the subtype content-independent.
5. **Export route: Chromium in the Vercel bundle, unbounded volume, public-by-ID access, broken accents** — pure-JS generators only (verify `pnpm why playwright` empty in web); truncate to top-N with an explicit "showing N of M" note; make an explicit access-control + rate-limit decision (report is currently unauthenticated by-ID); embed a Unicode TTF and test `áéíóúñ¿¡`.

Plus: **score dilution** from new per-page `ok` rows (verify score drift on the reference fixture; consider aggregate rows), **non-deterministic CSR diff churn** (always emit a stable per-page row so only severity changes), and **bot-detection/blocked renders** (degrade to "not determined", never a false flag or job failure).

## Implications for Roadmap

Phase numbering continues from 11. Dependency logic: pure check extensions are safest → ship first; the render pass carries all the infra risk → do it deliberately in isolation; exports read existing data and benefit from render findings already existing → after render; the UI button is last.

### Phase 11: Deeper checks (canonical + heading hierarchy)
**Rationale:** Pure Cheerio logic over already-stored HTML, no infra, no migration, zero pipeline risk, independent of everything else. Immediate table-stakes value. Ship first to bank easy wins before the risky work.
**Delivers:** Extended TECH-04 (canonical→noindex/4xx/redirect/chains/cross-domain, with cross-page cases as a SiteCheck) + extended ONPAGE-03 (multiple H1, skipped levels, empty headings, order).
**Addresses:** Deeper canonical checks, heading hierarchy errors (both P1 table stakes).
**Avoids:** Fingerprint collisions (Pitfall 6 — introduce the sub-typed fingerprint util here, up front) and score dilution (Pitfall 7 — verify score drift on the juan-tech.com fixture).

### Phase 12: CSR/SSR render pass
**Rationale:** The only feature touching the worker + Docker — the real integration risk. Land and verify it in isolation before building the export surface on top. Also the biggest architectural add (new package + Playwright + container).
**Delivers:** `@auditor/render` package, worker render step (after crawl, before checks), `RENDER-01` pure check, `PageCheckCtx`/registry plumbing, pinned Playwright Dockerfile.
**Uses:** playwright 1.61.1 + `mcr.microsoft.com/playwright:v1.61.1-noble` (STACK.md).
**Implements:** `@auditor/render` + `RENDER-01` (ARCHITECTURE.md).
**Avoids:** Pitfalls 1–5, 13, 14 — image pin, global Chromium semaphore, browser lifecycle/`finally`+shutdown, `selectSample` (never 500), calibrated + documented threshold, template-level verdict, stable per-page rows, graceful degradation on blocked renders.

### Phase 13: Export foundation + serializers
**Rationale:** Depends only on existing report data; sequencing after 12 means the first exported reports already carry CSR findings. Build serializers in ascending complexity (MD → PDF → PPTX) so the shared `ReportModel` + route are validated by the cheapest format first.
**Delivers:** Extracted `buildReportModel`, `@auditor/export` package (pure), the Node export route with download headers, and the three serializers.
**Uses:** @react-pdf/renderer 4.5.1, pptxgenjs 4.0.1, hand-rolled Markdown (STACK.md).
**Implements:** `@auditor/export` + `reportModel.ts` + export route (ARCHITECTURE.md).
**Avoids:** Pitfalls 8–12 — no Chromium in the web bundle (build guard), top-N truncation with omission note, explicit access-control + rate-limit decision, Unicode TTF for Spanish accents, pure package boundary.

### Phase 14: Export UI
**Rationale:** Depends on Phase 13's route existing. Pure UI wired to the route, no new data flow.
**Delivers:** Top-right export button + PDF/Markdown/PPTX selector on the report header, keyboard/ARIA accessible, per-item loading/disabled state.
**Addresses:** Export button + type selector (P1).
**Avoids:** Double-submit of heavy requests (disable + spinner during generation).

### Phase Ordering Rationale

- **Risk-ascending, then risk-isolated:** pure/safe (11) → highest-infra-risk in isolation (12) → read-only exports (13) → trivial UI (14). Phases 12 and 13 are technically independent (exports don't require render), but ordering render first means exported reports immediately include CSR findings and the risky Docker change is verified before the export surface expands.
- **Shared primitives up front:** the sub-typed fingerprint util (Phase 11) and `buildReportModel` extraction (start of Phase 13) prevent drift/collisions across everything downstream.
- **Boundary discipline throughout:** render stays worker-only (`@auditor/render`), exports stay web-only + pure (`@auditor/export`) — the whole risk model depends on Playwright never reaching Vercel and Chromium never entering the export route.

### Research Flags

Phases likely needing deeper research during planning (`/gsd:plan-phase --research-phase <N>`):
- **Phase 12 (CSR/SSR render):** Highest-risk, novel infra. Needs empirical threshold calibration against SSR/CSR fixtures, container memory sizing under concurrency=2 + PSI, and the graceful-degradation/bot-detection path — all version- and environment-sensitive (MEDIUM-confidence areas in PITFALLS).

Phases with standard patterns (can skip research-phase):
- **Phase 11 (deeper checks):** Pure logic extending existing checks; conventions and severities already specified in FEATURES.md.
- **Phase 13 (exports):** Library choices decided (pure-JS), route pattern already exists in-repo, layouts/structures specified in FEATURES.md. The one open item (access control) is a product decision, not research.
- **Phase 14 (export UI):** Reuses the v1.1 component library and a11y baseline.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified live via `npm view` 2026-07-06; integration verified against actual repo code. Pure-JS export libs and Playwright are ecosystem-standard. |
| Features | HIGH | Checks/behavior verified against SEO conventions + W3C/WCAG; export libs against live npm; categorized against real competitors (Screaming Frog/Sitebulb). |
| Architecture | HIGH | Grounded in direct reads of the v1.0/v1.1 codebase (worker, checks, registry, schema, report page); additive-only, boundary-preserving. |
| Pitfalls | HIGH (integration) / MEDIUM (library specifics) | Integration/architecture pitfalls grounded in repo facts (fingerprints, scoring, worker lifecycle, public-by-ID). Playwright memory profile + PDF/PPTX i18n are ecosystem-standard but version-sensitive. |

**Overall confidence:** HIGH

### Gaps to Address

- **CSR threshold calibration:** No a-priori "correct" raw-vs-rendered ratio exists — must be tuned empirically against juan-tech.com (SSR) and a known CSR fixture during Phase 12, and the chosen value documented in a decision log (SimHash=3 precedent).
- **Worker memory sizing:** Actual RAM ceiling for 2 concurrent audits × (render + PSI) is environment-specific; validate on the Railway/Fly instance under overlapping-audit load, not just in dev.
- **Export access-control decision:** Product call needed — is the report intentionally public-by-shareable-link (defensible for a lead magnet) or should exports require the owning verified email? Decide and log before wiring the button; add rate limiting regardless. Never put PII (requester email, tokens) in export bodies.
- **Score comparability:** v1.2 scores may not be directly comparable to pre-v1.2 audit history for the same site once new checks land; verify drift on the reference fixture and warn users/roadmap if category composition materially changes.
- **Optional `Page.renderVerdict` column:** Deferred; add the nullable additive column only if the pages-view later wants a per-page CSR/SSR badge.

## Sources

### Primary (HIGH confidence)
- Repo direct reads — `apps/worker/src/index.ts`, `packages/checks/src/{types,registry,util}.ts`, `checks/tech/canonical.ts`, `checks/onpage/h1.ts`, `packages/scoring/src/{categoryScore,overallScore,diff}.ts`, `packages/db/prisma/schema.prisma`, `packages/psi/src/sample.ts`, `apps/web/app/audits/[id]/page.tsx`, `apps/web/app/api/audits/[id]/route.ts` — pipeline, boundaries, fingerprint format, scoring, public-by-ID access.
- `npm view` live (2026-07-06) — playwright 1.61.1, @react-pdf/renderer 4.5.1, pptxgenjs 4.0.1, crawlee 3.17.0.
- Root `CLAUDE.md` + `.planning/PROJECT.md` — Playwright Docker pinning, shm/`--ipc`, sample-not-all-500, web/worker boundary, v1.2 scope, exports on-demand in Node route.
- W3C/WAI heading structure, llms.txt spec — heading a11y rules, Markdown-for-LLM format.
- Playwright Docker docs, @react-pdf/renderer + pptxgenjs project docs.

### Secondary (MEDIUM confidence)
- Screaming Frog JS-rendering / "Show Differences" / JS Word Count; Prerender JS-SEO auditing — CSR/SSR detection conventions.
- Canonical issue taxonomy (chains/→redirect/→noindex, top-5 GSC issue) — seranking / atroposdigital.
- SEO audit deck structure (7–12 slides) — practitioner consensus.
- Playwright/Chromium container memory profile + headless detection; PDFKit WinAnsi core-font i18n limitation — ecosystem-standard, version-sensitive.

### Tertiary (LOW confidence)
- None — all findings grounded in repo code, live npm, or official/W3C sources.

---
*Research completed: 2026-07-06*
*Ready for roadmap: yes*
