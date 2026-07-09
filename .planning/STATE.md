---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Visualización avanzada + resolución de URL
status: Phases 21-22 completas y aprobadas. Próximo: Phase 23 (grafo JSON-LD radial). Retomar con /gsd-autonomous tras /clear.
last_updated: "2026-07-10T00:20:00.000Z"
last_activity: 2026-07-09 — Phase 22 APROBADA por Juan (dendrograma + mapa navegable /arquitectura; ARCH-05/06 Complete)
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 5
  completed_plans: 5
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-09 after v1.3, v1.4 opened)

**Core value:** Cualquier persona ingresa una URL y recibe una auditoría completa, precisa y accionable de su web (errores reales priorizados por severidad), a cambio de su email verificado.
**Current focus:** v1.4 (Visualización avanzada + resolución de URL). Phases 21-22 completas y aprobadas. Próximo: `/gsd:plan-phase 23` (grafo JSON-LD radial). Retomar con `/gsd-autonomous`.

## Current Position

Phase: 23 (Grafo JSON-LD con layout radial) — not started
Plan: —
Status: Phases 21 (resolución URL) y 22 (árbol octopus + mapa navegable) COMPLETAS y aprobadas por Juan. Listo para arrancar Phase 23.
Last activity: 2026-07-09 — Phase 22 aprobada (ARCH-05/06 Complete)

## Phase 23 — arranque (contexto para el discuss)

Objetivo (SDVIZ-01): el grafo de entidades JSON-LD (`EntityGraphSvg`) usa layout RADIAL por componente conexo: el nodo raíz de cada grafo (entidad sin edges entrantes) al centro con sus hijos alrededor, en vez del círculo uniforme actual. Una página con varios grafos (ej. BlogPosting + BreadcrumbList) muestra cada componente con su propio centro.
- Componente a reworkear: `apps/web/app/components/EntityGraphSvg.tsx` (hoy pone TODOS los nodos en un círculo uniforme — ver `angle = 2π·i/n`).
- El grafo de entidades ya expande entidades anidadas (fix de v1.3: `buildEntityGraph` en `packages/checks/src/checks/schema/entityGraph.ts` — nodes/edges con rel por propiedad). Se persiste en `Page.schemaGraph`.
- Se muestra en `/audits/[id]/pages/[pageId]` (detalle de página). SVG puro, cero deps, tokens-only sin hex.
- Detectar componentes conexos + root (nodo sin incoming edges o el primero) + layout radial por componente.

## Phase 24 — pendiente (la más pesada)

SDVIZ-02 (código JSON-LD formateado por entidad) + SDVIZ-03 (validación por propiedad/tipo contra schema.org, errores individuales estilo Classy Schema). Candidata a research de la fuente del vocabulario schema.org. Alcance pragmático (subconjunto de alto valor, no vocab completo). Nunca falla dura del score.

## Notas de ejecución (patrón de esta sesión)

- Cada fase: smart discuss (AskUserQuestion con grey areas batch) → planner (gsd-planner) → plan-checker (gsd-plan-checker) → executor(es) secuenciales en main tree → code-review (gsd-code-reviewer) + verify (gsd-verifier) en paralelo → fix warnings inline → commit.
- Fases UI (22-24) terminan en checkpoint:human-verify — Juan valida visualmente antes de cerrar. Juan es design-conscious e itera el look.
- Migraciones: `packages/db` es schema-first (`pnpm db:push`, sin carpeta migrations). Cuando el worker escribe una columna/campo nuevo, correr `pnpm db:push` contra Neon o las auditorías fallan (pasó con Page.title, Audit.resolvedUrl).
- Verificar fixes de datos contra un audit real de aprendoclub con tsx (patrón: script .mts en packages/db o packages/report-model, correr con node node_modules/.pnpm/tsx@4.23.0/.../cli.mjs).

## Milestone v1.4 — Phases

| Phase | Nombre | Requirements | UI |
|-------|--------|--------------|-----|
| 21 | Resolución canónica de la URL de entrada | URLRES-01/02 | no |
| 22 | Árbol de arquitectura estilo octopus | ARCH-05/06 | sí |
| 23 | Grafo JSON-LD con layout radial | SDVIZ-01 | sí |
| 24 | Código + validación JSON-LD estilo Classy Schema | SDVIZ-02/03 | sí |

## Notas de arranque

- Origen: feedback de Juan durante validación visual de v1.3 (capturas Octopus.do + Classy Schema).
- Milestone design-heavy: Juan es design-conscious, iterará el look de las visualizaciones (Phases 22-24).
- Phase 24 (validación schema.org) es la más pesada y candidata a research de la fuente del vocabulario.
- Phase 21 reemplaza la mitigación puntual `resolveHomeKey` (v1.3) por resolución correcta aguas arriba.
- Backlog completo en `.planning/BACKLOG.md`.
