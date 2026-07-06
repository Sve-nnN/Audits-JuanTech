---
phase: 10-pantallas-redise-adas-copy-motion-y-accesibilidad
plan: "04"
subsystem: web-ui
tags: [ui, a11y, motion, tokens, screen-03]
requires: ["10-01"]
provides:
  - "AuditProgress re-skineado con barra de 3 fases animada (MOTION-02)"
  - "progress.module.css tokenizado y desacoplado de report.module.css"
affects:
  - "apps/web/app/audits/[id]/AuditProgress.tsx"
tech-stack:
  added: []
  patterns:
    - "CSS custom property (--fill) para el ancho data-driven del segmento en vez de style numérico"
    - "Shimmer indeterminado reusando el patrón @keyframes de Skeleton.module.css"
    - "role=progressbar determinado/indeterminado según fase (aria-valuenow vs aria-busy)"
key-files:
  created:
    - "apps/web/app/audits/[id]/progress.module.css"
  modified:
    - "apps/web/app/audits/[id]/AuditProgress.tsx"
decisions:
  - "Ancho del segmento activo en crawling vía CSS var --fill (no style numérico inline) para cumplir DS-01"
  - "En failed se pintan de --critical los segmentos hasta la fase actual para leer la barra como error"
metrics:
  duration: ~15m
  completed: 2026-07-06
---

# Phase 10 Plan 04: Progreso de auditoría (SCREEN-03) Summary

Re-skin de la pantalla de progreso de auditoría con barra de 3 fases animada (crawling → analyzing → performance), copy neutro humanizado y accesibilidad completa (role=progressbar + aria-live), tokenizando todo el hex/style inline (cierra DS-01 para este archivo) y desacoplando de report.module.css con un progress.module.css propio, sin tocar el polling de v1.0.

## What Was Built

- **`progress.module.css` (nuevo):** panel `--surface`/`--radius-lg`/padding `--space-8`, stepper de 3 segmentos (`--border` pendiente, `--success` completado, `--accent` activo, `--critical` failed), shimmer indeterminado con `@keyframes shimmer` y guard `prefers-reduced-motion` obligatorio al final. Cero hex crudo; solo tokens semánticos.
- **`AuditProgress.tsx` (re-skin):**
  - Import redirigido de `./report.module.css` a `./progress.module.css`.
  - Barra MOTION-02: segmento activo en `crawling` llena por `width` (CSS var `--fill`, transición `--motion-base`); en `analyzing`/`performance` (sin ratio) muestra shimmer indeterminado.
  - DS-01: eliminados todos los `style={{...}}` numéricos/hex (`color:"#dc2626"`, `fontSize`, `opacity`) → clases `errorText` (`--critical`), `phaseLabel`, `phaseCaption`, `readout`.
  - A11y: `role="progressbar"` con `aria-valuenow/min/max` en crawling determinado y `aria-busy` en fases indeterminadas + `aria-label` de fase; `role="status" aria-live="polite"` en la etiqueta de fase; `role="alert"` en failed.
  - Copy exacto de UI-SPEC (neutral, sin voceo, sin em/en dashes).
  - **Poll preservado VERBATIM:** `setInterval(..., 2500)` + `clearInterval` + `window.location.reload()` en `done`/`failed`, shape `AuditStats` intacto.

## Verification

Todos los gates automáticos del plan pasaron:
- `pnpm --filter @auditor/web typecheck` → PASS
- `progress.module.css` existe → PASS
- Sin import de `report.module.css` → PASS
- Sin hex crudo en AuditProgress.tsx → PASS
- `setInterval` presente (poll intacto) → PASS
- `role="progressbar"` presente → PASS
- Anti-voceo grep → PASS (0 coincidencias)
- `report.module.css` NO tocado → PASS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tipo de retorno de `segmentClass` incompatible con CSS Modules bajo `noUncheckedIndexedAccess`**
- **Found during:** Task 1 (typecheck)
- **Issue:** `tsc` reportaba `Type 'string | undefined' is not assignable to type 'string'` en los `return styles.segment` (acceso indexado a claves del módulo CSS).
- **Fix:** Cambiar la firma de `segmentClass(index): string` a `string | undefined`; `className` acepta `string | undefined`.
- **Files modified:** apps/web/app/audits/[id]/AuditProgress.tsx
- **Commit:** 2a50c74

## Checkpoint

**Task 2 (checkpoint:human-verify — validación visual, gate="blocking"):** auto-aprobado bajo AUTO_MODE tras pasar todos los gates automáticos. No es un checkpoint de legitimidad de paquete (no se instaló nada). Validación visual en dark/light + mobile/desktop y reduced-motion queda disponible para Juan de forma asíncrona.

## Self-Check: PASSED
- FOUND: apps/web/app/audits/[id]/progress.module.css
- FOUND: apps/web/app/audits/[id]/AuditProgress.tsx
- FOUND commit: 2a50c74
