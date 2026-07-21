import type { AggregatedInput, Signature } from "../types";

/**
 * Signatures del eje `cdn` (FPRINT-04). Cada firma devuelve un CONTEO de headers
 * del mismo vendor, pero ese conteo es solo EVIDENCIA — NO alimenta la confianza.
 * La confianza la fija el motor (`resolveConfidence`) por marcador inequívoco
 * (`unequivocal`, ej. cf-ray / x-amz-cf-id) → `alto`, o por una única firma fuerte
 * no inequívoca → `medio`. El conteo de headers solo se usa para el desempate de
 * builder, no acá. Matching solo sobre `ctx.responseHeaders` (keys en minúscula
 * por contrato) — sin regex.
 */

/** Cuenta cuántos de los headers indicados están presentes. */
function headersPresent(ctx: AggregatedInput, ...names: string[]): number {
  return names.reduce((n, name) => n + (ctx.responseHeaders[name] !== undefined ? 1 : 0), 0);
}

/** Devuelve true si el valor del header (case-insensitive) contiene `needle`. */
function headerIncludes(ctx: AggregatedInput, name: string, needle: string): boolean {
  return (ctx.responseHeaders[name] ?? "").toLowerCase().includes(needle.toLowerCase());
}

export const cdnSignatures: Signature[] = [
  {
    id: "cdn.cloudflare",
    axis: "cdn",
    value: "Cloudflare",
    strength: "fuerte",
    unequivocal: true, // cf-ray es un marcador exclusivo de Cloudflare
    test: (ctx) =>
      headersPresent(ctx, "cf-ray", "cf-cache-status") +
      (headerIncludes(ctx, "server", "cloudflare") ? 1 : 0),
  },
  {
    id: "cdn.fastly",
    axis: "cdn",
    value: "Fastly",
    strength: "fuerte",
    test: (ctx) =>
      headersPresent(ctx, "x-served-by", "x-cache", "x-cache-hits") +
      (headerIncludes(ctx, "via", "varnish") ? 1 : 0),
  },
  {
    id: "cdn.akamai",
    axis: "cdn",
    value: "Akamai",
    strength: "fuerte",
    unequivocal: true, // headers x-akamai-* son exclusivos de Akamai
    test: (ctx) =>
      headersPresent(ctx, "x-akamai-transformed", "x-akamai-request-id", "x-check-cacheable"),
  },
  {
    id: "cdn.cloudfront",
    axis: "cdn",
    value: "CloudFront",
    strength: "fuerte",
    unequivocal: true, // x-amz-cf-id es exclusivo de CloudFront
    test: (ctx) =>
      headersPresent(ctx, "x-amz-cf-id", "x-amz-cf-pop") +
      (headerIncludes(ctx, "via", "cloudfront") ? 1 : 0),
  },
];
