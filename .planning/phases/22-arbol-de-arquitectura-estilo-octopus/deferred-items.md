# Deferred Items — Phase 22

## From Plan 22-01

- **[RESUELTO en Plan 22-02] `apps/web/app/components/ArchitectureTreeSvg.tsx` referenciaba `nodesByDepth` (eliminado).**
  - Al reemplazar `ReportArchitecture.nodesByDepth` por `tree: ArchTreeNode[]`, este componente (líneas ~57, 61) ya no typecheckeaba contra el nuevo contrato.
  - Fuera de alcance por diseño: el Plan 22-01 es data-only; el Plan 22-02 reescribió este SVG como dendrograma estilo Octopus.do consumiendo `ArchTreeNode`/`tree`.
  - Resolución: Plan 22-02 (commit `c6b96da`) reescribió `ArchitectureTreeSvg.tsx` como dendrograma top-down; `pnpm --filter web typecheck` y `build` pasan.
