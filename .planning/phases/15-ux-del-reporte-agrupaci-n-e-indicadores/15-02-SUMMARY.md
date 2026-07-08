---
phase: 15-ux-del-reporte-agrupaci-n-e-indicadores
plan: 02
subsystem: web-report-ui
tags: [ui, details-summary, grouping, a11y, tokens-only]
requires:
  - "@auditor/report-model groupIssuesByType (plan 15-01, única fuente del orden)"
  - "CategoryAccordion patrón details/summary; Badge/SeverityBadge/DiffBadge; url.ts shortUrl"
provides:
  - "IssueTypeGroup: dropdown reutilizable de grupo de issues por tipo (REPORT-01/02)"
  - "page.tsx cableado: Issues prioritarios y Detalle por categoría renderizan grupos"
affects:
  - "Reporte on-screen: prioritarios y detalle por categoría dejan de ser listados planos"
tech-stack:
  added: []
  patterns:
    - "details/summary nativo sin estado JS (a11y de teclado gratis, aria-expanded nativo)"
    - "Componente client montado como hijo dentro de server component (page.tsx sigue server)"
    - "CSS Module tokens-only, focus-visible lime inset, guard reduced-motion"
key-files:
  created:
    - apps/web/app/components/ui/IssueTypeGroup.tsx
    - apps/web/app/components/ui/IssueTypeGroup.module.css
    - apps/web/app/components/ui/IssueTypeGroup.test.tsx
  modified:
    - apps/web/app/audits/[id]/page.tsx
decisions:
  - "El componente exporta el nombre IssueTypeGroup; no importa el tipo homónimo de report-model (evita colisión) — el tipo de grupos se infiere de groupIssuesByType"
  - "Filas de página afectada con etiquetas Página / URL y Valor medido (dl-style) reusando la salvaguarda de esquema http(s) de IssuesTable"
  - "En Issues prioritarios la nota 'Mostrando N de M' pasa a texto (styles.tableNote) bajo los grupos; el EmptyState se renderiza explícito con CheckCircle2 (antes lo daba IssuesTable)"
metrics:
  duration: ~7 min
  completed: 2026-07-08
---

# Phase 15 Plan 02: Componente IssueTypeGroup y cableado en el reporte Summary

Un único componente `IssueTypeGroup` (details/summary nativo) reemplaza el listado plano de issues en las dos secciones del reporte —"Issues prioritarios" (REPORT-01) y "Detalle por categoría" en problemas y correctos (REPORT-02)— alimentado por `groupIssuesByType` como única fuente del orden severidad→cantidad, garantizando orden idéntico en ambos lugares sin perder ni duplicar issues.

## What Was Built

- **`IssueTypeGroup.tsx`** (client component): recibe `{ issues: ReportIssue[] }`, llama a `groupIssuesByType` y renderiza un `<details>` por grupo. Summary = título del issue (Geist Sans semibold, NO Khand) + `SeverityBadge` de la peor severidad del grupo + conteo singular/plural (`{n} página`/`{n} páginas`) + `ChevronDown` aria-hidden que rota en `[open]`. Cuerpo = una fila por página afectada con URL (enlace real solo si `^https?://`, si no texto que React escapa — salvaguarda T-15-02), valor medido mono (`?? "—"`) y `DiffBadge` cuando hay `diffStatus`. Región de filas `role="region"` + `aria-label` + `tabIndex=0` con `overflow-x:auto` (mismo tratamiento que IssuesTable). Sin estado JS ni `aria-expanded` manual.
- **`IssueTypeGroup.module.css`**: tokens-only (cero hex), superficie `--surface`/`--border`/`--radius-md`, hover `--surface-hover`, focus-visible `2px var(--ring)` offset `-2px`, chevron `transform .2s ease` con guard `prefers-reduced-motion`.
- **`IssueTypeGroup.test.tsx`** (RTL, jsdom): 5 casos — títulos+conteos visibles, orden del DOM == orden del helper (critical antes que warning), expandir muestra ambas filas sin perder issues, DiffBadge presente con diffStatus, vacío no renderiza `<details>`.
- **`page.tsx`**: "Issues prioritarios" renderiza `<IssueTypeGroup issues={priorityIssues} />` con EmptyState explícito cuando vacío y nota "Mostrando N de M" debajo. "Detalle por categoría" renderiza `<IssueTypeGroup />` sobre `problems` y `passing` dentro de cada `AccordionSubgroup`. Eliminado el código muerto (`IssuesTable`, `IssueDetail`, `renderIssue`, `urlValue`, `issueColumns/issueRows`, `SEVERITY_SORT_WEIGHT`, tipos `Severity`/`Diff`, imports `shortUrl`/`ReactNode`/`ReportIssue`).

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 (RED) | test failing para IssueTypeGroup | 7f860d8 |
| 1 (GREEN) | impl IssueTypeGroup + CSS tokens-only | fef1e9a |
| 2 | cableado en page.tsx (ambas secciones) + limpieza | 4cd9b29 |

## Verification

- `pnpm --filter web test -- IssueTypeGroup` → 23 tests verdes (5 nuevos IssueTypeGroup + 18 existentes).
- `pnpm --filter web typecheck` → limpio.
- `pnpm --filter web build` → verde (ruta `/audits/[id]` 26.1 kB).
- CSS module sin hex crudo (grep = 0). Summary con `focus-visible` `var(--ring)` offset `-2px`. Sin voceo en el componente.
- Secciones score/categoría/perf/diff sin cambios (diff acotado a imports, helpers muertos y las dos secciones objetivo).

## TDD Gate Compliance

Task 1 siguió RED→GREEN: commit `test(...)` (7f860d8) con el componente inexistente fallando en el import, luego `feat(...)` (fef1e9a) con la implementación. Sin fase REFACTOR necesaria. Task 2 no es TDD (cableado sobre componente ya testeado; cubierto por typecheck+build).

## Deviations from Plan

None - plan ejecutado tal como está escrito.

## Self-Check: PASSED

- FOUND: apps/web/app/components/ui/IssueTypeGroup.tsx
- FOUND: apps/web/app/components/ui/IssueTypeGroup.module.css
- FOUND: apps/web/app/components/ui/IssueTypeGroup.test.tsx
- FOUND commits: 7f860d8, fef1e9a, 4cd9b29
