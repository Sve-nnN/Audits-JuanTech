---
phase: 25-fingerprint-de-stack-t-cnico-contrato-de-datos-y-motor-de-de
plan: 02
subsystem: database
tags: [prisma, postgres, crawlee, cheerio, fingerprinting, vitest]

# Dependency graph
requires:
  - phase: 25-01
    provides: "@auditor/fingerprint data contract + PageFingerprintInput types (consumidor futuro de estas columnas)"
provides:
  - "Columnas aditivas Page.responseHeaders (Json?) + Page.cookieNames (String[]) en el schema Prisma"
  - "Helpers curateHeaders (allowlist-only) + parseCookieNames (solo nombres) testeados"
  - "requestHandler del CheerioCrawler persiste headers curados + nombres de cookie por página sin requests extra"
affects: [phase-26, detectStack, fingerprint, mapeo Page[] -> PageFingerprintInput[]]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Allowlist-driven header curation: iterar sobre CURATED_HEADER_KEYS, nunca sobre keys del sitio (anti prototype-pollution)"
    - "Cookie capture names-only: split antes del primer '=' — nunca valores/atributos (FPRINT-01 / T-25-01)"

key-files:
  created:
    - packages/crawler/src/captureHeaders.ts
    - packages/crawler/src/captureHeaders.test.ts
  modified:
    - packages/db/prisma/schema.prisma
    - packages/crawler/src/crawl.ts

key-decisions:
  - "Persistir solo headers curados (allowlist fija), no el objeto crudo completo — evita guardar auth/set-cookie con valor"
  - "cookieNames captura únicamente nombres vía split nativo, sin dependencia set-cookie-parser (ningún paquete nuevo)"
  - "db:generate corrió offline (valida el typecheck de Task 3); db:push a Neon quedó bloqueado por entorno sin conexión — lo aplica Juan"

patterns-established:
  - "Captura de fingerprinting dentro del requestHandler existente sin agregar requests HTTP"
  - "curateHeaders/parseCookieNames como helpers puros y testeables, separados del crawler"

requirements-completed: [FPRINT-01]

coverage:
  - id: D1
    description: "Columnas aditivas Page.responseHeaders (Json?) + Page.cookieNames (String[]) declaradas y schema válido"
    requirement: FPRINT-01
    verification:
      - kind: other
        ref: "pnpm --filter @auditor/db exec prisma validate (exit 0) + grep -cE 'responseHeaders Json\\?|cookieNames String\\[\\]' == 2"
        status: pass
    human_judgment: false
  - id: D2
    description: "Helpers curateHeaders (allowlist-only, anti prototype-pollution) + parseCookieNames (solo nombres, dedup, string|string[]|undefined)"
    requirement: FPRINT-01
    verification:
      - kind: unit
        ref: "packages/crawler/src/captureHeaders.test.ts (7 casos, 31 tests suite pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "requestHandler del crawler escribe responseHeaders + cookieNames en create y update del page.upsert, sin requests extra"
    requirement: FPRINT-01
    verification:
      - kind: unit
        ref: "pnpm --filter @auditor/crawler typecheck (exit 0) + grep de responseHeaders/cookieNames en create+update de crawl.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Columnas físicamente aplicadas a la base Neon vía pnpm db:push"
    requirement: FPRINT-01
    verification:
      - kind: other
        ref: "pnpm --filter @auditor/db db:push (BLOQUEADO — P1001, entorno sin conexión a Neon)"
        status: fail
    human_judgment: true
    rationale: "El entorno de ejecución no alcanza el compute de Neon (P1001). Juan debe correr el push manualmente; no se puede verificar automáticamente aquí sin conexión."

# Metrics
duration: 5min
completed: 2026-07-21
status: complete
---

# Phase 25 Plan 02: Captura de headers + nombres de cookie en el crawler Summary

**Columnas aditivas Page.responseHeaders (Json) + Page.cookieNames (String[]) con helpers allowlist-only (curateHeaders) y names-only (parseCookieNames) cableados al upsert del CheerioCrawler, sin requests HTTP adicionales.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-21T20:47:13Z
- **Completed:** 2026-07-21T20:52:50Z
- **Tasks:** 3 (Task 2 db:push bloqueado por entorno — ver abajo)
- **Files modified:** 4

## Accomplishments
- Dos columnas aditivas/nullable en `model Page`: `responseHeaders Json?` y `cookieNames String[]`, con comentario de fase; `prisma validate` en verde.
- `captureHeaders.ts`: `curateHeaders` itera SOLO sobre `CURATED_HEADER_KEYS` (20 headers curados), une arrays con ", " y omite ausentes; `parseCookieNames` extrae únicamente NOMBRES (nunca valores/atributos), tolera string y string[], deduplica y devuelve [] ante undefined.
- `crawl.ts`: el `requestHandler` deriva `responseHeaders`/`cookieNames` de `response.headers` ya cargados (sin request extra) y los escribe en los bloques `create` y `update` del `page.upsert`.
- 31 tests del paquete crawler en verde (7 nuevos casos cubren las 6 conductas del bloque behavior + un caso anti prototype-pollution). Typecheck del crawler en exit 0.

## Task Commits

1. **Task 1: Columnas aditivas Page.responseHeaders + cookieNames** - `66b7889` (feat)
2. **Task 2: [BLOQUEANTE] Aplicar schema a Neon + regenerar cliente** - db:generate OK (offline, sin artefactos versionables); **db:push a Neon BLOQUEADO** (ver Issues)
3. **Task 3 (TDD): helpers + wiring** - `6ed9e0e` (test/RED) → `124234f` (feat/GREEN)

_No hubo commit de REFACTOR: el código quedó limpio en GREEN._

## Files Created/Modified
- `packages/db/prisma/schema.prisma` - Agrega `Page.responseHeaders Json?` y `Page.cookieNames String[]` (aditivas, patrón idéntico a schemaGraph/schemaJson).
- `packages/crawler/src/captureHeaders.ts` - Helpers `curateHeaders` / `parseCookieNames` + constante `CURATED_HEADER_KEYS`.
- `packages/crawler/src/captureHeaders.test.ts` - Suite Vitest de las conductas de captura (allowlist, join, anti-pollution, names-only, dedup, tolerancia string/undefined).
- `packages/crawler/src/crawl.ts` - Import de helpers; derivación de `responseHeaders`/`cookieNames`; escritura en create+update del upsert.

## Decisions Made
- Persistir solo headers curados (allowlist fija), no el objeto crudo — evita almacenar headers sensibles (auth, set-cookie con valor). Mitiga T-25-02/T-25-03.
- Cookie capture solo nombres vía `split(";")[0].split("=")[0]` nativo, sin `set-cookie-parser` — ningún paquete nuevo (T-25-SC accept). Mitiga T-25-01.
- Ejecutar `db:generate` offline (lee el schema local) para que el typecheck de Task 3 sea válido; el `db:push` a Neon es un paso operacional separado que aplica Juan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Índice posiblemente undefined en parseCookieNames**
- **Found during:** Task 3 (GREEN, typecheck)
- **Issue:** Con `noUncheckedIndexedAccess`, `c.split(";")[0]` y `.split("=")[0]` son `string | undefined`; el encadenado `.trim()` fallaba el typecheck (TS2532).
- **Fix:** Desestructurar con fallbacks `?? ""` antes de `.trim()` en dos pasos, manteniendo la misma semántica.
- **Files modified:** packages/crawler/src/captureHeaders.ts
- **Verification:** `pnpm --filter @auditor/crawler typecheck` exit 0; 31 tests siguen en verde.
- **Committed in:** 124234f (commit GREEN de Task 3)

---

**Total deviations:** 1 auto-fixed (1 bug de tipos)
**Impact on plan:** El fix es de seguridad de tipos, sin cambio de comportamiento ni de scope.

## Issues Encountered

**db:push a Neon BLOQUEADO por entorno sin conexión (Task 2 [BLOQUEANTE])**
- Síntoma: `pnpm --filter @auditor/db db:push` falla con `P1001: Can't reach database server at ep-patient-smoke-atcb3b0c-pooler...neon.tech:5432`.
- Diagnóstico: DNS resuelve y el pooler acepta TCP (`nc` en verde), pero el handshake Postgres de Prisma no completa (compute Neon suspendido/inaccesible desde este entorno). Se reintentó 4 veces, con y sin sandbox; no es error de credenciales ni de formato de `DATABASE_URL`.
- Decisión: No se fabricó éxito. Se detuvieron los intentos de conexión (confirmado por el orquestador de fase: Juan aplicará el push).
- `db:generate` SÍ corrió (offline) y regeneró `@prisma/client` con `responseHeaders`/`cookieNames`, por eso el typecheck de Task 3 es válido y pasa.

**Acción pendiente para Juan (único paso que falta, no destructivo):**
```bash
cd /Users/juan/Documents/Codigo/Personal/juantech/auditor
pnpm --filter @auditor/db db:push && pnpm --filter @auditor/db db:generate
```
Columnas aditivas/nullable → el push no requiere `--accept-data-loss`. Hasta correrlo, un crawl real fallaría al escribir en Neon (las columnas del cliente existen en tipos, pero no en la base viva).

## User Setup Required
None - no se requiere configuración de servicio externo nuevo (solo el `db:push` operacional descrito arriba, sobre la base Neon ya configurada).

## Next Phase Readiness
- Código y schema listos para Phase 26 (motor `detectStack` que consume `Page.responseHeaders` + `Page.cookieNames`).
- **Bloqueo abierto:** `pnpm --filter @auditor/db db:push` debe correrse contra Neon antes de un crawl real o de depender de las columnas en runtime.

## Self-Check: PASSED

- Archivos creados/modificados presentes en disco: schema.prisma, captureHeaders.ts, captureHeaders.test.ts, crawl.ts, 25-02-SUMMARY.md.
- Commits presentes: 66b7889 (Task 1), 6ed9e0e (RED), 124234f (GREEN).
- Verificaciones offline en verde: `prisma validate` exit 0; grep de columnas == 2; 31 tests crawler pass; crawler typecheck exit 0; db typecheck exit 0.
- Pendiente único (documentado, no fabricado): `pnpm --filter @auditor/db db:push` a Neon (P1001 — entorno sin conexión).
- Archivos no relacionados (.env.example, README.md, apps/web/app/api/audits/route.ts) NO fueron tocados ni stageados.

---
*Phase: 25-fingerprint-de-stack-t-cnico-contrato-de-datos-y-motor-de-de*
*Completed: 2026-07-21*
