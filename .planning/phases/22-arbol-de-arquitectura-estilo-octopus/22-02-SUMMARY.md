---
phase: 22-arbol-de-arquitectura-estilo-octopus
plan: 02
subsystem: web-report
tags: [architecture, tree, dendrogram, svg, ARCH-06, DS-01]
requires:
  - "ReportArchitecture.tree (ArchTreeNode[]) reconstruido en Plan 22-01"
  - "Helpers/estilos existentes de ArchitectureTreeSvg (classForTemplate, TEMPLATE_LABEL, tokens tpl*)"
provides:
  - "ArchitectureTreeSvg como dendrograma top-down con conectores padre-hijo visibles"
  - "Cap por rama MAX_CHILDREN_PER_NODE con nodo-resumen '+K más' visible"
  - "Banda de huérfanas aparte con su propio cap '+N más'"
affects:
  - "apps/web/app/audits/[id]/page.tsx (nota descriptiva del dendrograma)"
tech-stack:
  added: []
  patterns:
    - "Dendrograma reingold-tilford simplificado: X de hoja por contador, X interna = promedio de hijos"
    - "Conectores <path> bezier vertical tokens-only (fill:none, stroke var(--border))"
    - "SVG puro sin motor de layout en cliente (CSP estricta, DS-01)"
key-files:
  created: []
  modified:
    - apps/web/app/components/ArchitectureTreeSvg.tsx
    - apps/web/app/components/ArchitectureTreeSvg.module.css
    - apps/web/app/audits/[id]/page.tsx
decisions:
  - "MAX_CHILDREN_PER_NODE=12 (en línea con el antiguo MAX_NODES_PER_ROW=12); exceso → nodo-resumen '+K más' como hijo virtual visible, nunca truncado silencioso (T-22-04)"
  - "Huérfanas en banda-grilla bajo el árbol (sin conectores), columnas alineadas al ancho del árbol; cap MAX_ORPHANS=24"
  - "Nivel del dendrograma = profundidad de traversal del árbol (Y), independiente de node.depth (que sigue como badge de clics)"
metrics:
  duration: "~20 min"
  completed: "2026-07-09"
  tasks: "2/3 (auto completadas; Task 3 checkpoint humano pendiente)"
  files: 3
---

# Phase 22 Plan 02: Dendrograma de arquitectura estilo Octopus.do Summary

Reescritura de `ArchitectureTreeSvg` de filas planas por profundidad a un dendrograma top-down (raíz/home arriba, niveles hacia abajo) que consume el árbol anidado `ReportArchitecture.tree` del Plan 22-01, con conectores SVG padre-hijo visibles, cap por rama "+N más", señales v1.3 por nodo y SVG puro tokens-only sin hex. Cierra la superficie de código de ARCH-06 — pendiente sólo la aprobación visual de Juan (Task 3).

## What Was Built

- **Task 1 — Dendrograma (`ArchitectureTreeSvg.tsx`):** Cuerpo reescrito para consumir `architecture.tree` (array de raíces `ArchTreeNode`) en vez del `nodesByDepth` eliminado. Layout determinista en dos pasadas puras: (1) recorrido recursivo `layout()` que asigna a cada hoja una X desde un contador incremental (`leafCursor`) y a cada nodo interno la X promedio de sus hijos dibujados (reingold-tilford simplificado), con el nivel = profundidad de traversal (Y creciente); (2) render de conectores primero (`<path>` bezier vertical de borde inferior del padre a borde superior del hijo) y encima las tarjetas. Cada tarjeta conserva las señales v1.3 reusando los helpers existentes: franja de color por plantilla (`classForTemplate` + `currentColor`), `TEMPLATE_LABEL`, badge `${depth} clic(s)`, marca `+3 clics` (`isDeep`), marca `huérfana`. Cap por rama `MAX_CHILDREN_PER_NODE=12`: el exceso se dibuja como nodo-resumen `+K más` (hijo virtual visible, con conector, T-22-04). Huérfanas (`architecture.orphans`) en banda-grilla aparte bajo el árbol (sin conectores) con su propio cap `+N más`. Ancho del SVG dinámico por total de hojas, alto por profundidad máxima. Estado vacío conservado; `aria-label` actualizado a "Árbol de arquitectura del sitio (jerarquía padre-hijo)". Sin dependencias nuevas, sin hex, sin motor de layout en cliente. Commit `c6b96da`.
- **Task 2 — Estilos + nota (`.module.css`, `page.tsx`):** CSS: nuevas clases `.connector` (`stroke: var(--border)`, `fill: none` obligatorio para bezier) y `.moreCardBg` (`--surface-hover` + `stroke-dasharray`), ambas tokens-only sin hex; se conservan todas las reglas existentes (`.cardBg`, `.cardTitle`, `.tpl*`, `.deepMark`, etc.). `page.tsx`: la prop sigue siendo `architecture={model.architecture}` (sin cambio de forma); sólo se reemplazó el texto de la nota "Páginas agrupadas por profundidad de clics…" por una descripción de la jerarquía/dendrograma padre-hijo. Commit `0454b20`.

## Verification

- `pnpm --filter web typecheck` — pasa (referencia a `nodesByDepth` eliminada).
- `pnpm --filter web build` — pasa (todas las rutas compilan; `/audits/[id]` 8.01 kB).
- `grep -c "nodesByDepth\|DEPTH_ORDER" ArchitectureTreeSvg.tsx` — 0.
- `grep -nE "#[0-9a-fA-F]{3,6}\b"` en `.tsx` y `.module.css` — 0 (DS-01, tokens-only).
- Conectores `<path>`, consumo de `tree`/`children` y cap `MAX_CHILDREN_PER_NODE`/"+N más" presentes (greps de acceptance verdes).

## Deviations from Plan

None en las tareas auto — ejecutadas tal cual. Detalle de discreción documentado: se usó `<path>` bezier (no `<line>`) para conectores curvos suaves estilo Octopus.do (el plan permite ambos); las huérfanas se distribuyen en grilla con columnas alineadas al ancho del árbol (el plan pedía "banda/sección aparte con su propio cap", cumplido).

## Checkpoint Pendiente (Task 3 — human-verify, blocking)

El código está completo, commiteado y con typecheck+build verdes. Task 3 es un checkpoint de verificación visual que NO se auto-aprueba: requiere que Juan levante la web (`cd apps/web && pnpm dev`), abra un reporte con grafo persistido (ej. aprendoclub, 71 nodos) en `/audits/{id}` → sección "Arquitectura del sitio", y confirme que se ve como un dendrograma top-down con conexiones visibles (no filas planas), señales por nodo, nodos "+N más" en ramas grandes, banda de huérfanas, y contraste correcto en claro/oscuro. ARCH-06 queda cerrado sólo tras "aprobado".

## Deferred Issues

- Item diferido de Plan 22-01 (`ArchitectureTreeSvg.tsx` referenciaba `nodesByDepth` eliminado) — **RESUELTO** por este plan.
- `pnpm --filter web lint` no corre: el entorno no tiene configuración de ESLint y `next lint` (deprecado en Next 16) abre un prompt interactivo. Preexistente, ajeno a este plan; typecheck cubre la validación estática.

## Self-Check: PASSED

- Archivos modificados existen: ArchitectureTreeSvg.tsx, ArchitectureTreeSvg.module.css, page.tsx — OK.
- Commits presentes: `c6b96da`, `0454b20` — OK.
