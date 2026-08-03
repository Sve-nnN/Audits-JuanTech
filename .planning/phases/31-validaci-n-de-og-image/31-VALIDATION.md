---
phase: 31
slug: validaci-n-de-og-image
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest `^4.1.9` (devDependency de `packages/checks`) |
| **Config file** | none — `packages/checks` corre con los defaults de vitest |
| **Quick run command** | `pnpm --filter @auditor/checks test` |
| **Full suite command** | `pnpm test && pnpm typecheck && pnpm assert:web-boundary` |
| **Estimated runtime** | ~30 segundos (quick) |
| **Network mocking** | sin msw ni nock en el repo. Patrones establecidos: `vi.mock("<módulo>")` (`brokenExternalLinks.test.ts:7-15`) y `vi.stubGlobal("fetch", …)` (`psi/src/client.test.ts:7-12`) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @auditor/checks test`
- **After every plan wave:** Run `pnpm test && pnpm typecheck && pnpm assert:web-boundary`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 0 | IMG-01..04 | — | N/A | scaffolding | `pnpm --filter @auditor/checks test` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | IMG-01..04 | T-31-01 (SSRF) | `probeImage` rechaza hosts privados/loopback/link-local antes de emitir el request | unit | `pnpm --filter @auditor/checks exec vitest run src/checks/network/imageProbe.test.ts -t "ssrf"` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | IMG-01..04 | — | N/A | unit | `pnpm --filter @auditor/checks exec vitest run src/checks/network/imageProbe.test.ts -t "corta"` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | IMG-04 | — | N/A | unit | `… imageProbe.test.ts -t "tamaño total"` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | IMG-03 | — | N/A | unit | `… imageProbe.test.ts -t "dimensiones desde buffer"` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | IMG-01 | — | N/A | unit | `… ogImageNetwork.test.ts -t "dedup"` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | IMG-01 | — | N/A | unit | `… ogImageNetwork.test.ts -t "cap"` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | IMG-01 | — | N/A | unit | `… ogImageNetwork.test.ts -t "sin og:image"` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | IMG-02 | — | N/A | unit | `… ogImageNetwork.test.ts -t "alcanzabilidad"` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | IMG-02 | T-31-02 (content-type mentiroso) | no se marca `critical` por content-type genérico si los bytes parsean como imagen | unit | `… ogImageNetwork.test.ts -t "content-type"` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | IMG-03 | — | N/A | unit | `… ogImageNetwork.test.ts -t "dimensiones"` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | IMG-03 | — | N/A | unit | `… ogImageNetwork.test.ts -t "ratio"` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | IMG-04 | — | N/A | unit | `… ogImageNetwork.test.ts -t "peso"` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | IMG-01..04 | T-31-03 (texto del sitio auditado persistido) | los campos derivados de la URL/headers del sitio auditado se truncan y no se interpretan como HTML | unit | `… ogImageNetwork.test.ts -t "saneo"` | ❌ W0 | ⬜ pending |
| TBD | 03 | 3 | IMG-01..04 | — | N/A | integración | `pnpm --filter @auditor/checks exec vitest run src/registry.test.ts` | ✅ ampliar | ⬜ pending |
| TBD | 03 | 3 | IMG-01..04 | — | N/A | guardarraíl | `pnpm --filter @auditor/checks exec vitest run src/checks/social/social-guardrail.test.ts` | ✅ ampliar | ⬜ pending |
| TBD | 03 | 3 | IMG-01..04 | — | N/A | frontera | `pnpm assert:web-boundary` | ✅ existe | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs se completan cuando los PLAN.md quedan escritos; la columna Plan/Wave refleja la descomposición esperada.*

---

## Wave 0 Requirements

- [ ] `pnpm --filter @auditor/checks add image-size@2.0.2` — dependencia directa nueva
- [ ] `packages/checks/src/checks/network/imageProbe.test.ts` — transporte (Range, 206 vs 200, corte de lectura, dimensiones desde buffer parcial, guard SSRF)
- [ ] `packages/checks/src/checks/network/ogImageNetwork.test.ts` — clasificación (IMG-01..04)
- [ ] Ampliar `packages/checks/src/registry.test.ts` con un caso `includeNetworkChecks: true` (requiere mock de `probeImage` o `vi.stubGlobal("fetch", …)`)
- [ ] Ampliar `packages/checks/src/checks/social/social-guardrail.test.ts` para incluir la fila de `IMG-01` en la comparación de fingerprints de la categoría `social`

> **Ojo con el guardarraíl social:** `social-guardrail.test.ts:118-126` afirma `distinctCheckIds.size === SOCIAL_CHECK_ID_COUNT` (8) y corre con `includeNetworkChecks: false`, así que no se rompe al agregar IMG-01. Si el plan activa la red en ese archivo, la constante debe subir a 9 y el harness necesita un mock de `probeImage`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Comportamiento contra un servidor real que ignora `Range` y responde 200 con el archivo completo | IMG-01, IMG-04 | depende de infraestructura de terceros; el caso está cubierto por unit test con fetch stubeado | correr una auditoría real contra un sitio con og:image en un CDN y confirmar en logs que la lectura se corta en 64 KiB |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
