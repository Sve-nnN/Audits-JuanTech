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
 * Attribute-aware, not a bare substring match (fix for the false negatives
 * found in Phase 30 verification, WR-01): the declaration is only accepted
 * when `charset` is an actual attribute name on a `<meta>` tag, or when it
 * appears inside the `content` attribute of a `<meta http-equiv="Content-Type">`
 * tag specifically — never merely because the substring `charset=` shows up
 * anywhere inside a tag (e.g. inside an unrelated `content="..."` value, or
 * inside an HTML comment, both of which used to read as a declaration).
 */

/** Byte window the charset declaration must fall inside, per the HTML standard. */
export const CHARSET_WINDOW_BYTES = 1024;

/** Strips HTML comments before tag matching, so a commented-out declaration cannot count. */
const COMMENT_PATTERN = /<!--[\s\S]*?-->/g;

/** Extracts whole `<meta ...>` tags from the (comment-stripped) window. */
const META_TAG_PATTERN = /<meta\b[^>]*>/gi;

/** Extracts `name="value"` / `name='value'` attribute pairs from a single tag. */
const ATTR_PATTERN = /([a-zA-Z0-9-]+)\s*=\s*"([^"]*)"|([a-zA-Z0-9-]+)\s*=\s*'([^']*)'/g;

function parseMetaAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTR_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR_PATTERN.exec(tag))) {
    const name = (match[1] ?? match[3])?.toLowerCase();
    const value = match[2] ?? match[4] ?? "";
    if (name) attrs[name] = value;
  }
  return attrs;
}

/**
 * True when the document declares its charset inside the first
 * `CHARSET_WINDOW_BYTES` UTF-8 bytes, via an actual `charset` attribute or a
 * `http-equiv="Content-Type"` meta's `content` parameter — not via a bare
 * substring match anywhere in the tag.
 */
export function hasCharsetInFirstKB(html: string): boolean {
  const buf = Buffer.from(html, "utf8");
  // The pattern only ever sees the trimmed window: that is at once the check's
  // criterion and the mitigation that keeps matching cost independent of the
  // document size on adversarial minified HTML (T-30-03).
  const head = buf.subarray(0, CHARSET_WINDOW_BYTES).toString("utf8");
  const withoutComments = head.replace(COMMENT_PATTERN, "");
  const tags = withoutComments.match(META_TAG_PATTERN) ?? [];

  for (const tag of tags) {
    const attrs = parseMetaAttrs(tag);
    if (attrs.charset !== undefined) return true;
    if (attrs["http-equiv"]?.toLowerCase() === "content-type" && attrs.content && /charset\s*=/i.test(attrs.content)) {
      return true;
    }
  }
  return false;
}
