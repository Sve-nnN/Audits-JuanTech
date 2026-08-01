---
phase: 29
slug: scoring-categor-a-social-retiro-de-onpage-05
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-01
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 |
| **Config file** | none in `packages/scoring` / `packages/checks` (defaults); `vitest.config.ts` exists in `packages/export`, `packages/report-model`, `apps/web` |
| **Quick run command** | `pnpm --filter @auditor/scoring test` |
| **Full suite command** | `pnpm test --continue` (plus `pnpm typecheck --continue`) |
| **Estimated runtime** | ~150 ms scoping run; full suite ~13 test tasks |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter <touched-package> test` + `pnpm --filter <touched-package> typecheck`
- **After every plan wave:** Run `pnpm typecheck --continue` (only mechanism that catches the non-partial `Record<Category, …>` breakages) and `pnpm test --continue`
- **Before `/gsd-verify-work`:** Full suite must be green with `16 total` / `13 total` visible (not a cached `FULL TURBO` run)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (filled by plans) | — | — | SCORE-01 | — | N/A | unit | `pnpm --filter @auditor/scoring test` | ⚠️ extend | ⬜ pending |
| TBD (filled by plans) | — | — | SCORE-02 | — | N/A | unit | `pnpm --filter @auditor/scoring test` | ✅ / ❌ W0 | ⬜ pending |
| TBD (filled by plans) | — | — | SOCIAL-09 | — | N/A | unit + integration | `pnpm --filter @auditor/checks test` | ⚠️ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Extend `packages/scoring/src/overallScore.test.ts` — assert individual weight values (onpage .10, schema .05, social .10) + renormalization with no `social` data (SCORE-01/SCORE-02)
- [ ] Extend `packages/checks/src/registry.test.ts` — negative guardrail: no registered check has `checkId === "ONPAGE-05"`, and `runAllChecks` emits no such issue (SOCIAL-09)
- [ ] `CATEGORY_ORDER` exhaustiveness test in `packages/report-model` (covers the silent-drop failure mode in `build.ts`)
- [ ] `CATEGORY_ORDER` exhaustiveness test in `packages/export`
- [ ] `CATEGORY_ORDER` exhaustiveness test in `apps/web`
- [ ] No new framework to install; no new shared fixtures needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Version-cut note: pre-v1.6 audit scores are not directly comparable to post-v1.6 ones | SOCIAL-09 | Documentation assertion, not runtime behavior | Confirm the version-cut note exists in the agreed doc location and names both the weight rebalance and the ONPAGE-05 retirement |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
