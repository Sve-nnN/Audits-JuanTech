---
phase: 20-visualizador-de-arquitectura
plan: 03
subsystem: web-report
tags: [web, report, architecture, svg, arch-01, arch-02, arch-04, csp, tokens-only]
requires:
  - "ArchNode / ReportArchitecture from @auditor/report-model (Plan 20-02)"
  - "ReportModel.architecture populated in buildReportModel (Plan 20-02)"
  - "TEMPLATE_LABEL exported from app/components/ui/labels.ts"
  - "EntityGraphSvg pure-SVG precedent + tokens.css semantic tokens (DS-01)"
provides:
  - "ArchitectureTreeSvg — self-contained pure-SVG depth tree, zero new deps"
  - "Arquitectura del sitio section rendered in the audit report (conditional)"
affects:
  - "Closes Phase 20 and milestone v1.3 — no downstream consumer"
tech-stack:
  added: []
  patterns:
    - "Deterministic static SVG layout (no client-side layout engine, CSP-safe)"
    - "Token-backed color classes with fill: currentColor (mirrors EntityGraphSvg)"
    - "Per-level truncation with +N más (mostrando N de M)"
    - "Degradation-safe optional section guarded by model.architecture"
key-files:
  created:
    - apps/web/app/components/ArchitectureTreeSvg.tsx
    - apps/web/app/components/ArchitectureTreeSvg.module.css
  modified:
    - apps/web/app/audits/[id]/page.tsx
decisions:
  - "Four depth rows always rendered in fixed 0/1/2/3+ order; empty levels show a muted placeholder for structural clarity"
  - "Orphans row appended only when non-empty; orphan nodes show a 'sin ruta' badge + 'huérfana' marker instead of a depth number (depth -1 sentinel)"
  - "viewBox width derived from max nodes-per-row (capped at MAX_NODES_PER_ROW=12) so the tree scales via CSS width:100% like EntityGraphSvg"
  - "Template → distinct semantic token per class (home/category/product/article/other); deep=--warning, orphan=--text-muted; zero new hex"
metrics:
  duration: ~7m
  completed: 2026-07-09
---

# Phase 20 Plan 03: Architecture Tree SVG Summary

The audit report now renders a self-contained, pure-SVG architecture tree that groups the persisted `ReportArchitecture` nodes by click-depth (0/1/2/3+) plus an orphans row, drawing per-node signals (title/url, depth, orphan indicator, >3-clicks indicator, classified template) with zero new dependencies and tokens-only CSS — shown only when `model.architecture` is present.

## What Was Built

- **`ArchitectureTreeSvg.tsx`:** `ArchitectureTreeSvg({ architecture })` importing `ReportArchitecture`/`ArchNode`/`PageTemplate` from `@auditor/report-model` and `TEMPLATE_LABEL` from `./ui/labels`. Deterministic static layout: four fixed depth rows (`["0","1","2","3+"]`) plus a "Huérfanas" row when `orphans` is non-empty; each row is a left-to-right sequence of node cards. Nodes per row capped at `MAX_NODES_PER_ROW = 12` with a trailing `+N más` label. Each card draws `truncate(title ?? url, 22)`, `TEMPLATE_LABEL[template]`, a depth badge (`{depth} clic(s)` or `sin ruta` for orphans), a `huérfana` marker when `isOrphan`, and a `+3 clics` marker when `isDeep`. Template maps to a token-backed color class on a left stripe using `fill: currentColor`. Empty-state branch (all buckets + orphans empty) renders a single-line neutral-Spanish message. Root `<svg>` has `role="img"` + descriptive `aria-label`. All site-derived strings are React text children (auto-escaped — no `dangerouslySetInnerHTML`).
- **`ArchitectureTreeSvg.module.css`:** Mirrors `EntityGraphSvg.module.css` — `.canvas` responsive (`width:100%`, `height:auto`, `max-width: var(--container-narrow)`) with a fade animation, card/label/badge/indicator classes, and one color class per template. Every color is `var(--token)`; zero raw hex.
- **`page.tsx`:** Imported `ArchitectureTreeSvg` from `../../components/ArchitectureTreeSvg`. After the "Detalle por categoría / plantilla" section (before the footer links) added a `Reveal as="section"` guarded by `{model.architecture && (...)}` with an `<h3 className={styles.sectionTitle}>Arquitectura del sitio</h3>`, the tree, and a `styles.tableNote` caption explaining the depth-of-clicks grouping. No other section, import, or the notFound()/progress branches touched.

## Verification

- `pnpm --filter @auditor/web typecheck` — exit 0 (both tasks).
- `pnpm --filter @auditor/web build` — succeeds; `/audits/[id]` compiles with the new server-rendered section.
- `pnpm --filter @auditor/web test` — 29 tests pass across 4 files (no regression).
- Grep acceptance: imports limited to `@auditor/report-model`, `./ui/labels`, CSS module; `"./ui/labels"` present; `TEMPLATE_LABEL` used; `isOrphan`/`isDeep` both rendered; no `dangerouslySetInnerHTML`; no hex in the CSS module; `model.architecture &&` guard present; `ArchitectureTreeSvg` import + JSX usage present.

## Deviations from Plan

None - plan executed exactly as written.

## Threat Notes

Per the plan threat model: every site-derived string (`node.url`, `node.title`) is rendered as an escaped React text child and length-capped via `truncate()` — no `dangerouslySetInnerHTML` (T-20-03 mitigated, grep-gated). No package installs (T-20-SC accepted). No new network/auth/file surface introduced.

## Tasks & Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Create ArchitectureTreeSvg component + tokens-only CSS module | dfbd067 |
| 2 | Wire architecture section into the report page (conditional) | 41a7842 |

## Self-Check: PASSED
- apps/web/app/components/ArchitectureTreeSvg.tsx — FOUND (exports ArchitectureTreeSvg, tokens-only imports).
- apps/web/app/components/ArchitectureTreeSvg.module.css — FOUND (no hex).
- apps/web/app/audits/[id]/page.tsx — FOUND (import + conditional JSX usage).
- Commit dfbd067 — FOUND.
- Commit 41a7842 — FOUND.
