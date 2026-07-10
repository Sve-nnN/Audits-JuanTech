---
phase: 24-codigo-validacion-jsonld-classy-schema
plan: 02
subsystem: db, checks, worker
tags: [schema, jsonld, persistence, prisma]
requires:
  - "packages/checks/src/checks/schema/extract.ts (extractJsonLdBlocks, flattenNodes)"
  - "packages/db/prisma/schema.prisma (modelo Page)"
provides:
  - "Page.schemaJson (Json?): array de entidades JSON-LD planas por página"
  - "RunAllChecksResult.pageSchemaEntities: Map<pageId, entidades planas>"
  - "worker escribe schemaJson junto a schemaGraph en un único update por página"
affects:
  - "apps/web (24-03 consume Page.schemaJson; fallback por Page.html)"
tech-stack:
  added: []
  patterns:
    - "Reutiliza el $ ya cargado por página en runAllChecks (sin re-parsear)"
    - "Un único prisma.page.update por página para schemaGraph + schemaJson (union de pageIds)"
key-files:
  created: []
  modified:
    - packages/db/prisma/schema.prisma
    - packages/checks/src/registry.ts
    - apps/worker/src/index.ts
decisions:
  - "Write unificado por página vía Set de pageIds (grafo y/o entidades) para no duplicar updates"
  - "schemaJson y schemaGraph se escriben condicionalmente segun cada mapa (páginas solo-grafo siguen intactas)"
metrics:
  completed: 2026-07-09
  tasks: 2
  files: 3
---

# Phase 24 Plan 02: Persistir Page.schemaJson Summary

Campo `Page.schemaJson (Json?)` que persiste el array de entidades JSON-LD planas por página como fuente Playwright-free para el árbol de propiedades del detalle (24-03), escrito por el worker en paralelo a `schemaGraph`.

## What Was Built

- **Task 1 — Campo + extracción**: `Page.schemaJson Json?` agregado al modelo Page (schema-first). `RunAllChecksResult` gana `pageSchemaEntities: Map<string, Record<string, unknown>[]>`, poblado en el loop por página reutilizando el `$` ya cargado (`flattenNodes(extractJsonLdBlocks($)).map(n => n.data)`, solo si hay entidades). Cliente Prisma regenerado.
- **Task 2 — Worker write + db:push**: el worker desestructura `pageSchemaEntities` y unifica el write de schema por página en un solo `prisma.page.update` (Set de pageIds con grafo y/o entidades), escribiendo `schemaGraph` y/o `schemaJson` condicionalmente. `pnpm db:push` aplicado contra Neon (columna nullable aditiva).

## Deviations from Plan

None. El write se unificó exactamente como sugería el plan (un update por página en lugar de dos).

## Verification

- `prisma validate` → schema válido; `grep schemaJson prisma/schema.prisma` presente.
- `packages/checks pnpm typecheck` → limpio; `runAllChecks` devuelve `pageSchemaEntities`.
- `apps/worker pnpm typecheck` → limpio; el worker escribe `schemaJson`.
- `pnpm db:push` → "database is now in sync" contra Neon (neondb).
- Sin dependencias nuevas.

## Commits

- `d3b31d9` feat(24-02): Page.schemaJson field + pageSchemaEntities in runAllChecks
- `d2b6b21` feat(24-02): worker persists Page.schemaJson alongside schemaGraph

## Self-Check: PASSED

- schema.prisma, registry.ts, worker/index.ts modificados y verificados en disco.
- db:push aplicado (los audits nuevos ya persisten schemaJson; audits viejos usan fallback por html en 24-03).
