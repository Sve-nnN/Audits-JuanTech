---
phase: 09-librer-a-de-componentes
plan: 05
subsystem: ui-components
tags: [components, composites, accessibility, design-system, empty-state, accordion]
requires:
  - "09-01: tokens semánticos (--surface, --border, --critical, --ring, --radius-*, --font-khand)"
  - "09-03: Badge (variant critical/ok) para los subgrupos del acordeón"
  - "09-04: Button (variant primary/secondary) para la acción de EmptyState/ErrorState"
provides:
  - "EmptyState/ErrorState (COMP-07): estado vacío/fallo con chip de ícono + título + descripción + acción opcional"
  - "CategoryAccordion (COMP-05): disclosure nativo por categoría con subgrupos Problemas/Correcto"
  - "AccordionSubgroup + IssueDetail (COMP-05): estructuras reutilizables que Fase 10 rellena"
affects:
  - "wave 4 (IssuesTable) consume EmptyState para su estado vacío"
  - "Fase 10 (ensamblado del reporte) consume CategoryAccordion + subgrupos + issue-detail rows"
tech-stack:
  added: []
  patterns:
    - "'use client' + named export + CSS Module hermano (idioma Button/Badge)"
    - "<details>/<summary> nativos: teclado + AT sin estado JS; defaultOpen → atributo open"
    - "chevron rota con [open]; transición guardada por prefers-reduced-motion"
    - "soft-fill crítico local vía color-mix sobre token (mismo patrón que Badge)"
    - "regla nth-of-type(2) para el dd 'Valor medido' en Geist Mono + tnum (verbatim report L348-351)"
key-files:
  created:
    - apps/web/app/components/ui/EmptyState.tsx
    - apps/web/app/components/ui/EmptyState.module.css
    - apps/web/app/components/ui/CategoryAccordion.tsx
    - apps/web/app/components/ui/CategoryAccordion.module.css
  modified: []
decisions:
  - "title/description opcionales con placeholder por variante: incluye el copy voceo-free del UI-SPEC como default, sigue overridable por prop"
  - "acción con href navega vía window.location.assign desde el Button (el consumidor interno provee rutas de app, no entrada de usuario — T-09-05-01)"
  - "helpers AccordionSubgroup e IssueDetail exportados para que Badge tenga uso real y quede definida la estructura reutilizable que Fase 10 rellena"
  - "chip de EmptyState vacío usa --surface-hover; error usa --critical sobre color-mix 12% (no existe token global de fill)"
metrics:
  duration: ~8min
  completed: 2026-07-06
  tasks: 2
  files: 4
---

# Phase 9 Plan 05: EmptyState/ErrorState + CategoryAccordion Summary

Composites de wave 3: `EmptyState`/`ErrorState` (COMP-07) — chip de ícono lucide + título Khand + descripción en `--text-secondary` (AA) + acción opcional que renderiza `Button`, con `role="status"`/`role="alert"` — y `CategoryAccordion` (COMP-05) — disclosure `<details>`/`<summary>` nativo (teclado gratis) con chevron guardado por reduced-motion, foco inset y subgrupos Problemas/Correcto que consumen `Badge`. Solo tokens semánticos, cero hex, copy sin voceo.

## What Was Built

- **EmptyState / ErrorState** (`EmptyState.tsx`) — named exports `"use client"`. `ErrorState` = `EmptyState` con `variant="error"`. Layout columna centrada (`max-width:52ch`, borde dashed, padding `--space-10/8`). Chip 56×56 `--radius-full`: empty → ícono `Inbox` en `--text-muted` sobre `--surface-hover`; error → `AlertTriangle` en `--critical` sobre color-mix 12%, borde de énfasis crítico. Ícono `aria-hidden`, overridable por prop `icon`. Título rol Khand h4 (`--font-size-xl`/500) como `role="heading" aria-level=2`. Descripción Geist Sans 16 `--text-secondary` line-height 1.5. Acción opcional renderiza `Button` (primary empty / secondary error) con `onClick` o navegación por `href`. Copy placeholder voceo-free (UI-SPEC L385-393) como default por variante.
- **CategoryAccordion** (`CategoryAccordion.tsx`) — named export `"use client"` sobre `<details>`/`<summary>` nativos (Enter/Space, estado expandido expuesto por el navegador; sin estado JS). `defaultOpen` → atributo `open`. Summary flex space-between: título Khand + `meta` (count Geist Sans 14 `--text-secondary` + `ChevronDown` 20px `aria-hidden`). Marcador nativo oculto (`::-webkit-details-marker`), hover `--surface-hover`, focus-visible `outline:2px --ring; outline-offset:-2px` (inset). Chevron rota 180° en `[open]` con transición anulada bajo `prefers-reduced-motion`. Body con `border-top` + padding `--space-5`.
- **AccordionSubgroup** — subgrupo "Problemas"/"Correcto": empareja `Badge` (critical/ok) + conteo; vacío en `--text-muted` ("Sin problemas en esta categoria." / "Sin checks correctos.").
- **IssueDetail** — fila de detalle: título `[checkId] título` (checkId en mono) + slot de Badges de severidad/diff + `<dl>` grid `repeat(auto-fit, minmax(220px,1fr))`; `dt` uppercase 11px `--text-secondary`, `dd` 14px `--text`, y el 2.º campo ("Valor medido") en Geist Mono + tnum vía `nth-of-type(2)` (verbatim report L348-351).

## Deviations from Plan

None - plan executed exactly as written. Ajustes esperados/documentados: (1) `title`/`description` se hicieron opcionales con placeholder por variante para incluir el copy del UI-SPEC como default sin dejar de ser overridable; (2) la acción con `href` navega vía `window.location.assign` desde el `Button` (el `Button` es `<button>`, no anchor; ruta la provee el consumidor interno — cubre T-09-05-01); (3) se exportaron helpers `AccordionSubgroup` e `IssueDetail` para dar uso real a `Badge` y dejar la estructura reutilizable que Fase 10 rellena.

## Verification

- Gates automáticos por tarea: named exports + key-links (`from "./Button"`, `from "./Badge"`) + a11y greps (`role="alert"`, `<details>`/`<summary>`, `webkit-details-marker`, `outline-offset:-2px`, `prefers-reduced-motion`→`none`) + iconos lucide (`Inbox`/`AlertTriangle`/`ChevronDown`) + hex-scan (cero hex en ambos CSS) + `pnpm --filter @auditor/web typecheck` → OK en ambas tareas.
- Descripción de EmptyState en `--text-secondary` (AA), no `--text-muted`.
- `prefers-reduced-motion` presente en CategoryAccordion (rotación del chevron instantánea).
- Copy sin voceo verificado (los únicos matches de "voceo" son la frase "voceo-free" en comentarios).

## Threat Coverage

- T-09-05-01 (Tampering / action.href): el `href` lo delega el consumidor interno (rutas de app, no entrada de usuario); React escapa atributos y la navegación va por `window.location.assign` sobre ese valor delegado. Cubierto.
- T-09-05-02 (Repudiation / ErrorState role=alert): `role="alert"` solo anuncia el fallo visualmente; sin persistencia ni auditoría de acción (accept). Cubierto.

## Self-Check: PASSED

Todos los archivos creados existen y los 2 commits (9b6551d, e1e192b) están en el historial.
