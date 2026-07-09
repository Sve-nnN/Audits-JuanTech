/** Page template a URL is classified into (TEMPLATE-01). */
export type PageTemplate = "home" | "category" | "product" | "article" | "other";

/** Display order for template groups (Claude's discretion per 19-CONTEXT.md). */
export const TEMPLATE_ORDER: PageTemplate[] = ["home", "category", "product", "article", "other"];

/** Full-segment match, case-insensitive. Order within the array is irrelevant (Set membership). */
const PRODUCT_SEGMENTS = new Set(["producto", "product", "p"]);
const CATEGORY_SEGMENTS = new Set(["categoria", "category", "c", "coleccion", "collection"]);
const ARTICLE_SEGMENTS = new Set(["blog", "articulo", "article", "post", "noticias", "news"]);

/**
 * Classify a page URL into a `PageTemplate` via a pure URL-segment heuristic
 * (TEMPLATE-01, locked in 19-CONTEXT.md — "Clasificador de plantilla"). No CMS
 * assumption: matches full path segments (case-insensitive) against known
 * product/category/article vocabularies, never substrings.
 *
 * - Empty path (or just `/`) -> "home".
 * - Any segment exactly matching a product term (producto/product/p) -> "product".
 * - Else any segment exactly matching a category term (categoria/category/c/
 *   coleccion/collection) -> "category".
 * - Else any segment exactly matching an article term (blog/articulo/article/
 *   post/noticias/news) -> "article".
 * - Otherwise -> "other".
 *
 * Match priority when multiple candidate segments are present: product >
 * category > article (first-scanned matching set wins) — distinct from
 * `TEMPLATE_ORDER`, which is only the display order.
 *
 * Never throws (T-19-01): a malformed/adversarial `url` string (already
 * persisted `issue.source`, from a third-party crawled site) degrades to
 * "other" instead of crashing `buildReportModel`.
 */
export function classifyTemplate(url: string): PageTemplate {
  let segments: string[];
  try {
    const parsed = new URL(url);
    segments = parsed.pathname
      .split("/")
      .filter((s) => s.length > 0)
      .map((s) => s.toLowerCase());
  } catch {
    return "other";
  }

  if (segments.length === 0) return "home";

  if (segments.some((s) => PRODUCT_SEGMENTS.has(s))) return "product";
  if (segments.some((s) => CATEGORY_SEGMENTS.has(s))) return "category";
  if (segments.some((s) => ARTICLE_SEGMENTS.has(s))) return "article";

  return "other";
}
