---
phase: 25-fingerprint-de-stack-t-cnico-contrato-de-datos-y-motor-de-de
plan: 04
subsystem: fingerprint
tags: [detectStack, cheerio, wordpress, builder-detection, cdn, analytics, vitest]

# Dependency graph
requires:
  - phase: 25-01
    provides: "contrato de tipos (DetectedStack, AxisResult, Signal, AggregatedInput, PageFingerprintInput, Confidence)"
  - phase: 25-03
    provides: "registry de signatures por eje (cms/builder/cdn/hosting/jsFramework/analytics)"
provides:
  - "detectStack(input): función pura orquestadora que resuelve el DetectedStack con cada eje independiente"
  - "aggregate() seguro: headers lowercased sin prototype pollution, HTML truncado ~256KB antes de cheerio"
  - "resolveConfidence con 5 ramas explícitas (sin puntaje numérico)"
  - "fixtures sintéticos + reales y suite de 34 tests (FPRINT-02..08)"
  - "firmas de builder de WordPress calibradas contra HTML real (blocker STATE.md cerrado)"
affects: [phase-26-worker, phase-27-adaptadores, fingerprint-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Motor puro sobre registry: cargar cheerio una vez sobre HTML agregado, correr firmas por eje, resolver confianza por reglas"
    - "no-detectado como estado de primera clase (nunca forzar respuesta)"
    - "Truncado de HTML por bytes UTF-8 antes de parsear (defensa DoS T-25-07/08)"

key-files:
  created:
    - packages/fingerprint/src/detectStack.ts
    - packages/fingerprint/src/detectStack.test.ts
    - packages/fingerprint/src/__fixtures__/synthetic.ts
    - packages/fingerprint/src/__fixtures__/realSites.ts
  modified:
    - packages/fingerprint/src/index.ts

key-decisions:
  - "aggregate() usa Object.create(null) para el mapa de headers: keys hostiles del sitio quedan como propiedades propias inertes (T-25-09), sin allowlist rígida que rompería firmas con headers arbitrarios legítimos (cf-ray, x-shopify-stage)"
  - "Primera aparición de cada header gana al agregar múltiples páginas (determinista, home primero)"
  - "Truncado por bytes UTF-8 real con Buffer.subarray (no por longitud de caracteres) para respetar MAX_HTML_BYTES literal"
  - "Las firmas de builder.ts matchearon HTML real sin cambios: no se requirió calibración, el blocker se cierra por validación positiva"

patterns-established:
  - "resolveAxis genérico: agrupar señales por value candidato, ganar por más señales fuertes (desempate: más totales, luego orden de registry)"
  - "resolveBuilder: desempate por conteo de marcadores; empate real -> no-detectado; nunca Gutenberg default"

requirements-completed: [FPRINT-02, FPRINT-03, FPRINT-04, FPRINT-05, FPRINT-06, FPRINT-07, FPRINT-08]

coverage:
  - id: D1
    description: "detectStack detecta cada CMS (WordPress/Shopify/Webflow/Wix/Squarespace) con confianza correcta"
    requirement: "FPRINT-02"
    verification:
      - kind: unit
        ref: "src/detectStack.test.ts#detectStack — CMS (FPRINT-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "builder correcto por fixture; empate -> no-detectado; WP sin builder -> no-detectado (nunca Gutenberg)"
    requirement: "FPRINT-03"
    verification:
      - kind: unit
        ref: "src/detectStack.test.ts#detectStack — Builder (FPRINT-03)"
        status: pass
    human_judgment: false
  - id: D3
    description: "CDN detectado desde headers (Cloudflare/Fastly/Akamai)"
    requirement: "FPRINT-04"
    verification:
      - kind: unit
        ref: "src/detectStack.test.ts#detectStack — CDN (FPRINT-04)"
        status: pass
    human_judgment: false
  - id: D4
    description: "hosting no-detectado cuando un CDN enmascara el origen; nginx -> bajo, nunca alto"
    requirement: "FPRINT-05"
    verification:
      - kind: unit
        ref: "src/detectStack.test.ts#detectStack — Hosting (FPRINT-05)"
        status: pass
    human_judgment: false
  - id: D5
    description: "JS framework detectado desde marcadores HTML (Next.js)"
    requirement: "FPRINT-06"
    verification:
      - kind: unit
        ref: "src/detectStack.test.ts#detectStack — JS framework (FPRINT-06)"
        status: pass
    human_judgment: false
  - id: D6
    description: "analytics devuelve array con GA4+GTM+Meta Pixel coexistiendo"
    requirement: "FPRINT-07"
    verification:
      - kind: unit
        ref: "src/detectStack.test.ts#detectStack — Analytics (FPRINT-07)"
        status: pass
    human_judgment: false
  - id: D7
    description: "0 señales -> todos los ejes value null / no-detectado y analytics []"
    requirement: "FPRINT-08"
    verification:
      - kind: unit
        ref: "src/detectStack.test.ts#detectStack — No-detectado (FPRINT-08)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Firmas de builder de WordPress validadas contra HTML real (Elementor/Divi/WPBakery, 2 sitios c/u)"
    requirement: "FPRINT-03"
    verification:
      - kind: unit
        ref: "src/detectStack.test.ts#detectStack — builder (sitios reales, calibración)"
        status: pass
    human_judgment: true
    rationale: "El human-check de fin de fase (Task 3) requiere que Juan confirme visualmente que el stack detectado sobre los sitios reales coincide con la verdad conocida y que ningún builder/CDN/framework se fuerza como falso positivo."

# Metrics
duration: 14min
completed: 2026-07-21
status: complete
---

# Phase 25 Plan 04: Motor detectStack Summary

**Motor puro `detectStack` que resuelve seis ejes de stack de forma independiente (WordPress + Cloudflare + Next.js a la vez) con confianza por reglas explícitas, `no-detectado` como estado de primera clase, y firmas de builder de WordPress calibradas contra HTML real.**

## Performance

- **Duration:** 14 min (incluye QA de red contra 6 sitios reales)
- **Started:** 2026-07-21T17:00Z (aprox.)
- **Completed:** 2026-07-21T21:14Z
- **Tasks:** 3
- **Files modified:** 5 (4 creados, 1 modificado)

## Accomplishments
- `detectStack.ts`: función pura que agrega el input de todas las páginas y resuelve cada eje con el registry, sin winner-take-all — un sitio puede ser WordPress + Cloudflare + Next.js simultáneamente.
- `aggregate()` endurecido: header keys en minúscula sobre objeto sin prototipo (T-25-09), unión de cookieNames, HTML home->fallback truncado a `MAX_HTML_BYTES` (256KB) por bytes UTF-8 antes de `cheerio.load` (T-25-07/08).
- `resolveConfidence` con las 5 ramas explícitas (2+ fuertes -> alto; 1 fuerte inequívoca -> alto; 1 fuerte -> medio; solo débiles -> bajo; 0 -> no-detectado); `resolveBuilder` con desempate por conteo y sin default de Gutenberg; `resolveAnalytics` como array.
- Suite de 34 tests verde cubriendo FPRINT-02..08, independencia de ejes, y calibración contra 6 sitios reales (2 por builder).
- Blocker de STATE.md cerrado: las firmas de `builder.ts` matchearon HTML real de Elementor/Divi/WPBakery sin necesidad de ajuste.

## Task Commits

1. **Task 1: Motor detectStack** - `9f34c88` (feat)
2. **Task 2: Fixtures sintéticos + suite de tests** - `4976176` (test)
3. **Task 3: QA de calibración contra sitios reales** - `7d36306` (test)

## Files Created/Modified
- `packages/fingerprint/src/detectStack.ts` - Motor orquestador puro (aggregate, resolveConfidence, resolveAxis, resolveBuilder, resolveAnalytics, MAX_HTML_BYTES).
- `packages/fingerprint/src/index.ts` - Export de `detectStack` y `MAX_HTML_BYTES` en el barrel.
- `packages/fingerprint/src/__fixtures__/synthetic.ts` - Fixtures por firma (CMS/builder/CDN/framework/analytics) + vacío + multi-eje.
- `packages/fingerprint/src/__fixtures__/realSites.ts` - Fragmentos reales recortados de 6 sitios (2 por builder) con builder esperado.
- `packages/fingerprint/src/detectStack.test.ts` - 34 tests (28 sintéticos + 6 reales parametrizados).

## Decisions Made
- **Object.create(null) para headers** en lugar de una allowlist rígida: previene prototype pollution (T-25-09) sin romper firmas que dependen de headers arbitrarios legítimos (cf-ray, x-shopify-stage, x-akamai-*).
- **Primera aparición de header gana** al unir múltiples páginas — determinista y coherente con "home primero".
- **Truncado por bytes UTF-8 real** (`Buffer.subarray`) para respetar `MAX_HTML_BYTES` de forma literal, no por longitud de caracteres.

## Deviations from Plan

None - plan executed exactly as written. Las firmas de `builder.ts` se validaron contra HTML real y no requirieron calibración (resultado esperado y permitido por la Task 3, pero en la práctica no hubo cambios en `builder.ts`).

## Issues Encountered
- Algunos sitios candidatos para QA (marthastewart.com, superfoodly.com, timmarshall) devolvieron 403/000 (bot protection). Se resolvió eligiendo sitios reales que responden a fetch: Elementor (elementor.com, websitedemos.net), Divi (elegantthemes.com/preview/Divi/, divilover.com), WPBakery (wpbakery.com, demo.wpbakery.com). Cobertura de 2 sitios por builder alcanzada.

## User Setup Required
None - no external service configuration required.

## Human QA Pendiente (fin de fase)
El human-check de la Task 3 (human_verify_mode=end-of-phase) sigue abierto por diseño: Juan debe confirmar que el stack detectado sobre los sitios reales coincide con la verdad conocida (Elementor/Divi/WPBakery) y que ningún builder/CDN/framework se reporta como falso positivo. Los tests automatizados ya afirman el builder esperado por sitio; la confirmación humana es la validación cualitativa final antes de `/gsd-verify-work`.

## Next Phase Readiness
- `detectStack` es la única API pública que consumirá el worker (Phase 26): función pura sin I/O, lista para invocarse una vez por auditoría mapeando `Page[]` a `PageFingerprintInput[]` en el borde.
- Nota de seguridad diferida a Phase 26 (T-25-10): los `cookieNames` provienen del sitio; la UI del reporte debe escaparlos (XSS) al renderizar evidencia.

## Self-Check: PASSED

Todos los archivos declarados existen en disco y los 3 commits de tarea (9f34c88, 4976176, 7d36306) están presentes en el historial.

---
*Phase: 25-fingerprint-de-stack-t-cnico-contrato-de-datos-y-motor-de-de*
*Completed: 2026-07-21*
