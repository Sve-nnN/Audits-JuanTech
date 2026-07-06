---
phase: 10-pantallas-redise-adas-copy-motion-y-accesibilidad
plan: 05
subsystem: web-ui
tags: [screen-04, report, phase-9-components, motion, copy, a11y]
requires:
  - "10-01: Phase 9 UI library + motion hooks (ScoreGauge, CategoryCard, IssuesTable, CategoryAccordion, Badge, EmptyState, useCountUp, useReveal, labels.ts, url.ts)"
provides:
  - "SCREEN-04 report /audits/[id] re-skinned with the full Phase 9 library"
  - "ScoreGaugeAnimated client wrapper (count-up + arc fill anchor for the report hero)"
affects:
  - "apps/web/app/audits/[id]/page.tsx"
  - "apps/web/app/audits/[id]/report.module.css"
  - "apps/web/app/audits/[id]/ScoreGaugeAnimated.tsx"
  - "apps/web/app/components/ui/CategoryAccordion.tsx (empty-copy fix)"
tech-stack:
  added: []
  patterns:
    - "Server component composes Phase 9 client components; motion isolated in tiny client wrappers (ScoreGaugeAnimated + Reveal)"
    - "Section reveals via <Reveal as=section delay> with staggered --reveal-delay (0/60/120/180, capped 4 steps)"
    - "Gauge count-up by feeding useCountUp's interpolated value into ScoreGauge (number + --gauge-offset arc animate together per render)"
key-files:
  created:
    - "apps/web/app/audits/[id]/ScoreGaugeAnimated.tsx"
  modified:
    - "apps/web/app/audits/[id]/page.tsx"
    - "apps/web/app/audits/[id]/report.module.css"
    - "apps/web/app/components/ui/CategoryAccordion.tsx"
decisions:
  - "Gauge arc animated by re-rendering ScoreGauge with the interpolated count-up value (not a separate WAAPI --gauge-offset pass) — ScoreGauge already derives offset from value, so number + arc stay in lockstep and reduced-motion returns the final value instantly"
  - "Fixed AccordionSubgroup empty copy to the exact UI-SPEC strings (accent + wording) rather than rendering bespoke empties, keeping the shared component as the single source of that copy"
metrics:
  duration: ~20m
  completed: 2026-07-06
  tasks: 2 auto + 1 checkpoint (auto-approved)
  files: 4
---

# Phase 10 Plan 05: Report SCREEN-04 Re-skin Summary

Re-skinned the report `/audits/[id]` (the product's centerpiece, mirror of the juan-tech.com 86/100 reference) by replacing every hand-rolled block (scoreCircle, categoryCard, table, native details, pill badges) with the Phase 9 library — ScoreGauge, CategoryCard, IssuesTable, CategoryAccordion/AccordionSubgroup/IssueDetail, SeverityBadge/DiffBadge/Badge, EmptyState/ErrorState — deduplicated the local label/url maps into `components/ui/labels` + `url`, applied the exact UI-SPEC copy (neutral Spanish, no voceo), and added motion (gauge count-up + arc fill on viewport entry, staggered section/card reveals) with the reduced-motion contract inherited from globals.css. All v1.0 server-side data-fetching is preserved verbatim.

## What was built

**Task 1 — Re-skin + dedupe + copy (`97f55a3`)**
- Preserved intact: `notFound()`, the `status !== "done"` gate rendering `<AuditProgress>`, the `Promise.all` (priorityIssues / issuesForDetail / resolvedIssues + `count`), the `issuesByCategory` bucketing, the typed `AuditScores`/`AuditStats`/`PerfStatsSummary` reads, and `formatDate` (`es` locale).
- Deleted the local `CATEGORY_LABEL/STATUS_LABEL/SEVERITY_LABEL/DIFF_LABEL/STRATEGY_LABEL` maps and the local `shortUrl`/`issueUrl` helpers; now imported from `components/ui/labels` and `components/ui/url`.
- Composition: breadcrumb (`ArrowLeft` → "Inicio"), header row (Khand h1 domain + meta line + "Ver páginas y grafo de entidades"), score hero (`ScoreGauge` lg + Khand h2 + body + status `Badge`), 5× `CategoryCard` grid, diff summary (3× `DiffBadge` + mono count + resolved list), `IssuesTable` (Categoría · Issue · Página[sticky] · Severidad · Valor medido[mono] · Estado), perf 2-card grid with `EmptyState`/`ErrorState` fallbacks, `CategoryAccordion` per category with Problemas/Correcto subgroups + `IssueDetail`, footer link.
- `report.module.css` rewritten to layout/section styles only, fully tokenized (zero hex), orphaned hand-rolled classes removed.
- Exact UI-SPEC SCREEN-04 copy strings; DB `recommendation` strings untouched (COPY-03 scope = chrome/labels only).

**Task 2 — Motion (`a661c6e`)**
- `ScoreGaugeAnimated.tsx` (client): `useCountUp(overall, { duration: 900 })` interpolates 0→overall on viewport entry; the interpolated value feeds `ScoreGauge` so the number counts and the `--gauge-offset` arc fills together.
- Hero, categories, diff, issues, perf, and detail sections wrapped in `<Reveal as="section">` with staggered `--reveal-delay` (0/60/120/180, capped ~4 steps); category cards stagger-reveal within their grid.
- No new libraries; reduced-motion neutralization comes from globals.css (`[data-reveal]` + gauge final value).

## Verification

- `pnpm --filter @auditor/web typecheck` → exit 0 (full monorepo clean).
- Phase 9 components present (`IssuesTable`, `CategoryAccordion`); labels/url imports present; no voceo tokens; motion hooks (`useCountUp`/`useReveal`) present; zero hex in CSS.
- Task 3 (visual pixel-perfect checkpoint) auto-approved under AUTO_MODE after gates passed, per orchestrator instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Copy correctness] AccordionSubgroup empty strings**
- **Found during:** Task 1
- **Issue:** `components/ui/CategoryAccordion.tsx` emitted `"Sin problemas en esta categoria."` (missing accent) and `"Sin checks correctos."`, which do not match the exact UI-SPEC SCREEN-04 strings the acceptance criteria require.
- **Fix:** Updated to `"Sin problemas en esta categoría."` and `"Sin checks marcados como correctos."`. Shared component, so all consumers get the corrected copy.
- **Files modified:** apps/web/app/components/ui/CategoryAccordion.tsx
- **Commit:** 97f55a3

## Auto-mode Checkpoint

- **Task 3 (checkpoint:human-verify, gate=blocking):** Auto-approved under AUTO_MODE. All automated gates green (typecheck, component presence, dedupe, no-voceo, motion, no-hex). Pixel-perfect visual validation against the reference report (dark/light, mobile/desktop, gauge count-up, sticky-URL scroll, reduced-motion) remains available for Juan to spot-check; not blocking.

## Deferred Issues

- Logged to `deferred-items.md`: transient `apps/web/app/HomeClient.tsx` TS2322 (`Input` `ref`) errors appeared mid-run from a concurrent SCREEN-01 sibling agent and were resolved by that agent before final verification. Not a 10-05 concern; 10-05 files were type-clean throughout.

## Known Stubs

None. All rendered data is wired to the preserved v1.0 data-fetching; no placeholder/empty-array UI stubs introduced.

## Self-Check: PASSED

All created/modified files exist; both task commits (97f55a3, a661c6e) present in git history.
