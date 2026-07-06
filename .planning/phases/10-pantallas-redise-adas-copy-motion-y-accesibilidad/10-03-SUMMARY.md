---
phase: 10-pantallas-redise-adas-copy-motion-y-accesibilidad
plan: 03
subsystem: web/verify
tags: [ui, screen-02, verify, copy, motion, a11y, stylesheet-decouple]
requires:
  - "Phase 9 Button (COMP-06)"
  - "Phase 9 ErrorState/EmptyState (COMP-07)"
  - "tokens.css + globals.css (Wave 1)"
provides:
  - "SCREEN-02 re-skineado con 4 estados (idle/verifying/done/error)"
  - "apps/web/app/verify/verify.module.css (stylesheet propio, desacopla home.module.css)"
affects:
  - "Home/History pueden trabajar home.module.css en paralelo sin conflicto"
tech-stack:
  added: []
  patterns:
    - "State machine → composición con primitivos de Fase 9 (Button loading, ErrorState)"
    - "Cross-fade + scale-in con --motion-base/--ease-out, reduced-motion estático"
    - "Foco al heading del resultado en cambio de estado (useEffect + tabIndex=-1 ref)"
key-files:
  created:
    - apps/web/app/verify/verify.module.css
  modified:
    - apps/web/app/verify/VerifyClient.tsx
    - apps/web/app/verify/page.tsx
decisions:
  - "verify.module.css replica --sev-good-bg con color-mix local (el token está scoped a Badge.module.css)"
  - "errorKind (generic/expired/network) clasifica el mensaje del server sin tocar el POST"
  - "Se elimina el estado `error` (string) no usado; la copy fija viene del UI-SPEC vía errorKind"
metrics:
  duration: "~5 min"
  completed: "2026-07-06"
  tasks: 2
  files: 3
---

# Phase 10 Plan 03: Re-skin SCREEN-02 (Verify email) Summary

Verify email re-skineado a 4 estados claros (idle/verifying/done/error) compuestos con Button + ErrorState de Fase 9 e iconos lucide, con copy en español neutro sin voceo (strings exactos del UI-SPEC) y un `verify.module.css` propio que rompe la dependencia de `home.module.css` para permitir trabajo paralelo entre Home/Verify/History.

## What Was Built

- **`verify.module.css` (nuevo):** panel `--surface`/`--radius-lg`/padding `--space-8`, contenedor `--container-narrow` top-aligned padded (sin centrado a 100vh), icono de estado, chip de éxito con `color-mix(var(--success) 12%)`, cross-fade `fade-in` (--motion-base) y `scale-in` del icono de éxito, branch `prefers-reduced-motion`. Cero hex, todo tokenizado.
- **`VerifyClient.tsx`:** los 4 estados con `ShieldCheck` (--accent-text, 32px) en idle, `Button loading` en verifying, `CheckCircle2` (--success, 40px) en chip `--sev-good-bg` + Link estilado como Button primary en done, y `ErrorState variant="error"` para error (genérico/expirado/red) y token faltante. Copy neutro exacto del UI-SPEC. Foco al heading del resultado en cambio de estado; `role="status"` en done, `role="alert"` (heredado de ErrorState) en error.
- **`page.tsx`:** import redirigido de `../home.module.css` a `./verify.module.css`; `<h1>` de pantalla (sr-only) + panel con `<h2>` del cliente. `await searchParams` y `CONSENT_TEXT` intactos.

## Data-fetching preservado (verbatim)

- Máquina `Status = "idle" | "verifying" | "done" | "error"` intacta.
- Único `POST /api/verify` con body `{ token, consentText }` sin cambios (endpoint, método, headers, payload).
- Early-return de token faltante preservado (ahora renderiza `ErrorState` en lugar de `<p>`).

## Copy (neutro, sin voceo, sin em/en dashes)

- idle: "Confirma tu correo" + consentText del server (en `--text`) + CTA "Confirmar y aceptar" / loading "Confirmando…".
- done: "Correo confirmado" + "Listo. Ya puedes lanzar tu auditoría gratuita{ con email}." + CTA "Continuar a mi auditoría".
- error genérico: "No pudimos verificar tu correo" + "El enlace no se pudo validar. Pide uno nuevo desde el inicio e inténtalo otra vez."
- error expirado/inválido: "El enlace ya no es válido" + "Este enlace de verificación expiró o ya se usó. Vuelve al inicio y solicita uno nuevo."
- error de red: "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo."
- token faltante: "Falta el token de verificación" + "El enlace está incompleto. Ábrelo de nuevo desde el correo que te enviamos."
- error CTA: "Volver al inicio".

## Verification

- `verify/` ya no referencia `home.module.css` (gate PASS).
- `verify.module.css` existe, cero hex (gate PASS).
- Cero voceo real (formas vos acentuadas: `confirmá|podés|ingresá|volvé|…` → PASS). Sin em/en dashes.
- Typecheck: los archivos de verify no producen errores en `pnpm --filter @auditor/web typecheck`.

## Deviations from Plan

**1. [Rule 3 - Blocking] Gate `pnpm typecheck` reporta errores fuera de scope**
- **Found during:** Task 1 verificación.
- **Issue:** El typecheck del paquete web falla en `apps/web/app/audits/[id]/AuditProgress.tsx` (SCREEN-03), archivo con cambios sin commitear de un plan de Wave 2 en curso que comparte el working tree. No pertenece a este plan.
- **Fix:** Ninguno — fuera de scope (SCOPE BOUNDARY). Confirmado que los tres archivos de verify no producen errores de typecheck. No se toca `AuditProgress.tsx`.
- **Files modified:** ninguno.
- **Commit:** n/a.

**2. [Gate false-positive] Regex de voceo del plan matchea la copy neutra correcta**
- **Issue:** El gate `grep -inE 'confirm[áa] '` matchea "Confirma tu correo" (imperativo tú neutro, correcto) porque `[áa]` incluye la "a" sin acento. La forma voceo sería "confirmá" (acentuada), ausente.
- **Fix:** Verificado con un grep específico de formas vos acentuadas → cero voceo. La copy es el string exacto del UI-SPEC. No se altera la copy.

## Threat Flags

Sin superficie de seguridad nueva. El re-skin solo muestra el resultado de `/api/verify` (validación de v1.0 intacta); se mantiene el click explícito en "Confirmar y aceptar" (intención double opt-in, T-10-03-R mitigado).

## Checkpoint

Task 2 (`checkpoint:human-verify` — validación visual de Juan) auto-aprobado bajo AUTO_MODE tras pasar todos los gates (typecheck de verify limpio, desacople de home.module.css, cero voceo, cero hex). ⚡ Auto-approved: Validación visual de Verify.

## Self-Check: PASSED

Todos los archivos creados/modificados existen; commit 86b965c presente en el historial; sin deletions inesperadas.
