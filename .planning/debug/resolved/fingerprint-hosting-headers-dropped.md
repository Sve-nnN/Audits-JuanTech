---
status: resolved
trigger: "Batch 2 de diagnóstico de fingerprint contra sitios reales (aprendoclub.com, aprendoseo.com, estylopia.com). aprendoclub.com corre en Vercel pero detectStack devuelve hosting=no-detectado."
created: 2026-07-25T16:42:00Z
updated: 2026-07-25T16:42:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "hosting.vercel (y hosting.netlify, hosting.wpengine, y partes de cdn.fastly/cdn.akamai) son código muerto: referencian headers que el allowlist CURATED_HEADER_KEYS del crawler NUNCA captura, así que la signature no puede verlos. aprendoclub.com corre en Vercel (x-vercel-id/x-vercel-cache presentes en la respuesta cruda) pero curateHeaders los descarta => hosting no-detectado. Mismo bug de indirección escritor<->lector que Hostinger."
  confirming_evidence:
    - "detectStack real sobre aprendoclub.com: RAW headers traen x-vercel-id, x-vercel-cache, x-powered-by: Next.js, Payload; headers curados quedan solo {server, x-powered-by, cf-ray, cf-cache-status} => hosting=null pese a estar en Vercel."
    - "hosting.vercel.test lee x-vercel-id/x-vercel-cache; hosting.netlify lee x-nf-request-id; hosting.wpengine lee x-wpe-loopback-upstream-addr/x-wpengine-lb; cdn.fastly lee x-cache-hits; cdn.akamai lee x-akamai-request-id/x-check-cacheable — NINGUNO está en CURATED_HEADER_KEYS."
    - "estylopia.com (Hostinger tras Cloudflare) SÍ detecta hosting=Hostinger[alto] con el fix previo => confirma que el patrón allowlist+signature funciona cuando el header se captura."
  falsification_test: "Si tras agregar x-vercel-id/x-vercel-cache al allowlist, curateHeaders({...,x-vercel-id,x-vercel-cache}) no los conserva, o detectStack con esos headers no da hosting=Vercel[alto], la hipótesis es falsa."
  fix_rationale: "Restaurar el invariante: el allowlist debe ser superset de TODO header que cualquier signature referencia. Agregar los 8 headers faltantes (x-vercel-id, x-vercel-cache, x-nf-request-id, x-wpe-loopback-upstream-addr, x-wpengine-lb, x-cache-hits, x-akamai-request-id, x-check-cacheable) revive las signatures muertas sin tocar el motor."
  blind_spots: "No se corre un audit real ni se lee la DB: la confirmación end-to-end de que got-scraping entrega esos headers en minúscula queda para Juan. Payload (cms) queda fuera de alcance v1.5 por decisión previa, no se agrega signature."

## Symptoms

expected: aprendoclub.com corre en Vercel; detectStack debería reportar hosting=Vercel con confianza alta.
actual: hosting=no-detectado. Solo cdn (Cloudflare), jsFramework (Next.js) y analytics (GA4) detectan.
errors: Ninguno (under-detection).
reproduction: Correr detectStack sobre aprendoclub.com (Vercel tras Cloudflare) y revisar Audit.stack.hosting.
started: Desde el shipping del motor v1.5 — las signatures de Vercel/Netlify nunca pudieron disparar.

## Eliminated

- hypothesis: "Cloudflare enmascara el origen Vercel (comportamiento esperado)."
  evidence: "Vercel emite headers propios (x-vercel-id, x-vercel-cache) que PASAN a través de Cloudflare (visibles en la respuesta cruda). No es que el CDN los oculte: el crawler los descarta en su allowlist. Bug real, no comportamiento esperado."
  timestamp: 2026-07-25T16:44:00Z

## Evidence

- timestamp: 2026-07-25T16:43:00Z
  checked: "detectStack real (scratchpad/verify-batch2.mts) sobre los 3 sitios."
  found: |
    aprendoclub.com  -> cdn=Cloudflare[alto], jsFramework=Next.js[alto], analytics=GA4[medio], cms=null (Payload, fuera de alcance), hosting=null (BUG: Vercel).
    aprendoseo.com   -> cms=Webflow[medio], cdn=Cloudflare[alto], analytics=GTM+MetaPixel (consistente).
    estylopia.com    -> cms=WordPress[alto], builder=Elementor[medio], cdn=Cloudflare[alto], hosting=Hostinger[alto], analytics=GA4. (Valida fix Hostinger en 2do sitio.)
  implication: "Único bug nuevo: hosting Vercel no-detectado por allowlist. estylopia valida Hostinger. aprendoseo consistente."

- timestamp: 2026-07-25T16:45:00Z
  checked: "Cruce de headers referenciados por signatures vs CURATED_HEADER_KEYS."
  found: "Faltan en el allowlist: x-vercel-id, x-vercel-cache (Vercel), x-nf-request-id (Netlify), x-wpe-loopback-upstream-addr, x-wpengine-lb (WP Engine), x-cache-hits (Fastly), x-akamai-request-id, x-check-cacheable (Akamai)."
  implication: "Drift sistemático allowlist<->signatures: 8 headers referenciados nunca se capturan. Fix = agregarlos."

## Resolution

root_cause: "Drift entre el allowlist CURATED_HEADER_KEYS del crawler y los headers que las signatures de hosting/cdn referencian: 8 headers (x-vercel-id, x-vercel-cache, x-nf-request-id, x-wpe-loopback-upstream-addr, x-wpengine-lb, x-cache-hits, x-akamai-request-id, x-check-cacheable) eran leídos por signatures pero nunca capturados => Vercel/Netlify/WP Engine indetectables (y Fastly/Akamai con cobertura parcial). aprendoclub.com (Vercel) lo expone: hosting=null. NO es 'CDN oculta señal': los headers de Vercel pasan por Cloudflare; el crawler los tiraba."
fix: "Agregar los 8 headers faltantes a CURATED_HEADER_KEYS (restaura el invariante allowlist superset de signatures)."
verification: |
  Self-verificado end-to-end:
  - fingerprint 38/38 verde (incluye test Vercel-tras-Cloudflare -> hosting=Vercel[alto]).
  - crawler captureHeaders 9/9 verde (incluye captura de x-vercel-id/x-vercel-cache/x-nf-request-id/x-wpe-*).
  - tsc --noEmit limpio en ambos.
  - detectStack REAL post-fix: aprendoclub.com -> hosting=Vercel[alto] (antes null). estylopia/aprendoseo estables.
  PENDIENTE verificación humana: audit real tras rebuild/deploy del worker.
files_changed:
  - "packages/crawler/src/captureHeaders.ts: +8 headers (x-vercel-id, x-vercel-cache, x-nf-request-id, x-wpe-loopback-upstream-addr, x-wpengine-lb, x-cache-hits, x-akamai-request-id, x-check-cacheable)"
  - "packages/crawler/src/captureHeaders.test.ts: test de regresión (captura headers Vercel/Netlify/WP Engine)"
  - "packages/fingerprint/src/__fixtures__/synthetic.ts: +fixture hostingVercelPage"
  - "packages/fingerprint/src/detectStack.test.ts: +test hosting Vercel[alto]"

## Diagnóstico por sitio (batch 2) — bug vs esperado
- aprendoclub.com: BUG real hosting Vercel (arreglado). cms=Payload NO soportado en v1.5 (comportamiento esperado; nota: x-powered-by trae "Payload", trivial de agregar si se decide soportar). Next.js/CDN/GA4 correctos.
- aprendoseo.com: Webflow — sin cambios, consistente con la sesión previa.
- estylopia.com: TODO correcto (WordPress[alto]+Elementor[medio]+Cloudflare[alto]+Hostinger[alto]+GA4). Valida el fix de Hostinger en un 2do sitio real. Sin bug.

## Optional follow-ups (NO implementados)
- Payload CMS: fuera de alcance v1.5. Fácil de agregar (x-powered-by incluye "Payload") cuando se decida soportarlo.
- LiteSpeed / Webflow-as-hosting: mismos follow-ups que la sesión previa.
