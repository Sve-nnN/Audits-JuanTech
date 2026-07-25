---
status: resolved
trigger: "Al correr una auditoria contra el sitio real ariannalupi.com, el motor de fingerprint (@auditor/fingerprint, detectStack, milestone v1.5 shipped Phase 25/26) solo detecta Cloudflare (eje CDN) -- todos los demas ejes (CMS, builder, hosting, framework JS, analytics) quedan en 'no detectado', cuando se esperaria que al menos el CMS se detecte con algo de confianza."
created: 2026-07-25T16:18:05Z
updated: 2026-07-25T16:35:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

reasoning_checkpoint:
  hypothesis: "El eje hosting queda no-detectado en ariannalupi.com NO por comportamiento esperado sino por un gap real de doble punta: (1) el allowlist CURATED_HEADER_KEYS del crawler (captureHeaders.ts) descarta los headers `platform: hostinger` y `panel: hpanel` que el sitio SI emite, y (2) el registry de hosting no tiene ninguna signature de Hostinger. Los demas ejes (cms/builder/jsFramework/analytics) quedan no-detectado CORRECTAMENTE: el sitio es estatico hecho a mano sin marcadores."
  confirming_evidence:
    - "WebFetch/curl real a https://ariannalupi.com devuelve headers: server: cloudflare, cf-ray, cf-cache-status (=> CDN Cloudflare detecta, coincide con sintoma), y ADEMAS platform: hostinger, panel: hpanel, x-turbo-charged-by: LiteSpeed."
    - "captureHeaders.ts CURATED_HEADER_KEYS incluye cf-ray/cf-cache-status/server (por eso Cloudflare pasa) pero NO incluye platform/panel/x-turbo-charged-by => se descartan antes de persistir en Page.responseHeaders (crawl.ts:112 curateHeaders)."
    - "hosting.ts solo cubre Vercel/Netlify/WP Engine/Nginx/Apache. No hay signature de Hostinger ni LiteSpeed."
    - "El HTML crudo (77KB) del home NO tiene: meta generator, /wp-content/, /wp-includes/, elementor, wixstatic, squarespace, cdn.shopify, __NEXT_DATA__, /_next/, data-wf, gtag/js?id=G-, gtm.js, GTM-, fbevents.js, fbq(. Solo 5 <script>: 2 inline, 1 application/ld+json, 1 de Cloudflare email-decode. Sitio estatico a mano."
  falsification_test: "Si tras (a) agregar platform/panel al allowlist del crawler y (b) agregar la signature hosting.hostinger al registry, un input con responseHeaders {cf-ray, server: cloudflare, platform: hostinger, panel: hpanel} NO devuelve hosting=Hostinger (alto) y cdn=Cloudflare simultaneamente, la hipotesis es falsa."
  fix_rationale: "El fix ataca la causa raiz en sus dos puntas (captura + signature), no un sintoma: sin capturar los headers, ninguna signature podria verlos; sin signature, capturar los headers no sirve. Ambas puntas son necesarias y suficientes para detectar Hostinger en este sitio y en cualquier sitio Hostinger detras de CDN."
  blind_spots: "No se corrio un crawl real ni se leyo un Audit real de la DB: la confirmacion end-to-end de que Page.responseHeaders efectivamente contiene platform/panel en runtime (y no los normaliza distinto got-scraping) requiere un crawl real -> queda como verificacion humana. La confianza exacta (alto) depende de que got-scraping entregue las keys en minuscula tal como el contrato asume."

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Al auditar ariannalupi.com con detectStack, se espera que al menos el eje CMS (y potencialmente builder/hosting/framework JS/analytics) se detecte con algun nivel de confianza, no solo el CDN.
actual: Solo el eje CDN detecta Cloudflare. Los ejes CMS, builder, hosting, framework JS y analytics quedan todos en "no detectado".
errors: Ninguno reportado -- no es un crash, es under-detection (falsos negativos en todos los ejes salvo CDN).
reproduction: Correr una auditoria completa (worker post-crawl) contra el sitio real ariannalupi.com y revisar el campo Audit.stack resultante -- todos los ejes salvo CDN quedan vacios/no-detectados.
started: Reportado luego del shipping del motor de fingerprint v1.5 (Phase 25/26). No se especifico si alguna vez detecto correctamente otros ejes contra este sitio en particular.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: "Cloudflare delante oculta/reescribe las senales de CMS => por eso CMS no detecta (comportamiento esperado)."
  evidence: "Cloudflare NO reescribe el HTML de origen: el HTML crudo llega completo (77KB) y simplemente no contiene ningun marcador de CMS. La razon de CMS no-detectado no es el CDN sino que el sitio es estatico hecho a mano (sin WordPress/Shopify/Wix/etc.). Para CMS, no-detectado ES la respuesta correcta (FPRINT-08)."
  timestamp: 2026-07-25T16:33:00Z

- hypothesis: "Bug en el armado de PageFingerprintInput en el worker (headers/cookies/html no llegan al motor)."
  evidence: "El worker (index.ts:616-629) mapea correctamente html/responseHeaders/cookieNames y deriva isHome via normalizeUrl. El CDN (header-based) SI detecta => la tuberia de responseHeaders funciona; los checks (html-based) producen issues => la tuberia de html funciona. El problema no es el armado del input sino QUE headers sobreviven la curacion aguas arriba."
  timestamp: 2026-07-25T16:34:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-25T16:25:00Z
  checked: "curl -D- a https://ariannalupi.com (headers reales de respuesta)."
  found: "server: cloudflare, cf-ray, cf-cache-status (CDN), MAS platform: hostinger, panel: hpanel, x-turbo-charged-by: LiteSpeed, content-security-policy: upgrade-insecure-requests. Sin x-powered-by, sin generator header."
  implication: "El origen (Hostinger/LiteSpeed) SI filtra senales a traves de Cloudflare via headers propios (platform/panel/x-turbo-charged-by) — no todo el origen queda enmascarado por el CDN."

- timestamp: 2026-07-25T16:27:00Z
  checked: "HTML crudo del home (77KB): grep de marcadores de cms/builder/jsFramework/analytics del registry."
  found: "Cero marcadores conocidos. title custom, meta description/twitter, assets locales /assets/, 5 <script> (2 inline, 1 JSON-LD, 1 Cloudflare email-decode)."
  implication: "cms/builder/jsFramework/analytics = no-detectado es CORRECTO para este sitio (bespoke estatico). No hay nada que detectar; el motor no debe forzar (FPRINT-08)."

- timestamp: 2026-07-25T16:29:00Z
  checked: "packages/crawler/src/captureHeaders.ts CURATED_HEADER_KEYS y crawl.ts:112."
  found: "El allowlist captura server/cf-ray/cf-cache-status (=> Cloudflare pasa) pero NO platform/panel/x-turbo-charged-by. curateHeaders es exactamente lo que se persiste en Page.responseHeaders."
  implication: "Los headers de Hostinger/LiteSpeed se descartan antes de llegar al motor. Aunque exista una signature, nunca veria esos headers. Bug de indireccion escritor(curacion)<->lector(signature)."

- timestamp: 2026-07-25T16:30:00Z
  checked: "packages/fingerprint/src/signatures/hosting.ts (cobertura del registry)."
  found: "Solo Vercel/Netlify/WP Engine/Nginx/Apache. Sin Hostinger ni LiteSpeed."
  implication: "Segunda punta del gap: aun capturando los headers, faltaria la signature. El fix requiere ambas puntas."

## Evidence (ampliación: 3 sitios reales, verificación end-to-end con detectStack real)
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-25T16:45:00Z
  checked: "Script tsx que corre el detectStack REAL + curateHeaders REAL sobre fetch en vivo de los 3 sitios (reproduce la tubería del worker sin crawl completo). scratchpad/verify-fingerprint.mts."
  found: |
    ariannalupi.com  -> cdn=Cloudflare[alto], hosting=Hostinger[alto], resto no-detectado. (FIX confirmado end-to-end.)
    aprendoseo.com   -> cms=Webflow[medio] (signals: cms.webflow.assets), cdn=Cloudflare[alto], analytics=GTM[medio]+MetaPixel[medio], hosting=null. NO es Payload: es Webflow y SE DETECTA.
    drmanuelvargashidalgo.com -> cms=WordPress[medio] (paths+apiLink), builder=Divi[medio], cdn=Cloudflare[alto], hosting=null. WordPress+Divi bien detectados.
  implication: "El motor funciona correctamente en los 3. El unico FALSO NEGATIVO real era el hosting de ariannalupi (ya arreglado). aprendoseo/drmanuel detectan CMS+builder OK."

- timestamp: 2026-07-25T16:47:00Z
  checked: "aprendoseo (Webflow): host de assets real y marcadores. Signature cms.webflow.assets."
  found: "El sitio usa el CDN ACTUAL cdn.prod.website-files.com (80 ocurrencias) + <html data-wf-page data-wf-site>. La signature fijaba el host VIEJO `assets.website-files.com` (0 match) y `.webflow.io` (0). La deteccion se salvaba SOLO por los selectores data-wf. Staleness real de la firma."
  implication: "Bug latente en cms.ts: si un HTML/pagina Webflow no trae data-wf-*, la firma no matchea pese a servir desde website-files.com. Fix: ampliar substring a `website-files.com` (cubre assets./assets-global./cdn.prod.)."

- timestamp: 2026-07-25T16:49:00Z
  checked: "drmanuel (WordPress+Divi): byte offsets vs MAX_HTML_BYTES=262144 y analytics."
  found: "/wp-content/ @2138 y et_pb_ @102386 estan DENTRO de 256KB (por eso WP+Divi matchean). Meta generator WordPress @688694 y Divi @686787 quedan FUERA de la truncacion => cms.wordpress.generator NO dispara. Sin gtag/js?id=G- ni gtm.js ni GTM- en todo el archivo (751KB): Site Kit sin loader GA estandar => analytics vacio es CORRECTO."
  implication: "WordPress queda [medio] (paths fuerte + apiLink debil) en vez de [alto] porque el generator cae tras la truncacion anti-DoS deliberada (T-25-07/08). NO es bug: deteccion correcta, solo menor confianza. hosting=null = LiteSpeed (x-litespeed-cache no capturado) = gap esperado, opcional."

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  Probado detectStack REAL contra 3 sitios. El motor funciona bien en los 3; hubo 2 bugs reales de signatures (ambos arreglados) y el resto es comportamiento esperado:
  (1) BUG hosting (ariannalupi): doble gap — el allowlist CURATED_HEADER_KEYS descartaba `platform: hostinger`/`panel: hpanel`, y no habia signature de Hostinger. Hosting quedaba no-detectado pese a senal clara. NO es 'CDN oculta senal'.
  (2) BUG staleness Webflow (aprendoseo): cms.webflow.assets fijaba el host de CDN VIEJO `assets.website-files.com`; Webflow 2026 sirve desde `cdn.prod.website-files.com`. La deteccion se salvaba solo por los atributos data-wf-*; en HTML Webflow sin esos atributos habria falso negativo.
  EXPECTED (no bug): cms/builder/jsFramework/analytics no-detectado en ariannalupi (sitio estatico a mano, sin marcadores — FPRINT-08 no fuerza). WordPress[medio]+Divi[medio] en drmanuel es correcto; queda [medio] y no [alto] solo porque el meta generator cae tras la truncacion anti-DoS de 256KB (deliberada). hosting=null en aprendoseo(Webflow) y drmanuel(LiteSpeed) = gap esperado (esos hosts no estan cubiertos; opcional extender).
  MISLABEL: la tarea decia aprendoseo='Payload CMS'; el sitio real es Webflow y SE DETECTA.
fix: "(a) crawler: +`platform`, +`panel` al allowlist. (b) fingerprint hosting: +signature hosting.hostinger (fuerte, unequivocal). (c) fingerprint cms: ampliar el marcador de asset de Webflow de `assets.website-files.com` a `website-files.com` (cubre el CDN actual cdn.prod.website-files.com). Tests de regresion en los 3 puntos."
verification: |
  Self-verificado end-to-end:
  - fingerprint suite 37/37 verde (incluye regresiones: hosting Hostinger[alto]; escenario Hostinger-tras-Cloudflare; Webflow por cdn.prod.website-files.com sin data-wf).
  - crawler captureHeaders 8/8 verde (incluye captura de platform/panel tras CDN).
  - tsc --noEmit limpio en fingerprint y crawler.
  - detectStack REAL corrido contra los 3 sitios en vivo (scratchpad/verify-fingerprint.mts): ariannalupi hosting=Hostinger[alto]; aprendoseo cms=Webflow[medio]; drmanuel WordPress[medio]+Divi[medio]. Todos con cdn=Cloudflare[alto].
  PENDIENTE verificacion humana: re-correr un audit real (tras rebuild/deploy del worker con @auditor/crawler + @auditor/fingerprint) y confirmar Audit.stack persistido.
files_changed:
  - "packages/crawler/src/captureHeaders.ts: +platform, +panel al allowlist CURATED_HEADER_KEYS"
  - "packages/crawler/src/captureHeaders.test.ts: test de regresión (captura platform/panel tras CDN)"
  - "packages/fingerprint/src/signatures/hosting.ts: +signature hosting.hostinger (fuerte, unequivocal)"
  - "packages/fingerprint/src/signatures/cms.ts: Webflow assets `assets.website-files.com` -> `website-files.com` (CDN actual)"
  - "packages/fingerprint/src/__fixtures__/synthetic.ts: +hostingerBehindCloudflarePage, +webflowCurrentCdnPage"
  - "packages/fingerprint/src/detectStack.test.ts: +3 tests de regresión (hosting Hostinger; escenario completo; Webflow CDN actual)"

## Optional follow-ups (NO implementados — decisión de scope)
- LiteSpeed hosting: aparece en 2/3 sitios (ariannalupi `x-turbo-charged-by: LiteSpeed`, drmanuel `x-litespeed-cache`). Detectarlo requiere capturar esos headers + signature nueva; compite en valor único con Hostinger. Bajo valor (dato de web-server) vs CMS/builder que ya funcionan.
- Webflow-as-hosting: `x-wf-region` podría dar hosting=Webflow. No capturado hoy.
- Confianza Webflow: hoy [medio] (una firma). Los atributos data-wf-* son inequívocos; separarlos en firma unequivocal daría [alto]. No tocado para no recalibrar confianza sin pedido.
- WordPress[medio] en sitios Divi pesados: el generator cae tras la truncación de 256KB. Subir MAX_HTML_BYTES es un tradeoff de memoria/DoS; no recomendado por un bump de confianza sobre detección ya correcta.
