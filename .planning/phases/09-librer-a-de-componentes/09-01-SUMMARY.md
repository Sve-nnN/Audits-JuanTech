---
phase: 09-librer-a-de-componentes
plan: 01
subsystem: web-ui-foundation
tags: [ui, components, dependencies, i18n-es, helpers]
requires: []
provides:
  - "lucide-react dependency in @auditor/web"
  - "components/ui/labels.ts (SEVERITY/DIFF/CATEGORY/STATUS/STRATEGY_LABEL)"
  - "components/ui/url.ts (shortUrl, issueUrl)"
affects:
  - "Waves 2-4 de Fase 9 (Badge, Button, Field, EmptyState, Accordion, IssuesTable)"
tech-stack:
  added:
    - "lucide-react ^1.23.0 (íconos SVG inline, tree-shakeable, CSP-safe)"
  patterns:
    - "Módulos compartidos server/client-agnósticos (funciones puras + constantes, sin 'use client')"
    - "Copy extraído verbatim desde la fuente para evitar drift de etiquetas"
key-files:
  created:
    - apps/web/app/components/ui/labels.ts
    - apps/web/app/components/ui/url.ts
  modified:
    - apps/web/package.json
    - pnpm-lock.yaml
decisions:
  - "lucide-react verificado legítimo en npm (publisher lucide, repo lucide-icons/lucide) antes de instalar"
  - "labels.ts y url.ts NO llevan 'use client' — son puros y reutilizables desde server o client"
metrics:
  duration: "~2 min"
  completed: "2026-07-06"
  tasks: "3/3"
  files: 4
---

# Phase 9 Plan 01: Fundación de la librería de componentes Summary

Instalada `lucide-react` (única dependencia nueva de la fase, verificada como legítima) y extraídos a módulos compartidos (`labels.ts`, `url.ts`) los cinco mapas de etiquetas en español neutro y los helpers `shortUrl`/`issueUrl` que vivían inline en `audits/[id]/page.tsx`, listos para consumo por los componentes reutilizables de las waves 2-4.

## What Was Built

- **Task 1 (checkpoint de legitimidad, pre-aprobado):** verificación de `lucide-react` en npm — publisher oficial `lucide`, repo `github.com/lucide-icons/lucide`, no typosquat. Aprobado por Juan antes de instalar (mitiga T-09-SC de supply-chain).
- **Task 2:** `pnpm --filter @auditor/web add lucide-react` → `^1.23.0` en `dependencies` (orden alfabético), resoluble por node.
- **Task 3:** creada la carpeta `apps/web/app/components/ui/` con:
  - `labels.ts` — named exports `CATEGORY_LABEL`, `STATUS_LABEL`, `SEVERITY_LABEL`, `DIFF_LABEL`, `STRATEGY_LABEL`, tipados con `Category`/`ScoreStatus` de `@auditor/scoring`.
  - `url.ts` — `issueUrl({source, scope})` y `shortUrl(url)` como funciones puras.

## Verification

- `grep` confirma los exports esperados en ambos módulos.
- `pnpm --filter @auditor/web typecheck` (tsc --noEmit) pasa limpio.
- `node -e "require.resolve('lucide-react')"` OK; queda en `dependencies`, no `devDependencies`.
- Copy verbatim, español neutro sin voceo.

## Deviations from Plan

None - plan executed exactly as written.

Nota de scope: durante Task 3 el gate de typecheck reportó momentáneamente 3 errores en `ScoreGauge.tsx` (WIP de otro plan paralelo de la misma fase, archivo sin trackear). Fuera de scope de este plan; el plan paralelo lo corrigió y el typecheck final pasó. Sólo se commitearon `labels.ts` y `url.ts` (staging individual); `ScoreGauge.*` y `CategoryCard.*` de otros planes se dejaron intactos.

Nota de convención: `url.ts` conserva el glifo `—` como valor de fallback de `shortUrl` — es una constante de display de UI copiada verbatim de la fuente existente (misma convención que `formatDate`), no prosa de deliverable, por lo que la regla anti-em-dash no aplica.

## Commits

- `2abd9be` chore(09-01): add lucide-react to @auditor/web
- `d82f95f` feat(09-01): extract shared UI labels and url helpers

## Self-Check: PASSED
