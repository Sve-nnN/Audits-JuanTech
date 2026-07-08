---
phase: 13-fundaci-n-de-export-serializers
plan: 04
subsystem: api
tags: [export, next, api-route, nodejs-runtime, vitest, bundle-boundary, zero-pii]

# Dependency graph
requires:
  - phase: 13-01
    provides: "buildReportModel(auditId): Promise<ReportModel | null> (single source of truth, cero PII)"
  - phase: 13-02
    provides: "@auditor/export: toMarkdown, toPptx (cap top-N compartido)"
  - phase: 13-03
    provides: "@auditor/export: toPdf (Khand/Geist Sans, sin navegador headless)"
  - phase: 12-render
    provides: "scripts/assert-no-playwright-in-web.mjs (guardarrail de frontera Chromium, checks A/B/C)"
provides:
  - "Route Node GET /api/audits/[id]/export?format=pdf|md|pptx que descarga el reporte con Content-Type por formato y Content-Disposition attachment"
  - "Guardarrail de frontera extendido (Check D): @auditor/export no arrastra Puppeteer/Chromium al bundle web"
  - "Infra de test en apps/web (vitest) — primer paquete web con suite propia"
affects: [14-boton-export-ui]

# Tech tracking
tech-stack:
  added:
    - "vitest@4.1.9 (devDep de apps/web — primera suite de tests del paquete web)"
  patterns:
    - "Route Node de export que reusa buildReportModel + serializers puros, cero recomputo de checks"
    - "FORMATS map (ext + contentType) como única fuente de headers por formato"
    - "Guardarrail de frontera extendido por carrier: cada dep real nueva del web (ahora @auditor/export) suma un Check que prueba cero browser engine"

key-files:
  created:
    - apps/web/app/api/audits/[id]/export/route.ts
    - apps/web/app/api/audits/[id]/export/route.test.ts
    - apps/web/vitest.config.ts
  modified:
    - apps/web/package.json
    - scripts/assert-no-playwright-in-web.mjs

key-decisions:
  - "body tipado string | Uint8Array con cast a BodyInit: el Node runtime acepta Buffer/Uint8Array, pero el tipo DOM BodyInit de esta lib los omite"
  - "Validación de format con type guard isFormat (union pdf|md|pptx) antes de tocar la DB: 400 sin llamar buildReportModel"
  - "filename = auditoria-<slug(domain)>-<auditId>.<ext>; slugifyDomain sanea a [a-z0-9.-] con fallback 'sitio'"
  - "Check D reusa el filtro de non-peer edges de Check C para puppeteer/chromium (pnpm why vacío = ausente)"

patterns-established:
  - "Guardarrail de frontera crece con cada dep real: Check por carrier (render→playwright, export→puppeteer/chromium)"
  - "Test de route App Router con vi.mock del builder de modelo + serializers reales (firma binaria por formato)"

requirements-completed: [EXPORT-01, EXPORT-02, EXPORT-03, EXPORT-05]

# Metrics
duration: ~10min
completed: 2026-07-08
---

# Phase 13 Plan 04: Route Node de export + guardarrail de frontera Chromium Summary

**Route `GET /api/audits/[id]/export?format=pdf|md|pptx` en runtime nodejs que lee el `ReportModel` compartido (Plan 01) y devuelve el archivo con el serializer correspondiente (Plans 02/03) como descarga (`Content-Disposition: attachment` + `Content-Type` por formato), 400 en formato inválido y 404 en audit inexistente, acceso por auditId sin PII; y el guardarrail de frontera de Phase 12 extendido con un Check D que prueba que `@auditor/export` — ahora dependency real del web — no arrastra Puppeteer/Chromium al bundle de Vercel. Cierra Phase 13 (4/4).**

## Performance
- **Duration:** ~10 min
- **Started:** 2026-07-08T14:34Z
- **Completed:** 2026-07-08T14:44Z
- **Tasks:** 2
- **Files created/modified:** 5

## Accomplishments
- **Task 1 — Route de export (EXPORT-01/02/03/05):** `apps/web/app/api/audits/[id]/export/route.ts` con `export const runtime = "nodejs"` y `GET(request, ctx)`. Lee `auditId` de params y `format` del query; valida con un type guard (`isFormat`) sobre la union `pdf|md|pptx` → 400 sin tocar la DB si es inválido/ausente. Llama `buildReportModel(id)`; si es `null` → 404. Según format invoca `toMarkdown` (string UTF-8), `toPdf` (Buffer) o `toPptx` (Uint8Array) y responde con el `Content-Type` correcto (`application/pdf`, `text/markdown; charset=utf-8`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`) y `Content-Disposition: attachment; filename="auditoria-<slug(domain)>-<auditId>.<ext>"`. Acceso por auditId sin auth extra (mismo modelo free-tier que `page.tsx`); la respuesta no incluye email/token (el `ReportModel` no los trae). Añadida `@auditor/export` como dependency de apps/web.
- **Task 2 — Test de route + guardarrail extendido (EXPORT-05):** `route.test.ts` (7 tests) ejercita el handler `GET` con `vi.mock('@auditor/report-model')` (buildReportModel mockeado) y los serializers reales: los tres formatos con status 200, `Content-Type` esperado, `Content-Disposition attachment` con la extensión correcta y firma de cuerpo (`%PDF-`, Markdown con dominio+acentos, `PK` del zip PPTX); 400 ante `?format` inválido/ausente (sin llamar al builder); 404 ante `buildReportModel → null`; y cero PII (email/token de fixture ausentes en el MD). Infra de test nueva en apps/web (`vitest.config.ts` + script `test`). `scripts/assert-no-playwright-in-web.mjs` gana un **Check D**: `pnpm why puppeteer`/`why chromium` en el web deben quedar sin edges reales (reusa el filtro de non-peer de Check C); cabecera actualizada para nombrar `@auditor/export` como el nuevo carrier a vigilar. Los Checks A/B/C siguen pasando ahora que `@auditor/export` es dep real del web.
- **Verificación:** 7 tests de route verdes, `pnpm assert:web-boundary` PASS (exit 0) con `@auditor/export` como dep del web, typecheck y `next build` verdes (route `/api/audits/[id]/export` en el listado como ƒ dynamic).

## Task Commits
1. **Task 1: route Node GET /api/audits/[id]/export** — `b09538e` (feat)
2. **Task 2: test de route (3 formatos, headers, 400/404, cero PII) + Check D** — `0a384c2` (test)

## Files Created/Modified
- `apps/web/app/api/audits/[id]/export/route.ts` — route Node de export (runtime nodejs, 3 formatos, headers, 400/404, cero PII).
- `apps/web/app/api/audits/[id]/export/route.test.ts` — 7 tests (3 formatos + 400×2 + 404 + cero PII).
- `apps/web/vitest.config.ts` — infra de test del paquete web (environment node, include app/**/*.test.ts).
- `apps/web/package.json` — añade `@auditor/export` (dependency), `vitest` (devDep) y el script `test`.
- `scripts/assert-no-playwright-in-web.mjs` — Check D (puppeteer/chromium vía @auditor/export) + cabecera actualizada.

## Decisions Made
- `body` tipado `string | Uint8Array` con cast a `BodyInit`: el Node runtime acepta Buffer/Uint8Array como cuerpo, pero el tipo DOM `BodyInit` de esta versión de lib los omite (solo el cast puentea el tipo, sin cambio de runtime).
- Validación de `format` con type guard antes de consultar la DB — 400 no llega a `buildReportModel` (verificado con `expect(mockedBuild).not.toHaveBeenCalled()`).
- `filename` deriva de `slugifyDomain(model.audit.domain)` (sanea a `[a-z0-9.-]`, fallback `sitio`) + auditId + extensión.
- Check D reutiliza el filtro de non-peer edges de Check C; como `pnpm why` imprime vacío cuando el paquete está ausente, cualquier edge real de puppeteer/chromium sería una fuga.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- Typecheck inicial falló porque el tipo DOM `BodyInit` de la lib no incluye `Buffer`/`Uint8Array` (TS2322). Resuelto tipando `body` como `string | Uint8Array` y casteando a `BodyInit` en el `new Response(...)` — el runtime Node ya acepta ambos. No es una desviación de plan (ajuste de tipos interno del task).

## User Setup Required
None - sin configuración de servicios externos.

## Known Stubs
None - la route está completamente cableada a `buildReportModel` + los tres serializers reales y verificada por tests (firma binaria por formato).

## Threat Flags
None - la route consume solo el `ReportModel` (cero PII por construcción); T-13-01 (format tampering → 400) y T-13-02 (cero PII en el cuerpo) mitigados y testeados; el guardarrail de frontera Chromium cierra T-13-SC.

## Next Phase Readiness
- Route de descarga lista para el botón "Exportar" en la UI del reporte (Phase 14, EXPORT-04).
- Guardarrail de frontera cubre ya los dos carriers del web (render→playwright, export→puppeteer/chromium); cualquier dep real nueva que meta un browser engine lo rompe en CI.

## Self-Check: PASSED

- Archivos creados/modificados verificados en disco: route.ts, route.test.ts, vitest.config.ts, package.json, assert-no-playwright-in-web.mjs.
- Commits verificados: b09538e (feat), 0a384c2 (test).
- 7 tests de route verdes; `pnpm assert:web-boundary` PASS (exit 0); typecheck + `next build` verdes.

---
*Phase: 13-fundaci-n-de-export-serializers*
*Completed: 2026-07-08*
