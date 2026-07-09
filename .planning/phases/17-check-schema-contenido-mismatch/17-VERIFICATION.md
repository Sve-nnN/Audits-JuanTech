---
phase: 17-check-schema-contenido-mismatch
verified: 2026-07-09T10:20:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
---

# Phase 17: Check schema-contenido mismatch Verification Report

**Phase Goal:** El auditor advierte cuando una página declara datos estructurados de alto riesgo sin contenido visible correspondiente, evitando el riesgo de acción manual de Google.
**Verified:** 2026-07-09T10:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | El auditor detecta páginas con JSON-LD `FAQPage`, `HowTo`, `Product`+`AggregateRating` o `Review` sin contenido visible correspondiente en el HTML | ✓ VERIFIED | `packages/checks/src/checks/schema/contentMismatch.ts` implements `schemaContentMismatchCheck` (checkId `SD-06`), evaluating all 4 risky types via `faqSignals`/`howToSignals`/`RATING_VISIBLE_PATTERN`/`reviewSignal`. 13 TDD tests in `contentMismatch.test.ts` cover mismatch + match for each type; ran directly, all 13 pass (`vitest run src/checks/schema/contentMismatch.test.ts` → 13/13 passed). Registered in `schemaSiteChecks` (`packages/checks/src/checks/schema/index.ts:18`), which flows into `siteChecks` (`registry.ts:16`) → `runAllChecks`. |
| 2 | El hallazgo se reporta siempre con severidad `warning` (nunca `critical` automático) | ✓ VERIFIED | `severity: "warning"` hardcoded literal at `contentMismatch.ts:139`. `grep -c '"critical"' contentMismatch.ts` returns 0 (no critical literal anywhere in the file). Test 13 in the TDD suite asserts this across all fixtures; suite passes. |
| 3 | El check no marca como mismatch páginas confirmadas como renderizadas por JS (CSR) en la muestra CSR/SSR de v1.2, evitando falsos positivos | ✓ VERIFIED | `contentMismatch.ts:131` — `if (renderVerdictByPageId?.[page.id] === "csr") continue;` suppresses only on explicit `"csr"`. `RenderIssueDraft.verdict` (packages/render/src/types.ts) is populated on all 3 branches (ssr/csr/undetermined) in `packages/render/src/detect.ts` (verified via `grep -c "verdict:"` = 4 occurrences, including the fingerprint helper). Worker (`apps/worker/src/index.ts`) builds `renderVerdictByPageId` from `renderIssues` (lines 371-374) and passes it into `runAllChecks` (line 383), with `runRenderSample` (byte offset 13042) confirmed executing before `runAllChecks` (byte offset 13796). |
| 4 (SCHEMA-06 req) | Requirement SCHEMA-06 satisfied | ✓ VERIFIED | Same evidence as Truth 1. |
| 5 (SCHEMA-07 req) | Requirement SCHEMA-07 satisfied (severity + CSR cross-check) | ✓ VERIFIED | Same evidence as Truths 2 and 3. |
| 6 | Pipeline resilience — audit still reaches `status: done` if render sample fails entirely | ✓ VERIFIED | `apps/worker/src/index.ts:350-365` — `runRenderSample` call wrapped in try/catch, degrading `renderIssues = []` on error (unchanged behavior from Phase 12, only relocated). `renderVerdictByPageId` build loop iterates an empty array harmlessly if the sample fails, so `runAllChecks` still receives a valid (empty) options field and SD-06 evaluates all pages normally. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/checks/src/checks/schema/contentMismatch.ts` | SD-06 check, exports `schemaContentMismatchCheck` | ✓ VERIFIED | Exists, exports correctly, full implementation matches plan spec (signals extraction, threshold matching, rating pattern, CSR suppression). |
| `packages/checks/src/checks/schema/contentMismatch.test.ts` | 13 TDD cases | ✓ VERIFIED | 13 `it()` blocks confirmed via grep, all 13 pass when run in isolation. |
| `packages/checks/src/types.ts` | `RenderVerdictValue` local type + `SiteCheckCtx.renderVerdictByPageId` | ✓ VERIFIED | Both present (lines 13, 66). |
| `packages/checks/src/registry.ts` | `RunAllChecksOptions.renderVerdictByPageId` + siteCtx assembly | ✓ VERIFIED | Present at lines 29 (field) and 59 (siteCtx assembly), destructured at line 44. |
| `packages/checks/src/checks/schema/index.ts` | `schemaContentMismatchCheck` registered in `schemaSiteChecks` | ✓ VERIFIED | Imported and included in the array and named exports. |
| `packages/render/src/types.ts` | `RenderIssueDraft.verdict: RenderVerdict` | ✓ VERIFIED | Field present with doc comment. |
| `packages/render/src/detect.ts` | `verdict` populated on ssr/csr/undetermined branches | ✓ VERIFIED | 3 occurrences of `verdict: "..."` literal (csr, ssr, undetermined) confirmed via grep. |
| `apps/worker/src/index.ts` | `runRenderSample` before `runAllChecks`, `renderVerdictByPageId` threaded through | ✓ VERIFIED | Byte-offset ordering check confirms `runRenderSample` (13042) precedes `runAllChecks` (13796); `renderVerdictByPageId` appears 4 times (declaration, population loop, field pass-through). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `contentMismatch.ts` | `extract.ts` | `extractJsonLdBlocks`/`flattenNodes`/`typesOf`/`hasProp` | ✓ WIRED | All 4 functions imported and used (line 4, used throughout). |
| `registry.ts` | `checks/schema/index.ts` | `schemaSiteChecks` array | ✓ WIRED | `schemaSiteChecks` spread into `siteChecks` (registry.ts:16), which is iterated in `runAllChecks`. |
| `apps/worker/src/index.ts` | `packages/checks` (`runAllChecks`) | `RunAllChecksOptions.renderVerdictByPageId` | ✓ WIRED | `renderVerdictByPageId` passed as a field in the `runAllChecks({...})` call (worker/src/index.ts:383). |
| `packages/render/src/detect.ts` | `packages/render/src/types.ts` | `RenderIssueDraft.verdict` | ✓ WIRED | `verdict:` literal set on all 3 return branches, matching the `RenderIssueDraft` interface shape. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `schemaContentMismatchCheck` | `renderVerdictByPageId` | Worker builds it from `runRenderSample()` output (real Playwright-derived CSR/SSR/undetermined verdicts per page, not static/hardcoded) | Yes | ✓ FLOWING |
| `schemaContentMismatchCheck` | `mismatched` issue set | Derived from real per-page JSON-LD extraction (`extractJsonLdBlocks`) and real visible-text extraction (`extractVisibleText`) against actual crawled `page.html` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SD-06 TDD suite (13 cases) | `pnpm --filter @auditor/checks exec vitest run src/checks/schema/contentMismatch.test.ts` | 13/13 passed | ✓ PASS |
| Full `@auditor/checks` suite (no regressions) | `pnpm --filter @auditor/checks test` | 21 files, 100/100 tests passed | ✓ PASS |
| `@auditor/checks` typecheck | `pnpm --filter @auditor/checks typecheck` | exit 0 | ✓ PASS |
| `@auditor/render` suite | `pnpm --filter @auditor/render test` | 2 files, 16/16 tests passed | ✓ PASS |
| `@auditor/render` typecheck | `pnpm --filter @auditor/render typecheck` | exit 0 | ✓ PASS |
| `@auditor/worker` typecheck | `pnpm --filter @auditor/worker typecheck` | exit 0 | ✓ PASS |
| Web/Playwright boundary assertion | `pnpm assert:web-boundary` | PASS: Playwright stays out of the @auditor/web bundle | ✓ PASS |
| Pipeline order (runRenderSample before runAllChecks) | `node -e "...indexOf checks..."` | runRenderSample@13042 < runAllChecks@13796 | ✓ PASS |
| No `@auditor/render` dependency leak into `@auditor/checks` | `grep -c '"@auditor/render"' packages/checks/package.json` | 0 | ✓ PASS |
| Severity never `"critical"` in SD-06 impl | `grep -c '"critical"' contentMismatch.ts` | 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| SCHEMA-06 | 17-01-PLAN.md | Detecta JSON-LD FAQPage/HowTo/Product+AggregateRating/Review sin contenido visible | ✓ SATISFIED | `schemaContentMismatchCheck` implementation + 13 passing tests. |
| SCHEMA-07 | 17-01-PLAN.md, 17-02-PLAN.md | Severidad warning por defecto (nunca critical) + cruce con muestra CSR/SSR v1.2 | ✓ SATISFIED | Hardcoded `"warning"` literal + `renderVerdictByPageId` CSR-suppression wiring confirmed end-to-end (render → worker → checks). |

No orphaned requirements — both IDs declared in plan frontmatter match REQUIREMENTS.md and both are marked `[x]` complete there.

### Anti-Patterns Found

None. Scanned all 7 modified/created files (`contentMismatch.ts`, `contentMismatch.test.ts`, `types.ts`, `registry.ts`, `render/types.ts`, `render/detect.ts`, `worker/index.ts`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and stub-return patterns — zero matches.

### Human Verification Required

None. This phase is a backend heuristic detection check with deterministic, fully-testable behavior (no UI/visual component, no external service integration beyond the already-existing Playwright render sample from Phase 12). All observable truths are verifiable via code inspection and automated test execution.

### Gaps Summary

None. Both plans (17-01, 17-02) were verified against the actual codebase, not just SUMMARY.md claims:
- SD-06 check exists, is substantive (full 4-type detection logic, not a stub), and is wired into `schemaSiteChecks` → `siteChecks` → `runAllChecks`.
- Severity is a hardcoded literal, confirmed via grep absence of `"critical"`.
- CSR suppression is wired end-to-end: `RenderIssueDraft.verdict` populated in `packages/render`, worker builds `renderVerdictByPageId` from real render-sample output, worker pipeline order confirmed (render sample before checks), and `runAllChecks` receives the real map (not a static/empty stub).
- All 3 roadmap Success Criteria and both requirement IDs (SCHEMA-06, SCHEMA-07) verified with direct evidence, independent test runs (not relying on SUMMARY.md's reported test counts), and typecheck/boundary-assertion command execution.
- Git commits for both plans (186638c, 37d158e, e37d617, 42c72c0, 10f900e) confirmed present in `git log`.

---

_Verified: 2026-07-09T10:20:00Z_
_Verifier: Claude (gsd-verifier)_
