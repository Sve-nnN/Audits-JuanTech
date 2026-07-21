import type { AggregatedInput, Signature } from "../types";

/**
 * Signatures del eje `analytics` (FPRINT-07). A diferencia del resto de ejes,
 * `analytics` es un ARRAY en `DetectedStack`: GA4 + GTM + Meta Pixel coexisten
 * y se reportan los tres. Matching solo sobre HTML (scripts embebidos) via
 * `includes()` — sin regex.
 */

/** Suma cuántos de los substrings aparecen (al menos una vez) en el HTML. */
function htmlIncludes(ctx: AggregatedInput, ...needles: string[]): number {
  const html = ctx.html ?? "";
  return needles.reduce((n, needle) => n + (html.includes(needle) ? 1 : 0), 0);
}

export const analyticsSignatures: Signature[] = [
  {
    id: "analytics.ga4",
    axis: "analytics",
    value: "GA4",
    strength: "fuerte",
    // Solo el loader con measurement-id GA4 (`?id=G-`). `gtag(` suelto se comparte
    // con Google Ads (`AW-`) y con GTM, por eso NO se usa como marcador (WR-03).
    test: (ctx) => htmlIncludes(ctx, "googletagmanager.com/gtag/js?id=G-"),
  },
  {
    id: "analytics.gtm",
    axis: "analytics",
    value: "Google Tag Manager",
    strength: "fuerte",
    // Marcadores específicos de GTM: el loader `gtm.js` o el container id `GTM-`.
    // `dataLayer` suelto NO sirve: aparece también en el snippet estándar de GA4,
    // lo que producía un falso positivo sistemático de GTM (WR-01).
    test: (ctx) => htmlIncludes(ctx, "googletagmanager.com/gtm.js", "GTM-"),
  },
  {
    id: "analytics.metaPixel",
    axis: "analytics",
    value: "Meta Pixel",
    strength: "fuerte",
    // Marcadores propios del pixel: el script `fbevents.js` o la llamada `fbq(`.
    // `connect.facebook.net` suelto también lo carga el SDK de Facebook (sdk.js),
    // no solo el pixel, por eso se descarta como marcador (WR-03).
    test: (ctx) => htmlIncludes(ctx, "fbevents.js", "fbq("),
  },
];
