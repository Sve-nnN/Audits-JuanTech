---
phase: 30
slug: checks-de-meta-tags-social
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-01
updated: 2026-08-02
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.9 |
| **Config file** | none — packages run `vitest run` with defaults (verified in `fingerprint`, `cms-adapters`, `checks`) |
| **Quick run command** | `pnpm --filter @auditor/meta-social test && pnpm --filter @auditor/checks test` |
| **Full suite command** | `pnpm test` (turbo, all packages) |
| **Estimated runtime** | ~3 seconds (baseline `@auditor/checks`: 28 files / 152 tests / 2.12s, measured 2026-08-01) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @auditor/meta-social test && pnpm --filter @auditor/checks test`
- **After every plan wave:** Run `pnpm typecheck && pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green, plus `pnpm assert:web-boundary`
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

Rows follow the real 6-plan decomposition on disk. Each plan is its own wave and depends on the previous one, except `30-06`, which depends on `30-02`..`30-05`. Threat IDs are scoped per plan (`T-30-01` in `30-01` is the extractor accumulator; `T-30-01` in `30-04` is the duplicate-grouping map) — always read them against the plan named in the row.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 30-01 T1 | 01 | 1 | D-1 — checkId/fingerprint format decision (blocking human checkpoint) | — | N/A | checkpoint | `grep -c 'option-a\|option-b' .planning/phases/30-checks-de-meta-tags-social/30-01-SUMMARY.md` | ❌ written by this task, first side effect | ⬜ pending |
| 30-01 T2 | 01 | 1 | SOCIAL-01 (og:title missing / 10-60 / out of range) + pure-engine scaffold (`extractMetaSocial`, `firstValue`, `types.ts`, `thresholds.ts`) + registry wiring | T-30-01 (prototype-safe accumulator), T-30-SC | Accumulate site-controlled meta keys in a `Map`, never an object literal; zero new registry packages (lockfile diff shows only the workspace importer) | integration (end-to-end via `runAllChecks`) | `pnpm install && pnpm --filter @auditor/meta-social typecheck && pnpm --filter @auditor/checks test` | ❌ W0 — this task creates the Wave 0 scaffolding | ⬜ pending |
| 30-01 T3 | 01 | 1 | SOCIAL-01 unit coverage + Pitfall 1 regression (`property`/`name`) + stable-fingerprint contract | T-30-01 | Hostile prototype key lands as an ordinary `Map` entry and `Object.prototype` gains no properties | unit + mutation teeth test (reverted, `git diff` clean) | `pnpm --filter @auditor/meta-social test && pnpm --filter @auditor/checks test` | ❌ W0 | ⬜ pending |
| 30-01 T4 | 01 | 1 | Phase gate — reasoned "no external API integration" declaration | — | N/A | file assertion | `test -f .planning/phases/30-checks-de-meta-tags-social/COVERAGE.md && grep -qE '^No external API integration: .+' .planning/phases/30-checks-de-meta-tags-social/COVERAGE.md` | ❌ W0 | ⬜ pending |
| 30-02 T1 | 02 | 2 | SOCIAL-02 (og:description missing / 55-200 / out of range) | T-30-07 (accept), T-30-SC | Length read is constant cost on an already-bounded value | unit | `pnpm --filter @auditor/meta-social test && pnpm --filter @auditor/checks test` | ❌ W0 | ⬜ pending |
| 30-02 T2 | 02 | 2 | SOCIAL-05 (og:type present / absent, presence only) | T-30-06 (site-controlled value into `measuredValue`) | Truncate the site-controlled value to `MAX_MEASURED_VALUE_CHARS` before persisting it | unit | `pnpm --filter @auditor/meta-social test && pnpm --filter @auditor/checks test` | ❌ W0 | ⬜ pending |
| 30-03 T1 | 03 | 3 | SOCIAL-03 (og:image missing / relative / protocol-relative / insecure / absolute HTTPS OK) | T-30-02 (dangerous URL schemes), T-30-06 (SSRF), T-30-07 | Reject relative and non-HTTPS `og:image` through `normalizeUrl`; never fetch the URL in this phase (network validation is Phase 31) | unit | `pnpm --filter @auditor/meta-social test && pnpm --filter @auditor/checks test` | ❌ W0 | ⬜ pending |
| 30-03 T2 | 03 | 3 | SOCIAL-04 (og:url missing / differs from canonical / coherent) | T-30-02, T-30-07 | Canonical is re-read from the already-loaded query object, never fetched; dangerous schemes neutralized before persisting | unit | `pnpm --filter @auditor/meta-social test && pnpm --filter @auditor/checks test` | ❌ W0 | ⬜ pending |
| 30-03 T3 | 03 | 3 | Wave close — teeth test of the two costliest regressions of the plan | — | Mutation is reverted in the same step; task closes with a clean `git diff` | mutation + full suite | `pnpm typecheck && pnpm test` | ❌ W0 | ⬜ pending |
| 30-04 T1 | 04 | 4 | SOCIAL-06 (duplicate OG same value = no issue / differing values = issue / `property`+`name` cross case) | T-30-01 (grouping map), T-30-SC | Group on a `Map`, never an object literal, since duplicate keys are site-controlled | unit | `pnpm --filter @auditor/checks test` | ❌ W0 | ⬜ pending |
| 30-04 T2 | 04 | 4 | SOCIAL-07 (twitter:card missing / invalid / valid; `twitter:image` absent with `og:image` present is NOT an issue) | T-30-05, T-30-06 (arbitrary-length card value) | Truncate the card value before it reaches `measuredValue`; up to 500 rows per audit | unit | `pnpm --filter @auditor/meta-social test && pnpm --filter @auditor/checks test` | ❌ W0 | ⬜ pending |
| 30-04 T3 | 04 | 4 | Wave close — teeth test of the two business rules | — | Mutation reverted in the same step, clean `git diff` at close | mutation + full suite | `pnpm typecheck && pnpm test` | ❌ W0 | ⬜ pending |
| 30-05 T1 | 05 | 5 | SOCIAL-08 engine — `hasCharsetInFirstKB` over real bytes, multibyte-safe (`CHARSET_WINDOW_BYTES`) | T-30-03 (regex over adversarial minified HTML) | Bounded window and a non-backtracking pattern; encode to bytes before measuring, never count string units | unit | `pnpm --filter @auditor/meta-social test && pnpm --filter @auditor/meta-social typecheck` | ❌ W0 | ⬜ pending |
| 30-05 T2 | 05 | 5 | SOCIAL-08 check — emits the issue when the engine reports charset absent or past byte 1024 | T-30-05, T-30-SC | Header-declared charset limitation stated in the `criterion`, so the check never claims more than it measured | unit | `pnpm --filter @auditor/meta-social test && pnpm --filter @auditor/checks test` | ❌ W0 | ⬜ pending |
| 30-06 T1 | 06 | 6 | **Success Criterion #5** — zero fingerprint collision with retired `ONPAGE-05` on a page carrying the 4 basic OG tags, with a synthetic detection self-test | T-30-09 (a guardrail that cannot fail), T-30-10 | Detection capability is proven with synthetic data inside the test via `findDuplicateFingerprints`; production source is never mutated for this artifact | integration | `pnpm --filter @auditor/checks test` | ❌ W0 | ⬜ pending |
| 30-06 T2 | 06 | 6 | Registry — the 8 `SOCIAL-*` checkIds present in `pageChecks`, no duplicate checkIds, `ONPAGE-05` still absent, end-to-end reachability | T-30-09 | Existing registry cases are only extended, never rewritten or relaxed | integration | `pnpm --filter @auditor/checks test src/registry.test.ts` | ✅ extend `registry.test.ts` | ⬜ pending |
| 30-06 T3 | 06 | 6 | Emitter-profile fixtures + measured score-band calibration + phase close gate | T-30-10 (catalog edit at phase end), T-30-11 (real client HTML in fixtures), T-30-12 | Calibration remediation is never applied on the fly — execution stops and returns the decision to planning; all six fixtures use example-space hosts and invented text | integration + full suite | `pnpm typecheck && pnpm test && pnpm assert:web-boundary` | ❌ W0 | ⬜ pending |
| (inherited) | 06 | 6 | No checkId collision against the `@auditor/psi` catalog | — | N/A | integration | `pnpm --filter @auditor/checks test` (`checkIdCollision.test.ts`) | ✅ passes automatically once the 8 checks are registered | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity:** every task in all six plans carries an `<automated>` block. Longest run without an automated command: zero tasks. No watch-mode flags anywhere — `vitest run` throughout, via `pnpm --filter ... test`.

---

## Wave 0 Requirements

Wave 0 is not a separate wave in this phase: every scaffolding item below is created by `30-01` (the tracer, wave 1) before any test that depends on it exists, which is precisely what the tracer-first ordering buys. Each item is mapped to the task that creates it, so there is no unplanned Wave 0 gap.

- [x] `packages/meta-social/package.json` + `tsconfig.json` + `src/index.ts` — package scaffolding mirroring `packages/fingerprint` → **30-01 Tarea 2, steps 1 and 5** (mechanical copy, no design decisions)
- [x] `pnpm install` at the root to link `@auditor/meta-social` into `@auditor/checks` node_modules → **30-01 Tarea 2, step 6**, asserted with `test -L packages/checks/node_modules/@auditor/meta-social`
- [x] `packages/checks/src/checks/social/index.ts` — category barrel, created already populated with `ogTitleCheck` so `registry.ts` compiles in the same commit → **30-01 Tarea 2, step 8**. An empty-array placeholder is not needed: the tracer registers its check in the same task that creates the barrel.
- [x] `packages/meta-social/src/__fixtures__/` — the two fixtures the phase needs first (`yoast.html`, contradictory `mixed-property-name.html`) → **30-01 Tarea 3, steps 1 and 2**. The remaining four emitter profiles (RankMath, Shopify, Webflow, Next.js Metadata API) are only required by the calibration run and are created in **30-06 Tarea 3**, not before.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Score-band calibration of the `social` category on a real site (research assumption A3: target band 60-80) | SOCIAL-01..08 (aggregate), executed in 30-06 Tarea 3 | The target band is a research estimate, not a measurement; there is no automatable oracle for "is this catalog well calibrated" | Run a full audit against a real fixture site, read `model.scoresByCategory.social`, and confirm it does not saturate at 0 or 100. If any single check passes >95% across all fixture profiles, do NOT strip its `ok` row on the fly: stop execution and return the decision to planning (30-06 prohibition, threat T-30-10), because that remediation contradicts an acceptance criterion already written in a sibling plan of the same phase. |
| `twitter:card` validity against X's own renderer | SOCIAL-07 (30-04 Tarea 2) | X retired the public Twitter Card Validator; no public validation API exists (REQUIREMENTS.md Out of Scope) | Verification is against fixtures and the published spec (`summary`, `summary_large_image`, `app`, `player`), not against an external validator. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — 17 tasks across 6 plans, all covered
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — zero tasks without one
- [x] Wave 0 covers all MISSING references — all scaffolding mapped to 30-01 wave 1, remaining fixtures to 30-06 wave 6
- [x] No watch-mode flags (`vitest run`, never `vitest --watch`)
- [x] Feedback latency < 10s — measured baseline 2.12s for `@auditor/checks`, quick-run pair well inside the budget
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** signed 2026-08-02 — validation strategy rewritten against the real 6-plan / 6-wave decomposition (30-01 w1 SOCIAL-01 + engine scaffold; 30-02 w2 SOCIAL-02 + SOCIAL-05; 30-03 w3 SOCIAL-03 + SOCIAL-04; 30-04 w4 SOCIAL-06 + SOCIAL-07; 30-05 w5 SOCIAL-08 + charset engine; 30-06 w6 guardrail, registry and calibration).
