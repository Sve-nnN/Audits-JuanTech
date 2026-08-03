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

/** Minimum width, in pixels, below which the platforms ignore the image entirely. */
export const OG_IMAGE_MIN_WIDTH = 200;

/** Minimum height, in pixels, below which the platforms ignore the image entirely. */
export const OG_IMAGE_MIN_HEIGHT = 200;

/** Width below which the share preview renders as a small thumbnail instead of a large image. */
export const OG_IMAGE_SMALL_WIDTH = 600;

/** Height below which the share preview renders as a small thumbnail instead of a large image. */
export const OG_IMAGE_SMALL_HEIGHT = 315;

/**
 * The aspect ratio the three major platforms recommend (1.91:1).
 *
 * It exists for the wording of the recommendation and is **not** used in any
 * comparison: the verdict is decided by the two explicit band ends below.
 */
export const OG_IMAGE_TARGET_RATIO = 1.91;

/**
 * Lower end of the accepted width/height band.
 *
 * The band is declared as two explicit ends and never as "the target ratio
 * plus or minus a tolerance": a subtraction in floating point makes the end of
 * a tolerance not exactly representable, so the verdict of an image landing
 * right on that end would be undefined. With two ends the comparison is a
 * plain strict less-than / greater-than and both exact ends pass.
 *
 * The band accepts the three recommended proportions (1200x630 = 1.9048,
 * 1200x628 = 1.9108, 1200x627 = 1.9139) and also 16:9 (1.7778), which a large
 * part of the CMS universe serves by default and penalising it would be a
 * massive false positive. It rejects square (1.0) and 4:3 (1.333).
 */
export const OG_IMAGE_RATIO_MIN = 1.7;

/** Upper end of the accepted width/height band. See `OG_IMAGE_RATIO_MIN`. */
export const OG_IMAGE_RATIO_MAX = 2.1;

/**
 * Weight above which a social image is reported as heavier than recommended.
 *
 * The limits of the requirement ("1MB" / "5MB") are read in binary units, the
 * ones filesystem tooling uses, so the constants are round products of powers
 * of two. The ceiling below corresponds to the **strictest** platform limit (X
 * and LinkedIn, 5 MB), not to Facebook's, which is higher (8 MB).
 */
export const OG_IMAGE_HEAVY_BYTES = 1 * 1_024 * 1_024;

/** Weight above which the strictest platforms reject the image outright. */
export const OG_IMAGE_MAX_BYTES = 5 * 1_024 * 1_024;
