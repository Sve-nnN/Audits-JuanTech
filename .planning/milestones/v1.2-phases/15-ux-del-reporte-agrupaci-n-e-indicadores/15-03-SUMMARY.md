---
phase: 15-ux-del-reporte-agrupaci-n-e-indicadores
plan: 03
subsystem: web-report-ui
tags: [jsonld, badge, report-04, rtl, tdd, phase-close, milestone-close]
requires:
  - "@auditor/report-model jsonLdStateForPage + JsonLdState (plan 15-01)"
  - "apps/web Badge variantes critical/warning/ok/neutral (Fase 9)"
provides:
  - "JsonLdBadge: mapea los 4 estados JSON-LD a variantes de Badge existentes + copy UI-SPEC"
  - "Lista de páginas rastreadas con estado JSON-LD de 4 valores por pageId (REPORT-04)"
affects:
  - "Cierra Phase 15 (3/3) y el milestone v1.2"
tech-stack:
  added: []
  patterns:
    - "Client badge derivado de helper puro (jsonLdStateForPage) — la UI solo mapea estado→variante+copy"
    - "Server component cruza issues category=schema por pageId con presencia de schemaGraph"
    - "RTL jsdom con // @vitest-environment jsdom + cleanup explícito (globals off)"
key-files:
  created:
    - apps/web/app/components/ui/JsonLdBadge.tsx
    - apps/web/app/components/ui/JsonLdBadge.test.tsx
  modified:
    - apps/web/app/audits/[id]/pages/page.tsx
decisions:
  - "hasSchemaGraph derivado en la UI como nodeCount > 0; el helper puro (15-01) mantiene la precedencia error>advertencia>correcto>ausente"
  - "Severidad de Prisma (IssueSeverity) casteada a ReportSeverity (critical|warning|ok) al agrupar por pageId"
  - "Cero colores nuevos: mapeo directo error→critical, warning→warning, ok→ok, absent→neutral (variantes ya existentes de Badge)"
metrics:
  duration: ~6 min
  completed: 2026-07-08
---

# Phase 15 Plan 03: Badge JSON-LD de 4 estados por página Summary

La lista de páginas rastreadas ahora comunica la salud del JSON-LD por página en 4 estados (error / advertencia / correcto / sin JSON-LD, REPORT-04), derivados por el helper puro `jsonLdStateForPage` (15-01) que cruza los issues de categoría `schema` de cada página (por `pageId`) con la presencia de `schemaGraph`, mapeados a variantes existentes de `Badge` sin colores nuevos. Cierra Phase 15 (3/3) y el milestone v1.2.

## What Was Built

- **`JsonLdBadge.tsx`** (client component): prop `{ schemaSeverities: ReportSeverity[]; nodeCount: number }`. Deriva `hasSchemaGraph = nodeCount > 0`, llama a `jsonLdStateForPage`, y mapea el estado a `Badge` con dos mapas locales: estado→variante (`error:"critical"`, `warning:"warning"`, `ok:"ok"`, `absent:"neutral"`) y estado→copy exacto del UI-SPEC (el caso `ok` interpola `nodeCount`). Cero colores nuevos, texto español neutro sin voceo.
- **`JsonLdBadge.test.tsx`** (RTL, jsdom): un assert por cada uno de los 4 estados (variante + copy) más el caso mixto `critical`+`warning` → precedencia "JSON-LD con errores" (y ausencia de "JSON-LD con advertencias").
- **`pages/page.tsx`**: segunda consulta Prisma `issue.findMany({ where: { auditId, category: "schema" }, select: { pageId, severity } })`, agrupada en un `Map<string, ReportSeverity[]>` por `pageId`. El badge de 2 estados fue sustituido por `<JsonLdBadge schemaSeverities={map.get(page.id) ?? []} nodeCount={nodeCount} />`. Resto de la fila (enlace, `shortUrl`, `Reveal`, `orderBy: url`, `EmptyState`) intacto.

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 (RED) | test JsonLdBadge 4-state (import fallido) | 64fefea |
| 1 (GREEN) | impl JsonLdBadge → variantes de Badge | 5ef8a73 |
| 2 | consulta schema por pageId + monta JsonLdBadge en la lista | 07c7294 |

## Verification

- `pnpm --filter web test -- JsonLdBadge` → verde (5 tests del badge).
- `pnpm --filter web test` (suite completa) → 4 archivos, 28 tests verdes.
- `pnpm --filter web typecheck` → limpio.
- `pnpm --filter web build` → compila y genera todas las rutas (incluida `/audits/[id]/pages`).

## TDD Gate Compliance

Task 1 siguió RED→GREEN: commit `test(...)` con el módulo inexistente (fallo real de import, verificado en rojo) antes del commit `feat(...)` con la implementación. Sin fase REFACTOR necesaria. Task 2 no es TDD (cableado de server component verificado por typecheck+build, patrón consistente con 14-01/15-02).

## Deviations from Plan

None — plan ejecutado tal cual. El build inicial falló por `ENOSPC` (disco lleno del entorno, no defecto de código); se liberó espacio limpiando cachés dentro del scope del proyecto (`.next`, `.turbo`) y el build compiló verde. No es una desviación del plan.

## Self-Check: PASSED

- FOUND: apps/web/app/components/ui/JsonLdBadge.tsx
- FOUND: apps/web/app/components/ui/JsonLdBadge.test.tsx
- FOUND: apps/web/app/audits/[id]/pages/page.tsx (modificado)
- FOUND commits: 64fefea, 5ef8a73, 07c7294
