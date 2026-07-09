---
phase: 18-diagnosticos-de-lighthouse-desde-psi
verified: 2026-07-09T10:45:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
---

# Phase 18: Diagnósticos de Lighthouse desde PSI — Verification Report

**Phase Goal:** El reporte muestra diagnósticos de Lighthouse accionables (formatos de imagen, CSS/JS sin usar, render-blocking) sin costo extra de API.
**Verified:** 2026-07-09T10:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria + Plan must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | El reporte muestra diagnósticos curados (WebP/AVIF, CSS sin usar, render-blocking, compresión de texto, CSS/JS sin minificar) extraídos de la respuesta PSI ya obtenida, sin llamadas adicionales a la API | ✓ VERIFIED | `packages/psi/src/parser.ts:83-100` `extractDiagnostics()` reads the 6 audit IDs from the already-parsed `raw.lighthouseResult.audits` object (same `raw` param used by `parsePsiResponse`). `client.ts:59-61` calls `extractDiagnostics(json)` on the exact same `json` object already fetched by `res.json()` — no second `fetch`/`await res.json()` call exists in the success path. |
| 2 | Cada diagnóstico aparece como issue con severidad `warning`/`ok` (nunca `critical`) y no duplica señal de LCP/CLS/TTFB/INP | ✓ VERIFIED | `issues.ts:280-282` `gradeDiagnostic()` returns only `"ok"` \| `"warning"` (return type is `PerfIssueSeverity` but function body only ever returns those two literals). `mapDiagnosticIssues` (line 292-326) computes severity via `severities.includes("warning") ? "warning" : "ok"` — no path assigns `"critical"`. DIAGNOSTIC_SPECS covers 5 distinct Lighthouse audit IDs (`modern-image-formats`, `unused-css-rules`, `render-blocking-resources`, `uses-text-compression`, `unminified-css`+`unminified-javascript` combined) — none overlap with LCP/CLS/TTFB/INP (METRIC_SPECS in the same file, checkIds PERF-01/02-*). |
| 3 | extractDiagnostics lee los 6 audit IDs sin llamadas extra a la API | ✓ VERIFIED | `DIAGNOSTIC_AUDIT_IDS` map in parser.ts:67-74 lists all 6 IDs; `extractDiagnostics` iterates them reading from the same `audits` object. |
| 4 | mapDiagnosticIssues produce exactamente 5 checkIds nuevos (PERF-05..PERF-09), combinando unminified-css+js | ✓ VERIFIED | `DIAGNOSTIC_SPECS` array (issues.ts:229-277) has exactly 5 entries: PERF-05, PERF-06, PERF-07, PERF-08, PERF-09. PERF-09's `pick` (lines 268-275) combines `unminifiedCss`/`unminifiedJavascript`, picking the worse (lower) score. |
| 5 | Un audit ausente no genera issue para ese diagnóstico (degradación silenciosa) | ✓ VERIFIED | `mapDiagnosticIssues` line 299: `if (mobilePick === null && desktopPick === null) continue;` — skips without exception. `extractDiagnostics` line 92: `if (audit === undefined) continue;` — key simply omitted. |
| 6 | Una entrada PsiMetrics cacheada en Redis antes de esta fase (sin `diagnostics`) se sigue leyendo sin excepción | ✓ VERIFIED | `types.ts:25` `diagnostics?: PsiDiagnostics` is optional. `cache.test.ts:57-71` regression test writes a legacy JSON blob (no `diagnostics` key) directly into `FakeRedis`, then asserts `getCached()` returns non-null and `result?.diagnostics` is `undefined` without throwing. Test passes (see below). |
| 7 | El worker persiste issues PERF-05..PERF-09 en la misma pasada que PERF-01/02-*, sin llamadas PSI adicionales | ✓ VERIFIED | `apps/worker/src/index.ts:218-224` calls `mapDiagnosticIssues({...})` immediately after `mapPerfIssues({...})` (lines 210-216) inside `runOnePage`, pushing into the same `issues` array. That array becomes `perfIssues` (line 403-408) which flows into `issueRowsWithoutDiff` (line 425+) → `Issue.createMany` (line 501). No additional `runPsi(` call was introduced (only 1 call site exists in the file, inside the existing cache-miss branch at line 180). |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/psi/src/types.ts` | `PsiDiagnosticAudit`, `PsiDiagnostics`, optional `PsiMetrics.diagnostics` | ✓ VERIFIED | Present, lines 25, 29-32, 39-46. |
| `packages/psi/src/parser.ts` | `extractDiagnostics(raw)`, separate from `parsePsiResponse` | ✓ VERIFIED | `parsePsiResponse` unchanged in signature/output (line 47-64); `extractDiagnostics` added separately (line 83-100). |
| `packages/psi/src/issues.ts` | `DIAGNOSTIC_SPECS` + `mapDiagnosticIssues()` | ✓ VERIFIED | Lines 211-326. |
| `packages/psi/src/index.ts` | Public exports of all of the above | ✓ VERIFIED | Lines 1-19: `PsiDiagnostics`, `PsiDiagnosticAudit`, `extractDiagnostics`, `mapDiagnosticIssues` all exported, no existing exports removed. |
| `packages/psi/src/client.ts` | `runPsi()` attaches `diagnostics` via `extractDiagnostics(json)` | ✓ VERIFIED | Line 60: `const metrics = { ...parsePsiResponse(json), diagnostics: extractDiagnostics(json) };` |
| `apps/worker/src/index.ts` | `runOnePage` calls `mapDiagnosticIssues` alongside `mapPerfIssues` | ✓ VERIFIED | Lines 218-224. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `issues.ts` | `types.ts` | `mapDiagnosticIssues` reads `metrics.diagnostics` | ✓ WIRED | `pickAudit(m.diagnostics?....)` calls throughout `DIAGNOSTIC_SPECS.pick` functions. |
| `index.ts` | `parser.ts` | re-export of `extractDiagnostics` | ✓ WIRED | `index.ts:9`. |
| `client.ts` | `parser.ts` | `extractDiagnostics(json)` on the same parsed response | ✓ WIRED | `client.ts:1,60` — same `json` variable used for both `parsePsiResponse` and `extractDiagnostics`, no second fetch. |
| `apps/worker/src/index.ts` | `issues.ts` | `mapDiagnosticIssues({url, pageId, mobile, desktop})` inside `runOnePage` | ✓ WIRED | `apps/worker/src/index.ts:218-224`; result flows into `issues` → `perfIssues` → `issueRowsWithoutDiff` → `Issue.createMany` (lines 403-501). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `apps/worker/src/index.ts` `runOnePage` | `perPageMetrics.mobile/desktop` (incl. `.diagnostics`) | `runPsi()` live call or `getCached()` — both populate `PsiMetrics` including `diagnostics` field (client.ts:60; cache stores/returns whatever was set, including `diagnostics`) | Yes — real Lighthouse scores from PSI API response, not static/hardcoded | ✓ FLOWING |
| Report UI (`apps/web/app/audits/[id]/page.tsx`, `.../pages/[pageId]/page.tsx`) | `issue.checkId`/`issue.category` rendered generically via `IssueTypeGroup`/`CategoryAccordion` | Reads `Issue` rows from Postgres (persisted by worker `Issue.createMany`) | No hardcoded `PERF-0x` filter/exclusion found in `apps/web` source (`grep -rn "PERF-0" apps/web/app` returns empty) — generic rendering means PERF-05..09 display automatically once persisted | ✓ FLOWING (generic path, no special-casing needed or found) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full `@auditor/psi` test suite passes | `pnpm --filter @auditor/psi test` | 6 test files, 45 tests passed | ✓ PASS |
| `@auditor/psi` typecheck | `pnpm --filter @auditor/psi typecheck` | No errors | ✓ PASS |
| `@auditor/worker` typecheck | `pnpm --filter @auditor/worker typecheck` | No errors | ✓ PASS |
| Cache regression: pre-v1.3 entry (no `diagnostics`) reads without throwing | Included in `pnpm --filter @auditor/psi test` (cache.test.ts:57-71) | Passed as part of the 45 | ✓ PASS |
| No new `runPsi(` call introduced in worker | `grep -c "runPsi(" apps/worker/src/index.ts` | 1 occurrence (unchanged single call site) | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist in this repo and neither PLAN nor SUMMARY reference probe scripts. Step 7c: SKIPPED (no probes declared for this phase; verification relies on the vitest suite + typecheck, which are the phase's own automated verification gates per PLAN `<verify>` blocks).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| PERF-05 | 18-01, 18-02 | El auditor extrae de la respuesta PSI ya pagada (sin llamadas extra) los diagnósticos: formatos de imagen modernos, CSS sin usar, render-blocking, compresión de texto, CSS/JS sin minificar | ✓ SATISFIED | `extractDiagnostics` (parser.ts) + `runPsi` wiring (client.ts:60), no extra fetch. |
| PERF-06 | 18-01, 18-02 | Cada diagnóstico se reporta como issue nuevo (PERF-0x) con severidad warning/ok (nunca critical), sin duplicar LCP/CLS/TTFB/INP | ✓ SATISFIED | `mapDiagnosticIssues` (issues.ts:292-326), `gradeDiagnostic` never returns "critical", distinct checkIds from METRIC_SPECS. |

No orphaned requirements: REQUIREMENTS.md maps only PERF-05/PERF-06 to Phase 18, both are declared in both plans' `requirements` frontmatter field and satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found (no TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER, no stub returns, no hardcoded empty issue arrays) | — | No blockers |

Note: `grep -A200 'DIAGNOSTIC_SPECS' issues.ts \| grep -c '"critical"'` returns 2, but both matches are descriptive code comments (lines 279, 288: `/** never "critical" ... */`), not actual severity assignments — confirmed by reading `mapDiagnosticIssues` logic directly, which only ever returns `"ok"`/`"warning"`.

### Human Verification Required

None. All must-haves are verifiable via code inspection, automated test suite, and typecheck — no visual/UX/real-time behavior claims in this phase's scope (pure backend logic + worker persistence, no new UI components).

### Gaps Summary

No gaps found. Both plans (18-01 pure logic, 18-02 end-to-end wiring) were executed as specified, all must-haves from PLAN frontmatter and ROADMAP success criteria are verified against actual code (not just SUMMARY claims), the full test suite (45 tests) passes, both packages typecheck cleanly, and the data flow traces cleanly from PSI response → `runPsi` → worker → `Issue.createMany` → generic report UI rendering (no special-casing needed since the UI renders issues generically by category/checkId).

---

_Verified: 2026-07-09T10:45:00Z_
_Verifier: Claude (gsd-verifier)_
