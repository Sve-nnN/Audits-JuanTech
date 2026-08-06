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

Framework install: **not applicable** — Vitest is already present in both packages, so there is no wave-0 infrastructure task. What follows is the list of test artifacts that do **not** exist today and the exact task that creates each one. The order below is the real order in the plans, not an aspirational one; it is authoritative and `28-01`/`28-02`/`28-03` agree with it.

| Test artifact | Created in | Wave | Relative to the code it covers | Covers |
|---|---|---|---|---|
| `packages/checks/src/testUtils.ts` → `makePage` enumerating `responseMs`/`htmlBytes` | `28-01` Task 2, step 4 | 1 | **Before** any threshold test can pass (`makePage` does not spread `overrides`; without this every threshold test silently returns `[]`) | fixture prerequisite for PAGEPERF-03 |
| `packages/checks/src/checks/perf/responseTime.test.ts` | `28-01` Task 2, step 8 | 1 | **Same commit** as `responseTime.ts` | PAGEPERF-03 threshold edges + null guard + end-to-end `runAllChecks` |
| `packages/crawler/src/pageMetrics.test.ts` | `28-01` Task 3 | 1 | **One task after** `pageMetrics.ts` (see note below) | PAGEPERF-01, PAGEPERF-02 |
| `packages/checks/src/checks/perf/htmlSize.test.ts` | `28-02` Task 1 | 2 | **Same commit** as `htmlSize.ts` | PAGEPERF-03 threshold edges + KB rounding + null guard |
| `packages/checks/src/checks/perf/checkIdCollision.test.ts` | `28-02` Task 2 | 2 | **After** both checks exist — by construction: it compares the real registry catalog against the real `packages/psi` catalog, so it cannot be written before the checks it guards are registered | guardrail vs. the `packages/psi` checkId/fingerprint collision |
| `packages/checks/src/registry.test.ts` | `28-02` Task 2 | 2 | **After** both checks are registered — same reason: it asserts registry contents | guardrail vs. a half-registered check |
| `apps/worker/scripts/verify-pageperf.mts` | `28-03` Task 1 | 3 | **After** the schema and both checks exist | manual verification against real data, modeled on `verify-stack.mts` |

Non-test artifact tracked here because the tests depend on it: `packages/crawler/src/pageMetrics.ts` — pure helper extracting metric derivation out of `crawl.ts` (which has no tests today), same pattern as the existing `captureHeaders.ts`. Created in `28-01` Task 2, step 2.

**Note on `pageMetrics.ts` / `pageMetrics.test.ts` (the one gap between task and dedicated test).** The helper is created in `28-01` Task 2 and its dedicated unit test lands in `28-01` Task 3, one task later inside the same wave. It is not untested in the interim: Task 2's own `<automated>` verify exercises the helper end-to-end through the tracer slice (crawl wiring → persisted field → threshold check → `runAllChecks`), and `28-01` Task 2 has a mandatory mid-task gate (`pnpm db:generate` + both typechecks) that isolates the capture layer before the check layer is written. Task 3 then adds the three absence modes and the UTF-8-vs-UTF-16 regression case, which the end-to-end path does not reach. The two tasks are consecutive in wave 1, so the helper never ships a wave without its dedicated test.

**Why the two guardrail tests are wave 2 and not earlier:** both assert over the *assembled* catalog (`pageChecks` contents, and the union of `packages/checks` vs `packages/psi` checkIds). Writing them before the checks are registered would make them assert over an empty or partial set — a guardrail that passes vacuously is worse than no guardrail. Their `28-02` Task 2 acceptance criteria include a self-test with a synthetic colliding ID precisely so they cannot pass vacuously.

Coverage consequence: every requirement (PAGEPERF-01, PAGEPERF-02, PAGEPERF-03) has automated coverage by the end of wave 2, and no test artifact is deferred past the phase.

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
