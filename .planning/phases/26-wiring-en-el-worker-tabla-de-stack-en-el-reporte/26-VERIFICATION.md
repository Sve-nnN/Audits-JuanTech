---
phase: 26-wiring-en-el-worker-tabla-de-stack-en-el-reporte
verified: 2026-07-22T13:20:00Z
status: human_needed
score: 4/4 must-haves verified (offline); 2 manual checks pending
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Correr verify-stack.mts contra un audit real WordPress con red a Neon: pnpm --filter @auditor/worker exec tsx scripts/verify-stack.mts <auditId>"
    expected: "isHome marcadas >= 1 y DetectedStack con CMS resuelto (no 'no-detectado'). Confirma que la derivación isHome vía normalizeUrl (WR-01 fix) matchea contra las URLs normalizadas del crawler sobre datos reales (Assumption A4 / IN-03)."
    why_human: "El sandbox no tiene red saliente a Neon (P1001). Requiere una máquina con acceso a la DB. Es verificación de precisión de detección runtime, no un bug de código."
  - test: "Abrir el reporte de un audit real con stack en el browser: tema claro y oscuro, viewport < 640px."
    expected: "1) tabla 'Stack técnico detectado' tras 'Score general' y antes de 'Scores por categoría'; 2) 5 filas en orden, CMS combinado 'WordPress (Elementor)' cuando aplica; 3) eje sin señal muestra 'No detectado con certeza' + Badge gris; 4) Analytics muestra un chip por herramienta; 5) 4 estados de confianza distinguibles (verde/ámbar sólido/ámbar tenue/gris), nunca rojo; 6) < 640px colapsa a lista vertical sin scroll horizontal; 7) audit sin stack (pre-v1.5) no muestra la sección."
    why_human: "Apariencia visual, contraste en ambos temas y comportamiento responsive no verificables por grep. Human-check declarado en 26-05."
---

# Phase 26: Wiring en el worker + tabla de stack en el reporte — Verification Report

**Phase Goal:** El usuario ve, apenas termina el escaneo, una tabla del stack técnico detectado de su sitio, consistente con el design system existente, calculada una sola vez por auditoría.
**Verified:** 2026-07-22T13:20:00Z
**Status:** human_needed (achieved-with-deferred-manual-checks)
**Re-verification:** No — initial verification (post code-review, REVIEW resuelto)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 (FPRINT-09) | El worker invoca la detección una sola vez por auditoría y persiste el resultado; abrir el reporte no re-ejecuta la detección | ✓ VERIFIED | `detectStack` se llama 1 vez (index.ts:629), persistido en el ÚNICO update de cierre `status:"done"` (index.ts:656), junto a `scores`/`stats`. `grep -c detectStack build.ts` = 0: report-model lee el escalar `audit.stack` (build.ts:182-183), nunca re-detecta. worker typecheck PASS. |
| 2 (STACKUI-01) | La tabla "Stack técnico detectado" es visible al inicio del reporte, antes del resto de las secciones | ✓ VERIFIED (posición en código; apariencia → human-check) | page.tsx:184-188 renderiza `<StackTable>` entre el hero "Score general" (cierra L179) y "Scores por categoría" (L191). Guardado por `model.stack`. web build PASS. |
| 3 (STACKUI-02) | La tabla lista cada categoría (CMS+builder, CDN/proxy, hosting, framework JS, analytics) con su confianza, incluyendo estado explícito de "no detectado con certeza" | ✓ VERIFIED | StackTable.tsx: 5 filas fijas (cms/cdn/hosting/jsFramework/analytics). `NotDetected` pinta "No detectado con certeza" + Badge neutral (L30-40). CMS+builder combinado "WordPress (Elementor)" en build.ts:148-149 (guard truthy, IN-01 fix). CONFIDENCE_BADGE mapea 4 estados, nunca `critical`. Test StackTable 10/10 PASS. |
| 4 (STACKUI-03) | La tabla se construye con tokens del design system (cero hex hardcodeado) y se ve bien en tema claro y oscuro | ✓ VERIFIED (tokens-only offline; ambos temas → human-check) | `grep -nE "#[0-9a-fA-F]{3,6}"` en StackTable.module.css y Badge.module.css: sin coincidencias. Badge variante `warningSubtle` vía `color-mix(--warning ...)` (tokens-only, CSP-safe). web typecheck + build PASS. |

**Score:** 4/4 truths verificados offline. Renderizado visual en ambos temas y runtime de detección → 2 checks manuales pendientes (abajo).

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/db/prisma/schema.prisma` | columna `stack Json?` en Audit | ✓ VERIFIED | L86 `stack Json?`. Cliente Prisma regenerado expone `stack: JsonValue \| null` (typechecks pasan). |
| `apps/worker/src/index.ts` | detectStack 1x + persist en update único | ✓ VERIFIED | L616-629 mapeo + detectStack; L656 persist en update `done`. normalizeUrl para isHome (WR-01). |
| `apps/worker/scripts/verify-stack.mts` | script de verificación runtime | ✓ VERIFIED (código); runtime DIFERIDO | isHome vía normalizeUrl (L83-91); falla ruidoso con P1001 sin fabricar stack. Ejecución runtime = acción manual de Juan (IN-03). |
| `packages/report-model/src/build.ts` | toReportStack + lectura escalar, sin re-detección | ✓ VERIFIED | `toReportStack` (L143), lectura `audit.stack` escalar (L182), descarta signals/evidence. grep detectStack = 0. |
| `packages/report-model/src/model.ts` + `index.ts` | tipos ReportStack/ReportStackAxis + re-export Confidence | ✓ VERIFIED | Tipos exportados (index.ts:21-22), re-export `Confidence` desde fingerprint (L27). |
| `apps/web/app/components/ui/Badge.tsx` + `.module.css` | variante `warningSubtle` tokens-only | ✓ VERIFIED | Union + VARIANT_CLASS (Badge.tsx:23,44); `.warningSubtle` con color-mix (css:72). Sin hex. |
| `apps/web/app/components/ui/StackTable.tsx` + `.module.css` | RSC, 5 filas, responsive, sin use client/dangerouslySetInnerHTML | ✓ VERIFIED | Server Component (sin "use client" salvo comentario JSDoc); 5 filas; srOnly de confianza en chips analytics (WR-02 fix, L116-119). |
| `apps/web/app/components/ui/labels.ts` | AXIS_LABEL + CONFIDENCE_LABEL es-neutral | ✓ VERIFIED | Ambos maps presentes (L55, L67). |
| `apps/web/app/audits/[id]/page.tsx` | render guardado por model.stack | ✓ VERIFIED | L184-188, entre hero y categorías. Sin query paralela. |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| worker index.ts | @auditor/fingerprint detectStack | import + llamada única (L43, L629) | ✓ WIRED |
| worker index.ts | Audit.stack (DB) | prisma.audit.update data.stack (L656) | ✓ WIRED |
| report-model build.ts | Audit.stack (escalar) | `audit.stack as DetectedStack` → toReportStack (L182-183) | ✓ WIRED |
| page.tsx | StackTable | import + render guardado por model.stack (L14, L184) | ✓ WIRED |
| StackTable.tsx | Badge warningSubtle | CONFIDENCE_BADGE.bajo → "warningSubtle" (L17) | ✓ WIRED |
| labels.ts / StackTable.tsx | Confidence | import desde @auditor/report-model (no fingerprint directo) | ✓ WIRED |

### Behavioral Spot-Checks (offline)

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| report-model contrato/transform | `pnpm --filter @auditor/report-model test` | 44/44 passed | ✓ PASS |
| report-model tipos | `pnpm --filter @auditor/report-model typecheck` | tsc --noEmit sin errores | ✓ PASS |
| worker wiring tipos | `pnpm --filter @auditor/worker typecheck` | tsc --noEmit sin errores | ✓ PASS |
| StackTable (5 filas, no-detectado, XSS escape, no critical, WR-02) | `pnpm --filter web test -t StackTable` | 10/10 passed | ✓ PASS |
| web tipos | `pnpm --filter web typecheck` | tsc --noEmit sin errores | ✓ PASS |
| web build (RSC compila) | `pnpm --filter web build` | PASS, ruta /audits/[id] 7.93 kB | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| --- | --- | --- | --- |
| verify-stack.mts (detección runtime) | `tsx scripts/verify-stack.mts <auditId>` | P1001 sin red a Neon | ⏸ DIFERIDO (acción manual Juan) |

_El sandbox no tiene red a Neon (P1001). No es fallo: el script está bien construido (falla ruidoso, nunca fabrica un DetectedStack). El `db:push` a Neon ya lo corrió Juan fuera del sandbox y el cliente Prisma local fue regenerado con `Audit.stack`._

### Requirements Coverage

| Requirement | Descripción | Status | Evidence |
| --- | --- | --- | --- |
| FPRINT-09 | Fingerprint persistido asociado a la auditoría, sin re-detección por vista | ✓ SATISFIED (offline) | schema stack Json?, persist único en worker, report-model lee escalar (detectStack=0) |
| STACKUI-01 | Tabla de stack técnico al inicio del reporte | ✓ SATISFIED (posición); apariencia → human | page.tsx render order verificado |
| STACKUI-02 | Cada categoría con confianza + estado no-detectado | ✓ SATISFIED | 5 filas, NotDetected, CMS+builder, test 10/10 |
| STACKUI-03 | Consistente con design system, sin hex, ambos temas | ✓ SATISFIED (tokens-only); ambos temas → human | sin hex en CSS, warningSubtle color-mix, build PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | Ninguno | — | Sin TBD/FIXME/XXX en archivos de la fase; "use client"/dangerouslySetInnerHTML/critical solo en comentarios JSDoc; sin stubs/placeholders. |

### Human Verification Required

**1. Runtime de detección (verify-stack.mts / IN-03)**
- Test: `pnpm --filter @auditor/worker exec tsx scripts/verify-stack.mts <auditId>` con red a Neon, sobre un audit WordPress real.
- Expected: `isHome marcadas >= 1` y `DetectedStack` con CMS resuelto (no `no-detectado`).
- Why human: sandbox sin red a Neon (P1001); confirma el fix WR-01 (isHome vía normalizeUrl) sobre datos reales.

**2. Human-check visual (26-05)**
- Test: abrir el reporte de un audit con stack en browser — tema claro/oscuro, viewport < 640px.
- Expected: los 7 puntos del human-check de 26-05 (posición, 5 filas, no-detectado, chips analytics, 4 estados de confianza sin rojo, colapso responsive, ocultar sección pre-v1.5).
- Why human: apariencia visual, contraste por tema y responsive.

### Gaps Summary

No hay gaps. Los 4 Success Criteria del ROADMAP y los 4 requirements (FPRINT-09, STACKUI-01/02/03) están satisfechos y verificados offline: código presente, cableado y con datos reales fluyendo (worker → Audit.stack → report-model → StackTable). REVIEW cerrado (0 blockers; WR-01, WR-02, IN-01 fixed; IN-02 accepted; IN-03 deferred). Todas las suites offline (report-model 44/44, StackTable 10/10, 3 typechecks, build) pasan.

Quedan 2 verificaciones que por diseño no corren en este entorno y son acción manual de Juan: (a) runtime de `verify-stack.mts` contra Neon (precisión de detección de CMS sobre datos reales), y (b) el human-check visual del reporte en ambos temas y viewport angosto. Ninguna es un fallo de implementación; son verificaciones de precisión runtime y de apariencia visual que no se pueden ejecutar offline.

---

_Verified: 2026-07-22T13:20:00Z_
_Verifier: Claude (gsd-verifier)_
