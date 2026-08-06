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

> Regenerado contra la descomposición real de la fase: 5 planes en 4 olas (`31-01` ola 1 · `31-02` y `31-03` ola 2 · `31-04` ola 3 · `31-05` ola 4).
> Prefijo de comando común, abreviado como `VT` en la tabla: `pnpm --filter @auditor/checks exec vitest run`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 31-01 T1 | 01 | 1 | IMG-01 | — | N/A | checkpoint:decision | ninguno — decisión ya resuelta (`emision-por-pagina`), se transcribe en el SUMMARY | n/a | ⬜ pending |
| 31-01 T2 | 01 | 1 | IMG-01, IMG-02 | T-31-04 (amplificación contra el sitio auditado) | una imagen única se sondea una sola vez por auditoría; la aserción es sobre el número de llamadas de red, no de filas | unit | `VT src/checks/network/ogImageNetwork.test.ts -t "dedup"` | ❌ W0 | ⬜ pending |
| 31-01 T2 | 01 | 1 | IMG-01 | — | N/A | unit | `VT src/checks/network/ogImageNetwork.test.ts -t "cap"` | ❌ W0 | ⬜ pending |
| 31-01 T2 | 01 | 1 | IMG-01 | — | N/A | unit | `VT src/checks/network/ogImageNetwork.test.ts -t "sin og:image"` | ❌ W0 | ⬜ pending |
| 31-01 T2 | 01 | 1 | IMG-02 | — | N/A | integración | `VT src/checks/network/ogImageNetwork.test.ts` (caso de punta a punta con `runAllChecks`) | ❌ W0 | ⬜ pending |
| 31-01 T2 | 01 | 1 | IMG-01..04 | T-31-SC (dependencia nueva) | guarda de regresión de Playwright/Chromium sobre el grafo de Vercel | frontera | `pnpm assert:web-boundary` | ✅ existe | ⬜ pending |
| 31-01 T3 | 01 | 1 | IMG-02 | T-31-01, T-31-02 (SSRF y revalidación por salto) | el destino se valida antes de abrir la conexión y en cada salto; con destino rechazado el fetch global no se invoca ni una vez | unit | `VT src/checks/network/ssrfGuard.test.ts -t "ssrf"` | ❌ W0 | ⬜ pending |
| 31-01 T3 | 01 | 1 | IMG-02 | T-31-01 | tabla de rangos privados/loopback/link-local/metadatos de nube, sin abrir conexiones reales | unit | `VT src/checks/network/ssrfGuard.test.ts` | ❌ W0 | ⬜ pending |
| 31-02 T1 | 02 | 2 | IMG-01 | T-31-03 (cuerpo sin fin / Range ignorado) | la lectura corta a 64 KiB y cancela el lector siempre | unit | `VT src/checks/network/imageProbe.test.ts -t "corta"` | ❌ W0 | ⬜ pending |
| 31-02 T1 | 02 | 2 | IMG-04 | T-31-07 (cabecera numérica hostil) | sólo se acepta entero finito no negativo; 206 lee el rango de contenido, no la longitud del fragmento | unit | `VT src/checks/network/imageProbe.test.ts -t "tamaño total"` | ❌ W0 | ⬜ pending |
| 31-02 T2 | 02 | 2 | IMG-03 | T-31-06, T-31-08 | la lectura de dimensiones nunca propaga excepción ni persiste el mensaje de la librería | unit | `VT src/checks/network/imageProbe.test.ts -t "dimensiones desde buffer"` | ❌ W0 | ⬜ pending |
| 31-03 T1 | 03 | 2 | IMG-01, IMG-02 | T-31-01 (extensión a TECH-12/TECH-13) | el verificador de enlaces valida el destino antes del fetch, con el mismo helper compartido | unit | `VT src/checks/network/linkChecker.test.ts -t "ssrf"` | ❌ W0 | ⬜ pending |
| 31-03 T1 | 03 | 2 | IMG-01 | T-31-10 (divergencia de runners) | un único runner de concurrencia para toda la capa de red, con orden preservado | unit | `VT src/checks/network/linkChecker.test.ts -t "orden"` y `… -t "concurrencia"` | ❌ W0 | ⬜ pending |
| 31-03 T2 | 03 | 2 | IMG-02 | T-31-09 (defensa que fabrica falsos positivos) | un destino rechazado sale como fila informativa, nunca como enlace/recurso roto | unit | `VT src/checks/network/brokenExternalLinks.test.ts` | ✅ ampliar | ⬜ pending |
| 31-04 T1 | 04 | 3 | IMG-02 | — | todo 4xx/5xx sobre og:image es `critical`, sin carve-out por status de bloqueo (decisión lockeada) | unit | `VT src/checks/network/ogImageNetwork.test.ts -t "alcanzabilidad"` | ❌ W0 | ⬜ pending |
| 31-04 T1 | 04 | 3 | IMG-02 | T-31-11 (content-type mentiroso) | no se marca `critical` por content-type genérico si los bytes parsean como imagen | unit | `VT src/checks/network/ogImageNetwork.test.ts -t "content-type"` | ❌ W0 | ⬜ pending |
| 31-04 T1 | 04 | 3 | IMG-02 | T-31-12 (falso aprobado en SVG) | una imagen vectorial sale por rama de error y corta antes de evaluar dimensiones | unit | `VT src/checks/network/ogImageNetwork.test.ts -t "svg"` | ❌ W0 | ⬜ pending |
| 31-04 T2 | 04 | 3 | IMG-03 | — | N/A | unit | `VT src/checks/network/ogImageNetwork.test.ts -t "dimensiones"` | ❌ W0 | ⬜ pending |
| 31-04 T2 | 04 | 3 | IMG-03 | — | N/A | unit | `VT src/checks/network/ogImageNetwork.test.ts -t "ratio"` | ❌ W0 | ⬜ pending |
| 31-04 T2 | 04 | 3 | IMG-04 | T-31-07 (umbral desplazado por redondeo) | comparación estricta sobre el entero de bytes; el redondeo es sólo de presentación | unit | `VT src/checks/network/ogImageNetwork.test.ts -t "peso"` | ❌ W0 | ⬜ pending |
| 31-04 T2 | 04 | 3 | IMG-01..04 | T-31-05 (texto del sitio auditado persistido) | el valor medido se recorta al tope compartido; el ámbito y el fingerprint nunca se recortan | unit | `VT src/checks/network/ogImageNetwork.test.ts -t "saneo"` | ❌ W0 | ⬜ pending |
| 31-05 T1 | 05 | 4 | IMG-01..04 | T-31-14 (la suite saliendo a internet) | el catálogo corre IMG-01 con la red activa y con la capa de transporte simulada | integración | `VT src/registry.test.ts` | ✅ ampliar | ⬜ pending |
| 31-05 T2 | 05 | 4 | IMG-01..04 | T-31-14, T-31-16 | ningún fingerprint del check nuevo colisiona con los 8 de la fase 30, ni consigo mismo con dos ramas sobre la misma página | guardarraíl | `VT src/checks/social/social-guardrail.test.ts` | ✅ ampliar | ⬜ pending |
| 31-05 T3 | 05 | 4 | IMG-01..04 | T-31-15, T-31-16 | los dos guardarraíles se prueban por mutación y reversión, con árbol limpio al cerrar | gate de fase | `pnpm test && pnpm typecheck && pnpm assert:web-boundary` | ✅ existe | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*`File Exists`: ❌ W0 = archivo de test que la fase crea (ver Wave 0 Requirements) · ✅ ampliar = archivo existente al que la fase agrega casos · ✅ existe = comando ya disponible en HEAD.*

---

## Wave 0 Requirements

Archivos y pasos que no existen en HEAD y que la fase tiene que crear antes de que su comando de verificación pueda correr en verde. Entre paréntesis, el plan y la tarea que los produce.

- [ ] `pnpm --filter @auditor/checks add image-size@2.0.2` — dependencia directa nueva (31-01 T2)
- [ ] `packages/checks/src/checks/network/ogImageNetwork.test.ts` — dedupe, cap en el borde 150/151, omisión sin og:image, fan-out por página y caso de punta a punta con `runAllChecks` (31-01 T2); 31-04 le agrega clasificación, bordes y saneo
- [ ] `packages/checks/src/checks/network/ssrfGuard.test.ts` — tabla de rangos privados, rechazo por resolución DNS y el caso etiquetado `ssrf` que prueba que el fetch global no se invoca (31-01 T3)
- [ ] `packages/checks/src/checks/network/imageProbe.test.ts` — transporte: `Range`, 206 contra 200, corte de lectura con cancelación del lector, derivación del tamaño total y dimensiones desde el buffer parcial (31-02 T1 y T2)
- [ ] `packages/checks/src/checks/network/linkChecker.test.ts` — **no existe en HEAD**: defensa de destino en `checkOne`, orden preservado y concurrencia del runner compartido (31-03 T1)
- [ ] Ampliar `packages/checks/src/checks/network/brokenExternalLinks.test.ts` con la rama de destino no verificable (31-03 T2)
- [ ] Ampliar `packages/checks/src/registry.test.ts` con casos `includeNetworkChecks: true` (requiere mock de `probeImages` y de la validación de destino, o `vi.stubGlobal("fetch", …)`) (31-05 T1)
- [ ] Ampliar `packages/checks/src/checks/social/social-guardrail.test.ts` con un segundo bloque `describe` que incluya la fila de `IMG-01` en la comparación de fingerprints de la categoría `social` (31-05 T2)

> **Ojo con el guardarraíl social:** `social-guardrail.test.ts:118-126` afirma `distinctCheckIds.size === SOCIAL_CHECK_ID_COUNT` (8) y corre con `includeNetworkChecks: false`, así que no se rompe al agregar IMG-01. El plan 31-05 **no toca** ese bloque ni esa constante: agrega un bloque nuevo con la red activa y su propia constante de conteo (9), más el mock de `probeImages`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Comportamiento contra un servidor real que ignora `Range` y responde 200 con el archivo completo | IMG-01, IMG-04 | depende de infraestructura de terceros; el caso está cubierto por unit test con fetch stubeado | correr una auditoría real contra un sitio con og:image en un CDN y confirmar en logs que la lectura se corta en 64 KiB |
| Tasa real de filas con dimensiones indeterminadas (respaldo de la asunción A1: que 64 KiB alcanzan para el marcador de dimensiones de la mayoría de los JPEG reales) | IMG-03 | depende de la distribución real de metadatos de los JPEG que sirven los CMS, no del código; ningún test con fetch simulado puede confirmarla | correr una auditoría real sobre un sitio con imágenes sociales variadas y medir qué proporción de filas de `IMG-01` sale con el subtipo de dimensiones indeterminadas. Si es alta, subir `IMAGE_HEAD_BYTES` y volver a medir: es un solo número en un solo archivo |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
