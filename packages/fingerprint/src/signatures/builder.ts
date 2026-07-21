import type { AggregatedInput, Signature } from "../types";

/**
 * Signatures del eje `builder` (FPRINT-03). Solo relevantes cuando el CMS es
 * WordPress (el motor de Plan 25-04 lo condiciona).
 *
 * `test` devuelve el CONTEO total de marcadores del builder (no un boolean):
 * el motor desempata builders por conteo (gana el de mayor número de marcas).
 *
 * REGLA DURA: Gutenberg NUNCA es un default implícito. Solo matchea con su
 * marcador POSITIVO propio (clases `wp-block-*` y comentarios `<!-- wp:`).
 * WordPress sin ningún builder matcheado => builder = no-detectado.
 */

/** Cuenta ocurrencias de un substring en el HTML (sin regex, seguro ante ReDoS). */
function countOccurrences(html: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let idx = html.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = html.indexOf(needle, idx + needle.length);
  }
  return count;
}

/** Suma cuántos de los substrings aparecen (al menos una vez) en el HTML. */
function htmlIncludes(ctx: AggregatedInput, ...needles: string[]): number {
  const html = ctx.html ?? "";
  return needles.reduce((n, needle) => n + (html.includes(needle) ? 1 : 0), 0);
}

export const builderSignatures: Signature[] = [
  {
    id: "builder.elementor",
    axis: "builder",
    value: "Elementor",
    strength: "fuerte",
    test: (ctx) =>
      ctx.$('[class*="elementor-"], [data-elementor-type], [data-elementor-id]').length +
      htmlIncludes(ctx, "/wp-content/plugins/elementor/"),
  },
  {
    id: "builder.wpbakery",
    axis: "builder",
    value: "WPBakery",
    strength: "fuerte",
    test: (ctx) =>
      ctx.$('[class*="wpb_"], .vc_row, [class*="vc_"]').length +
      htmlIncludes(ctx, "js_composer"),
  },
  {
    id: "builder.divi",
    axis: "builder",
    value: "Divi",
    strength: "fuerte",
    test: (ctx) =>
      ctx.$('[class*="et_pb_"]').length +
      htmlIncludes(ctx, "/et-builder/", "/Divi/"),
  },
  {
    id: "builder.gutenberg",
    axis: "builder",
    value: "Gutenberg",
    strength: "fuerte",
    // Marcador POSITIVO: clases wp-block-* y comentarios de bloque <!-- wp:.
    // Sin estas marcas, Gutenberg NO se reporta (nunca default de WordPress).
    test: (ctx) =>
      ctx.$('[class*="wp-block-"]').length + countOccurrences(ctx.html ?? "", "<!-- wp:"),
  },
];
