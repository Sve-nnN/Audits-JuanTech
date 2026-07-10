---
phase: 23-grafo-json-ld-con-layout-radial
plan: 01
subsystem: web
tags: [visualization, svg, json-ld, entity-graph, SDVIZ-01]
requires:
  - "EntityGraph (nodes/edges) persistido en Page.schemaGraph por el worker (v1.3)"
  - "Tipos EntityGraph/EntityGraphNode/EntityGraphEdge exportados desde @auditor/checks"
provides:
  - "layoutEntityGraph(graph): { width, height, positions } — módulo puro determinista"
  - "EntityGraphSvg reescrito para consumir el layout radial por componente conexo"
affects:
  - "apps/web/app/components/EntityGraphSvg.tsx (render en /audits/[id]/pages/[pageId])"
tech-stack:
  added: []
  patterns:
    - "Componentes conexos por adyacencia NO dirigida; root = primer nodo sin incoming (tie-break por orden de nodes)"
    - "BFS multi-anillo desde el root; celdas en grid sin solape; width=720 fijo, height dinámico"
key-files:
  created:
    - apps/web/app/components/entityGraphLayout.ts
    - apps/web/app/components/entityGraphLayout.test.ts
  modified:
    - apps/web/app/components/EntityGraphSvg.tsx
decisions:
  - "Layout radial por componente: root al centro de su celda, hijos en anillos por nivel BFS con radio acotado a la celda"
  - "1 componente ⇒ 1 columna a todo el ancho; múltiples ⇒ grid con height que crece por filas"
  - "Módulo puro sin React/DOM/estilos; sin Math.random/Date.now (determinismo verificado por test)"
metrics:
  completed: "2026-07-09"
  tasks: 2
  files: 3
---

# Phase 23 Plan 01: Grafo JSON-LD con layout radial Summary

Reemplazo del círculo uniforme (`angle = 2π·i/n`) de `EntityGraphSvg` por un **layout radial por componente conexo**: el root de cada componente (entidad sin edges entrantes) queda en el centro de su celda con los hijos en anillos por BFS, y múltiples grafos se empacan en un grid sin solaparse. Cierra SDVIZ-01. La lógica vive en un módulo puro determinista (`entityGraphLayout.ts`) con tests; el componente sólo renderiza.

## What Was Built

- **Task 1 — Módulo de layout (`entityGraphLayout.ts` + test):** `layoutEntityGraph(graph)` devuelve `{ width, height, positions }`. Agrupa componentes conexos por adyacencia no dirigida, elige root por incoming===0 (tie-break por orden de `graph.nodes`), posiciona por BFS multi-anillo, empaca componentes en celdas de grid sin solape, con `width=720` fijo y `height` dinámico por filas. Módulo puro (sin React/DOM/estilos, sin `Math.random`/`Date.now`). Commits `cce4242` (tests) y `bc361ef` (módulo). 9 tests verdes.
- **Task 2 — Render (`EntityGraphSvg.tsx`):** Se retiraron `HEIGHT`, `RADIUS` y el loop del círculo uniforme; ahora `const { width, height, positions } = layoutEntityGraph(graph)` alimenta el `<svg>` y las posiciones de edges/nodos. Se conservan estado vacío, `<defs><marker id="arrow">`, render de edges (line + chip + label) y de nodos (circle + type + caption), helpers `classForType`/`truncate`. JSDoc actualizado. Cero deps nuevas, CSS sin hex nuevos. Commit `8a989c5`.

## Verification

- `cd apps/web && pnpm exec vitest run app/components/entityGraphLayout.test.ts` — 9/9 verdes (root al centro, root=sin-incoming, tie-break en ciclo, agrupamiento no dirigido, multi-componente sin solape, anillos BFS, determinismo, grafo vacío).
- `cd apps/web && pnpm typecheck` — pasa.
- `grep "layoutEntityGraph" EntityGraphSvg.tsx` presente; `RADIUS`/`2π·i/n` ausentes; sin hex en el CSS.
- Sin dependencias nuevas (`package.json` sin cambios en esta fase).

## Deviations from Plan

None — ambos tasks auto ejecutados tal cual. El módulo y sus tests ya venían commiteados de una sesión previa (`cce4242`, `bc361ef`); esta sesión verificó verde y commiteó el render (Task 2, `8a989c5`).

## Deferred Issues

None.

## Threat Model Notes

- **T-23-01 (DoS por ciclos):** mitigado — BFS con set de visitados (cada nodo una vez); self-loops (`from===to`) filtrados; sin recursión no acotada.
- **T-23-02 (XSS vía label):** aceptado — React escapa el texto SVG; `truncate` sólo acorta; sin `dangerouslySetInnerHTML`. Superficie de datos sin cambios vs v1.3.

## Self-Check: PASSED

- Archivos existen: `entityGraphLayout.ts`, `entityGraphLayout.test.ts`, `EntityGraphSvg.tsx` — OK.
- Commits presentes: `cce4242`, `bc361ef`, `8a989c5` — OK.
- Pendiente: checkpoint:human-verify (Task 3) — validación visual de Juan antes de cerrar la fase.
