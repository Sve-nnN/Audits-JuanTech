---
phase: 26-wiring-en-el-worker-tabla-de-stack-en-el-reporte
plan: 04
subsystem: ui-primitives
tags: [badge, design-system, csp-safe, tokens-only]
requires: []
provides:
  - "Badge variant='warningSubtle' (ámbar outline tenue, confianza 'bajo')"
affects:
  - "StackTable (26-05) mapea confianza 'bajo' → warningSubtle"
tech-stack:
  added: []
  patterns:
    - "color-mix(in srgb, var(--token) N%, transparent) para bordes/fills sin hex crudo"
    - "box-shadow inset como borde para no alterar el box-model de variantes sin border"
key-files:
  created: []
  modified:
    - apps/web/app/components/ui/Badge.tsx
    - apps/web/app/components/ui/Badge.module.css
decisions:
  - "warningSubtle (ámbar outline) en vez de info (azul/accent): fiel al CONTEXT que bloquea 'bajo → warning tenue', supera la sugerencia previa del RESEARCH Pattern 3."
  - "Borde vía box-shadow inset, no border: la base .badge no define border, evita shift de box-model en las 8 variantes existentes."
metrics:
  duration: ~4m
  completed: 2026-07-21
  tasks: 1
  files: 2
status: complete
---

# Phase 26 Plan 04: Badge warningSubtle Variant Summary

Novena variante `warningSubtle` para el primitivo Badge: ámbar en outline tenue (foreground `--warning`, fondo transparente, borde `color-mix(--warning 35%)` vía `box-shadow inset`), tokens-only y CSP-safe, para el nivel de confianza `bajo` de la tabla de stack, distinguible de `medio` (warning soft-fill sólido).

## What Was Built

**Task 1 — Variante warningSubtle (commit `113e902`)**

- `Badge.tsx`: agregado `| "warningSubtle"` a la union `BadgeVariant` y la entrada `warningSubtle: styles.warningSubtle` al mapa `VARIANT_CLASS`. El componente `Badge` compone `VARIANT_CLASS[variant]` genéricamente, así que no requirió cambios; los wrappers `SeverityBadge`/`DiffBadge` quedaron intactos. Actualizado el conteo del docstring ("Ocho" → "Nueve variantes") por coherencia.
- `Badge.module.css`: clase `.warningSubtle` con `color: var(--warning)`, `background: transparent` y `box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 35%, transparent)`. Se usó `box-shadow inset` en lugar de `border` para no alterar el box-model de las variantes existentes (la base `.badge` no define borde). Cero hex crudo, mismo patrón CSP-safe que los soft-fills `--sev-*`.

## Verification Results

| Verificación | Comando | Resultado |
|---|---|---|
| warningSubtle en tsx | `grep -q "warningSubtle" Badge.tsx` | PASS |
| .warningSubtle en css | `grep -q "\.warningSubtle" Badge.module.css` | PASS |
| Grep guard hex crudo | `! grep -nE "#[0-9a-fA-F]{3,6}" Badge.module.css` | PASS (sin hex crudo) |
| Typecheck | `pnpm --filter web typecheck` | PASS (tsc --noEmit, sin errores) |

## Deviations from Plan

Ninguna funcional. Cambio menor de coherencia documental fuera del alcance estricto del `<action>`: se actualizó el comentario "Ocho variantes" → "Nueve variantes" en el docstring de `Badge.tsx` para reflejar la variante agregada. No afecta comportamiento ni la API pública.

## Notes

- Cambios pre-existentes ajenos a esta fase (`.env.example`, `README.md`, `apps/web/app/api/audits/route.ts`, `.planning/ROADMAP.md`) quedaron sin tocar y fuera de este commit, según lo indicado.
- La variante queda lista para ser consumida por `StackTable` en el plan 26-05.

## Self-Check: PASSED

- FOUND: apps/web/app/components/ui/Badge.tsx (modificado)
- FOUND: apps/web/app/components/ui/Badge.module.css (modificado)
- FOUND: commit 113e902
