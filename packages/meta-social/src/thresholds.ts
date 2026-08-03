/**
 * Calibratable length thresholds for the `social` check category.
 *
 * These are deliberately different from the on-page `<title>` thresholds
 * (30-60): a social headline is truncated earlier in the share preview of the
 * major platforms than a title is in a search result, so the lower bound is
 * looser and the upper bound is a preview-truncation ceiling rather than a
 * SERP one.
 *
 * This file is the single home for the category's thresholds because Phase 32
 * reuses them to paint the preview panel with exactly the same criterion the
 * checks score against. No check file redeclares a threshold of its own.
 */

/** Minimum recommended og:title length, in characters of the trimmed value. */
export const OG_TITLE_MIN = 10;

/** Maximum recommended og:title length, in characters of the trimmed value. */
export const OG_TITLE_MAX = 60;

/**
 * Minimum recommended og:description length, in characters of the trimmed
 * value. Deliberately different from the on-page meta description range
 * (70-160): the social share preview and the search result snippet do not cut
 * at the same point, so reusing the search numbers would score the social
 * summary against a ceiling that no share preview enforces.
 */
export const OG_DESC_MIN = 55;

/** Maximum recommended og:description length, in characters of the trimmed value. */
export const OG_DESC_MAX = 200;

/**
 * Single cap for any fragment of site-controlled text a `social` check copies
 * into an issue's measured value.
 *
 * It lives here, not inside each check, for two reasons. One audit writes one
 * row per page across up to 500 pages, so a hostile value of arbitrary length
 * is amplified five hundred times in the database. And Phase 32 paints that
 * same text in the preview panel, so the cap has to be one number shared by
 * the whole category instead of four numbers that drift apart on the first
 * recalibration. Every check in the category imports this constant; none
 * declares a cap of its own.
 */
export const MAX_MEASURED_VALUE_CHARS = 80;

/**
 * The four card values X currently accepts, in the order the vocabulary
 * documents them.
 *
 * It lives here and not inside the check because Phase 32 paints the social
 * preview against exactly this list: a copy redeclared in the check file
 * guarantees that the panel and the issue end up contradicting each other.
 *
 * The retired values `photo`, `gallery` and `product` are deliberately absent,
 * so a page still declaring one of them is reported as not admitted. That
 * retirement is assumption A1 of the phase research — ecosystem knowledge, not
 * a fact verified against an official source, because X also retired its
 * public card validator and left no automatable oracle behind.
 *
 * The type annotation is explicit and not a const assertion on purpose: the
 * check compares against a plain `string` read from the audited site, and a
 * tuple of literals would fail the typecheck on that comparison.
 */
export const TWITTER_CARD_VALUES: readonly string[] = [
  "summary",
  "summary_large_image",
  "app",
  "player",
];
