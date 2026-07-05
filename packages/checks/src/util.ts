import type { CheerioAPI } from "cheerio";

/**
 * Extracts visible body text for content-length / duplicate-content checks:
 * strips script/style/noscript (never "content"), collapses whitespace.
 */
export function extractVisibleText($: CheerioAPI): string {
  const $body = $("body").clone();
  $body.find("script, style, noscript, template").remove();
  return $body.text().replace(/\s+/g, " ").trim();
}

export function wordCount(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/** Builds a stable page-level fingerprint: checkId + normalized page URL. */
export function pageFingerprint(checkId: string, url: string): string {
  return `${checkId}:${url}`;
}

/** Builds a stable site-level fingerprint: checkId + scope (e.g. a URL or fixed label). */
export function siteFingerprint(checkId: string, scope: string): string {
  return `${checkId}:${scope}`;
}
