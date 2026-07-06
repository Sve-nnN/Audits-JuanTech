---
phase: 09-librer-a-de-componentes
plan: 04
subsystem: ui-components
tags: [components, forms, accessibility, design-system]
requires:
  - "09-01: tokens semánticos (--accent, --ring, --shadow-focus, --critical, etc.)"
provides:
  - "Button (COMP-06): 4 variantes, 3 tamaños, loading accesible"
  - "Input (COMP-06): estados con font 16px anti-zoom iOS + aria-invalid"
  - "Field (COMP-06): wrapper accesible label+hint+error"
affects:
  - "wave 3 (EmptyState/ErrorState) consume Button"
  - "Fase 10 (home email→URL) consume Field + Input + Button"
tech-stack:
  added: []
  patterns:
    - "React 19: ref y props reenviados sin forwardRef; ref es prop normal"
    - "cloneElement para inyectar id/aria-describedby/aria-invalid al control hijo"
    - "'use client' + named export + CSS Module hermano (idioma ThemeToggle)"
    - "prefers-reduced-motion guard para transiciones y spinner"
key-files:
  created:
    - apps/web/app/components/ui/Button.tsx
    - apps/web/app/components/ui/Button.module.css
    - apps/web/app/components/ui/Input.tsx
    - apps/web/app/components/ui/Input.module.css
    - apps/web/app/components/ui/Field.tsx
    - apps/web/app/components/ui/Field.module.css
  modified: []
decisions:
  - "No forwardRef: React 19 pasa ref como prop normal; permite named exports (export function) exigidos por el gate"
  - "--sev-critical-bg definido localmente en Button via color-mix (no existe token global)"
  - ".srOnly local en Field.module.css (no hay utilidad visually-hidden global)"
metrics:
  duration: ~12min
  completed: 2026-07-06
  tasks: 3
  files: 6
---

# Phase 9 Plan 04: Button, Input, Field (COMP-06) Summary

Primitivos de acción y formulario con estados completos y accesibles: `Button` (4 variantes × 3 tamaños + loading con spinner guardado), `Input` (estados con font 16px anti-zoom iOS y `aria-invalid`) y `Field` (wrapper que asocia label+hint+error vía `htmlFor`/`aria-describedby`/`role=alert` clonando el control hijo). Solo tokens semánticos, cero hex, foco lima de marca, copy sin voceo.

## What Was Built

- **Button** — named export que extiende `ButtonHTMLAttributes`. Variantes primary/secondary/ghost/destructive (default→hover por tabla UI-SPEC), tamaños sm/md/lg (min-height 36/44/48). `loading` renderiza `Loader2` con spin, `aria-busy` y `disabled`, conservando el label. `disabled` real (atributo), focus-visible con `--ring`+`--shadow-focus`. `type` default "button" (evita submits accidentales, T-09-04-02). Transición y spinner anulados bajo `prefers-reduced-motion`.
- **Input** — named export que extiende `InputHTMLAttributes`. Base con `font-size:var(--font-size-base)` (16px, previene zoom iOS) y `min-height:44px`. Estados default/hover/focus/disabled/error; `invalid` pinta borde `--critical` y emite `aria-invalid`. Reenvía props/ref al `<input>` nativo.
- **Field** — named export accesible. Clona el control hijo (`cloneElement`) inyectando `id={htmlFor}`, `aria-describedby` (hint/error) y `aria-invalid`/`invalid` en error. Label 14/600, marcador `*` `aria-hidden` + span sr-only "obligatorio". Error con `AlertCircle` + `role="alert"` reemplaza al hint. Hint en `--text-secondary` (contraste AA, no `--text-muted`).

## Deviations from Plan

None - plan executed exactly as written. Ajustes de idioma esperados por el plan: `export function` en lugar de forwardRef (React 19 permite ref como prop), `--sev-critical-bg` local vía color-mix, y `.srOnly` local (sin utilidad global).

## Verification

- Gates automáticos por tarea: named export + a11y greps (`aria-busy`/`aria-invalid`/`role="alert"`/`AlertCircle`/`aria-describedby`/`htmlFor`) + hex-scan (cero hex en los 3 CSS) + `pnpm --filter @auditor/web typecheck` → OK en las 3 tareas.
- `prefers-reduced-motion` presente en Button (transición + spinner) e Input.
- Copy sin voceo verificado.

## Threat Coverage

- T-09-04-01 (Tampering / Input value): el componente solo expone `invalid`/`aria-invalid` como señal visual; validación/sanitización queda para el server (Fase 7/10). Cubierto.
- T-09-04-02 (EoP / Button type): `type` default "button"; el consumidor opta a "submit" explícito. Cubierto.

## Self-Check: PASSED

Todos los archivos creados existen y los 3 commits (b90ac57, 2965f0f, a7d74d5) están en el historial.
