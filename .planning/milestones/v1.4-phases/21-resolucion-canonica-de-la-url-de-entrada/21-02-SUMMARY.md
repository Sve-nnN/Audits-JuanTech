---
phase: 21-resolucion-canonica-de-la-url-de-entrada
plan: 02
subsystem: graph
tags: [buildLinkGraph, home-lookup, canonical-url, refactor]
requires:
  - "resolveCanonicalUrl (Phase 21 Plan 01) — el worker pasa el origin ya resuelto"
provides:
  - "buildLinkGraph con home lookup por match exacto de normalizeUrl(origin)"
affects:
  - "packages/graph (consumido por el worker al construir el grafo de enlaces)"
tech-stack:
  added: []
  patterns:
    - "Home del grafo por match determinista, sin heurística de dominio registrable"
key-files:
  created: []
  modified:
    - packages/graph/src/buildLinkGraph.ts
    - packages/graph/src/buildLinkGraph.test.ts
decisions:
  - "Eliminar resolveHomeKey: la resolución de variantes de dominio (www/http-vs-https) vive aguas arriba en resolveCanonicalUrl, no en el grafo"
metrics:
  duration: "~6 min"
  completed: 2026-07-09
requirements: [URLRES-02]
---

# Phase 21 Plan 02: Eliminar resolveHomeKey del grafo de enlaces — Summary

Se removió la mitigación puntual `resolveHomeKey` de `buildLinkGraph` y el home del grafo vuelve a ubicarse por match exacto de `normalizeUrl(origin)`, apoyándose en que el origin ya llega canónicamente resuelto desde `resolveCanonicalUrl` (Plan 01) vía el worker (Plan 03).

## What Was Built

- **Task 1 — `buildLinkGraph.ts`:** Eliminada por completo la función `resolveHomeKey` (y su bloque de comentario). El call-site pasó a un match exacto: `const normalizedOrigin = normalizeUrl(origin); const homeUrl = normalizedOrigin && byUrl.has(normalizedOrigin) ? normalizedOrigin : null;`. La degradación a grafo vacío (`{ nodes: [], edges: [], depthByUrl: {} }`) cuando `homeUrl` es null quedó intacta. JSDoc actualizado para documentar que el home se ubica por match exacto del origin resuelto aguas arriba. Los imports `normalizeUrl` y `sameRegistrableDomain` se conservan: `sameRegistrableDomain` sigue usándose en la construcción de la adjacency (filtrado de enlaces internos).
- **Task 2 — `buildLinkGraph.test.ts`:** Reemplazado el Test 9 ("www regression"). Ahora invoca `buildLinkGraph(pages, "https://www.example.com")` con el origin YA RESUELTO (variante www real) y valida el match exacto (`depthByUrl["https://www.example.com/"] === 0`, `/a === 1`, `/b === 2`, `nodes.length === 3`). El comentario documenta que el caso "origin bare con páginas www" ya no ocurre porque la resolución canónica se movió a `resolveCanonicalUrl`. Los demás tests (6 degradación, 7 edges, 8 pre-redirect) quedaron sin tocar.

## Verification

- `grep -c "resolveHomeKey" packages/graph/src/buildLinkGraph.ts` → `0`.
- `grep -n "normalizeUrl(origin)" packages/graph/src/buildLinkGraph.ts` → encuentra el nuevo home lookup (línea 70).
- `cd packages/graph && pnpm tsc --noEmit` → limpio (sin imports sin uso ni errores de tipo).
- `cd packages/graph && pnpm vitest run src/buildLinkGraph.test.ts` → 9/9 tests verdes.
- `grep -n "resolveCanonicalUrl" packages/graph/src/buildLinkGraph.test.ts` → encuentra el comentario que documenta el traslado (línea 94).

## Deviations from Plan

Ninguna funcional. Ajuste menor de redacción: el JSDoc de `buildLinkGraph` se redactó sin nombrar literalmente `resolveHomeKey` para cumplir el criterio de aceptación `grep -c "resolveHomeKey" == 0` (el must-have "no queda ninguna referencia a resolveHomeKey en el paquete graph"). Se describe la heurística removida sin usar el identificador.

## Commits

- `63ac04d` refactor(21-02): replace resolveHomeKey heuristic with exact origin match
- `f5a5125` test(21-02): adjust www test to validate exact match on resolved origin

## Self-Check: PASSED
