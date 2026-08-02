---
phase: 30
slug: checks-de-meta-tags-social
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-01
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | — (extractor: reads `property` and `name`, normalizes, groups into arrays) | — | N/A | unit | `pnpm --filter @auditor/meta-social test` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | SOCIAL-08 (charset within the first 1024 real bytes, multibyte-safe) | — | N/A | unit | `pnpm --filter @auditor/meta-social test` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | SOCIAL-01 (og:title missing / 10-60 / out of range) | — | N/A | unit | `pnpm --filter @auditor/checks test` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | SOCIAL-02 (og:description missing / 55-200 / out of range) | — | N/A | unit | `pnpm --filter @auditor/checks test` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | SOCIAL-03 (og:image missing / relative / protocol-relative / http on https site / absolute OK) | T-30-01 | Reject relative and non-HTTPS `og:image` URLs; never fetch the URL in this phase | unit | `pnpm --filter @auditor/checks test` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | SOCIAL-04 (og:url missing / differs from canonical / coherent) | — | N/A | unit | `pnpm --filter @auditor/checks test` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | SOCIAL-05 (og:type missing / present) | — | N/A | unit | `pnpm --filter @auditor/checks test` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | SOCIAL-06 (duplicate same value = no issue / differing values = issue / `property`+`name` cross case) | — | N/A | unit | `pnpm --filter @auditor/checks test` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | SOCIAL-07 (twitter:card missing / invalid / valid; `twitter:image` missing with `og:image` present is NOT an issue) | — | N/A | unit | `pnpm --filter @auditor/checks test` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | SOCIAL-08 (check-level: emits issue when the extractor reports charset absent or past byte 1024) | — | N/A | unit | `pnpm --filter @auditor/checks test` | ❌ W0 | ⬜ pending |
| TBD | 03 | 3 | Success Criterion #5 — zero fingerprint collision with retired `ONPAGE-05` on a page with the 4 basic OG tags, with a synthetic detection self-test | — | N/A | integration | `pnpm --filter @auditor/checks test` | ❌ W0 | ⬜ pending |
| TBD | 03 | 3 | Registry: the 8 `SOCIAL-*` checks present in `pageChecks`, no duplicate checkIds, `ONPAGE-05` still absent | — | N/A | integration | `pnpm --filter @auditor/checks test` | ✅ extend `registry.test.ts` | ⬜ pending |
| TBD | 03 | 3 | No checkId collision against the `@auditor/psi` catalog | — | N/A | integration | `pnpm --filter @auditor/checks test` (`checkIdCollision.test.ts`) | ✅ passes automatically once registered | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/meta-social/package.json` + `tsconfig.json` + `src/index.ts` — package scaffolding mirroring `packages/fingerprint` (no tests can land without it)
- [ ] `pnpm install` at the root to link `@auditor/meta-social` into `@auditor/checks` node_modules
- [ ] `packages/meta-social/src/__fixtures__/` — HTML fixtures for Yoast, RankMath, Shopify, Webflow, Next.js Metadata API, plus the contradictory `property`/`name` case (blocks SOCIAL-06 and SOCIAL-07 tests)
- [ ] `packages/checks/src/checks/social/index.ts` — initial barrel (`socialPageChecks: PageCheck[] = []`) so `registry.ts` compiles before the 8 checks exist

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Score-band calibration of the `social` category on a real site (research assumption A3: target band 60-80) | SOCIAL-01..08 (aggregate) | The target band is a research estimate, not a measurement; there is no automatable oracle for "is this catalog well calibrated" | Run a full audit against a real fixture site, read `model.scoresByCategory.social`, and confirm it does not saturate at 0 or 100. If any single check passes >95% across all fixture profiles, convert it to problem-rows-only. |
| `twitter:card` validity against X's own renderer | SOCIAL-07 | X retired the public Twitter Card Validator; no public validation API exists (REQUIREMENTS.md Out of Scope) | Verification is against fixtures and the published spec (`summary`, `summary_large_image`, `app`, `player`), not against an external validator. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, never `vitest --watch`)
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
