---
phase: 08-fundamentos-de-marca-fuentes-y-design-system
plan: 04
subsystem: frontend-shell
tags: [layout, design-system, header, footer, css-modules, tokens]
requires:
  - "08-02: tokens.css (--surface, --border, --z-sticky, --container-max, --space-*, --font-khand, --font-geist-sans)"
  - "08-03: layout.tsx con Providers/fuentes/suppressHydrationWarning + ThemeToggle"
provides:
  - "AppHeader: cabecera sticky compartida (wordmark, nav Auditar/Historial, ThemeToggle)"
  - "AppFooter: pie compartido (wordmark, enlaces, copyright)"
  - "shell.module.css: primitivas de layout (container, grid 12-col, header, footer)"
  - "layout.tsx: shell montado alrededor de children para todas las pantallas"
affects:
  - "Todas las pantallas heredan header/footer; Fase 10 refina cada pantalla y adopta .container"
tech-stack:
  added: []
  patterns:
    - "CSS Modules camelCase, tokens semánticos only (0 hex crudo)"
    - "main full-bleed para no recortar pantallas v1.0 con fondo full-bleed"
key-files:
  created:
    - apps/web/app/components/AppHeader.tsx
    - apps/web/app/components/AppFooter.tsx
    - apps/web/app/components/shell.module.css
  modified:
    - apps/web/app/layout.tsx
decisions:
  - "main es full-bleed (shell.main) en lugar de .container para evitar recorte del fondo full-bleed del reporte v1.0 en pantallas anchas"
metrics:
  duration: ~8m
  completed: 2026-07-05
requirements: [DS-04, FONT-04]
---

# Phase 8 Plan 04: Base Layout Shell Summary

Shell de layout base compartido (header sticky de 64px, footer y primitivas de contenedor/grid con tokens) montado en el root layout, de modo que todas las pantallas heredan el mismo chrome de marca con el ThemeToggle integrado en el header.

## What Was Built

- **`shell.module.css`**: primitivas de layout con tokens únicamente (0 hex crudo):
  - `.container` (max-width `--container-max` 1200px, `margin-inline: auto`, gutter responsive 16px → 24px ≥640px → 32px ≥1024px, sin overflow horizontal).
  - `.grid` 12 columnas con `gap: var(--space-6)`, colapsa a una columna en móvil.
  - `.header` sticky 64px (`position: sticky; top: 0; z-index: var(--z-sticky)`, `background: var(--surface)`, `border-bottom` con `--border`).
  - `.footer` (`background: var(--bg)`, `border-top`, padding vertical `--space-12`).
  - Roles tipográficos: wordmark/nav en Khand (rol h4, 20px/500), copyright en Geist Sans body small; glifo acento con `--accent`; `focus-visible` con `--ring`; `prefers-reduced-motion` respetado.
- **`AppHeader.tsx`** (`"use client"`, named export): wordmark "Auditor" → `/`, nav "Auditar"/"Historial", spacer y `<ThemeToggle />`. Roles ARIA (`nav aria-label`), español neutro sin voceo.
- **`AppFooter.tsx`** (server component, named export): wordmark, enlaces mínimos y copyright exacto `© 2026 juan-tech.com. Todos los derechos reservados.`
- **`layout.tsx`**: importa `AppHeader`/`AppFooter`, los renderiza dentro de `<Providers>` en el orden header → `<main>` → footer, envueltos en un `.shell` (columna flex, `min-height: 100vh`) para fijar el footer al fondo. Conserva variables de fuente, `suppressHydrationWarning`, `lang="es"` y metadata de 08-03.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Prevención de regresión] `<main>` full-bleed en vez de `.container`**
- **Found during:** Task 2
- **Issue:** El plan sugería envolver `{children}` en `.container` (max-width 1200px). Las pantallas v1.0 (`home.module.css` `.page`, `report.module.css` `.page`) ya traen su propio fondo full-bleed (`min-height: 100vh` + `background`). Constreñir el `<main>` a 1200px habría recortado el fondo del reporte a 1200px, dejando franjas del `--bg` del body a los lados en pantallas anchas — regresión visible.
- **Fix:** El `<main>` usa `.main` (full-bleed, `flex: 1 0 auto`, `width: 100%`). `.container` queda como primitiva reutilizable que header y footer usan internamente para su fila interna y que las pantallas de Fase 10 adoptarán al refinarse. Esto satisface "sin overflow horizontal" y "contenido centrado en contenedor" (header/footer) sin romper las pantallas existentes.
- **Files modified:** apps/web/app/layout.tsx, apps/web/app/components/shell.module.css
- **Commit:** 9685bbd

## Checkpoints

**Task 3 (checkpoint:human-verify, gate="blocking")** — Auto-aprobado en AUTO_MODE tras pasar las compuertas automatizadas (typecheck limpio + `pnpm --filter @auditor/web build` con 9/9 páginas incluyendo `/`, `/verify`, `/history`, `/audits/[id]`). No es checkpoint de legitimidad de paquete, por lo que aplica auto-aprobación. Verificación visual pixel-por-pixel en navegador pendiente de revisión humana en Fase 10 (pulido por pantalla).

## Verification

- `grep` de Task 1 y Task 2: todos OK (ThemeToggle, Auditar, juan-tech.com, `var(--z-sticky)`, `var(--container-max)`, 0 hex en shell.module.css, `<AppHeader`/`<AppFooter`/`<main`/`suppressHydrationWarning` en layout).
- `pnpm --filter @auditor/web typecheck`: pasa.
- `pnpm --filter @auditor/web build`: pasa (9/9 páginas).

## Known Stubs

Ninguno. Los enlaces del nav apuntan a rutas reales existentes (`/`, `/history`).

## Self-Check: PASSED

Todos los archivos creados existen; ambos commits (22625ff, 9685bbd) presentes en el historial.
