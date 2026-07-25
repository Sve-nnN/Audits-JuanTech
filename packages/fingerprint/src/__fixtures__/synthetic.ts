import type { PageFingerprintInput } from "../types";

/**
 * Fixtures sintéticos por firma para la suite de `detectStack` (FPRINT-02..08).
 * Todas las keys de `responseHeaders` van en MINÚSCULA a propósito (Pitfall 5):
 * HTTP es case-insensitive y el motor normaliza, pero los fixtures fijan el
 * contrato tal como lo entrega got-scraping.
 *
 * `cookieNames` transporta SOLO nombres de cookie (FPRINT-01), nunca valores.
 */

const emptyHeaders: Record<string, string> = {};

// --- CMS (FPRINT-02) -------------------------------------------------------

export const wordpressPage: PageFingerprintInput = {
  url: "https://wp.example.com/",
  isHome: true,
  html: `<html><head><meta name="generator" content="WordPress 6.7" /><link rel="stylesheet" href="/wp-content/themes/x/style.css" /><script src="/wp-includes/js/jquery.js"></script></head><body>Hola</body></html>`,
  responseHeaders: { link: "<https://wp.example.com/wp-json/>; rel=\"https://api.w.org/\"" },
  cookieNames: [],
};

export const shopifyPage: PageFingerprintInput = {
  url: "https://shop.example.com/",
  isHome: true,
  html: `<html><head><script src="https://cdn.shopify.com/s/files/app.js"></script></head><body>Powered by Shopify</body></html>`,
  responseHeaders: { "x-shopify-stage": "production", "x-sorting-hat-shopid": "12345" },
  cookieNames: ["_shopify_s", "_shopify_y"],
};

export const webflowPage: PageFingerprintInput = {
  url: "https://wf.example.com/",
  isHome: true,
  html: `<html data-wf-page="abc" data-wf-site="def"><head><meta name="generator" content="Webflow" /><link href="https://assets.website-files.com/x.css" rel="stylesheet" /></head><body></body></html>`,
  responseHeaders: emptyHeaders,
  cookieNames: [],
};

export const wixPage: PageFingerprintInput = {
  url: "https://wix.example.com/",
  isHome: true,
  html: `<html><head><meta name="generator" content="Wix.com Website Builder" /><script src="https://static.parastorage.com/x.js"></script><img src="https://static.wixstatic.com/media/x.png" /></head><body></body></html>`,
  responseHeaders: { "x-wix-request-id": "req-123" },
  cookieNames: [],
};

export const squarespacePage: PageFingerprintInput = {
  url: "https://sq.example.com/",
  isHome: true,
  html: `<html><head><meta name="generator" content="Squarespace" /><link href="https://static1.squarespace.com/x.css" rel="stylesheet" /></head><body></body></html>`,
  responseHeaders: emptyHeaders,
  cookieNames: ["squarespace-refresh"],
};

/**
 * Regresión (fingerprint-cms-not-detected): sitio Webflow 2026 servido desde el
 * CDN ACTUAL `cdn.prod.website-files.com`, SIN atributos `data-wf-*` ni meta
 * generator. La signature vieja fijaba `assets.website-files.com` => 0 match =>
 * Webflow no-detectado. Al ampliar a `website-files.com` debe volver a detectar.
 */
export const webflowCurrentCdnPage: PageFingerprintInput = {
  url: "https://wf-cdn.example.com/",
  isHome: true,
  html: `<html><head><link rel="stylesheet" href="https://cdn.prod.website-files.com/abc123/css/site.webflow.shared.min.css" /></head><body><h1>Webflow 2026</h1></body></html>`,
  responseHeaders: emptyHeaders,
  cookieNames: [],
};

// --- Builder (FPRINT-03) — todos sobre base WordPress ----------------------

const wpBase = `<meta name="generator" content="WordPress 6.7" /><link href="/wp-content/themes/x/style.css" rel="stylesheet" />`;

export const wordpressElementorPage: PageFingerprintInput = {
  url: "https://wp-elementor.example.com/",
  isHome: true,
  html: `<html><head>${wpBase}<link href="/wp-content/plugins/elementor/assets/css/frontend.min.css" rel="stylesheet" /></head><body><div class="elementor elementor-1234" data-elementor-type="wp-page"><section class="elementor-section"></section></div></body></html>`,
  responseHeaders: emptyHeaders,
  cookieNames: [],
};

export const wordpressGutenbergPage: PageFingerprintInput = {
  url: "https://wp-gutenberg.example.com/",
  isHome: true,
  html: `<html><head>${wpBase}</head><body><!-- wp:paragraph --><p class="wp-block-paragraph">Hola</p><!-- /wp:paragraph --><div class="wp-block-group"></div></body></html>`,
  responseHeaders: emptyHeaders,
  cookieNames: [],
};

/** WP con UNA marca de Elementor y UNA de Divi -> empate real de conteo. */
export const wordpressBuilderTiePage: PageFingerprintInput = {
  url: "https://wp-tie.example.com/",
  isHome: true,
  html: `<html><head>${wpBase}</head><body><div class="elementor-widget"></div><div class="et_pb_section"></div></body></html>`,
  responseHeaders: emptyHeaders,
  cookieNames: [],
};

/** WP SIN ninguna marca de builder -> builder no-detectado (NUNCA Gutenberg). */
export const wordpressNoBuilderPage: PageFingerprintInput = {
  url: "https://wp-plain.example.com/",
  isHome: true,
  html: `<html><head>${wpBase}</head><body><div class="site-content"><p>Contenido clásico sin builder.</p></div></body></html>`,
  responseHeaders: emptyHeaders,
  cookieNames: [],
};

// --- CDN (FPRINT-04) -------------------------------------------------------

export const cloudflarePage: PageFingerprintInput = {
  url: "https://cf.example.com/",
  isHome: true,
  html: `<html><body></body></html>`,
  responseHeaders: { "cf-ray": "8abc123-EWR", "cf-cache-status": "HIT", server: "cloudflare" },
  cookieNames: [],
};

export const fastlyPage: PageFingerprintInput = {
  url: "https://fastly.example.com/",
  isHome: true,
  html: `<html><body></body></html>`,
  responseHeaders: { "x-served-by": "cache-ewr-1", "x-cache": "HIT", via: "1.1 varnish" },
  cookieNames: [],
};

export const akamaiPage: PageFingerprintInput = {
  url: "https://akamai.example.com/",
  isHome: true,
  html: `<html><body></body></html>`,
  responseHeaders: { "x-akamai-transformed": "9 - 0 pmb=mRUM,1", "x-akamai-request-id": "abc123" },
  cookieNames: [],
};

// --- Hosting (FPRINT-05) ---------------------------------------------------

/** CDN Cloudflare reescribe `server`: el origen queda enmascarado. */
export const hostingMaskedByCdnPage: PageFingerprintInput = {
  url: "https://masked.example.com/",
  isHome: true,
  html: `<html><body></body></html>`,
  responseHeaders: { "cf-ray": "8abc123-EWR", server: "cloudflare" },
  cookieNames: [],
};

/** Origen nginx genérico: señal débil -> hosting `bajo`, nunca `alto`. */
export const hostingNginxPage: PageFingerprintInput = {
  url: "https://nginx.example.com/",
  isHome: true,
  html: `<html><body></body></html>`,
  responseHeaders: { server: "nginx/1.24.0" },
  cookieNames: [],
};

/**
 * Regresión (fingerprint-cms-not-detected): sitio ESTÁTICO hecho a mano en
 * Hostinger detrás de Cloudflare. Cloudflare enmascara `server`, pero el origen
 * deja pasar `platform: hostinger` + `panel: hpanel`. CDN Cloudflare y hosting
 * Hostinger deben detectarse a la vez; cms/jsFramework/analytics quedan
 * no-detectado CORRECTAMENTE (no hay marcadores en el HTML — no se fuerza).
 */
export const hostingerBehindCloudflarePage: PageFingerprintInput = {
  url: "https://static-hostinger.example.com/",
  isHome: true,
  html: `<html><head><title>Sitio estático hecho a mano</title><meta name="description" content="Sin CMS" /></head><body><h1>Portafolio</h1></body></html>`,
  responseHeaders: {
    server: "cloudflare",
    "cf-ray": "a20c7d15aa6b6d1d-AMS",
    "cf-cache-status": "DYNAMIC",
    platform: "hostinger",
    panel: "hpanel",
  },
  cookieNames: [],
};

// --- JS framework (FPRINT-06) ----------------------------------------------

export const nextjsPage: PageFingerprintInput = {
  url: "https://next.example.com/",
  isHome: true,
  html: `<html><head><link href="/_next/static/css/app.css" rel="stylesheet" /></head><body><div id="__next"></div><script id="__NEXT_DATA__" type="application/json">{"props":{}}</script></body></html>`,
  responseHeaders: emptyHeaders,
  cookieNames: [],
};

// --- Analytics (FPRINT-07) -------------------------------------------------

export const analyticsTrioPage: PageFingerprintInput = {
  url: "https://analytics.example.com/",
  isHome: true,
  html: `<html><head><script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123"></script><script>gtag('config','G-ABC123');</script><script>(function(){window.dataLayer=window.dataLayer||[];})();new Image().src='https://www.googletagmanager.com/gtm.js?id=GTM-XYZ';</script><script>!function(f,b,e){fbq('init','123');}(window);var s=document.createElement('script');s.src='https://connect.facebook.net/en_US/fbevents.js';</script></head><body></body></html>`,
  responseHeaders: emptyHeaders,
  cookieNames: [],
};

// --- No-detectado (FPRINT-08) ----------------------------------------------

export const emptyPage: PageFingerprintInput = {
  url: "https://plain.example.com/",
  isHome: true,
  html: `<html><head><title>Sitio plano</title></head><body><h1>Sin firmas conocidas</h1></body></html>`,
  responseHeaders: emptyHeaders,
  cookieNames: [],
};

// --- Independencia de ejes (multi-eje) -------------------------------------

/** WordPress + Cloudflare + Next.js simultáneos (no winner-take-all). */
export const multiAxisPage: PageFingerprintInput = {
  url: "https://multi.example.com/",
  isHome: true,
  html: `<html><head><meta name="generator" content="WordPress 6.7" /><link href="/wp-content/themes/x/style.css" rel="stylesheet" /><script src="/wp-includes/js/x.js"></script><link href="/_next/static/css/app.css" rel="stylesheet" /></head><body><div id="__next"></div><script id="__NEXT_DATA__" type="application/json">{"props":{}}</script></body></html>`,
  responseHeaders: { "cf-ray": "8abc123-EWR", server: "cloudflare" },
  cookieNames: [],
};
