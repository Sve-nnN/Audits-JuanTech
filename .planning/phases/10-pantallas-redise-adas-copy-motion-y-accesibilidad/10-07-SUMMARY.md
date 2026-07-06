---
phase: 10-pantallas-redise-adas-copy-motion-y-accesibilidad
plan: 07
subsystem: web-ui
tags: [screen-06, history, css-modules, phase9-components, a11y, copy, motion, i18n]
requires:
  - "Phase 9 UI primitives (Field, Input, Button, Badge, EmptyState)"
  - "components/ui/labels.ts (STATUS_LABEL)"
  - "components/motion/useReveal.ts (Reveal)"
  - "tokens.css (container/motion/font tokens)"
provides:
  - "SCREEN-06 History re-skineado con componentes Fase 9"
  - "apps/web/app/history/history.module.css (stylesheet propio, desacopla home.module.css)"
affects:
  - "apps/web/app/history/page.tsx"
tech-stack:
  added: []
  patterns:
    - "Server Component compone client components (Field/Input/Button/Badge/EmptyState) con props serializables (strings/elements), sin pasar funciones cross-boundary"
    - "File-split del stylesheet compartido (home.module.css -> history.module.css) para paralelismo seguro"
    - "Tabla en región de scroll enfocable por teclado (tabindex+role=region) con caption sr-only y th scope=col"
key-files:
  created:
    - "apps/web/app/history/history.module.css"
  modified:
    - "apps/web/app/history/page.tsx"
decisions:
  - "EmptyState recibe description='' para suprimir el copy por defecto y usar el string exacto de UI-SPEC como título (role=status en ambos estados vacíos)"
  - "STATUS_BADGE mapea good->ok, needs_improvement->warning, critical->critical (DS-02)"
  - "Locale de fecha estandarizado a 'es' neutro (no es-AR rioplatense), igual que el reporte"
metrics:
  duration: "~12m"
  completed: 2026-07-06
---

# Phase 10 Plan 07: History (SCREEN-06) Re-skin Summary

Historial por correo recompuesto con el form de búsqueda Fase 9 (Field + Input + Button), tabla tokenizada con Score/Estado(Badge)/Fecha y acceso al reporte, estados vacíos diferenciados (sin búsqueda vs sin resultados) vía EmptyState, desacoplado de `home.module.css` con `history.module.css` propio, locale de fecha corregido a `es` neutro y copy en español neutro sin voceo.

## What Was Built

- **`history.module.css` nuevo:** estilos propios de history — lienzo top-aligned padded (`--space-12`→`--space-16`, sin `min-height:100vh`), columna `--container-narrow`, título Khand 36/600, subtítulo Geist Sans 16 `--text-secondary`, form que apila en móvil e inline bottom-aligned ≥640, tabla token-styled con región de scroll enfocable, columnas mono (Score/Fecha), enlace "Ver reporte" `--accent-text`. Cero hex, solo tokens.
- **`page.tsx` re-skineado:** import redirigido de `../home.module.css` a `./history.module.css`. Form `method="get"` con `<Field label="Correo"><Input type="email" mono/></Field>` + `<Button type="submit">Buscar`. Resultados en `<table>` real (caption "Historial de auditorías", `<th scope="col">`) con `Badge` de estado. `STATUS_LABEL` importado de `labels.ts` (se borró el mapa local). `formatDate` migrado de `es-AR` a `es`. Estados vacíos con `EmptyState` (role="status"): "Ingresa tu correo…" sin búsqueda, "No encontramos…" sin resultados. Reveal con `useReveal` para la tabla; back link "Volver al inicio".

## Preserved Verbatim (v1.0 data-fetching)

- `normalizeEmail` de `@auditor/email`, `prisma.email.findUnique` + `prisma.audit.findMany` (include site, orderBy createdAt desc), y el `<form method="get">` server-driven — sin cambios de lógica.

## Verification

Gates automáticos (todos PASS):
- `pnpm --filter @auditor/web typecheck` → exit 0
- `! grep home.module.css page.tsx` → PASS (import desacoplado)
- `test -f history.module.css` → PASS
- `! grep es-AR page.tsx` → PASS (locale es)
- voceo check (`consult[áa]|pod[ée]s|ingres[áa]` menos Ingresa/Consulta) → PASS
- `! grep hex` en history.module.css → PASS (solo tokens)

## Checkpoint

Task 2 (checkpoint:human-verify, validación visual de Juan) auto-aprobado bajo AUTO_MODE=true tras pasar todos los gates. No es un checkpoint de legitimidad de paquete, por lo que aplica el auto-approve del orquestador. Recomendación para el sweep A11Y/visual posterior: capturar dark+light, mobile+desktop, con un correo con auditorías y otro sin, para confirmar contraste AA, legibilidad de la tabla y ausencia de overflow horizontal.

## Deviations from Plan

None - plan executed exactly as written. (Nota de implementación menor: `EmptyState` recibe `description=""` para evitar que muestre su copy por defecto y usar el string exacto de UI-SPEC como título; el componente Input no expone prop `mono`, así que el estilo monoespaciado del input se aplica vía `className` — ambos dentro de la API real de los componentes Fase 9, sin cambios a los primitivos.)

## No Known Stubs

Todos los datos de la tabla se leen de Prisma (v1.0); los estados vacíos son intencionales y diferenciados. No hay placeholders ni datos mock.

## Self-Check: PASSED

- FOUND: apps/web/app/history/history.module.css
- FOUND: apps/web/app/history/page.tsx
- FOUND: .planning/phases/10-pantallas-redise-adas-copy-motion-y-accesibilidad/10-07-SUMMARY.md
- FOUND commit: 80c7cc3
