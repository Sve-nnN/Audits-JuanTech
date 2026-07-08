---
phase: 11-checks-m-s-profundos-canonical-headings-fix-dato-cwv
verified: 2026-07-06T21:40:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 11: Checks más profundos (canonical + headings) + fix dato CWV — Verification Report

**Phase Goal:** La auditoría detecta errores profundos de canonical y de jerarquía de encabezados, y los issues de rendimiento muestran la URL analizada — todo con lógica Cheerio pura sobre el HTML ya almacenado, sin tocar infra ni migraciones.
**Verified:** 2026-07-06T21:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (Success Criterion) | Status | Evidence |
|---|---------------------------|--------|----------|
| 1 | Canonical → noindex / 3xx / 4xx / 5xx / cadena canonical→canonical se marca CRÍTICO | ✓ VERIFIED | `canonicalDeep.ts`: `noindex-target` L166-180 (critical), `redirect-target` L208-221 (critical), `http-error-target` L224-237 (critical), `chain` L182-202 (critical). No recursivo → sin loops. |
| 2 | Detecta cross-domain, relativo, múltiple/conflictivo, canonical+noindex y mismatch vs URL final | ✓ VERIFIED | `cross-domain` L139-153 (warning, vía `sameRegistrableDomain`), `relative` L95-108 (warning), `multiple-conflicting` L74-89 (warning, normaliza antes de dedup), `noindex-conflict` L111-125 (critical), `final-url-mismatch` L241-254 (warning). 9 subtipos confirmados por grep. |
| 3 | Errores de jerarquía: saltos de nivel, vacíos, fuera de orden, H1 múltiple, H1 que duplica el title | ✓ VERIFIED | `headings.ts` (ONPAGE-08): `skip` L64-81, `empty` L83-91, `order` L93-103, `h1-dup-title` L105-119 (todos warning). "Multiple H1" delegado por diseño a ONPAGE-03 `h1.ts` L35 (`h1s.length > 1`), que sí lo marca. |
| 4 | Cada issue de Rendimiento/CWV muestra la URL analizada (no más "—") | ✓ VERIFIED | `PerfIssueDraft.source` añadido (`issues.ts` L22). Poblado `source: url` en las 4 ramas: métricas L158, INP presente L189, INP ausente L203, early-return L123. Worker mapea `source: draft.source ?? null` en el `.map` de perfIssues (`apps/worker/src/index.ts` L368). |
| 5 | Múltiples hallazgos por página no colapsan (fingerprints sub-tipados) y el score de fixture sana no se desvía | ✓ VERIFIED | `pageFingerprint` con checkId sub-tipado en todos los hallazgos (`TECH-04:<sub>`, `ONPAGE-08:<sub>`). `phase11-guardrail.test.ts`: `diff.statusByFingerprint.size === combined.length` L53, `scoreCategory(after).score === before.score` L92. Checks solo emiten filas de problema (cero filas "ok"), por lo que fixture sana → `[]`. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/checks/src/checks/tech/canonicalDeep.ts` | SiteCheck TECH-04, 9 subtipos, sin red | ✓ VERIFIED | 259 líneas, 9 fingerprints sub-tipados confirmados, cero llamadas de red (grep NONE), `checkId: "TECH-04"`. |
| `packages/checks/src/checks/onpage/headings.ts` | PageCheck ONPAGE-08, 4 subtipos warning | ✓ VERIFIED | 4 subtipos, todos `severity: "warning"`, `checkId: "ONPAGE-08"`. h1.ts intacto. |
| `packages/psi/src/issues.ts` | PerfIssueDraft.source poblado en todas las ramas | ✓ VERIFIED | `source?: string` + `source: url` en las 4 ramas. |
| `apps/worker/src/index.ts` | Mapea draft.source en perfIssues | ✓ VERIFIED | L368 `source: draft.source ?? null`. Ya no queda `source: null as string`. |
| `packages/checks/src/checks/phase11-guardrail.test.ts` | No-colapso + estabilidad de score | ✓ VERIFIED | Asserts SC#5 presentes y verdes. |
| `*.test.ts` (canonicalDeep, headings, issues) | Cobertura de subtipos + edge cases | ✓ VERIFIED | canonicalDeep 14 casos (incl. skip silencioso + no-colapso), headings 7 casos (incl. no-colapso + limpio), issues source assert incl. early-return. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `tech/index.ts` | `canonicalDeep` | `techSiteChecks[]` | ✓ WIRED | Importado L4, en array L30, re-export L36. `siteChecks = [...techSiteChecks,...]` en registry.ts L16. |
| `onpage/index.ts` | `headingsCheck` | `onPageChecks[]` | ✓ WIRED | Importado L9, en array L19, re-export L30. `pageChecks` incluye `...onPageChecks` en registry.ts L11. |
| `apps/worker/src/index.ts` | `perfIssues.map` | `source: draft.source ?? null` | ✓ WIRED | L368, dentro del map de perfIssues. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suite @auditor/checks verde | `pnpm --filter @auditor/checks test` | 19 files, 82 tests passed | ✓ PASS |
| Suite @auditor/psi verde | `pnpm --filter @auditor/psi test` | 5 files, 27 tests passed | ✓ PASS |
| Suite @auditor/scoring verde | `pnpm --filter @auditor/scoring test` | 3 files, 25 tests passed | ✓ PASS |
| Typecheck limpio | `tsc --noEmit` (checks/psi/worker) | exit 0 en los 3 | ✓ PASS |
| canonicalDeep sin red | grep fetch/axios/http en canonicalDeep.ts | NONE | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CANON-01 | 11-01 | Canonical → noindex crítico | ✓ SATISFIED | `noindex-target` L166 critical |
| CANON-02 | 11-01 | Canonical → 3xx/4xx/5xx y cadenas | ✓ SATISFIED | `redirect-target`, `http-error-target`, `chain` critical |
| CANON-03 | 11-01 | Cross-domain y mismatch URL final | ✓ SATISFIED | `cross-domain`, `final-url-mismatch` warning |
| CANON-04 | 11-01 | Múltiples, relativo, canonical+noindex | ✓ SATISFIED | `multiple-conflicting`, `relative`, `noindex-conflict` |
| HEAD-01 | 11-02 | Saltos de nivel | ✓ SATISFIED | `skip` L64-81 |
| HEAD-02 | 11-02 | Encabezados vacíos | ✓ SATISFIED | `empty` L83-91 |
| HEAD-03 | 11-02 | Fuera de orden + H1 duplica title | ✓ SATISFIED | `order` L93-103, `h1-dup-title` L105-119 |
| REPORT-03 | 11-03 | Issues perf muestran URL analizada | ✓ SATISFIED | `source: url` + worker L368 |

Ningún requerimiento ORPHANED: los 8 IDs mapeados a Phase 11 en REQUIREMENTS.md están reclamados por planes.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Ninguno relevante | — | Sin TODO/FIXME/XXX/PLACEHOLDER en los archivos de la fase. `return []` en headings.ts L46 es skip legítimo (página sin headings), no stub. |

### Notas del Code Review (11-REVIEW.md)

El review adversarial reportó 2 warnings (WR-01 cross-domain host exacto, WR-02 multiple-conflicting sin normalizar). **Ambos ya están corregidos en el código final:** cross-domain usa `sameRegistrableDomain` (canonicalDeep.ts L139) y multiple-conflicting normaliza antes de deduplicar (L74). Los 4 hallazgos INFO son riesgos menores de falso positivo/doble fila con severidad no crítica y fingerprints distintos (sin colapso de diff); no bloquean el goal.

### Human Verification Required

Ninguna. La fase es lógica Cheerio pura sobre HTML almacenado, sin red ni UI nueva; todos los comportamientos son verificables por tests unitarios verdes y typecheck. REPORT-03 está explícitamente acotado por REQUIREMENTS.md a "la capa que genera los issues perf" (dato `source`), verificado a nivel de datos + persistencia del worker.

### Gaps Summary

Sin gaps. Los 5 criterios de éxito se cumplen con código real (no solo claims): 9 subtipos canonical con severidades correctas, 4 subtipos de headings + delegación de H1-múltiple a ONPAGE-03, propagación de `source` end-to-end hasta el worker, y el guardrail SC#5 demuestra no-colapso de fingerprints y estabilidad de score. Suites verdes (82 + 27 + 25) y tsc limpio en los tres paquetes y el worker.

---

_Verified: 2026-07-06T21:40:00Z_
_Verifier: Claude (gsd-verifier)_
