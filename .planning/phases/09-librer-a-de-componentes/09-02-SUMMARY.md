---
phase: 09-librer-a-de-componentes
plan: 02
subsystem: ui-components
tags: [ui, design-system, score-state, a11y, motion-ready]
requires:
  - tokens.css (Fase 8): tokens semánticos --success/--warning/--critical/--text-secondary/--text-muted/--border/--surface/--radius-md/--space-*
provides:
  - ScoreGauge (COMP-01): indicador circular de score, estático, motion-ready
  - CategoryCard (COMP-02): card por categoría con variante link accesible
affects:
  - Fase 10 report /audits/[id] (consumidor principal)
tech-stack:
  added: []
  patterns:
    - '"use client" + named export + sibling CSS Module (camelCase una palabra)'
    - "estado→color reusando tokens de severidad (DS-02)"
    - "custom prop --gauge-offset sin transition (motion-ready para Fase 10)"
key-files:
  created:
    - apps/web/app/components/ui/ScoreGauge.tsx
    - apps/web/app/components/ui/ScoreGauge.module.css
    - apps/web/app/components/ui/CategoryCard.tsx
    - apps/web/app/components/ui/CategoryCard.module.css
  modified: []
decisions:
  - "Records estado→clase tipados como string|undefined por el typing estricto de CSS Modules"
  - "CategoryCard con href usa next/link (Link) como único <a> wrapper (un solo tab stop)"
  - "Número/arco del gauge se superponen con readout absoluto sobre el svg"
metrics:
  duration: ~10m
  completed: 2026-07-06
  tasks: 2
  files: 4
---

# Phase 9 Plan 02: ScoreGauge + CategoryCard Summary

ScoreGauge (anillo SVG circular con arco coloreado por estado y número en Geist Mono) y CategoryCard (card por categoría con variante link accesible), ambos estáticos y motion-ready, consumiendo solo tokens semánticos de la Fase 8.

## What Was Built

### Task 1 — ScoreGauge (COMP-01) · commit 47dc286
- Named export `"use client"` con JSDoc en español (propósito + a11y).
- `<svg role="img">` con `aria-label` derivado de value + estado en palabras (color nunca es la única señal); track y arco `aria-hidden`, svg no focusable.
- Dos círculos concéntricos: track `stroke:var(--border)` + arco `stroke:currentColor` con `stroke-linecap:round`, `stroke-dasharray`=circunferencia, rotación `-90deg` para arrancar a las 12.
- Geometría por tamaño: lg 132×132 / stroke 8, md 96×96 / stroke 6; radio y circunferencia calculados en runtime.
- Número centrado en Geist Mono (tnum, weight 700, line-height 1, `var(--text)`), `--font-size-5xl` (lg) / `--font-size-2xl` (md); sublabel "/ 100" en Geist Mono `--font-size-sm` `var(--text-muted)`.
- Estado `null`: solo track, número `—` en `var(--text-muted)`, aria-label "Score sin datos", sin color de estado.
- `stroke-dashoffset` expuesto vía custom prop `--gauge-offset` SIN transition; guard `@media (prefers-reduced-motion: reduce)` listo para Fase 10.

### Task 2 — CategoryCard (COMP-02) · commit 713e110
- Named export `"use client"` con JSDoc; layout `var(--surface)` + `1px solid var(--border)` + `var(--radius-md)`, padding `var(--space-4)` → `var(--space-5)` ≥640px, stack vertical `gap:var(--space-2)`.
- Label como `<p>` en `var(--text-secondary)` (NO `--text-muted`) por el fix de contraste AA de UI-FEEDBACK.
- Score en Geist Mono `--font-size-2xl` tnum weight 700, coloreado por estado (mismo mapa que el gauge); `null` → `—` en `var(--text-muted)`.
- Caption de estado `--font-size-xs` weight 600 coloreado por estado; `null` → "sin datos" en muted.
- Variante `href`: toda la card envuelta en un único `<a>` (next/link) — un solo tab stop, sin interactivos anidados — con hover (`--surface-hover` + `--border-strong`) y focus-visible (`outline var(--ring)`), transition guardado por reduced-motion. Sin href: card estática sin hover.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tipo de los Records estado→clase**
- **Found during:** Task 1 (y replicado en Task 2)
- **Issue:** El typing estricto de CSS Modules exporta cada clase como `string | undefined`, por lo que `Record<Status, string>` fallaba el typecheck (TS2322).
- **Fix:** Se tipó el record de clases como `Record<..., string | undefined>`.
- **Files modified:** ScoreGauge.tsx, CategoryCard.tsx
- **Commits:** 47dc286, 713e110

## Verification

- Gates automatizados (por tarea): presencia de `"use client"`, named export, `role="img"` (gauge), `text-secondary` + `prefers-reduced-motion` (card), `--gauge-offset` presente, scan anti-hex (cero hex crudo fuera de comentarios) y `pnpm --filter @auditor/web typecheck` → OK en ambas.
- Cero dependencia de lucide-react ni de helpers de wave 1 (independiente de 09-01).
- No se tocaron screens ni pipeline.

## Self-Check: PASSED

- FOUND: apps/web/app/components/ui/ScoreGauge.tsx
- FOUND: apps/web/app/components/ui/ScoreGauge.module.css
- FOUND: apps/web/app/components/ui/CategoryCard.tsx
- FOUND: apps/web/app/components/ui/CategoryCard.module.css
- FOUND: commit 47dc286
- FOUND: commit 713e110
