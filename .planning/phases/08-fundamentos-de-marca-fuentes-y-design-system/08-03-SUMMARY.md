---
phase: 08-fundamentos-de-marca-fuentes-y-design-system
plan: 03
subsystem: frontend/theming
tags: [theming, next-themes, design-system, fonts, css-tokens, accessibility]
requires:
  - "apps/web/app/fonts.ts (08-01): 4 font instances con .variable"
  - "apps/web/app/tokens.css (08-02): :root dark-first + [data-theme=light]"
  - "next-themes@0.4.6, geist@1.7.2 (instalados)"
provides:
  - "apps/web/app/providers.tsx → export Providers (ThemeProvider next-themes)"
  - "apps/web/app/components/ThemeToggle.tsx → export ThemeToggle"
  - "globals.css consumiendo tokens (var(--bg)/var(--text)) + Geist Sans body"
  - "layout.tsx con 4 font .variable, suppressHydrationWarning y Providers"
affects:
  - "Toda la app hereda theming claro/oscuro y las 4 CSS variables de fuente"
tech-stack:
  added: []
  patterns:
    - "next-themes ThemeProvider attribute=data-theme, dark-first, enableSystem, disableTransitionOnChange"
    - "Guard mounted (useEffect set-true) para evitar hydration mismatch en controles client"
    - "CSS Modules solo con tokens semánticos (0 hex crudo)"
key-files:
  created:
    - apps/web/app/providers.tsx
    - apps/web/app/components/ThemeToggle.tsx
    - apps/web/app/components/ThemeToggle.module.css
  modified:
    - apps/web/app/globals.css
    - apps/web/app/layout.tsx
decisions:
  - "defaultTheme=dark (marca dark-first) + enableSystem para respetar prefers-color-scheme inicial, según el gate del plan"
  - "disableTransitionOnChange para evitar transiciones de color al alternar tema"
  - "Íconos SVG inline (sol/luna) sin librería — lucide queda para Fase 9"
metrics:
  duration: "~8 min"
  completed: 2026-07-05
---

# Phase 8 Plan 03: Theming claro/oscuro sin FOUC (next-themes) Summary

Se habilitó el theming claro/oscuro de la app con next-themes (dark-first, persistente en localStorage, sin flash de tema incorrecto), un ThemeToggle accesible con guard de hidratación, y se migró globals.css/layout.tsx para consumir los tokens del design system y montar las cuatro variables de fuente de marca. Cierra DS-03 (toggle persistente sin FOUC) y ancla FONT-04 a nivel foundation (body en Geist Sans, 4 font vars disponibles en toda la app).

## What Was Built

- **`providers.tsx`** (`Providers`): monta `ThemeProvider` de next-themes con `attribute="data-theme"`, `defaultTheme="dark"`, `enableSystem` y `disableTransitionOnChange`. La persistencia en localStorage es el default de la librería; el script de resolución inyectado corre antes del paint (no FOUC).
- **`components/ThemeToggle.tsx`** (`ThemeToggle`): botón icon-only que alterna claro/oscuro vía `useTheme()`. Guard `mounted` (useEffect set-true) renderiza un placeholder inerte antes de montar para evitar hydration mismatch. `aria-label` según tema activo en español neutro sin voceo (`Cambiar a modo claro` / `Cambiar a modo oscuro`), target 44×44px, `<button>` nativo operable por teclado, íconos SVG inline (sol/luna), sin animación bajo `prefers-reduced-motion`.
- **`components/ThemeToggle.module.css`**: estilos solo con tokens semánticos (`var(--surface)`, `var(--border)`, `var(--text)`, `var(--radius-full)`, `var(--space-*)`), `:focus-visible` con `var(--ring)` + `var(--shadow-focus)`, bloque `prefers-reduced-motion`. Cero hex crudo.
- **`globals.css`** migrado: `@import "./tokens.css"` como primera línea, body con `var(--bg)`/`var(--text)` y stack Geist Sans, se eliminó el bloque `@media (prefers-color-scheme: dark)` (theming ahora vive en `[data-theme]`), se conservó el reset mínimo, `a { color: inherit }` y el comentario CSP-safe.
- **`layout.tsx`** cableado: importa `{ array, khand, geistSans, geistMono }` y aplica sus `.variable` al `<html>`, añade `suppressHydrationWarning`, envuelve `{children}` en `<Providers>`, conserva `lang="es"`, `import "./globals.css"` y `metadata`.

## Verification

- Task 1 gate: greps (use client, attribute data-theme, defaultTheme dark, useTheme, "Cambiar a modo", 0 hex en el module) + `pnpm --filter @auditor/web typecheck` → PASS.
- Task 2 gate: greps (tokens.css primera línea, var(--bg), var(--font-geist-sans), sin prefers-color-scheme, suppressHydrationWarning, <Providers>, .variable) + `pnpm --filter @auditor/web build` → PASS (build completo, 12 rutas).
- Task 3 (checkpoint visual human-verify, gate blocking): bajo AUTO_MODE se auto-aprobó tras pasar los gates automatizados. Pendiente de validación visual humana al cierre de fase (dark por defecto sin FOUC, toggle, persistencia, foco lima, body Geist Sans).

## Deviations from Plan

None - plan executed exactly as written.

Nota sobre `defaultTheme`: el prompt orquestador mencionó `defaultTheme system`, pero el gate automatizado del plan exige `defaultTheme="dark"` y las artifacts/acceptance también. Se siguió el plan (`defaultTheme="dark"` + `enableSystem`, que respeta `prefers-color-scheme` como inicial). No es una desviación del PLAN.md.

## Threat Model Coverage

- **T-08-05 (FOUC / hydration mismatch, mitigate):** cubierto — `suppressHydrationWarning` en `<html>` + resolución de tema pre-paint de next-themes + guard `mounted` en el toggle. Verificación visual humana pendiente al cierre de fase.
- **T-08-04 (tampering del valor de tema en localStorage, accept):** sin cambios; next-themes valida contra el set de temas conocido, valor inválido cae al default.

## Self-Check: PASSED

Todos los archivos creados/modificados existen y ambos commits de tarea (40de192, 7a0bb24) están en el historial.
