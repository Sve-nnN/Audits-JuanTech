import * as cheerio from "cheerio";
import { extractMetaSocial, firstValue, TWITTER_CARD_VALUES } from "@auditor/meta-social";
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
 * HTML. Pure: no network, no Prisma, no React. `pageId` and `imageStatus` are
 * resolved by the caller (`buildReportModel`), which is the only place that
 * knows the page row and the IMG-01 verdicts.
 *
 * The Open Graph values come from `@auditor/meta-social` — the single parsing
 * engine of the social category — but the native `<title>` and
 * `<meta name="description">` are read here, because that package deliberately
 * only collects the `og:`/`twitter:` prefixes.
 */
export function extractSocialPreview(
  html: string,
  pageUrl: string
): Omit<SocialPreviewData, "pageId" | "imageStatus"> {
  const $ = cheerio.load(html);
  const data = extractMetaSocial($);

  const ogTitle = firstValue(data, "og:title");
  const ogDescription = firstValue(data, "og:description");
  const nativeTitle = $("title").first().text().trim() || null;
  const nativeDescription =
    $('meta[name="description"]').first().attr("content")?.trim() || null;

  const title = cap(ogTitle ?? nativeTitle);
  const description = cap(ogDescription ?? nativeDescription);
  const ogImage = firstValue(data, "og:image") ?? null;
  const twitterCard = firstValue(data, "twitter:card");

  return {
    pageUrl,
    domain: hostnameOf(pageUrl),
    title,
    ogTitleDeclared: ogTitle !== undefined,
    description,
    ogDescriptionDeclared: ogDescription !== undefined,
    ogImage,
    ogUrlDeclared: firstValue(data, "og:url") !== undefined,
    ogTypeDeclared: firstValue(data, "og:type") !== undefined,
    twitterCardDeclared: twitterCard ?? null,
    twitterCardVariant: resolveTwitterCardVariant(twitterCard),
    // Misma regla de respaldo OG→Twitter que ya codifica SOCIAL-07
    // (`twitterCard.ts`): X recurre a Open Graph cuando falta su etiqueta, y
    // reescribirla distinto acá haría que el panel y el issue se contradigan.
    twitterTitle: cap(firstValue(data, "twitter:title") ?? null) ?? title,
    twitterDescription: cap(firstValue(data, "twitter:description") ?? null) ?? description,
    twitterImage: firstValue(data, "twitter:image") ?? ogImage,
    fixSnippet: null,
  };
}
