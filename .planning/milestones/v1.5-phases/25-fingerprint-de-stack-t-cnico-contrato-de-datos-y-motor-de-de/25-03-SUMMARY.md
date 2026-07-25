---
phase: 25-fingerprint-de-stack-t-cnico-contrato-de-datos-y-motor-de-de
plan: 03
subsystem: fingerprint
tags: [cheerio, signatures, stack-detection, registry, vitest]

# Dependency graph
requires:
  - phase: 25-01
    provides: "@auditor/fingerprint package with type contract (Signature, Axis, AggregatedInput, SignalStrength)"
provides:
  - "Six per-axis signature modules (cms, builder, cdn, hosting, jsFramework, analytics)"
  - "signatures/registry.ts: Record<Axis, Signature[]> — single source of detection rules"
  - "Count-based Signature.test contract (returns marker count, enables builder tie-break)"
  - "Gutenberg positive-marker signature (never a WordPress default)"
affects: [25-04, detectStack, fingerprint-engine, confidence-resolver]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Declarative per-axis signature registry (mirrors @auditor/checks registry pattern)"
    - "test() returns match COUNT not boolean, to allow count-based builder tie-break"
    - "Marker matching via cheerio selectors + string includes(), no ReDoS-prone regex"

key-files:
  created:
    - packages/fingerprint/src/signatures/cms.ts
    - packages/fingerprint/src/signatures/builder.ts
    - packages/fingerprint/src/signatures/cdn.ts
    - packages/fingerprint/src/signatures/hosting.ts
    - packages/fingerprint/src/signatures/jsFramework.ts
    - packages/fingerprint/src/signatures/analytics.ts
    - packages/fingerprint/src/signatures/registry.ts
    - packages/fingerprint/src/signatures/registry.test.ts
  modified: []

key-decisions:
  - "One Signature object per (tech, signal-source) rather than one per tech: produces multiple signals per value, feeding the confidence resolver's 2+-strong / 1-unequivocal rule directly."
  - "unequivocal:true only on platform-exclusive markers (cf-ray, x-amz-cf-id, x-akamai-*, x-vercel-id, x-nf-request-id, _shopify_s cookie, x-shopify-stage, x-wix-request-id, squarespace-refresh cookie, __NEXT_DATA__, meta generator Webflow) — never on shareable/generic signals."
  - "Nginx/Apache hosting signatures marked strength:debil (generic origin, masked by CDN) so they never reach 'alto' alone."
  - "Local helper functions inlined per module (headersPresent, headerIncludes, htmlIncludes, cookieStartsWith) instead of a shared file, to keep the declared file set and the pure-package decoupling intact."

patterns-established:
  - "Axis signature module: export `<axis>Signatures: Signature[]`, import only `type` from ../types, use injected ctx.$ (never import cheerio)."
  - "Builder tie-break: test() sums cheerio element .length + structural includes() so higher marker density wins."

requirements-completed: [FPRINT-02, FPRINT-03, FPRINT-04, FPRINT-05, FPRINT-06, FPRINT-07]

coverage:
  - id: D1
    description: "Six per-axis signature modules, multi-signal per tech (header + cookie + path/HTML)"
    requirement: FPRINT-02
    verification:
      - kind: unit
        ref: "packages/fingerprint/src/signatures/registry.test.ts#cada eje tiene al menos una signature"
        status: pass
      - kind: other
        ref: "pnpm --filter @auditor/fingerprint typecheck (exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Gutenberg detected only by positive marker (wp-block-*, <!-- wp:), never a WordPress default"
    requirement: FPRINT-03
    verification:
      - kind: unit
        ref: "packages/fingerprint/src/signatures/registry.test.ts#el eje builder incluye una signature Gutenberg"
        status: pass
    human_judgment: false
  - id: D3
    description: "Registry aggregates all axes as Record<Axis, Signature[]> with bucket integrity"
    requirement: FPRINT-04
    verification:
      - kind: unit
        ref: "packages/fingerprint/src/signatures/registry.test.ts#integridad de bucket"
        status: pass
    human_judgment: false
  - id: D4
    description: "Signature.test returns a numeric count (not boolean), enabling builder tie-break"
    requirement: FPRINT-03
    verification:
      - kind: unit
        ref: "packages/fingerprint/src/signatures/registry.test.ts#cada signature.test devuelve un número"
        status: pass
    human_judgment: false
  - id: D5
    description: "Signature matching against real-world sites (marker calibration vs live HTML per RESEARCH QA note)"
    verification: []
    human_judgment: true
    rationale: "Signature markers are MEDIUM-confidence (aggregated from community/doc sources, not verified against live sites in this session). Real-site calibration for the builder axis is a manual QA step flagged in 25-RESEARCH lines 388-392."

# Metrics
duration: 4min
completed: 2026-07-21
status: complete
---

# Phase 25 Plan 03: Registry de signatures por eje Summary

**Registry declarativo de detección de stack: seis módulos de signatures (cms/builder/cdn/hosting/jsFramework/analytics) con test() basado en conteo y Gutenberg por marcador positivo, agregados en un Record<Axis, Signature[]> con test estructural en verde.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-21T20:56:56Z
- **Completed:** 2026-07-21T21:00:46Z
- **Tasks:** 2
- **Files modified:** 8 (todos creados)

## Accomplishments
- Seis módulos de signatures por eje, cada tecnología apoyada en señales multi-fuente (header + cookie + path/HTML), nunca un único header.
- `Signature.test` devuelve el CONTEO de marcadores (no boolean): habilita el desempate de builders por densidad de marcas en Plan 25-04.
- Gutenberg con marcador POSITIVO propio (clases `wp-block-*` + comentarios `<!-- wp:`); WordPress sin builder matcheado queda no-detectado, nunca default.
- `registry.ts` agrega los seis arrays como `Record<Axis, Signature[]>` — única fuente de reglas que consumirá `detectStack`.
- Test estructural (Vitest): 6 claves de eje, buckets no vacíos, integridad de bucket (cada `signature.axis` coincide con su clave), presencia de Gutenberg y contrato de test() numérico.

## Task Commits

Cada tarea se commiteó atómicamente:

1. **Task 1: Módulos de signatures por eje** - `fc0aa2a` (feat)
2. **Task 2: registry.ts + test estructural** - `7bad743` (feat)

## Files Created/Modified
- `packages/fingerprint/src/signatures/cms.ts` - WordPress (4 señales), Shopify, Webflow, Wix, Squarespace
- `packages/fingerprint/src/signatures/builder.ts` - Elementor, WPBakery, Divi, Gutenberg (marcador positivo)
- `packages/fingerprint/src/signatures/cdn.ts` - Cloudflare, Fastly, Akamai, CloudFront
- `packages/fingerprint/src/signatures/hosting.ts` - Vercel, Netlify, WP Engine, Nginx/Apache (debil)
- `packages/fingerprint/src/signatures/jsFramework.ts` - Next.js, Nuxt, React (debil), Vue (debil)
- `packages/fingerprint/src/signatures/analytics.ts` - GA4, Google Tag Manager, Meta Pixel
- `packages/fingerprint/src/signatures/registry.ts` - Record<Axis, Signature[]>
- `packages/fingerprint/src/signatures/registry.test.ts` - test estructural del registry

## Decisions Made
- Una `Signature` por (tecnología, fuente de señal) en lugar de una por tecnología: genera varias señales por valor, alimentando directo la regla "2+ fuertes / 1 inequívoca → alto" del resolvedor de confianza (Plan 25-04).
- `unequivocal:true` solo en marcadores exclusivos de plataforma; nunca en señales genéricas o compartibles.
- Nginx/Apache marcados `debil` (origen genérico, enmascarado por CDN) para que nunca lleguen a "alto" solos.
- Helpers (`headersPresent`, `headerIncludes`, `htmlIncludes`, `cookieStartsWith`) inline por módulo en vez de un archivo compartido, para respetar el set de archivos declarado y mantener el paquete desacoplado (solo `import type` + `ctx.$` inyectado).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Vue `data-v-*` se detecta por `ctx.html.includes("data-v-")` en vez de selector cheerio, porque un selector CSS no puede matchear atributos por prefijo de NOMBRE; se resolvió con `includes()` (seguro ante ReDoS).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Registry listo y consumible por `detectStack` (Plan 25-04): agregación por eje + contrato de conteo para desempate.
- Blocker de calibración pendiente (D5): las firmas son MEDIUM-confidence; requieren QA manual contra 2-3 sitios reales por builder antes de considerar la detección validada en producción.
- `@auditor/fingerprint` sigue desacoplado en runtime (solo cheerio como dep); sin imports a @auditor/db/crawler/checks.

## Self-Check: PASSED

All 8 created files present, both task commits (fc0aa2a, 7bad743) in git history, SUMMARY.md written.

---
*Phase: 25-fingerprint-de-stack-t-cnico-contrato-de-datos-y-motor-de-de*
*Completed: 2026-07-21*
