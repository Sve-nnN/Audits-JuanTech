---
phase: 22
plan: 03
subsystem: web-ui
tags: [architecture, visualization, arch-06, zoom-pan, client-component]
requires:
  - "22-02: ArchitectureTreeSvg dendrograma (reusado sin cambios)"
  - "@auditor/report-model: buildReportModel + ReportArchitecture"
provides:
  - "ArchitectureMap: viewport cliente con zoom/pan/reset alrededor del árbol"
  - "Ruta /audits/[id]/arquitectura: mapa a pantalla completa"
  - "Tarjeta-link en el reporte que reemplaza el árbol embebido"
affects:
  - "apps/web/app/audits/[id]/page.tsx (reporte)"
tech-stack:
  added: []
  patterns:
    - "transform translate+scale puro movido por estado de React (cero deps de zoom/pan)"
    - "wheel no pasivo vía addEventListener({ passive: false }) para preventDefault"
    - "fit-to-view midiendo scrollWidth/Height del stage vs. viewport (ResizeObserver)"
key-files:
  created:
    - apps/web/app/components/ArchitectureMap.tsx
    - apps/web/app/components/ArchitectureMap.module.css
    - apps/web/app/audits/[id]/arquitectura/page.tsx
    - apps/web/app/audits/[id]/arquitectura/arquitectura.module.css
  modified:
    - apps/web/app/audits/[id]/page.tsx
    - apps/web/app/audits/[id]/report.module.css
decisions:
  - "Zoom con transformOrigin 0 0 y reajuste de x,y para fijar el punto bajo el cursor"
  - "Fit real (medir tamaño natural) en vez de reset a k=1, con ResizeObserver para responsive"
  - "prefers-reduced-motion se resuelve en CSS; el componente no lleva lógica de motion"
metrics:
  duration: "~15 min"
  completed: "2026-07-09"
  tasks_completed: 2
  tasks_total: 3
  status: "código completo — checkpoint visual pendiente (Task 3)"
---

# Phase 22 Plan 03: Mapa de arquitectura navegable Summary

Movió el árbol de arquitectura a una página propia a pantalla completa
(`/audits/[id]/arquitectura`) como mapa navegable con zoom (rueda hacia el cursor +
botones, acotado 0.2-3x), pan (arrastrar con mouse/touch + teclado) y reajuste
fit-to-view, reusando `ArchitectureTreeSvg` sin cambios; en el reporte, la sección
grande del árbol quedó reemplazada por una tarjeta-link. Cero dependencias nuevas.

## What Was Built

### Task 1 — `ArchitectureMap` (viewport cliente) · commit `3fe2fd2`

Client Component que envuelve `ArchitectureTreeSvg` en un `stage` con
`transform: translate() scale()` movido por estado de React:

- **Zoom con rueda hacia el cursor:** listener `wheel` NO pasivo registrado con
  `addEventListener("wheel", handler, { passive: false })` en un `useEffect` con
  cleanup, para poder llamar `e.preventDefault()` y no scrollear la página (React
  `onWheel` es pasivo y no permitiría el `preventDefault`). Con `transformOrigin 0 0`,
  ajusta `x,y` para fijar el punto bajo el cursor (`x2 = cx - (cx - x) * k2/k`).
- **Botones `+` / `-`:** zoom centrado en el centro del viewport.
- **Reajustar:** fit-to-view real midiendo `scrollWidth/Height` del stage vs. el
  viewport (con `ResizeObserver` para recalcular el fit en resize).
- **Pan:** pointer events (`onPointerDown` + `setPointerCapture`, `onPointerMove`,
  `onPointerUp/Cancel`), cubriendo mouse y touch con un solo código; cursor
  `grab`/`grabbing`.
- **Teclado:** `+`/`=`/`-` zoom, flechas pan (40px), `0` reajusta, todos con
  `preventDefault` para no scrollear; viewport `tabIndex={0}`, `role="application"`.
- **Escala acotada:** `clampScale` a `[MIN_SCALE=0.2, MAX_SCALE=3]` (mitiga T-22-03-01).
- **CSS tokens-only**, sin hex; el `stage :global(svg)` anula el cap
  `--container-narrow` del árbol (`max-width: none; width: max-content`);
  `prefers-reduced-motion` anula la transición del transform.

### Task 2 — Ruta `/arquitectura` + tarjeta-link · commit `d110cdb`

- **Nueva ruta server** `apps/web/app/audits/[id]/arquitectura/page.tsx`: carga
  `buildReportModel(auditId)`, `notFound()` si no existe el modelo, link de vuelta
  al reporte, y renderiza `ArchitectureMap` o un `EmptyState` si no hay
  `model.architecture`. Layout amplio (sin cap `--container-narrow`).
- **Reporte** (`page.tsx`): dentro del mismo guard `{model.architecture && ...}`, el
  SVG embebido se reemplazó por un `<Link>` estilizado como tarjeta (`.archCard`,
  íconos `Network` + `ArrowRight` de lucide) hacia `/audits/[id]/arquitectura`. Se
  eliminó el import de `ArchitectureTreeSvg` (ya no se usa: `grep -c` = 0).
- **CSS** `.archCard` tokens-only en `report.module.css` (hover, focus-visible).

## Verification

- `pnpm typecheck` (apps/web): pasa.
- `pnpm build` (apps/web): pasa; la ruta `/audits/[id]/arquitectura` compila (5.75 kB).
- Grep gates: `"use client";` en la primera línea, reusa `ArchitectureTreeSvg`, usa
  `passive: false`, sin librerías de zoom/pan (grep `pan-zoom|d3-zoom|react-zoom` = 0),
  pointer + teclado presentes, escala acotada (`MIN_SCALE 0.2` / `MAX_SCALE 3`).
- `ArchitectureTreeSvg` ya NO se renderiza en el reporte (`grep -c` = 0); guard
  `model.architecture` conservado; CSS nuevos/editados sin hex.

## Deviations from Plan

None — el plan se ejecutó tal como está escrito.

## Pending

**Task 3 — checkpoint:human-verify (bloqueante).** El código está completo y
comiteado, pero el comportamiento visual e interactivo del mapa (tamaño,
sensibilidad de zoom, layout de controles, modo claro/oscuro) requiere la
confirmación de Juan en el navegador. No se auto-aprobó ni se levantó un browser.

## Self-Check: PASSED

- Archivos creados: ArchitectureMap.tsx, ArchitectureMap.module.css,
  arquitectura/page.tsx, arquitectura/arquitectura.module.css — todos presentes.
- Commits `3fe2fd2` (Task 1) y `d110cdb` (Task 2) existen en el historial.
