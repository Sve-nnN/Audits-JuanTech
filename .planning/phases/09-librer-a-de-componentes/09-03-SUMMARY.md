---
phase: 09-librer-a-de-componentes
plan: 03
subsystem: ui-components
tags: [ui, design-system, badge, skeleton, a11y, reduced-motion]
requires:
  - tokens.css (Fase 8): --success/--warning/--critical/--accent-text/--text-secondary/--surface-hover/--surface/--border/--text/--radius-full/--radius-sm/--radius-md/--space-*/--font-size-xs/--font-geist-sans
  - labels.ts (09-01): SEVERITY_LABEL, DIFF_LABEL para los wrappers
  - lucide-react (09-01): iconos AlertOctagon/AlertTriangle/CheckCircle2/Sparkle/Circle
provides:
  - Badge (COMP-03): pill de severidad/diff con 8 variantes tokenizadas
  - SeverityBadge/DiffBadge (COMP-03): wrappers tipados localizados
  - Skeleton (COMP-08): placeholder de carga con shimmer accesible (6 variantes)
affects:
  - Accordion (wave 3, 09-06) consumidor de Badge
  - Fase 10 report /audits/[id] y cualquier vista con estado de carga (Skeleton)
tech-stack:
  added: []
  patterns:
    - '"use client" + named export + sibling CSS Module (camelCase una palabra)'
    - "soft-fills --sev-* locales a .badge (primitivo self-contained, no scope global)"
    - "shimmer CSS ::after con guard prefers-reduced-motion obligatorio"
    - "aria-hidden forzado en Skeleton (no se confía en el consumidor)"
key-files:
  created:
    - apps/web/app/components/ui/Badge.tsx
    - apps/web/app/components/ui/Badge.module.css
    - apps/web/app/components/ui/Skeleton.tsx
    - apps/web/app/components/ui/Skeleton.module.css
  modified: []
decisions:
  - "Soft-fills renombrados de --severity-*-bg (globales en .page del reporte) a --sev-*-bg locales en .badge para que el badge sea self-contained"
  - "Wrappers exponen prop icon?:boolean (default true) para poder omitir el icono líder sin perder el tipado"
  - "Skeleton card renderiza un contenedor de superficie (no animado) envolviendo dos bloques .skeleton internos (título + score); solo los internos hacen shimmer"
  - "Skeleton text con lines>1 apila N spans en flex-column; la última al 60% para simular párrafo real"
metrics:
  duration: ~8m
  completed: 2026-07-06
  tasks: 2
  files: 4
---

# Phase 9 Plan 03: Badge + Skeleton Summary

Badge (pill de severidad/diff con 8 variantes tokenizadas y wrappers `SeverityBadge`/`DiffBadge` localizados desde `labels.ts`) y Skeleton (placeholder de carga con shimmer CSS que respeta `prefers-reduced-motion` y siempre es `aria-hidden`), dos primitivos livianos self-contained sobre los tokens de la Fase 8.

## What Was Built

### Task 1 — Badge + wrappers (COMP-03) · commit aa42d6e
- Named exports `"use client"`: `Badge`, `SeverityBadge`, `DiffBadge` en un mismo archivo, con JSDoc en español (propósito + a11y).
- Base `.badge`: `inline-flex`, `gap:var(--space-1)`, `padding:var(--space-1) var(--space-2)`, `border-radius:var(--radius-full)`, `font-family:var(--font-geist-sans)`, `font-size:var(--font-size-xs)`, `font-weight:600`, `line-height:1.4`, `white-space:nowrap`.
- Soft-fills `--sev-good-bg`/`--sev-warn-bg`/`--sev-critical-bg`/`--sev-info-bg` definidos LOCALES en `.badge` vía `color-mix(... 12%, transparent)` sobre `--success`/`--warning`/`--critical`/`--accent-text` (portados y renombrados desde `report.module.css` L7-14, antes globales en `.page`).
- 8 variantes mapeadas a foreground/background según la tabla UI-SPEC: critical, warning, ok, new, persistent, resolved, info, neutral. Clase compuesta con template string `` `${styles.badge} ${styles[variant]}` `` vía Record tipado `string|undefined`.
- Icono lucide opcional a 14px, `aria-hidden`, hereda `currentColor`. Defaults por variante: severidad→AlertOctagon/AlertTriangle/CheckCircle2, diff→Sparkle/Circle/CheckCircle2.
- `SeverityBadge` (critical|warning|ok) y `DiffBadge` (new|persistent|resolved) resuelven la etiqueta desde `SEVERITY_LABEL`/`DIFF_LABEL` y el icono default; ambos aceptan `icon?:boolean` (default true).
- Decorativo, no focusable; el texto porta el significado (color nunca es señal única). Cero hex crudo.

### Task 2 — Skeleton (COMP-08) · commit 83b245b
- Named export `"use client"` con JSDoc (siempre decorativo). `aria-hidden="true"` forzado en el render, no confiado al consumidor.
- Base `.skeleton`: `background:var(--surface-hover)`, `border-radius:var(--radius-sm)`, `position:relative`, `overflow:hidden`.
- Shimmer vía `::after`: `linear-gradient(90deg, transparent, color-mix(in srgb, var(--text) 6%, transparent), transparent)` + `animation:shimmer 1.4s ease-in-out infinite`, `@keyframes shimmer` translateX -100%→100%.
- 6 variantes: `text` (14px, con `lines>1` apila N líneas en flex-column gap `--space-2`, última al 60%), `block` (20px), `circle` (`--radius-full`, 40×40), `gauge` (132×132 circular, footprint del ScoreGauge lg), `card` (contenedor `--surface`+`--border`+`--radius-md`+padding `--space-4` envolviendo skeleton de título + score), `row` (44px altura de fila).
- `width`/`height` overridean vía `style` inline (número → px).
- GUARD OBLIGATORIO `@media (prefers-reduced-motion: reduce){ .skeleton::after { animation: none; } }`: bajo reduced-motion el shimmer se anula y el bloque muted queda estático.
- Cero hex crudo (color-mix sobre tokens permitido).

## Verification

- Ambas verificaciones automatizadas del plan pasaron: named exports presentes, import de lucide-react, `--sev-critical-bg` local, `@keyframes shimmer` + guard reduced-motion con `animation: none`, scan de hex crudo negativo, `pnpm --filter @auditor/web typecheck` → OK.
- Scan de hex crudo sobre ambos CSS Modules: sin coincidencias.

## Deviations from Plan

None - plan executed exactly as written. La única precisión de implementación (no una desviación de alcance): la variante `card` del Skeleton se compone como contenedor de superficie con dos bloques `.skeleton` internos (título + score), documentada en decisions.

## Note on State Files

STATE.md/ROADMAP.md NO se editaron desde este agente (wave 2 en paralelo con agente hermano). Los requirements COMP-03 y COMP-08 se marcan vía SDK; la consolidación de STATE/ROADMAP queda a cargo del orquestador.

## Self-Check: PASSED

Los 5 archivos declarados existen en disco; los commits `aa42d6e` y `83b245b` están presentes en el historial.
