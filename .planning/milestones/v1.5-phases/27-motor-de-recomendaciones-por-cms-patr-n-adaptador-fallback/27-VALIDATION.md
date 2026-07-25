---
phase: 27
slug: motor-de-recomendaciones-por-cms-patr-n-adaptador-fallback
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-24
validated: 2026-07-25
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Wave 0 gaps (seeded pre-execution) were closed by Plans 27-01/02/03; this pass re-runs
> the resulting tests adversarially (assume unproven until a passing test demonstrates it)
> rather than trusting the plan SUMMARYs' self-reported results.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest `^4.1.9` (monorepo-wide) |
| **Config file** | Ninguno para `@auditor/cms-adapters` (defaults, igual que `packages/fingerprint`) |
| **Quick run command** | `pnpm --filter @auditor/cms-adapters test` |
| **Full suite command** | `pnpm test` (turbo run test en todo el monorepo) |
| **Typecheck** | `pnpm --filter @auditor/cms-adapters typecheck` / `pnpm --filter @auditor/report-model typecheck` / `pnpm --filter @auditor/worker typecheck` |
| **Actual runtime observed** | `cms-adapters` 165ms (21 tests) · `report-model` 246ms (48 tests) |

---

## Sampling Rate (as executed during the fase)

- **After every task commit:** `pnpm --filter @auditor/cms-adapters test` — cumplido (21/21 en Plan 02, 10/10 en Plan 01)
- **After every plan wave:** `pnpm --filter @auditor/cms-adapters test && pnpm --filter @auditor/report-model test` — cumplido en Plan 03 (48/48)
- **Before verify-work:** `pnpm test` + `pnpm typecheck` en verde — confirmado por 27-VERIFICATION.md (status passed, 9/9 truths) y re-confirmado en esta pasada (ver abajo)
- **Feedback latency observada:** < 1s por paquete, muy por debajo del límite de 5s

---

## Per-Task Verification Map (resuelto)

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 27-01 T1-T2 | 27-01 | W0→W1 | CMSFIX-01/03 | Resolución correcta por (confianza × plataforma × checkId × builder); 50 entradas no vacías | unit | `pnpm --filter @auditor/cms-adapters test` (`coverage.test.ts`) | ✅ existe | ✅ green (re-ejecutado: 21/21, incluye 10 de coverage) |
| 27-02 T1 | 27-02 | W1 | CMSFIX-01/02/04 | Fallback verbatim: stack null / confianza baja / label sin adaptador / checkId fuera de los 10 → genérico byte-idéntico; identidad estricta probada contra TECH-10 | unit | `pnpm --filter @auditor/cms-adapters test` (`resolveCmsRecommendation.test.ts`) | ✅ existe | ✅ green (re-ejecutado en esta pasada: 11/11 dentro de 21/21) |
| 27-03 T1 | 27-03 | W2 | CMSFIX-04/05 | `buildReportModel` inyecta la recomendación resuelta usando `rawStack`; guard `severity === "ok"` no se toca; TECH-10 (fuera de los 10) byte-idéntico | integration | `pnpm --filter @auditor/report-model test` (`build.test.ts`) | ✅ existe | ✅ green (re-ejecutado: 48/48, incluye los 4 tests de integración CMS) |
| 27-03 T2 | 27-03 | W2 | — | E2e contra audit real; degradación limpia offline sin fabricar datos | manual/e2e | `pnpm --filter @auditor/worker exec tsx scripts/verify-cms-fix.mts [auditId]` | ✅ existe | ✅ green para el camino offline (re-ejecutado en esta pasada: P1001, exit 1, mensaje limpio, sin fabricar `ReportModel`); ⚠️ camino online (datos reales) queda **manual**, per plan |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Nota: los Task IDs `TBD (planner)` del seed original fueron resueltos por los 3 planes (27-01/02/03); no quedó ningún gap sin task ID asignado.

---

## Wave 0 Requirements — resueltas

- [x] `packages/cms-adapters/src/resolveCmsRecommendation.test.ts` — 11 tests, CMSFIX-01/02/03/04, re-ejecutados en verde en esta pasada
- [x] `packages/cms-adapters/src/coverage.test.ts` — 10 tests, 50 entradas no vacías (CMSFIX-03), re-ejecutados en verde
- [x] `packages/report-model/src/build.test.ts` — 4 tests nuevos de integración (guard `ok`, personalización, TECH-10 byte-idéntico, stack null; CMSFIX-04/05), re-ejecutados en verde dentro de 48/48
- [x] `apps/worker/scripts/verify-cms-fix.mts` — existe, `tsx --check` exit 0, ejecutado en esta pasada contra DB inalcanzable → degradación P1001 limpia (exit 1, sin datos fabricados)

*vitest ya estaba instalado en el monorepo; no hubo gap de framework.*

---

## Adversarial Re-Verification (esta pasada)

Se asumió que cada gap listado en el seed `draft` seguía sin prueba real hasta demostrar lo contrario ejecutando los comandos en vivo (no se confió en los SUMMARY/VERIFICATION previos):

| Comando ejecutado | Resultado observado |
|---|---|
| `pnpm --filter @auditor/cms-adapters test` | 2 test files, **21/21 passed**, 165ms |
| `pnpm --filter @auditor/report-model test` | 4 test files, **48/48 passed**, 246ms |
| `pnpm --filter @auditor/cms-adapters typecheck` | exit 0 |
| `pnpm --filter @auditor/report-model typecheck` | exit 0 |
| `pnpm --filter @auditor/worker typecheck` | exit 0 |
| `DATABASE_URL=<inválida> pnpm exec tsx scripts/verify-cms-fix.mts fake-audit-id` (apps/worker) | Prisma P1001, script imprime hint limpio y sale con **exit 1**; no fabrica `ReportModel` |
| Grep de assertions clave (`resolveCmsRecommendation.test.ts`, `build.test.ts`) | Confirmadas: fallback byte-idéntico contra `TECH-10`, guard `severity === "ok"`, `generic === null` se propaga, Wix ≠ Squarespace |

Ningún test se debilitó ni se reescribió para pasar; todos los gaps del seed quedaron cubiertos por comportamiento real ejecutado, no por inspección de código únicamente.

---

## Manual-Only Verifications (sin cambios respecto al seed — siguen pendientes por diseño)

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Exactitud de rutas de menú en el copy (7 ítems `[REVISAR]`: Wix/Squarespace, H1, robots.txt, sitemap Webflow) | CMSFIX-03 | UI de admin de terceros, "moving target" | **Resuelto** 2026-07-25 vía WebSearch contra Wix/Webflow/Squarespace Help Center, copy actualizado en commit `60399aa`; aprobado por Juan (ver 27-VERIFICATION.md Human Verification #1) |
| Redacción es-neutro de la nota agregada a TECH-04 (fix WR-03) | CMSFIX-04 | Calidad de prosa, no verificable por test | **Resuelto** — Juan revisó y aprobó sin cambios (27-VERIFICATION.md #2) |
| Recomendación personalizada visible en un audit real (WordPress) | CMSFIX-05 | Requiere red a Postgres, no disponible en este entorno | **Diferido** — Juan lo corre manualmente: `pnpm --filter @auditor/worker exec tsx scripts/verify-cms-fix.mts [auditId]`. No bloqueante: lógica ya cubierta en verde por 21+48 tests automatizados; este paso solo confirma wiring end-to-end contra datos reales. |

*Tono/prosa NO se testea por automatización (revisión humana), consistente con el resto del proyecto.*

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies resueltas
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (cada plan corrió su suite tras cada task/wave)
- [x] Wave 0 covers all MISSING references (los 4 ítems del seed fueron creados y están en verde)
- [x] No watch-mode flags (todos los comandos son `vitest run` / `tsc --noEmit`, sin `--watch`)
- [x] Feedback latency < 5s (observado: < 1s por paquete)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated — 3 human-verification ítems resueltos/diferidos explícitamente (ninguno bloquea el cierre funcional de la fase), consistente con `27-VERIFICATION.md` (status `human_needed` → cierre operativo aprobado por Juan).
