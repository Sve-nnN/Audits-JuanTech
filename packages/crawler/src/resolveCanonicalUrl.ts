/**
 * Resolves the canonical entry URL for a domain before a crawl starts.
 *
 * Motivation: if the crawl seeds from the wrong origin (e.g. `https://example.com`
 * when the site actually lives on `https://www.example.com/`), discovery can start
 * from a redirect target that yields an empty graph. This helper probes the domain
 * over `https` first, falls back to `http` if https cannot connect, follows redirects
 * on a GET to the home page, and returns the real final URL the server reports.
 *
 * Returns `null` when neither protocol responds (never throws), so callers can decide
 * how to handle a fully unreachable host.
 */

/**
 * Per-candidate network timeout. Kept aligned with the worker's
 * `ROBOTS_FETCH_TIMEOUT_MS` (10s): a bounded abort so a hung host can't block the
 * worker (threat T-21-01, DoS mitigation).
 */
const RESOLVE_TIMEOUT_MS = 10_000;

/** Candidate schemes, in preference order. */
const SCHEMES = ["https", "http"] as const;

/** Strips protocol, path, query, and a leading `www.` to get a bare host. */
function toBareHost(domain: string): string {
  let host = domain.trim();
  // Drop an explicit scheme if the caller passed a full URL.
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  // Drop everything from the first path/query/fragment separator onward.
  host = host.replace(/[/?#].*$/, "");
  // Drop a leading `www.` so bare→www redirects resolve to the true canonical host.
  host = host.replace(/^www\./i, "");
  return host.toLowerCase();
}

/**
 * Resolves the canonical URL of `domain`.
 *
 * Discretion (per plan): uses `GET` (more reliable than HEAD for following home-page
 * redirects) and accepts ANY response that isn't a network error — a home returning
 * 403/500 still yields a valid canonical URL to crawl, so we don't require a 2xx.
 * The result is the raw `res.url` reported by the server after redirects; it is
 * intentionally NOT run through `normalizeUrl`.
 */
export async function resolveCanonicalUrl(domain: string): Promise<string | null> {
  const host = toBareHost(domain);
  if (host === "") return null;

  for (const scheme of SCHEMES) {
    const url = `${scheme}://${host}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeout);
      // Any non-network-error response gives us a usable canonical URL.
      return res.url;
    } catch {
      clearTimeout(timeout);
      // Network error or timeout on this scheme — try the next candidate.
    }
  }

  return null;
}
