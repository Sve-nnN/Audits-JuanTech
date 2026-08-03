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
