---
phase: 21-resolucion-canonica-de-la-url-de-entrada
plan: 03
subsystem: worker
tags: [url-resolution, prisma-schema, worker-pipeline, report-ui, urlres-02]

# Dependency graph
requires:
  - "21-01: resolveCanonicalUrl(domain) exportada en @auditor/crawler"
provides:
  - "Worker resuelve la URL canónica antes de runCrawl y la usa como startUrl/origin único"
  - "Audit.resolvedUrl String? (nullable, aditivo) persiste la URL efectivamente auditada"
  - "Reporte muestra la URL resuelta cuando difiere del dominio ingresado"
affects: [worker, web, packages/db, 22, 23, 24]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Resolución de red en el path crítico del worker: fallo total → throw español → status:failed (no crawl vacío)"
    - "Persistencia temprana (running) + final (done) del mismo escalar resolvedUrl para render en vivo"
    - "Comparación laxa host/path/protocolo para decidir si mostrar la URL resuelta en el reporte"

key-files:
  created: []
  modified:
    - packages/db/prisma/schema.prisma
    - apps/worker/src/index.ts
    - apps/web/app/audits/[id]/page.tsx

key-decisions:
  - "resolvedUrl reemplaza el guess `https://${domain}` como startUrl único; origin se deriva de él y se propaga a crawl/sitemap/grafo/checks sin cambios extra"
  - "Fallo de resolución DEBE fallar la auditoría (throw), a diferencia de PSI/render que degradan: sin URL válida no hay crawl posible"
  - "Mensaje de error en español neutro sin voceo, nombrando solo el dominio que el propio usuario ingresó (sin datos internos, T-21-06)"
  - "Schema-first: db:generate para regenerar el cliente; sin carpeta migrations; db:push contra la DB queda a cargo del despliegue"
  - "La URL resuelta se muestra solo cuando difiere del dominio (http, www, path o host distinto); un https://<domain> equivalente se oculta"

requirements-completed: [URLRES-02]

# Metrics
duration: 7min
completed: 2026-07-09
---

# Phase 21 Plan 03: Cablear resolución canónica en el worker Summary

**El worker resuelve la URL canónica con `resolveCanonicalUrl(domain)` antes de `runCrawl`, la usa como `startUrl`/`origin` único de todo el pipeline, la persiste en `Audit.resolvedUrl`, falla la auditoría con un mensaje español neutro si el dominio no responde, y el reporte la muestra cuando difiere del dominio ingresado.**

## Performance

- **Duration:** ~7 min
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Campo `Audit.resolvedUrl String?` agregado al schema (nullable, aditivo, junto a `error`), documentado; cliente Prisma regenerado (`db:generate`), sin carpeta migrations.
- Worker (`processAuditJob`): `resolveCanonicalUrl(audit.site.domain)` llamado antes de `runCrawl`; el resultado reemplaza el antiguo `const startUrl = \`https://${audit.site.domain}\`` y alimenta el `origin` derivado en crawl, sitemap, grafo y checks.
- Fallo total de resolución (`null`) lanza un `Error` en español neutro que captura `worker.on("failed")` → `status:"failed"` + `error.message` (no un crawl vacío). Ese mensaje ya se muestra en la rama `failed` de `AuditProgress`.
- `resolvedUrl` se persiste temprano (junto al estado `running`) y también en el `update` final (`status:"done"`), para que el reporte pueda mostrarla incluso mientras corre.
- Reporte (`page.tsx`): render condicional "Analizamos: {resolvedUrl}" bajo el `<h1>` del dominio, solo cuando la URL resuelta difiere del dominio ingresado (comparación laxa host/path/protocolo/www). React escapa el texto (T-21-05).
- `pnpm tsc --noEmit` limpio en `apps/worker` y `apps/web`.

## Task Commits

1. **Task 1: Agregar Audit.resolvedUrl (schema-first) y cablear el worker** - `5cb9c4f` (feat)
2. **Task 2: Mostrar la URL resuelta en el reporte** - `178d473` (feat)

## Files Created/Modified
- `packages/db/prisma/schema.prisma` - Campo `resolvedUrl String?` en `model Audit`.
- `apps/worker/src/index.ts` - Import de `resolveCanonicalUrl`; resolución previa a `runCrawl`; throw español en fallo; persistencia temprana y final de `resolvedUrl`; `startUrl = resolvedUrl`.
- `apps/web/app/audits/[id]/page.tsx` - Helper `resolvedDiffersFromDomain` + render condicional de la URL resuelta en el header.

## Deviations from Plan

**1. [Guía del orquestador] `db:push` no ejecutado contra la DB**
- **Motivo:** La instrucción de arranque indicó explícitamente NO correr `db:push` contra la base; regenerar el cliente Prisma (`db:generate`) es suficiente para que el typecheck reconozca `resolvedUrl`. El `db:push` real queda a cargo del despliegue.
- **Impacto:** Ninguno en código; el schema es aditivo/nullable y compatible con filas previas.

Fuera de eso, el plan se ejecutó tal como fue escrito.

## Threat Flags

Ninguno. Las tres entradas del threat register del plan (T-21-04 DoS, T-21-05 injection en render, T-21-06 information disclosure) quedan mitigadas/aceptadas según lo planeado: timeout heredado del Plan 01, React escapa el texto plano, y el mensaje solo nombra el dominio ingresado por el usuario.

## Known Stubs
Ninguno.

## Issues Encountered
Ninguno.

## Self-Check: PASSED
- FOUND: packages/db/prisma/schema.prisma (resolvedUrl)
- FOUND: apps/worker/src/index.ts (resolveCanonicalUrl)
- FOUND: apps/web/app/audits/[id]/page.tsx (resolvedUrl)
- FOUND: commit 5cb9c4f
- FOUND: commit 178d473

---
*Phase: 21-resolucion-canonica-de-la-url-de-entrada*
*Completed: 2026-07-09*
