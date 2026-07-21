import type { AggregatedInput, Signature } from "../types";

/**
 * Signatures del eje `hosting` (FPRINT-05). Solo `ctx.responseHeaders` y
 * `ctx.cookieNames`; sin regex.
 *
 * Pitfall clave: con un CDN delante (p.ej. Cloudflare reescribe `server`), el
 * header de origen se pierde. Nginx/Apache son señales `debil` genéricas — casi
 * nunca suben a "alto"; el motor devuelve `no-detectado` antes que adivinar.
 */

/** Cuenta cuántos de los headers indicados están presentes. */
function headersPresent(ctx: AggregatedInput, ...names: string[]): number {
  return names.reduce((n, name) => n + (ctx.responseHeaders[name] !== undefined ? 1 : 0), 0);
}

/** Devuelve true si el valor del header (case-insensitive) contiene `needle`. */
function headerIncludes(ctx: AggregatedInput, name: string, needle: string): boolean {
  return (ctx.responseHeaders[name] ?? "").toLowerCase().includes(needle.toLowerCase());
}

/** Cuenta cookies cuyo nombre contiene alguno de los substrings indicados. */
function cookieIncludes(ctx: AggregatedInput, ...needles: string[]): number {
  return ctx.cookieNames.filter((name) =>
    needles.some((needle) => name.toLowerCase().includes(needle))
  ).length;
}

export const hostingSignatures: Signature[] = [
  {
    id: "hosting.vercel",
    axis: "hosting",
    value: "Vercel",
    strength: "fuerte",
    unequivocal: true, // x-vercel-id es exclusivo de Vercel
    test: (ctx) =>
      headersPresent(ctx, "x-vercel-id", "x-vercel-cache") +
      (headerIncludes(ctx, "server", "vercel") ? 1 : 0),
  },
  {
    id: "hosting.netlify",
    axis: "hosting",
    value: "Netlify",
    strength: "fuerte",
    unequivocal: true, // x-nf-request-id es exclusivo de Netlify
    test: (ctx) =>
      headersPresent(ctx, "x-nf-request-id") +
      (headerIncludes(ctx, "server", "netlify") ? 1 : 0),
  },
  {
    id: "hosting.wpengine",
    axis: "hosting",
    value: "WP Engine",
    strength: "fuerte",
    test: (ctx) =>
      headersPresent(ctx, "x-wpe-loopback-upstream-addr", "x-wpengine-lb") +
      cookieIncludes(ctx, "wpengine") +
      (headerIncludes(ctx, "x-powered-by", "wpengine") ? 1 : 0),
  },
  {
    id: "hosting.nginx",
    axis: "hosting",
    value: "Nginx",
    strength: "debil", // genérico: origen no CDN, casi nunca sube a "alto"
    test: (ctx) => (headerIncludes(ctx, "server", "nginx") ? 1 : 0),
  },
  {
    id: "hosting.apache",
    axis: "hosting",
    value: "Apache",
    strength: "debil", // genérico: origen no CDN, casi nunca sube a "alto"
    test: (ctx) => (headerIncludes(ctx, "server", "apache") ? 1 : 0),
  },
];
