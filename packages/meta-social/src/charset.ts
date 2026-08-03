/**
 * Charset declaration position (SOCIAL-08) — measured on real bytes.
 *
 * Why the window is counted in bytes and never in characters: the HTML
 * standard puts the declaration inside the first kilobyte of the *served
 * document*, and a JavaScript string counts UTF-16 units, not bytes. A page
 * that ships accented Spanish copy or emoji ahead of the declaration measures
 * well below its real size when counted that way, so a document the standard
 * places outside the window would silently pass. Same rigor Phase 28 applied
 * to the HTML weight metric.
 *
 * Known limitation of re-encoding: `page.html` reaches us already decoded by
 * the crawl, and the original transport encoding is not persisted, so
 * re-encoding to UTF-8 reproduces the served bytes only for documents that
 * were served as UTF-8. The bias is conservative: UTF-8 never yields fewer
 * bytes than Latin-1 for the same text, so the possible error is reporting a
 * problem that is not there, never missing one that is.
 *
 * Accepted approximation: the pattern accepts any meta tag carrying the
 * charset token inside the window, so an unrelated meta tag that mentions it
 * in its content would read as a declaration. That is a deliberate trade for a
 * backtracking-free pattern (T-30-03), and no test pins it as desired
 * behaviour.
 */

/** Byte window the charset declaration must fall inside, per the HTML standard. */
export const CHARSET_WINDOW_BYTES = 1024;

/**
 * Matches both declaration forms: the direct charset attribute and the
 * `http-equiv` form carrying the charset parameter in its content. The
 * negated class stops at the tag close and carries a single simple
 * quantifier, so there is no nesting and no greedy wildcard to backtrack on.
 */
const CHARSET_DECLARATION = /<meta[^>]*charset\s*=/i;

/**
 * True when the document declares its charset inside the first
 * `CHARSET_WINDOW_BYTES` UTF-8 bytes.
 */
export function hasCharsetInFirstKB(html: string): boolean {
  const buf = Buffer.from(html, "utf8");
  // The pattern only ever sees the trimmed window: that is at once the check's
  // criterion and the mitigation that keeps matching cost independent of the
  // document size on adversarial minified HTML (T-30-03).
  const head = buf.subarray(0, CHARSET_WINDOW_BYTES).toString("utf8");
  return CHARSET_DECLARATION.test(head);
}
