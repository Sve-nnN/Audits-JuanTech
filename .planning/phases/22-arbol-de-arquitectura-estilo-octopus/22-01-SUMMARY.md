---
phase: 22-arbol-de-arquitectura-estilo-octopus
plan: 01
subsystem: report-model
tags: [architecture, tree, graph, ARCH-05]
requires:
  - "Audit.stats.graph (edges/nodes/depthByUrl) persistido por el worker (Phase 16)"
  - "ArchNode y classifyTemplate existentes en @auditor/report-model"
provides:
  - "ArchTreeNode (ArchNode + children[]) exportado"
  - "ReportArchitecture.tree: árbol anidado real reconstruido desde graph.edges"
  - "Reconstrucción padre-por-menor-profundidad en build.ts"
affects:
  - "apps/web/app/components/ArchitectureTreeSvg.tsx (consumía nodesByDepth — a rehacer en Plan 22-02)"
tech-stack:
  added: []
  patterns:
    - "Reconstrucción de árbol acíclico por regla depth(padre) < depth(hijo)"
    - "Orden estable por graph.nodes para children y raíces"
key-files:
  created: []
  modified:
    - packages/report-model/src/model.ts
    - packages/report-model/src/build.ts
    - packages/report-model/src/index.ts
    - packages/report-model/src/build.test.ts
decisions:
  - "Padre = enlazador válido de menor profundidad (depth estricto < hijo); empate → primero en orden estable; self-loops ignorados (grafo acíclico por construcción, cierra T-22-01)"
  - "Task 22-01 es data-only; el consumidor web ArchitectureTreeSvg.tsx se adapta en Plan 22-02 (diferido documentado)"
metrics:
  duration: "~15 min"
  completed: "2026-07-09"
  tasks: 3
  files: 4
---

# Phase 22 Plan 01: Árbol de arquitectura (reconstrucción desde edges) Summary

Reconstrucción del árbol anidado real del sitio (`ReportArchitecture.tree: ArchTreeNode[]`) desde `graph.edges`, reemplazando las filas planas por profundidad (`nodesByDepth`); cada nodo cuelga del enlazador de menor profundidad. Cierra ARCH-05 y deja el contrato listo para el dendrograma del Plan 22-02.

## What Was Built

- **Task 1 — Modelo (`model.ts`, `index.ts`):** Nuevo `ArchTreeNode extends ArchNode { children: ArchTreeNode[] }`. `ReportArchitecture` ahora expone `tree: ArchTreeNode[]` (raíces) en vez de `nodesByDepth`; `orphans: ArchNode[]` intacto. `ArchNode` sin cambios (ARCH-06 depende de sus señales). `ArchTreeNode` exportado públicamente. Commit `377112f`.
- **Task 2 — Reconstrucción (`build.ts`):** Se tiparon los `edges` como `{ from, to }[]` (antes `unknown[]`, sin consumir) y ahora se usan. Se construye `archByUrl` recorriendo `graph.nodes` en orden (saltando páginas rotas, WR-02), se calcula el padre de cada nodo como el enlazador válido de MENOR profundidad con `depth(padre) < depth(hijo)` (empate → primero, sin sobrescribir), y se arma `tree` con raíces + children en orden estable. Huérfanas preservadas igual que antes (WR-01, depth -1). `architecture = { tree, orphans }`. Commit `6a0cf68`.
- **Task 3 — Tests (`build.test.ts`):** `makeAuditWithGraph` acepta `edges` (default `[]`). Helpers `findInTree`/`childUrls`. Dos tests nuevos: jerarquía padre-hijo desde edges (home→A, home→B, A→C) y regla de padre por menor profundidad (leaf enlazado por home[0] y mid[1] → padre = home, sin importar el orden del edge). Se adaptaron a `tree` los tests de señales por nodo (title/isDeep/depth/template), depth==3, huérfanas, páginas rotas (WR-01/WR-02), graphless y nodes-vacío. Cero referencias a `nodesByDepth`. Commit `5f8db06`.

## Verification

- `pnpm --filter @auditor/report-model typecheck` — pasa.
- `pnpm --filter @auditor/report-model test` — 36/36 tests verdes.
- `grep -rc "nodesByDepth" packages/report-model/src` — 0 en todos los archivos.

## Deviations from Plan

None — plan ejecutado tal cual. Ajuste menor de fixture: en el test de jerarquía la aserción de `template` del hijo `/a/c` se fijó al valor real de `classifyTemplate` (`"category"`) en lugar de un valor inventado; verifica lo mismo (que la señal se preserva por nodo).

## Deferred Issues

- **`apps/web/app/components/ArchitectureTreeSvg.tsx` consume `nodesByDepth` (eliminado).** Fuera de alcance por diseño: Plan 22-01 es data-only; el Plan 22-02 reescribe ese SVG como dendrograma estilo Octopus.do consumiendo `ArchTreeNode`/`tree`. Hasta entonces, el typecheck/build de `web` fallará en ese archivo. Registrado en `.planning/phases/22-arbol-de-arquitectura-estilo-octopus/deferred-items.md`.

## Threat Model Notes

- **T-22-01 (DoS por ciclos):** mitigado — la regla `depth(padre) < depth(hijo)` produce un grafo acíclico por construcción; self-loops (`from===to`) se ignoran; el armado es iterativo (sin recursión no acotada).
- **T-22-02 (fuga de PII):** sin cambios en la superficie de datos (solo url/title/depth/template/isDeep/isOrphan); el test "never leaks PII" sigue pasando.

## Self-Check: PASSED

- Archivos modificados existen: model.ts, build.ts, index.ts, build.test.ts — OK.
- Commits presentes: `377112f`, `6a0cf68`, `5f8db06` — OK.
