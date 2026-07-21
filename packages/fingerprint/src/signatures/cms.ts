import type { AggregatedInput, Signature } from "../types";

/**
 * Signatures del eje `cms` (FPRINT-02).
 *
 * Cada tecnología se apoya en señales multi-fuente (header + cookie +
 * path/HTML), nunca en un único header. `test` devuelve el CONTEO de marcadores
 * que matchean (0 = sin match). El matching usa selectores cheerio (`ctx.$`) e
 * `includes()` de string — nunca regex con cuantificadores anidados sobre HTML
 * no confiable (mitiga ReDoS, T-25-05).
 */

/** Cuenta cuántos de los headers indicados están presentes (keys en minúscula por contrato). */
function headersPresent(ctx: AggregatedInput, ...names: string[]): number {
  return names.reduce((n, name) => n + (ctx.responseHeaders[name] !== undefined ? 1 : 0), 0);
}

/** Devuelve true si el valor del header (case-insensitive) contiene `needle`. */
function headerIncludes(ctx: AggregatedInput, name: string, needle: string): boolean {
  return (ctx.responseHeaders[name] ?? "").toLowerCase().includes(needle.toLowerCase());
}

/** Cuenta cuántos de los substrings indicados aparecen en el HTML (via includes, sin regex). */
function htmlIncludes(ctx: AggregatedInput, ...needles: string[]): number {
  const html = ctx.html ?? "";
  return needles.reduce((n, needle) => n + (html.includes(needle) ? 1 : 0), 0);
}

/** Cuenta cookies cuyo nombre empieza por alguno de los prefijos indicados. */
function cookieStartsWith(ctx: AggregatedInput, ...prefixes: string[]): number {
  return ctx.cookieNames.filter((name) => prefixes.some((p) => name.startsWith(p))).length;
}

export const cmsSignatures: Signature[] = [
  // --- WordPress: multi-señal (paths, generator, cookie, api link) ---
  {
    id: "cms.wordpress.paths",
    axis: "cms",
    value: "WordPress",
    strength: "fuerte",
    test: (ctx) => htmlIncludes(ctx, "/wp-content/", "/wp-includes/"),
  },
  {
    id: "cms.wordpress.generator",
    axis: "cms",
    value: "WordPress",
    strength: "fuerte",
    test: (ctx) =>
      ctx.$('meta[name="generator"][content*="WordPress"]').length,
  },
  {
    id: "cms.wordpress.cookie",
    axis: "cms",
    value: "WordPress",
    strength: "fuerte",
    test: (ctx) => cookieStartsWith(ctx, "wordpress_logged_in_"),
  },
  {
    id: "cms.wordpress.apiLink",
    axis: "cms",
    value: "WordPress",
    strength: "debil",
    test: (ctx) => (headerIncludes(ctx, "link", "api.w.org") ? 1 : 0),
  },

  // --- Shopify: headers + cookie (inequívocos) + CDN ---
  {
    id: "cms.shopify.headers",
    axis: "cms",
    value: "Shopify",
    strength: "fuerte",
    unequivocal: true,
    test: (ctx) => headersPresent(ctx, "x-shopify-stage", "x-sorting-hat-shopid", "x-shardid"),
  },
  {
    id: "cms.shopify.cookie",
    axis: "cms",
    value: "Shopify",
    strength: "fuerte",
    unequivocal: true,
    test: (ctx) => (ctx.cookieNames.includes("_shopify_s") || ctx.cookieNames.includes("_shopify_y") ? 1 : 0),
  },
  {
    id: "cms.shopify.cdn",
    axis: "cms",
    value: "Shopify",
    strength: "fuerte",
    test: (ctx) => htmlIncludes(ctx, "cdn.shopify.com"),
  },

  // --- Webflow: generator + assets/atributos ---
  {
    id: "cms.webflow.generator",
    axis: "cms",
    value: "Webflow",
    strength: "fuerte",
    unequivocal: true,
    test: (ctx) => ctx.$('meta[name="generator"][content*="Webflow"]').length,
  },
  {
    id: "cms.webflow.assets",
    axis: "cms",
    value: "Webflow",
    strength: "fuerte",
    test: (ctx) =>
      htmlIncludes(ctx, "assets.website-files.com", ".webflow.io") +
      ctx.$("[data-wf-page], [data-wf-site]").length,
  },

  // --- Wix: assets + header inequívoco + generator ---
  {
    id: "cms.wix.assets",
    axis: "cms",
    value: "Wix",
    strength: "fuerte",
    test: (ctx) => htmlIncludes(ctx, "wixstatic.com", "parastorage.com"),
  },
  {
    id: "cms.wix.header",
    axis: "cms",
    value: "Wix",
    strength: "fuerte",
    unequivocal: true,
    test: (ctx) => headersPresent(ctx, "x-wix-request-id"),
  },
  {
    id: "cms.wix.generator",
    axis: "cms",
    value: "Wix",
    strength: "fuerte",
    test: (ctx) => ctx.$('meta[name="generator"][content*="Wix"]').length,
  },

  // --- Squarespace: cookie inequívoca + generator + CDN ---
  {
    id: "cms.squarespace.cookie",
    axis: "cms",
    value: "Squarespace",
    strength: "fuerte",
    unequivocal: true,
    test: (ctx) => (ctx.cookieNames.includes("squarespace-refresh") ? 1 : 0),
  },
  {
    id: "cms.squarespace.generator",
    axis: "cms",
    value: "Squarespace",
    strength: "fuerte",
    test: (ctx) => ctx.$('meta[name="generator"][content*="Squarespace"]').length,
  },
  {
    id: "cms.squarespace.cdn",
    axis: "cms",
    value: "Squarespace",
    strength: "fuerte",
    test: (ctx) => htmlIncludes(ctx, "static1.squarespace.com", "squarespace-cdn.com"),
  },
];
