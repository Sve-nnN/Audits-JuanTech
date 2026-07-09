# Deferred Items — Phase 22

## From Plan 22-01

- **`apps/web/app/components/ArchitectureTreeSvg.tsx` referencia `nodesByDepth` (eliminado).**
  - Al reemplazar `ReportArchitecture.nodesByDepth` por `tree: ArchTreeNode[]`, este componente (líneas ~57, 61) ya no typecheckea contra el nuevo contrato.
  - Fuera de alcance por diseño: el Plan 22-01 es data-only; el Plan 22-02 reescribe este SVG como dendrograma estilo Octopus.do consumiendo `ArchTreeNode`/`tree`.
  - Acción requerida: Plan 22-02 debe adaptar `ArchitectureTreeSvg.tsx` (o su reemplazo) al nuevo árbol anidado. Hasta entonces, `pnpm --filter web typecheck/build` fallará en ese archivo.
