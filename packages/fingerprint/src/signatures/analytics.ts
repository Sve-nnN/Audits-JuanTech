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
    test: (ctx) => htmlIncludes(ctx, "googletagmanager.com/gtag/js?id=G-", "gtag("),
  },
  {
    id: "analytics.gtm",
    axis: "analytics",
    value: "Google Tag Manager",
    strength: "fuerte",
    test: (ctx) => htmlIncludes(ctx, "googletagmanager.com/gtm.js", "GTM-", "dataLayer"),
  },
  {
    id: "analytics.metaPixel",
    axis: "analytics",
    value: "Meta Pixel",
    strength: "fuerte",
    test: (ctx) => htmlIncludes(ctx, "connect.facebook.net", "fbevents.js", "fbq("),
  },
];
