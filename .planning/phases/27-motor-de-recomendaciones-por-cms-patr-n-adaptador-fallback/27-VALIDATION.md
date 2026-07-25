---
phase: 27
slug: motor-de-recomendaciones-por-cms-patr-n-adaptador-fallback
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-24
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from 27-RESEARCH.md `## Validation Architecture`. Task IDs are assigned by the planner; rows below are requirement-level until then.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest `^4.1.9` (ya en el monorepo — no requiere instalación) |
| **Config file** | Ninguno para `@auditor/cms-adapters` (usa defaults, igual que `packages/fingerprint`) |
| **Quick run command** | `pnpm --filter @auditor/cms-adapters test` |
| **Full suite command** | `pnpm test` (turbo run test en todo el monorepo) |
| **Typecheck** | `pnpm --filter @auditor/cms-adapters typecheck` |
| **Estimated runtime** | ~2-5 s (paquete puro de strings, sin I/O) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @auditor/cms-adapters test`
- **After every plan wave:** Run `pnpm --filter @auditor/cms-adapters test && pnpm --filter @auditor/report-model test`
- **Before `/gsd-verify-work`:** `pnpm test` + `pnpm typecheck` en verde
- **Max feedback latency:** ~5 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (planner) | — | — | CMSFIX-01/03 | — | Resolución correcta por (confianza × plataforma × checkId × builder) | unit | `pnpm --filter @auditor/cms-adapters test` (`resolveCmsRecommendation.test.ts`) | ❌ W0 | ⬜ pending |
| TBD (planner) | — | — | CMSFIX-03 | — | Cobertura: 10 checkIds × 5 labels = 50 entradas no vacías; variantes WP builder para alt/JSON-LD | unit | `pnpm --filter @auditor/cms-adapters test` (`coverage.test.ts`) | ❌ W0 | ⬜ pending |
| TBD (planner) | — | — | CMSFIX-02/04 | T-27 (V5 input) | Fallback verbatim: `bajo`/`no-detectado`/plataforma-sin-adaptador/checkId-fuera-de-los-10 → genérico intacto; severidad `ok` no se toca | unit | `pnpm --filter @auditor/cms-adapters test` | ❌ W0 | ⬜ pending |
| TBD (planner) | — | — | CMSFIX-05 | — | `buildReportModel` inyecta la recomendación resuelta usando `rawStack`; check fuera de los 10 (ej. hreflang) queda intacto | integration | `pnpm --filter @auditor/report-model test` | ❌ W0 | ⬜ pending |
| TBD (planner) | — | — | — | — | E2e contra audit real (recomendación personalizada visible) | manual/e2e | `pnpm --filter @auditor/worker exec tsx scripts/verify-cms-fix.mts [auditId]` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/cms-adapters/src/resolveCmsRecommendation.test.ts` — stubs para CMSFIX-01/02/03/04
- [ ] `packages/cms-adapters/src/coverage.test.ts` — 50 entradas (CMSFIX-03)
- [ ] Test nuevo en `packages/report-model` (build) — guard de severidad `ok` + check fuera de los 10 intacto (CMSFIX-04/05)
- [ ] `apps/worker/scripts/verify-cms-fix.mts` — e2e (espejo de `verify-stack.mts`)

*vitest ya está instalado en el monorepo; no hay gap de framework.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Exactitud de rutas de menú en el copy (especialmente las marcadas `[REVISAR]`: Wix/Squarespace, H1, robots.txt) | CMSFIX-03 | La UI de admin de cada plataforma cambia sin aviso; no es verificable por test automatizado | Revisar contra documentación oficial vigente de cada plataforma antes de dar por cerrada la fase |
| Recomendación personalizada visible en un audit real (ej. sitio WordPress conocido) | CMSFIX-05 | Requiere red a Postgres y un audit `done` real | `pnpm --filter @auditor/worker exec tsx scripts/verify-cms-fix.mts [auditId]` |

*Tono/prosa NO se testea (revisión humana).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
