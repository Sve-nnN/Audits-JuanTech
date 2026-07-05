/**
 * URL normalization helpers used across discovery (sitemap/link-crawl) and
 * persistence (Page upsert key) so the same logical URL is never crawled or
 * stored twice under cosmetically-different forms.
 */

/** Query params that carry no page-identity signal (tracking/marketing tags). */
const TRACKING_PARAM_PATTERNS: RegExp[] = [
  /^utm_/i,
  /^gclid$/i,
  /^fbclid$/i,
  /^msclkid$/i,
  /^mc_(cid|eid)$/i,
  /^ref$/i,
  /^ref_src$/i,
  /^igshid$/i,
  /^yclid$/i,
  /^_hs(enc|mi)$/i,
  /^__hstc$/i,
  /^__hssc$/i,
];

function isTrackingParam(key: string): boolean {
  return TRACKING_PARAM_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Normalizes a URL for dedup/comparison purposes:
 * - Resolves relative URLs against `base` (if provided).
 * - Lowercases the protocol + hostname (paths/query stay case-sensitive per spec).
 * - Strips the fragment (`#...`).
 * - Removes known tracking query params, then sorts the remaining ones for a
 *   stable, canonical query string.
 * - Ensures a consistent trailing-slash form: no trailing slash unless the
 *   path is the root (`/`).
 * - Drops a default port (`:80` for http, `:443` for https).
 *
 * Returns `null` if the input cannot be parsed as a URL (even with `base`).
 */
export function normalizeUrl(url: string, base?: string): string | null {
  let parsed: URL;
  try {
    parsed = base ? new URL(url, base) : new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hash = "";

  if (
    (parsed.protocol === "http:" && parsed.port === "80") ||
    (parsed.protocol === "https:" && parsed.port === "443")
  ) {
    parsed.port = "";
  }

  // Rebuild the query string: drop tracking params, sort remaining keys.
  const keptParams: [string, string][] = [];
  for (const [key, value] of parsed.searchParams.entries()) {
    if (!isTrackingParam(key)) {
      keptParams.push([key, value]);
    }
  }
  keptParams.sort(([a], [b]) => a.localeCompare(b));
  parsed.search = "";
  for (const [key, value] of keptParams) {
    parsed.searchParams.append(key, value);
  }

  // Trailing slash normalization: strip it unless path is exactly "/".
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  }

  return parsed.toString();
}

/**
 * Extracts the "registrable domain" (eTLD+1-ish) for same-site comparison.
 *
 * This is a pragmatic heuristic (not a full Public Suffix List implementation):
 * it strips a leading `www.` and compares the last two hostname labels
 * (`example.com`, `sub.example.co.uk` -> `co.uk` would misfire on multi-part
 * TLDs, but this is acceptable for MVP same-site link-following — false
 * negatives here just mean an internal link isn't followed, not a crawl
 * safety issue).
 */
export function registrableDomain(hostname: string): string {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  const labels = host.split(".");
  if (labels.length <= 2) return host;
  return labels.slice(-2).join(".");
}

/** Returns true if `a` and `b` share the same registrable domain (see above). */
export function sameRegistrableDomain(a: string, b: string): boolean {
  try {
    const hostA = a.includes("://") ? new URL(a).hostname : a;
    const hostB = b.includes("://") ? new URL(b).hostname : b;
    return registrableDomain(hostA) === registrableDomain(hostB);
  } catch {
    return false;
  }
}
