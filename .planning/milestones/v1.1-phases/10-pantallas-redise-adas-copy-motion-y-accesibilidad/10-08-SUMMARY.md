---
phase: 10
plan: 08
subsystem: web-ui
tags: [a11y, responsive, motion, sweep, wcag]
requires: ["10-02", "10-03", "10-04", "10-05", "10-06", "10-07"]
provides: ["skip-to-content", "a11y-acceptance-bar-signed"]
affects: ["apps/web/app/layout.tsx", "apps/web/app/globals.css", "apps/web/app/audits/[id]/pages/pages.module.css"]
tech-stack:
  added: []
  patterns: ["global skip-link (visually hidden until focus)", "prefers-reduced-motion global net + per-primitive branches", "keyboard-reachable table scroll regions"]
key-files:
  created: []
  modified:
    - apps/web/app/layout.tsx
    - apps/web/app/globals.css
    - apps/web/app/audits/[id]/pages/pages.module.css
decisions:
  - "Skip-to-content se implementa global en layout (no solo en reporte): un unico <a href=#main-content> cubre las 6 pantallas."
  - "El breadcrumb de pages pasa a --accent-text para coherencia con el reporte y contraste AA en un elemento interactivo."
metrics:
  duration: "~12 min"
  completed: "2026-07-06"
requirements: [A11Y-01, A11Y-02, A11Y-03, MOTION-03]
---

# Phase 10 Plan 08: Barrido final A11Y / responsive / motion Summary

Auditoria cruzada de las 6 pantallas de v1.1 contra la barra de aceptacion A11Y del UI-SPEC. El grueso del contrato ya lo cumplian las olas previas (regiones de scroll enfocables en IssuesTable e history, grafo responsive con max-width, cero hex crudo en tsx, sin `outline:none`, reduced-motion por primitiva + net global). El sweep cerro dos gaps puntuales: agrego skip-to-content global y corrigio el contraste del breadcrumb de pages.

## What Was Swept (verificado OK, sin cambios)

- **Responsive (A11Y-01):** IssuesTable (`overflow-x:auto` + `min-width` + `tabindex=0` `role=region`), tabla de history (`.scroll` enfocable con `role=region aria-label`), y EntityGraphSvg (`width:100%` + `max-width:--container-narrow`) escalan/scrollean dentro de su region, nunca la pagina. `shell.main` tiene `min-width:0` (evita overflow de flex). Sin hex crudo en tsx (DS-01 cerrado).
- **Contraste (A11Y-02):** cuerpo/caption usan `--text`/`--text-secondary`. Los `--text-muted` restantes son legitimos (placeholders de Input, disabled, dev-note, arrow-marker del grafo, fallback de severidad, EmptyState chip). Las clases legacy con `--text-muted` en home.module.css son codigo muerto (nadie las importa: home usa clases nuevas, history usa history.module.css) — no renderizan, se dejan intactas por scope.
- **Foco (A11Y-02):** cero `outline:none` sin reemplazo; focus-visible con `2px var(--ring)` en enfocables.
- **ARIA/motion (MOTION-03):** `prefers-reduced-motion` cubierto por net global en globals.css MAS ramas por primitiva (ScoreGaugeAnimated, progress bar, reveals, Skeleton, Button, ThemeToggle, accordion, CategoryCard).

## Fixes Applied

1. **Skip-to-content global (A11Y-03):** `<a href="#main-content" class="skipLink">Saltar al contenido</a>` como primer enfocable en layout; `<main>` recibe `id="main-content"`. Estilo `.skipLink` en globals.css: visualmente oculto (`top` negativo) hasta `:focus-visible`, entonces aparece con el ring de foco. El net de reduced-motion neutraliza su transicion.
2. **Breadcrumb de pages (A11Y-02):** `.breadcrumb a` pasa de `--text-muted` a `--accent-text` — contraste AA en un enlace y coherencia con el breadcrumb del reporte. Aplica a la lista de paginas y al detalle (ambos comparten pages.module.css).

## Deviations from Plan

None - el plan se ejecuto como estaba escrito. Los dos fixes caen dentro del alcance "corregir gaps detectados en los archivos de pantalla", solo tokens, sin librerias, sin tocar data-fetching ni el pipeline de crawl/checks/scoring, sin voceo.

## Automated Gates

- `pnpm --filter @auditor/web typecheck` -> PASS (tsc --noEmit limpio)
- `pnpm --filter @auditor/web build` -> PASS (12 rutas compiladas)
- `grep -c prefers-reduced-motion apps/web/app/globals.css` -> 1 (net global presente; ramas por primitiva en sus modulos)

## Checkpoint (Task 2 — pixel-perfect de Juan)

`checkpoint:human-verify` auto-aprobado en AUTO_MODE tras gates verdes (indicacion explicita de Juan: hace su pase visual por separado, no bloquear). No es gate de package-legitimacy.

## Self-Check: PASSED

- Archivos modificados presentes en disco (layout.tsx, globals.css, pages.module.css).
- SUMMARY presente.
- Commit 228e401 existe en el historial.
