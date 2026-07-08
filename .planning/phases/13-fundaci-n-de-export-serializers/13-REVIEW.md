---
phase: 13-fundaci-n-de-export-serializers
reviewed: 2026-07-08T00:00:00Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - packages/report-model/src/build.ts
  - packages/report-model/src/model.ts
  - packages/report-model/src/index.ts
  - packages/report-model/src/build.test.ts
  - packages/export/src/priority.ts
  - packages/export/src/markdown.ts
  - packages/export/src/pptx.ts
  - packages/export/src/pdf.tsx
  - packages/export/src/labels.ts
  - packages/export/src/no-pii.test.ts
  - apps/web/app/api/audits/[id]/export/route.ts
  - scripts/assert-no-playwright-in-web.mjs
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: findings
---

# Phase 13: Code Review Report

**Reviewed:** 2026-07-08
**Depth:** deep
**Files Reviewed:** 12
**Status:** findings

## Summary

Reviewed the export foundation: the new `@auditor/report-model` package
(`buildReportModel`), the `page.tsx` refactor, the three serializers in
`@auditor/export` (Markdown/PPTX/PDF), the export API route, and the extended
Playwright/Chromium boundary guardrail. The six design-critical properties all
hold up under tracing:

1. **No PII leak (verified).** `buildReportModel` fetches the full `Audit` row
   (which carries the `emailId` FK) but maps only a fixed whitelist
   (`domain/createdAt/finishedAt/urlLimit/status`) into the model; the `email`
   relation is never `include`d, so the email string is never even loaded. `Issue`
   rows go through `toReportIssue`, another whitelist, and `Issue`/`Page` carry no
   PII columns anyway. The route returns only the model. Output is clean in MD,
   PPTX, PDF, and the route body.
2. **top-N "M" correctness (verified).** All three serializers call
   `prioritizeIssues(model.priorityCandidates)` — the full, untrimmed
   critical+warning set — so `total` == `totalPriorityCandidates` (true M), never
   the 60-row screen cap nor the ok-inclusive set. The "Mostrando N de M" note
   fires only when `total > EXPORT_TOP_N` (50).
3. **page.tsx parity (verified, no regression).** The inlined `issueUrl` in
   `build.ts` is byte-identical to `components/ui/url.ts`; severity sort weight,
   category order, resolved-issues assembly, `hasScores` semantics
   (`scores != null` == old `scores ?`), and the detail grouping all match. The
   old `take: 60` at the DB vs. new fetch-all-then-`slice(0,60)` yields the same
   first 60 rows under the identical `ORDER BY`.
4. **Route validation (verified).** `isFormat` rejects with 400 *before* any DB
   access; missing/not-done audits return 404 after. No auth by design (same
   free-tier visibility as the on-screen report).
5. **Fonts (verified).** Khand (400/600) registered for headings, Geist Sans
   (400) for body; both have full Latin coverage, hyphenation disabled so accents
   stay whole. No fallback to a Helvetica core font.

The findings below are quality/robustness issues, not correctness or security
defects. No blockers.

## Warnings

### WR-01: Boundary guardrail Check C/D misses `-core` and scoped browser packages

**File:** `scripts/assert-no-playwright-in-web.mjs:100-103, 117-131`
**Issue:** The regexes match only the exact tokens `playwright`, `puppeteer`,
and `chromium` followed by whitespace+digit (e.g. `puppeteer\s+\d`). The packages
that actually carry a Chromium download in the 2026 ecosystem are frequently
named differently: `puppeteer-core`, `playwright-core`, `@puppeteer/browsers`,
`@sparticuz/chromium`, `chrome-aws-lambda`. In `puppeteer-core 24.0.0` the token
is `puppeteer-core`, so `puppeteer\s+\d` never matches and the edge slips through.
Today nothing pulls these in (the serializers are pure JS and Check B still
catches `@auditor/render`), so this is not currently exploited — but the guardrail
advertises "no browser engine can reach the web bundle" and would give a false
PASS if a future dep dragged in `puppeteer-core` or `@sparticuz/chromium`.
**Fix:** Broaden the browser package list and relax the token boundary to catch
scoped/`-core` variants, e.g.:
```js
for (const browserPkg of [
  "puppeteer", "puppeteer-core", "@puppeteer/browsers",
  "chromium", "@sparticuz/chromium", "chrome-aws-lambda",
  "playwright-core",
]) {
  const why = run("pnpm", ["--filter", "@auditor/web", "why", browserPkg]);
  const esc = browserPkg.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const realEdges = why.stdout.split("\n").map((l) => l.trim())
    .filter((l) => new RegExp(`(^|[│├└─\\s])${esc}[@\\s]+\\d[\\w.-]*`).test(l))
    .filter((l) => !/\bpeer\s*$/.test(l));
  // ...
}
```

### WR-02: Export-package and route PII tests are tautological

**File:** `packages/export/src/no-pii.test.ts:19-63`, `apps/web/app/api/audits/[id]/export/route.test.ts:17-36`
**Issue:** Both suites declare `FIXTURE_EMAIL`/`FIXTURE_TOKEN` and assert the
output `not.toContain(...)`, but neither ever inserts those strings into the
`ReportModel` the serializer receives (`buildModel` has no email/token param; the
route mocks `buildReportModel` with a PII-free fixture). The assertion therefore
*cannot fail* — it proves only that two arbitrary literals are absent, not that
the pipeline excludes PII. The real coverage rests entirely on
`packages/report-model/src/build.test.ts:155-171`, which does exercise the
whitelist against an audit row carrying `emailId`. Even there the assertions are
weak: `expect(serialized).not.toMatch(/"email"/i)` would NOT catch a leaked
`"emailId"` key (no closing quote after `email`), and `not.toContain("@")` will
false-fail on legitimate audit data (a `mailto:` link or a URL with userinfo
found on the audited site is valid model content).
**Fix:** In the export/route tests, inject the PII into the *source object the
model is derived from* (or into an issue field) and assert it is stripped, so the
test has teeth. In `build.test.ts`, assert exclusion by key
(`expect(model).not.toHaveProperty("audit.emailId")` / check the serialized JSON
for `emailId`) and drop the `@` heuristic in favor of an explicit token match.

### WR-03: Export route has no error boundary around the serializers

**File:** `apps/web/app/api/audits/[id]/export/route.ts:78-93`
**Issue:** `toPdf`/`toPptx` run without a `try/catch`. A serializer failure
(font registration error, `@react-pdf/renderer` render throw, `pptxgenjs` write
failure) rejects the handler, yielding an unstructured 500 with no server-side
log line — hard to diagnose a stuck/failing export, and in dev the framework may
surface an internal stack in the response.
**Fix:** Wrap the serialization branch and return a controlled 500:
```ts
try {
  if (format === "md") body = toMarkdown(model);
  else if (format === "pdf") body = await toPdf(model);
  else body = await toPptx(model);
} catch (err) {
  console.error(`export ${format} failed for audit ${id}:`, err);
  return NextResponse.json({ error: "Export generation failed" }, { status: 500 });
}
```

## Info

### IN-01: `Content-Disposition` filename embeds the raw `id` path param unsanitized

**File:** `apps/web/app/api/audits/[id]/export/route.ts:73, 91`
**Issue:** `filename="auditoria-${slug}-${id}.${ext}"` interpolates the raw route
param inside the quoted header value. The domain is slugified, but `id` is not.
Practically low risk (the audit must exist, so `id` is a valid cuid before this
line runs), but a raw quote/CR/LF in a header value is a defense-in-depth smell.
**Fix:** Sanitize `id` for the header the same way the domain is slugified, e.g.
`id.replace(/[^a-zA-Z0-9_-]/g, "")`.

### IN-02: Audit row fetched twice per report render

**File:** `apps/web/app/audits/[id]/page.tsx:72-75` + `packages/report-model/src/build.ts:90-93`
**Issue:** `page.tsx` still does its own `prisma.audit.findUnique(... include site)`
for the header/not-done branch, then `buildReportModel` fetches the same audit
again. Same data, so no correctness issue — noted only. (Performance is out of v1
review scope; flagged as INFO for future consolidation, e.g. have the page read
the audit meta from the model it already builds.)

---

_Reviewed: 2026-07-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
