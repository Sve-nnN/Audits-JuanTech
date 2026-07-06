---
phase: 10-pantallas-redise-adas-copy-motion-y-accesibilidad
plan: 01
subsystem: web/motion
tags: [motion, a11y, css, waapi, reduced-motion, tokens]
requires: []
provides:
  - useCountUp
  - useReveal
  - Reveal
  - "--motion-* / --ease-* tokens"
  - "@property --gauge-offset"
  - "[data-reveal] base rules"
  - "global prefers-reduced-motion safety net"
affects:
  - apps/web/app/tokens.css
  - apps/web/app/globals.css
tech-stack:
  added: []
  patterns:
    - "WAAPI element.animate sobre custom prop registrada (@property)"
    - "IntersectionObserver reveal/count-up una sola vez (unobserve)"
    - "mounted-guard client-safe (patrón ThemeToggle)"
    - "red de seguridad global prefers-reduced-motion"
key-files:
  created:
    - apps/web/app/components/motion/useCountUp.ts
    - apps/web/app/components/motion/useReveal.ts
  modified:
    - apps/web/app/tokens.css
    - apps/web/app/globals.css
decisions:
  - "Motion sin librerías: CSS + WAAPI/rAF nativo (CSP-safe, cero framer-motion)"
  - "useCountUp recibe geometría del arco (from/to) como valores, sin acoplarse a la geometría interna del ScoreGauge"
  - "Reveal wrapper construido con createElement (sin JSX) para convivir en módulo .ts junto al hook"
  - "Deps del effect por valor (gauge?.from/to) para no re-disparar con literal inline"
metrics:
  duration: ~8 min
  completed: 2026-07-06
---

# Phase 10 Plan 01: Fundación de motion transversal Summary

Primitivas de motion consumidas por todas las pantallas de la Fase 10: hooks `useCountUp` (count-up numérico + barrido del arco del ScoreGauge vía `--gauge-offset`) y `useReveal` (+`Reveal` wrapper) con IntersectionObserver de disparo único, tokens `--motion-*`/`--ease-*` en `tokens.css`, y en `globals.css` el registro `@property --gauge-offset`, las reglas base `[data-reveal]` y la red de seguridad global de `prefers-reduced-motion`. CSS + WAAPI únicamente, cero librerías.

## What Was Built

**Task 1 — Tokens + bloque global de motion** (`936b567`)
- `tokens.css`: `--motion-fast: 150ms`, `--motion-base: 300ms`, `--motion-reveal: 500ms`, `--motion-count: 900ms`, `--ease-out`, `--ease-standard` en `:root` (invariantes de tema).
- `globals.css`: `@property --gauge-offset` (`syntax: "<number>"`, `inherits: false`, `initial-value: 0`) para que el arco sea animable por transición CSS; reglas `[data-reveal]` (inicial `opacity:0; translateY(16px)`) y `[data-reveal="in"]` (final + `transition` con `--reveal-delay` para stagger); red de seguridad `@media (prefers-reduced-motion: reduce)` que neutraliza animación/transición/scroll y fuerza `[data-reveal]` visible.

**Task 2 — useCountUp** (`5f33a09`)
- Hook client-safe con mounted-guard (patrón ThemeToggle), sin hydration mismatch.
- IntersectionObserver (`threshold: 0.15`, `rootMargin: "0px 0px -10% 0px"`) dispara una sola vez al entrar al viewport; `unobserve` tras el primer intersect.
- Número interpolado 0→target vía rAF con ease-out cúbico; arco animado vía `element.animate([{ "--gauge-offset": from }, { "--gauge-offset": to }], …)`.
- Guard `prefers-reduced-motion` / `enabled=false` / sin observer: devuelve `target` final sin animar. Cleanup de rAF/observer/animation.

**Task 3 — useReveal + Reveal** (`e3c1294`)
- Hook devuelve un `ref`; al primer intersect setea `data-reveal="in"` y hace `unobserve` (reveal único).
- Contenido siempre en el DOM: solo togglea el atributo, nunca condiciona el render (visible para AT y no-JS). Estilos viven en `globals.css`.
- Guard `prefers-reduced-motion`: revela de inmediato. `Reveal` wrapper vía `createElement` (sin JSX) para módulo `.ts`.

## Verification

- `pnpm --filter @auditor/web typecheck` → pasa (tras Task 2 y Task 3).
- `pnpm --filter @auditor/web build` → pasa (9/9 páginas, sin errores).
- Grep gates Task 1: `--motion-count` (1), `prefers-reduced-motion` (1), `@property --gauge-offset` (1).
- Grep gates Task 2/3: archivos existen, `"use client"` en línea 1, export nombrado presente.
- Sin hex crudo introducido en `globals.css`; motion sin librerías externas.

## Deviations from Plan

None de fondo. Ajuste menor de robustez (dentro del alcance de la tarea, no altera el contrato):
- **[Rule 1 - Bug] Deps del effect de `useCountUp` por valor.** Se usó `gauge?.from`/`gauge?.to` en el array de dependencias en vez del objeto `gauge`, para evitar re-disparar la animación cuando el consumidor pasa un literal `gauge` inline (identidad cambiante en cada render). Archivo: `apps/web/app/components/motion/useCountUp.ts`. Commit: `5f33a09`.

## Notes for Next Plans (Wave 2)

- `useCountUp(target, { gauge: { from: circumference, to: offset } })`: la pantalla calcula `circumference`/`offset` con la misma geometría del `ScoreGauge` y pasa el `ref` al `<circle className={styles.arc}>` (o al `<svg>`). No se toca `ScoreGauge`.
- `useReveal({ delay })` o `<Reveal as="section" delay={80}>`: el elemento debe llevar (o el wrapper ya pone) `data-reveal`. Stagger vía `delay` → `--reveal-delay`.
- Lint (`next lint`) no está configurado en el repo (prompt interactivo); el gate de calidad de este plan es typecheck + build, ambos verdes.

## Environment Note

`pnpm --filter @auditor/web lint` no corre de forma no interactiva (Next.js pide configurar ESLint por primera vez). Condición preexistente del repo, fuera del alcance de este plan. Registrado para visibilidad, no bloqueante.

## Self-Check: PASSED

- Archivos creados/modificados: todos FOUND (useCountUp.ts, useReveal.ts, tokens.css, globals.css).
- Commits: 936b567, 5f33a09, e3c1294 — todos FOUND en git log.
