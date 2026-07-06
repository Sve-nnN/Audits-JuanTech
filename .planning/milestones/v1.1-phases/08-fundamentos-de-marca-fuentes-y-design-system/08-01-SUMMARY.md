---
phase: 08-fundamentos-de-marca-fuentes-y-design-system
plan: 01
subsystem: frontend-design-system
tags: [fonts, typography, next-font, design-system, csp-safe]
requires: []
provides:
  - "apps/web/app/fonts.ts (array, khand, geistSans, geistMono con CSS variables + swap)"
  - "geist + next-themes en dependencias de apps/web"
  - "Array-Regular.woff2 self-hosted"
affects:
  - "apps/web/app/layout.tsx (aplicará las .variable en plan 08-03)"
tech-stack:
  added: [geist@^1.7.2, next-themes@^0.4.6]
  patterns: [next/font/local, next/font/google, self-hosted-woff2, css-variables-font-display-swap]
key-files:
  created:
    - apps/web/app/fonts.ts
    - apps/web/app/fonts/Array-Regular.woff2
  modified:
    - apps/web/package.json
    - pnpm-lock.yaml
decisions:
  - "Fallbacks del UI-SPEC añadidos vía la opción fallback de next/font (array y khand) para robustez pre-swap"
  - "Geist Sans/Mono re-exportados tal cual del paquete geist (ya fijan sus CSS vars internamente)"
metrics:
  duration: ~4min
  completed: 2026-07-06
---

# Phase 8 Plan 01: Fundamentos de tipografía de marca Summary

Módulo central de fuentes que declara las cuatro tipografías de marca (Array display self-hosted, Khand de Google, Geist Sans/Mono vía paquete `geist`) como CSS variables con `font-display: swap`, todas self-hosted en build sin CDN en runtime.

## What Was Built

- **Task 1 (checkpoint de legitimidad):** Pre-resuelto por el orquestador. Ambos paquetes verificados en npmjs.com: `geist@1.7.2` (mantenedor vercel-release-bot, repo vercel/geist-font) y `next-themes@0.4.6` (mantenedor pacocoursey, repo pacocoursey/next-themes). Aprobado, sin typosquat.
- **Task 2:** Instalado `geist ^1.7.2` y `next-themes ^0.4.6` en las dependencias de `apps/web` vía `pnpm --filter @auditor/web add`. Descargado el binario woff2 de Array (display, peso 400) desde el CSS vigente de Fontshare y colocado self-hosted en `apps/web/app/fonts/Array-Regular.woff2` (20832 bytes, magic bytes `wOF2` verificados). Sin ningún `<link>` a CDN.
- **Task 3:** Creado `apps/web/app/fonts.ts` con cuatro named exports: `array` (`next/font/local`, `--font-array`), `khand` (`next/font/google`, pesos 400/500/600/700, `--font-khand`), `geistSans` y `geistMono` re-exportados de `geist/font/sans` y `geist/font/mono`. Todas con `display: "swap"` y fallbacks alineados a los stacks del 08-UI-SPEC. El módulo solo declara las fuentes; el wiring al `<html>` queda para el plan 08-03.

## Verification Results

- Task 2 gate: `geist`/`next-themes` presentes en package.json + woff2 válido (`wOF2`) → OK.
- Grep de CDN (`fonts.googleapis` / `fontshare.com`) en `apps/web/app/` → 0 coincidencias (CSP-safe).
- Task 3 gate: greps de `next/font/local`, `next/font/google`, `geist/font/sans`, `geist/font/mono`, `swap` → OK.
- `pnpm --filter @auditor/web typecheck` → pasa sin errores.
- `pnpm --filter @auditor/web build` → compila y genera 9/9 páginas estáticas (Khand self-hosteado en build sin fallo de red).

## Deviations from Plan

### Auto-fixed / mejoras dentro de alcance

**1. [Rule 2 - Correctness] Fallbacks explícitos en next/font**
- **Found during:** Task 3
- **Issue:** El plan describía los fallback stacks (08-UI-SPEC) para la capa CSS, pero `next/font` acepta una opción `fallback` que refuerza el render pre-swap.
- **Fix:** Añadidos `fallback: ["Khand", "system-ui", "sans-serif"]` a `array` y `fallback: ["Arial Narrow", "system-ui", "sans-serif"]` a `khand`, alineados 1:1 con el UI-SPEC. No altera CSS vars ni el contrato de exports.
- **Files modified:** apps/web/app/fonts.ts
- **Commit:** fb758ef

## Package Legitimacy (Task 1 checkpoint)

Checkpoint `blocking-human` pre-resuelto por el orquestador. Ambos paquetes son oficiales y ampliamente usados; instalación autorizada (T-08-SC mitigado).

## Commits

- 49af08d — chore(08-01): add geist + next-themes deps and self-host Array woff2
- fb758ef — feat(08-01): central brand fonts module (fonts.ts)

## Notes / Handoff

- `fonts.ts` NO aplica las fuentes al DOM. El plan 08-03 debe importar `array`, `khand`, `geistSans`, `geistMono` en `layout.tsx` y componer sus `.variable` en el `className` del `<html>`.
- No se tocaron tokens.css, providers ni el theming de layout (pertenecen a otros planes de la fase).

## Self-Check: PASSED

Todos los archivos declarados existen y ambos commits (49af08d, fb758ef) están en el historial. `next-themes` y `geist` presentes en package.json.
