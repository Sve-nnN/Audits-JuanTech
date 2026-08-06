import * as cheerio from "cheerio";
import {
  buildFixSnippet,
  extractMetaSocial,
  firstValue,
  TWITTER_CARD_VALUES,
  type FixSnippetField,
} from "@auditor/meta-social";
import type { SocialPreviewData } from "./model";

/**
 * Defensive cap on the site-controlled text that reaches the RSC payload of the
 * preview panel (mitigation T-32-02). It is deliberately NOT the
 * `MAX_MEASURED_VALUE_CHARS` (80) of `@auditor/meta-social`: that one caps the
 * compact measured value of an issue row, while this is the full preview text
 * a reader is meant to see truncated by the layout, not by the model.
 */
const PREVIEW_TEXT_MAX_CHARS = 500;

function cap(value: string | null): string | null {
  if (value == null) return null;
  return value.length > PREVIEW_TEXT_MAX_CHARS ? value.slice(0, PREVIEW_TEXT_MAX_CHARS) : value;
}

/**
 * The layout X actually renders. Only an explicit, admitted
 * `summary_large_image` widens the card: an absent, invalid, or explicitly
 * `summary` value all paint the small variant, which is what the real clients
 * assume by default. Nunca se fuerza `summary_large_image`.
 */
function resolveTwitterCardVariant(
  card: string | undefined
): "summary" | "summary_large_image" {
  if (!card) return "summary";
  const normalized = card.trim().toLowerCase();
  if (!TWITTER_CARD_VALUES.includes(normalized)) return "summary";
  return normalized === "summary_large_image" ? "summary_large_image" : "summary";
}

/**
 * Alcance del snippet de fix (FIX-01/02), resuelto acá y en ningún otro lado.
 *
 * Cubre EXACTAMENTE 5 etiquetas y sólo cuando están AUSENTES. Nunca por
 * longitud fuera de rango: esos casos ya tienen su propia fila de issue, y
 * reescribir un título real del usuario sería editorializar su contenido.
 *
 * `og:image` queda fuera a propósito: no existe ninguna URL de imagen real que
 * se pueda prellenar, e inventarla violaría la regla de que el snippet nunca
 * es un template con placeholders. `SOCIAL-06` (duplicados) y `SOCIAL-08`
 * (charset) tampoco entran: la copy fija del panel describe agregar una
 * etiqueta nueva, no resolver un conflicto entre dos existentes ni una
 * declaración de encoding sensible a la posición.
 */
function collectFixFields(
  data: Omit<SocialPreviewData, "pageId" | "imageStatus" | "twitterImageStatus" | "fixSnippet">
): FixSnippetField[] {
  const fields: FixSnippetField[] = [];

  // Sólo se ofrece un valor que la página ya tiene: si no hay ni og:title ni
  // <title>, no hay nada real que proponer y el campo se omite.
  if (!data.ogTitleDeclared && data.title != null) {
    fields.push({ tag: "og:title", value: data.title });
  }
  if (!data.ogDescriptionDeclared && data.description != null) {
    fields.push({ tag: "og:description", value: data.description });
  }
  if (!data.ogUrlDeclared) {
    fields.push({ tag: "og:url", value: data.pageUrl });
  }
  // Default técnico estándar de Open Graph, no contenido inventado del sitio.
  if (!data.ogTypeDeclared) {
    fields.push({ tag: "og:type", value: "website" });
  }
  const card = data.twitterCardDeclared?.trim().toLowerCase();
  if (card == null || !TWITTER_CARD_VALUES.includes(card)) {
    fields.push({
      tag: "twitter:card",
      value: data.ogImage ? "summary_large_image" : "summary",
    });
  }

  return fields;
}

/** Hostname of the crawled page URL. Never throws: a bad URL degrades to `""`. */
function hostnameOf(pageUrl: string): string {
  try {
    return new URL(pageUrl).hostname;
  } catch {
    return "";
  }
}

/**
 * Derive everything the preview panel paints for a single page from its stored
 * HTML. Pure: no network, no Prisma, no React. `pageId`, `imageStatus` and
 * `twitterImageStatus` are resolved by the caller (`buildReportModel`), which
 * is the only place that knows the page row and the IMG-01 verdicts.
 *
 * The Open Graph values come from `@auditor/meta-social` — the single parsing
 * engine of the social category — but the native `<title>` and
 * `<meta name="description">` are read here, because that package deliberately
 * only collects the `og:`/`twitter:` prefixes.
 */
export function extractSocialPreview(
  html: string,
  pageUrl: string
): Omit<SocialPreviewData, "pageId" | "imageStatus" | "twitterImageStatus"> & {
  /**
   * Raw (uncapped) URL-equality signal (WR-01, iteration 2 fix). `build.ts`
   * uses this — not a comparison of the already-capped `ogImage`/
   * `twitterImage` strings — to decide whether `twitterImageStatus` may
   * inherit `imageStatus` (IMG-01's `og:image` verdict). Comparing the
   * capped values would let two genuinely different image URLs longer than
   * `PREVIEW_TEXT_MAX_CHARS` that share an identical first-500-char prefix
   * (a real pattern for signed CDN URLs) collapse to "equal" and wrongly
   * inherit each other's verdict. Not part of the public `SocialPreviewData`
   * shape; `build.ts` strips it before constructing the final entry.
   */
  twitterImageSameAsOgImage: boolean;
} {
  const $ = cheerio.load(html);
  const data = extractMetaSocial($);

  const ogTitle = firstValue(data, "og:title");
  const ogDescription = firstValue(data, "og:description");
  const nativeTitle = $("title").first().text().trim() || null;
  const nativeDescription =
    $('meta[name="description"]').first().attr("content")?.trim() || null;

  const title = cap(ogTitle ?? nativeTitle);
  const description = cap(ogDescription ?? nativeDescription);
  // WR-01: `og:image`/`twitter:image`/`twitter:card` son valores de atributo
  // `content="..."` tan site-controlled como title/description, con la misma
  // ausencia de límite de longitud en el HTML fuente — el mismo `cap()`
  // defensivo (T-32-02) aplica acá para que ninguno de los dos bloat el
  // payload RSC ni se eco verbatim en el query string de `PreviewImage`.
  const rawOgImage = firstValue(data, "og:image") ?? null;
  const ogImage = cap(rawOgImage);
  const twitterCard = firstValue(data, "twitter:card");
  // WR-01 (iteration 2): resolve the "twitter:image falls back to og:image"
  // rule on the RAW, uncapped strings, and derive the equality signal from
  // those same raw strings — never from the capped `ogImage`/`twitterImage`
  // below, which only exist for display/storage.
  const rawTwitterImage = firstValue(data, "twitter:image") ?? rawOgImage;

  const base = {
    pageUrl,
    domain: hostnameOf(pageUrl),
    title,
    ogTitleDeclared: ogTitle !== undefined,
    description,
    ogDescriptionDeclared: ogDescription !== undefined,
    ogImage,
    ogUrlDeclared: firstValue(data, "og:url") !== undefined,
    ogTypeDeclared: firstValue(data, "og:type") !== undefined,
    twitterCardDeclared: cap(twitterCard ?? null),
    twitterCardVariant: resolveTwitterCardVariant(twitterCard),
    // Misma regla de respaldo OG→Twitter que ya codifica SOCIAL-07
    // (`twitterCard.ts`): X recurre a Open Graph cuando falta su etiqueta, y
    // reescribirla distinto acá haría que el panel y el issue se contradigan.
    twitterTitle: cap(firstValue(data, "twitter:title") ?? null) ?? title,
    twitterDescription: cap(firstValue(data, "twitter:description") ?? null) ?? description,
    twitterImage: cap(rawTwitterImage),
    twitterImageSameAsOgImage: rawTwitterImage === rawOgImage,
  };

  return { ...base, fixSnippet: buildFixSnippet(collectFixFields(base)) };
}
