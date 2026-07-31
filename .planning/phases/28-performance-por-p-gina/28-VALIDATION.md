---
phase: 28
slug: performance-por-p-gina
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-31
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 |
| **Config file** | none — Vitest defaults; `*.test.ts` live beside the source in `packages/checks` and `packages/crawler` |
| **Quick run command** | `pnpm --filter @auditor/checks test && pnpm --filter @auditor/crawler test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~4 seconds (quick) |

Green baseline verified before any change: `@auditor/checks` 24 files / 121 tests, `@auditor/crawler` 4 files / 33 tests, `@auditor/scoring` 3 files / 25 tests.

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @auditor/checks test && pnpm --filter @auditor/crawler test`
- **After every plan wave:** Run `pnpm typecheck && pnpm test && pnpm assert:web-boundary`
- **Before `/gsd-verify-work`:** Full suite must be green AND both `checkpoint:human-verify` items (db:push, re-crawl smoke test) resolved
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(filled by /gsd-validate-phase once task IDs exist)_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/crawler/src/pageMetrics.ts` — pure helper extracting metric derivation out of `crawl.ts` (which has no tests today); same pattern as the existing `captureHeaders.ts`
- [ ] `packages/crawler/src/pageMetrics.test.ts` — covers PAGEPERF-01 and PAGEPERF-02
- [ ] `packages/checks/src/checks/perf/responseTime.test.ts` — covers PAGEPERF-03 threshold edges + null guard
- [ ] `packages/checks/src/checks/perf/htmlSize.test.ts` — covers PAGEPERF-03 threshold edges + KB formatting + null guard
- [ ] `packages/checks/src/checks/perf/checkIdCollision.test.ts` — guardrail against the `packages/psi` checkId/fingerprint collision
- [ ] `packages/checks/src/registry.test.ts` — no test asserts registry contents today; a half-registered check would pass unnoticed
- [ ] `packages/checks/src/testUtils.ts` → `makePage` must enumerate the new fields (it does not spread `overrides`)
- [ ] `apps/worker/scripts/verify-pageperf.mts` — manual verification against real data, modeled on `verify-stack.mts`

Framework install: not applicable, Vitest already present in both packages.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Schema columns exist in the live database | PAGEPERF-01, PAGEPERF-02 | `DATABASE_URL` points at `shared-postgres:5432` (Docker-internal); `pnpm db:push` fails with `P1001` from the dev environment | Run `pnpm db:push` from an environment with database network access, then confirm the columns exist |
| A real crawl persists non-null `responseMs`/`htmlBytes` | PAGEPERF-01, PAGEPERF-02 | Requires network + database | `pnpm --filter @auditor/worker exec tsx scripts/verify-pageperf.mts <auditId>` |
| Re-crawl of a previously audited site completes without timeouts or regressions | SC#3 | Requires network + database + a real site | `checkpoint:human-verify` — exact command specified in the plan |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
