---
phase: 08-fundamentos-de-marca-fuentes-y-design-system
plan: 02
subsystem: design-system
tags: [css, tokens, theming, dark-mode, design-tokens]
requires: []
provides:
  - "apps/web/app/tokens.css — tokens primitivos + semánticos (dark default) + override light"
  - "Tokens semánticos: --bg, --surface, --text, --accent, --border, --critical/--warning/--success, --ring"
affects:
  - "apps/web/app/globals.css (lo importará en 08-03)"
tech-stack:
  added: []
  patterns:
    - "CSS custom properties planas (sin Tailwind ni PostCSS)"
    - "Dark-first: semánticos en :root, override bajo [data-theme=\"light\"]"
    - "Score-state reutiliza los tres tokens de severidad (DS-02)"
key-files:
  created:
    - apps/web/app/tokens.css
  modified: []
decisions:
  - "Dark como tema default en :root; light solo sobreescribe tokens semánticos y sombras"
  - "Rampas primitivas y escalas (espaciado/tipografía/radios/z-index) son theme-agnósticas, no se duplican en light"
  - "good→--success, needs_improvement→--warning, critical→--critical: única fuente para severidad y estados de score"
metrics:
  duration: ~3 min
  completed: 2026-07-06
requirements: [DS-01, DS-02]
---

# Phase 8 Plan 2: Tokens de diseño (tokens.css) Summary

Archivo único `tokens.css` que centraliza todos los tokens de diseño como CSS custom properties: rampas de color primitivas (slate/ink/lime/red/amber/green), escala de espaciado 4px, tipografía (tamaños/line-heights/pesos), radios, z-index, breakpoints y contenedores, más los tokens semánticos con tema oscuro por default en `:root` e inversión coherente bajo `[data-theme="light"]`.

## What Was Built

- **Primitivos theme-agnósticos en `:root`:** rampas slate 50→950, ink 900/800/700/600, lime 300→700, red/amber/green 400/500/600; escala `--space-0..--space-24` (base 4px); tipografía `--font-size-xs..6xl`, `--lh-*`, `--weight-*`; radios `--radius-sm/md/lg/full`; `--z-base..--z-tooltip`; breakpoints `--bp-*`; contenedores `--container-*`.
- **Semánticos DARK (default) en `:root`:** `--bg #0a0b0f`, `--surface #11131a`, `--surface-raised`, `--surface-hover`, `--border #1e293b`, `--border-strong`, `--text #f1f5f9`, `--text-secondary`, `--text-muted`, `--accent #c3f53c`, `--accent-hover`, `--accent-foreground`, `--accent-text`, `--critical #ef4444`, `--warning #f59e0b`, `--success #22c55e`, `--ring`; sombras dark `--shadow-sm/md/lg/focus`.
- **Override LIGHT bajo `[data-theme="light"]`:** solo tokens semánticos + sombras, con los shades accesibles del UI-SPEC (`--accent-text #4d7c0f`, `--ring #4d7c0f`, severidad en shades 600, `--bg #f8fafc`, `--surface #ffffff`, sombras suaves rgba(15,23,42,...)). Primitivos y escalas no se redefinen.
- **Coherencia DS-02:** comentario explícito que mapea los estados de score a los tres tokens de severidad, sin tokens divergentes.

Todos los valores coinciden 1:1 con las tablas Color/Spacing/Typography/Radii-Shadows-Z-index del 08-UI-SPEC.md. No se importó a globals.css (diferido a 08-03 según el límite del plan).

## Tasks Completed

| Task | Nombre | Commit |
|------|--------|--------|
| 1 | Crear tokens.css con primitivos y semánticos (dark default) | 041b14a |
| 2 | Añadir override del tema claro y verificar coherencia de severidad | fadc1a3 |

## Verification

- Task 1 gate: `grep` de `--accent:`, `--space-6:`, `--z-sticky:`, `--shadow-focus:` → OK
- Task 2 gate: `grep` de `[data-theme="light"]` y `--accent-text: #4d7c0f` → OK
- Parseo CSS válido: se confirmará en 08-03 al importarlo en globals.css (build de Next.js).

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: apps/web/app/tokens.css
- FOUND: commit 041b14a
- FOUND: commit fadc1a3
