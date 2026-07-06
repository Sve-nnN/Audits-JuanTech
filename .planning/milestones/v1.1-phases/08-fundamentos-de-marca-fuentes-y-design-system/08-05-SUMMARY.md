---
phase: 08-fundamentos-de-marca-fuentes-y-design-system
plan: 05
subsystem: web-ui
tags: [design-system, css-modules, tokens, typography, theming]
requires:
  - "08-03: tokens.css global (:root dark-first + [data-theme=light]) importado por globals.css"
  - "08-01/08-03: var(--font-geist-mono) y var(--font-geist-sans) disponibles como CSS vars"
provides:
  - "home.module.css referenciando solo tokens semanticos (DS-01)"
  - "report.module.css sin vars locales --color-*, con Geist Mono en scores/metricas (FONT-04)"
affects:
  - "Pantallas v1.0: home (/), verify, report (/audits/[id]), history"
tech-stack:
  added: []
  patterns:
    - "CSS Modules: 0 hex crudo, solo var(--semantic-token)"
    - "Fondos suaves de severidad via color-mix(in srgb, var(--token) 12%, transparent)"
    - "Numerales/metricas en var(--font-geist-mono) con font-feature-settings: tnum 1"
key-files:
  created: []
  modified:
    - apps/web/app/home.module.css
    - apps/web/app/audits/[id]/report.module.css
decisions:
  - "Fondos de badge de severidad: color-mix a 12% sobre el token de color (sin token *-bg directo) para preservar el badge tenue en ambos temas"
  - "diffNew reutiliza var(--accent-text) sobre --severity-info-bg (color-mix con accent-text); diffPersistent usa --surface-hover + --text-muted"
  - "Boton primario de home migrado a var(--accent) (lime de marca) con texto var(--accent-foreground), reemplazando el navy/blue v1.0 (cambio de marca intencional del overhaul v1.1)"
  - "Valor medido de issue seleccionado por .issueField:nth-of-type(2) dd para aplicar mono solo al campo numerico sin tocar el markup"
metrics:
  duration: "~15 min"
  completed: 2026-07-05
  tasks: 2
  files: 2
---

# Phase 8 Plan 05: Migración de CSS Modules a tokens + Geist Mono en métricas — Summary

Swap mecánico 1:1 de los dos únicos CSS Modules con color crudo (`home.module.css` y `report.module.css`) a los tokens semánticos globales de `tokens.css`, eliminando los bloques `@media (prefers-color-scheme: dark)` (theming ahora global vía `[data-theme]`) y aplicando `var(--font-geist-mono)` con numerales tabulares a los scores y valores medidos del reporte. Objetivo primario cumplido: cero regresión de estructura/layout, cambios limitados a color y tipografía.

## What Was Built

### Task 1 — home.module.css a tokens (commit 4f42479)
- Superficies/bordes: `#ffffff`→`var(--surface)`, `#e2e8f0`→`var(--border)`, `#cbd5e1`→`var(--border-strong)`.
- Texto: `#64748b`/`#94a3b8`→`var(--text-muted)`, `#475569`→`var(--text-secondary)`.
- Botón primario: relleno `var(--accent)` + texto `var(--accent-foreground)`; focus `var(--ring)`.
- Estados: `#dc2626`→`var(--critical)`, `#16a34a`→`var(--success)`; hint bg `var(--surface-hover)`; enlace `var(--accent-text)`.
- Sombra de card a `var(--shadow-sm)`. Eliminados los 4 bloques `@media (prefers-color-scheme: dark)`.

### Task 2 — report.module.css a tokens + Geist Mono (commit 8c4b118)
- Colapsadas las vars locales `.page { --color-* }` (y su override `@media` oscuro) en los tokens globales `--success/--warning/--critical/--border/--text-muted/--text/--surface/--bg`.
- Fondos suaves de severidad (`--color-*-bg` sin token directo) reconstruidos como `--severity-good/warn/critical-bg` con `color-mix(in srgb, var(--token) 12%, transparent)` — preservan el badge tenue en ambos temas.
- Diff badges: `.diffNew`→`--severity-info-bg` + `var(--accent-text)`; `.diffPersistent`→`var(--surface-hover)` + `var(--text-muted)`; `.diffResolved` mantiene el par success. Eliminado el `@media` oscuro de diff.
- `.page` cableado a `var(--font-geist-sans)` en lugar del stack `system-ui` hardcodeado; sombra del hero a `var(--shadow-sm)`.
- Geist Mono (`var(--font-geist-mono)` + `font-feature-settings: "tnum" 1`) en: `.scoreCircleNumber`, `.categoryCardScore`, valores del perf grid (`.perfMetricRow > strong` / `span:not(.perfMetricLabel)`) y el valor medido de issue (`.issueFields > .issueField:nth-of-type(2) dd`). Etiquetas (`.perfMetricLabel`, `dt`, títulos) siguen en Geist Sans/Khand.

## Verification

- Greps: 0 hex crudos y 0 `prefers-color-scheme` en ambos módulos; 0 `--color-*` en report; `var(--surface)` y `var(--font-geist-mono)` presentes; `var(--font-geist-mono)` dentro de `.scoreCircleNumber`. Todos OK.
- `pnpm --filter @auditor/web build`: PASA (12 rutas, compilación y typecheck limpios).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Build fallaba por estado stale de `.next`**
- **Found during:** Task 2 (verificación de build)
- **Issue:** Primera corrida de `next build` abortó en el prerender de `/404` con `ENOENT: pages-manifest.json`. La compilación y el typecheck pasaron; el fallo era del caché `.next` desactualizado, no de los cambios CSS (CSS no puede producir un manifest faltante).
- **Fix:** `rm -rf apps/web/.next` y rebuild. Segunda corrida pasó limpia.
- **Files modified:** ninguno (artefacto de build).
- **Commit:** n/a.

**2. [Rule 3 - Blocking] Selección del valor medido de issue sin tocar markup**
- **Found during:** Task 2
- **Issue:** El plan pide Geist Mono en el `dd` del valor medido, pero los `dd` de `.issueField` no tienen clase distintiva y comparten grid con campos de texto (URL, criterio, recomendación) que deben quedar en Geist Sans. El plan además exige conservar el markup.
- **Fix:** Selector CSS `.issueFields > .issueField:nth-of-type(2) dd` (el 2.º campo es siempre "Valor medido" en el markup fijo de `page.tsx`), evitando modificar el TSX.
- **Files modified:** `apps/web/app/audits/[id]/report.module.css`.
- **Commit:** 8c4b118.

## Checkpoints

**Task 3 (checkpoint:human-verify, gate=blocking) — no-regresión visual:** AUTO-APROBADO bajo AUTO_MODE tras pasar los gates automáticos (greps + build). No es un checkpoint de legitimidad de paquete, por lo que califica para auto-aprobación. Nota para verificación manual posterior: el botón primario de home ahora es lime de marca (`var(--accent)`), un cambio intencional del overhaul v1.1, no una regresión.

## Scope Honored

No se tokenizaron los hex inline/SVG de `AuditProgress.tsx`, `pages/page.tsx`, `pages/[pageId]/page.tsx` ni `EntityGraphSvg.tsx` (deferidos a Fase 10 por `<scope_and_deferral>`). No se tocó `layout.tsx`, CSS de shell (plan 08-04), ni el pipeline de crawl/checks/scoring.

## Self-Check: PASSED

Archivos verificados en disco (home.module.css, report.module.css, 08-05-SUMMARY.md) y commits presentes (4f42479, 8c4b118).
