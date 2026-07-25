# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## fingerprint-cms-not-detected — detectStack solo detectaba CDN en sitios reales (hosting/CMS no-detectado)
- **Date:** 2026-07-25
- **Error patterns:** fingerprint, detectStack, stack, cms no-detectado, hosting no-detectado, Cloudflare, Hostinger, Webflow, WordPress, Divi, curateHeaders, allowlist, signatures, responseHeaders
- **Root cause:** Dos bugs reales de cobertura de signatures (no "CDN oculta señal"): (1) el allowlist `CURATED_HEADER_KEYS` del crawler descartaba `platform: hostinger`/`panel: hpanel` y no existía signature de Hostinger → hosting no-detectado pese a señal clara detrás de Cloudflare; (2) la signature `cms.webflow.assets` fijaba el host de CDN viejo `assets.website-files.com` mientras Webflow 2026 sirve desde `cdn.prod.website-files.com` (detección se salvaba solo por atributos `data-wf-*`). El resto (cms/builder/analytics no-detectado en sitio estático a mano; WordPress/Webflow en confianza "medio"; hosting=null para LiteSpeed) es comportamiento esperado (FPRINT-08 no fuerza; truncación anti-DoS de 256KB deja el meta generator fuera en HTML muy grande).
- **Fix:** crawler: +`platform`,+`panel` al allowlist; fingerprint hosting: +signature `hosting.hostinger` (fuerte, unequivocal, matchea platform=hostinger + panel=hpanel); fingerprint cms: Webflow assets `assets.website-files.com` → `website-files.com` (cubre `cdn.prod.website-files.com`). Tests de regresión en los 3 puntos.
- **Files changed:** packages/crawler/src/captureHeaders.ts, packages/crawler/src/captureHeaders.test.ts, packages/fingerprint/src/signatures/hosting.ts, packages/fingerprint/src/signatures/cms.ts, packages/fingerprint/src/__fixtures__/synthetic.ts, packages/fingerprint/src/detectStack.test.ts
---
