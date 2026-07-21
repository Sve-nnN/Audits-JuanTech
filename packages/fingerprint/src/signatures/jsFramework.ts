import type { AggregatedInput, Signature } from "../types";

/**
 * Signatures del eje `jsFramework` (FPRINT-06).
 *
 * Nota: el crawler del proyecto es Cheerio (HTML crudo, no ejecuta JS). Muchos
 * frameworks CSR modernos no dejan marca en el HTML crudo — devolver
 * `no-detectado` es correcto, no forzar. React/Vue quedan como señales `debil`.
 */

/** Cuenta cuántos de los headers indicados están presentes. */
function headersPresent(ctx: AggregatedInput, ...names: string[]): number {
  return names.reduce((n, name) => n + (ctx.responseHeaders[name] !== undefined ? 1 : 0), 0);
}

/** Devuelve true si el valor del header (case-insensitive) contiene `needle`. */
function headerIncludes(ctx: AggregatedInput, name: string, needle: string): boolean {
  return (ctx.responseHeaders[name] ?? "").toLowerCase().includes(needle.toLowerCase());
}

/** Suma cuántos de los substrings aparecen (al menos una vez) en el HTML. */
function htmlIncludes(ctx: AggregatedInput, ...needles: string[]): number {
  const html = ctx.html ?? "";
  return needles.reduce((n, needle) => n + (html.includes(needle) ? 1 : 0), 0);
}

export const jsFrameworkSignatures: Signature[] = [
  {
    id: "jsFramework.next",
    axis: "jsFramework",
    value: "Next.js",
    strength: "fuerte",
    unequivocal: true, // <script id="__NEXT_DATA__"> identifica Next.js sin ambigüedad
    test: (ctx) =>
      ctx.$("script#__NEXT_DATA__").length +
      htmlIncludes(ctx, "/_next/static/", "/_next/") +
      headersPresent(ctx, "x-nextjs-cache") +
      (headerIncludes(ctx, "x-powered-by", "next.js") ? 1 : 0),
  },
  {
    id: "jsFramework.nuxt",
    axis: "jsFramework",
    value: "Nuxt",
    strength: "fuerte",
    test: (ctx) => htmlIncludes(ctx, "/_nuxt/", "window.__NUXT__"),
  },
  {
    id: "jsFramework.react",
    axis: "jsFramework",
    value: "React",
    strength: "debil", // data-reactroot solo en SSR legacy; apps modernas no dejan marca
    test: (ctx) => ctx.$("[data-reactroot]").length,
  },
  {
    id: "jsFramework.vue",
    axis: "jsFramework",
    value: "Vue",
    strength: "debil", // atributos data-v-* del DOM SSR de Vue
    test: (ctx) => htmlIncludes(ctx, "data-v-"),
  },
];
