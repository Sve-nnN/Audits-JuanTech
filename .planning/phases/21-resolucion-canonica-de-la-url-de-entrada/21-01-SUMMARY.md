---
phase: 21-resolucion-canonica-de-la-url-de-entrada
plan: 01
subsystem: crawler
tags: [fetch, abortcontroller, url-resolution, redirects, vitest]

# Dependency graph
requires: []
provides:
  - "resolveCanonicalUrl(domain) en @auditor/crawler: prueba https→http, sigue redirects y devuelve la finalUrl real (o null)"
affects: [21-02, 21-03, worker, resolucion-canonica-de-la-url-de-entrada]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fetch de red pura con AbortController + timeout acotado + redirect:follow por candidato de esquema"
    - "Resolución de URL canónica vía res.url (WHATWG fetch) sin re-normalizar"

key-files:
  created:
    - packages/crawler/src/resolveCanonicalUrl.ts
    - packages/crawler/src/resolveCanonicalUrl.test.ts
  modified:
    - packages/crawler/src/index.ts

key-decisions:
  - "GET en vez de HEAD para seguir de forma confiable los redirects del home"
  - "Acepta cualquier respuesta no-error de red (no exige 2xx): un 403/500 igual da URL canónica válida"
  - "Devuelve res.url crudo, sin pasar por normalizeUrl"
  - "Normaliza el input a host bare (quita protocolo, path y leading www) antes de construir candidatos"

patterns-established:
  - "Módulo de red puro testeable con fetch global mockeado (vi.stubGlobal)"

requirements-completed: [URLRES-01]

# Metrics
duration: 6min
completed: 2026-07-09
---

# Phase 21 Plan 01: Resolución canónica de la URL de entrada Summary

**resolveCanonicalUrl(domain) prueba https→http con fallback, sigue redirects del home vía GET y devuelve la finalUrl real (res.url) o null en fallo total, con timeout de 10s acotado por AbortController.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-09T14:44:00Z
- **Completed:** 2026-07-09T14:46:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `resolveCanonicalUrl(domain: string): Promise<string | null>` implementada como función de red pura con fallback https→http.
- Devuelve la finalUrl real reportada por el servidor (`res.url`) tras seguir redirects (resuelve el caso "redirige a www").
- Nunca lanza en fallo total: devuelve `null` cuando ningún protocolo conecta o ambos abortan por timeout.
- Timeout acotado `RESOLVE_TIMEOUT_MS = 10_000` por candidato (mitiga T-21-01 DoS: host colgado no bloquea al worker).
- 6 tests con `fetch` global mockeado (https ok, fallback http, ambos fallan, timeout en ambos, no-2xx aceptado, normalización de input).
- Re-export en el barrel `@auditor/crawler` para consumo del worker (Plan 03).

## Task Commits

1. **Task 1: Implementar resolveCanonicalUrl con tests (TDD)** - `58438c6` (feat) — test + impl combinados en un commit verde
2. **Task 2: Exportar resolveCanonicalUrl en el barrel** - `f0bcea1` (feat)

## Files Created/Modified
- `packages/crawler/src/resolveCanonicalUrl.ts` - Función de red pura: host bare → prueba https/http, GET redirect:follow, devuelve res.url o null.
- `packages/crawler/src/resolveCanonicalUrl.test.ts` - 6 tests con fetch mockeado cubriendo el bloque behavior del plan.
- `packages/crawler/src/index.ts` - Re-export nombrado de resolveCanonicalUrl.

## Decisions Made
- **GET en vez de HEAD**: más confiable para seguir redirects del home.
- **Sin requisito de 2xx**: cualquier respuesta que no sea error de red da una URL canónica válida para crawlear.
- **res.url crudo**: no se re-normaliza con normalizeUrl; se devuelve la finalUrl tal como la reporta el servidor.
- **Input normalizado a host bare**: se quita protocolo, path y `www.` inicial para que redirects bare→www resuelvan al host canónico real.

## Deviations from Plan

None - plan executed exactly as written. La tarea era TDD; RED verificado (módulo inexistente) antes de GREEN. El commit único combina test+impl porque el plan define ambos como una sola tarea `tdd="true"`.

## TDD Gate Compliance

Plan-level `type` es `execute` (no `tdd`), pero Task 1 tiene `tdd="true"`. Ciclo seguido: RED (test falla por módulo ausente) → GREEN (6/6 pasan). No se requirió REFACTOR. Test e implementación se agruparon en un commit `feat` por ser una única tarea del plan.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `resolveCanonicalUrl` exportada y verde; lista para que el worker la consuma antes de crawlear (Plan 03).
- `pnpm tsc --noEmit` limpio en packages/crawler.

## Self-Check: PASSED
- FOUND: packages/crawler/src/resolveCanonicalUrl.ts
- FOUND: packages/crawler/src/resolveCanonicalUrl.test.ts
- FOUND: commit 58438c6
- FOUND: commit f0bcea1

---
*Phase: 21-resolucion-canonica-de-la-url-de-entrada*
*Completed: 2026-07-09*
