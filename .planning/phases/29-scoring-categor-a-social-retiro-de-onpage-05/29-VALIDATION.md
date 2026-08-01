---
phase: 29
slug: scoring-categor-a-social-retiro-de-onpage-05
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-01
---

<!--
Por que `status` sigue en `draft` con los otros dos flags en `true`:
`status` lo escribe `/gsd-validate-phase` §6 despues de ejecutar la fase, no el planner.
Ponerlo en `validated` desde aca seria firmar una validacion que todavia no corrio.
`nyquist_compliant` y `wave_0_complete` si son propiedades de tiempo de planeacion y
quedan verificadas abajo: las 8 tareas tienen `<automated>` real y ninguna arrastra una
dependencia MISSING de Wave 0.
-->


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
| 29-01-T1 (tracer: categoria social de punta a punta) | 29-01 | 1 | SCORE-01, SCORE-02 | T-29-01, T-29-04 | Un issue `category: "social"` no se descarta en silencio en el seeding de buckets | integration + typecheck | `pnpm --filter @auditor/report-model test && pnpm typecheck --continue --force` | ⚠️ extend (`build.test.ts`) | ⬜ pending |
| 29-01-T2 (asserts de peso y renormalizacion) | 29-01 | 1 | SCORE-02 | — | N/A | unit | `pnpm --filter @auditor/scoring test` | ⚠️ extend (`overallScore.test.ts`) | ⬜ pending |
| 29-02-T1 (guardarrailes negativos del registry) | 29-02 | 1 | SOCIAL-09 | T-29-06 | El catalogo activo no contiene el check retirado, verificado por contenido y de punta a punta | unit + integration | `pnpm --filter @auditor/checks test` — **cierra en ROJO a proposito**, es la unica tarea de la fase que lo hace | ⚠️ extend (`registry.test.ts`) | ⬜ pending |
| 29-02-T2 (borrado del modulo y del barrel) | 29-02 | 1 | SOCIAL-09 | T-29-02, T-29-06 | El historial persistido y el catalogo de `cms-adapters` quedan intactos | unit + typecheck | `pnpm --filter @auditor/checks test && pnpm --filter @auditor/checks typecheck && pnpm --filter @auditor/cms-adapters test` | ✅ (lo dejo 29-02-T1) | ⬜ pending |
| 29-03-T1 (exhaustividad en report-model y export) | 29-03 | 2 | SCORE-01 | T-29-01, T-29-07 | Una categoria omitida en un `Category[]` deja de ser silenciosa | unit | `pnpm --filter @auditor/export test && pnpm --filter @auditor/report-model test && pnpm --filter @auditor/export typecheck` | ❌ W0 → la crea la tarea (`export/src/labels.test.ts`) | ⬜ pending |
| 29-03-T2 (`CATEGORY_ORDER` de la web + test) | 29-03 | 2 | SCORE-01 | T-29-01 | Idem en `apps/web`, mas paridad de copy con el mapa de export | unit | `pnpm --filter @auditor/web test && pnpm --filter @auditor/web typecheck` | ❌ W0 → la crea la tarea (`app/components/ui/labels.test.ts`) | ⬜ pending |
| 29-04-T1 (corte de version en Key Decisions) | 29-04 | 3 | SCORE-02, SOCIAL-09 | T-29-05 | El corte de version es recuperable al leer un reporte posterior | doc-assert + human-check | `test "$(grep -c '^\| ' .planning/PROJECT.md)" = "30"` (mas los dos greps de la tarea) | ✅ (`.planning/PROJECT.md`) | ⬜ pending |
| 29-04-T2 (gate de fase sin cache) | 29-04 | 3 | SCORE-01, SCORE-02, SOCIAL-09 | T-29-SC | Lockfile y esquema de DB sin tocar | full suite + typecheck | `pnpm typecheck --continue --force && pnpm test --continue --force` | ✅ (infra existente) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Nota sobre 29-02-T1.** Es la unica fila cuyo verde esperado es un rojo: el guardarrail se escribe antes del borrado y tiene que fallar contra HEAD. Su `<automated>` invierte el codigo de salida a proposito. Pasa a verde en 29-02-T2 sin editar el test.

**Nota sobre 29-01-T2.** El orden dentro del plan impide que arranque en rojo (la Tarea 1 escribe las constantes primero, y el union ampliado es lo que hace typecheckear el caso de renormalizacion). El rojo se sustituye por una prueba de dientes por mutacion en los criterios de aceptacion: invertir los pesos de on-page y datos estructurados debe poner la suite en rojo por el caso de valores individuales y NO por el de la suma, que con esos dos valores invertidos sigue sumando 1. Es exactamente el hueco Wave 0 que RESEARCH.md identifico.

---

## Wave 0 Requirements

Marcadas como cubiertas = cada item tiene una tarea duena en el plan set. No hay una ola 0 separada: cada scaffold lo crea la misma tarea que lo consume, dentro del mismo plan, asi que ninguna tarea arrastra una dependencia MISSING. El tilde significa "planificado con dueno", no "ejecutado en verde" (eso lo cierra `/gsd-validate-phase`).

- [x] Extend `packages/scoring/src/overallScore.test.ts` — assert individual weight values (onpage .10, schema .05, social .10) + renormalization with no `social` data (SCORE-01/SCORE-02) → **29-01-T2**
- [x] Extend `packages/checks/src/registry.test.ts` — negative guardrail: no registered check has the retired `checkId`, and `runAllChecks` emits no such issue (SOCIAL-09) → **29-02-T1**
- [x] `CATEGORY_ORDER` exhaustiveness test in `packages/report-model` (covers the silent-drop failure mode in `build.ts`) → **29-03-T1**
- [x] `CATEGORY_ORDER` exhaustiveness test in `packages/export` (archivo nuevo `labels.test.ts`) → **29-03-T1**
- [x] `CATEGORY_ORDER` exhaustiveness test in `apps/web` (archivo nuevo `labels.test.ts`, precedido por la reubicacion de la constante desde `page.tsx`) → **29-03-T2**
- [x] No new framework to install; no new shared fixtures needed — verificado: `git diff --stat pnpm-lock.yaml` vacio es criterio de cierre en 29-04-T2

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Version-cut note: pre-v1.6 audit scores are not directly comparable to post-v1.6 ones | SCORE-02, SOCIAL-09 | Documentation assertion, not runtime behavior | `<human-check>` de **29-04-T1**: abrir `.planning/PROJECT.md`, ir a Key Decisions y confirmar que la fila nueva se lee sola — pesos rebalanceados, check retirado, scores pre/post v1.6 no comparables, y "Resueltos" que el usuario no gano en la primera auditoria posterior al corte. Texto en espanol neutro sin voceo. La forma de la fila si esta cubierta por grep automatizado; lo manual es que se entienda. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — las 8 tareas del mapa tienen `<automated>` con un comando real; ninguna dice MISSING
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — cero tareas sin verify automatizado, asi que la racha maxima es 0
- [x] Wave 0 covers all MISSING references — los dos archivos de test nuevos (`packages/export/src/labels.test.ts` y `apps/web/app/components/ui/labels.test.ts`) los crea la misma tarea que los consume; los otros cuatro items extienden archivos de test que ya existen. Sin dependencias colgadas
- [x] No watch-mode flags — ningun comando del mapa lleva `--watch`; los `--force` de 29-04-T2 son anti-cache de Turborepo, no watch
- [x] Feedback latency < 60s — `pnpm --filter @auditor/scoring test` corre en ~150 ms; el gate completo de 29-04-T2 corre una sola vez al cierre de fase
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planificado y firmado a nivel de planeacion. `status` queda en `draft` a proposito: lo promueve `/gsd-validate-phase` §6 tras la ejecucion, con los ⬜ del mapa resueltos a ✅.
