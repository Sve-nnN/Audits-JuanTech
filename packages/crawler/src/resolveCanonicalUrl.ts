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

import { DEFAULT_USER_AGENT } from "./robots";
import { sameRegistrableDomain } from "./normalizeUrl";

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
        // WR-02: identify as the auditor bot (same UA the real crawl uses),
        // so a host that blocks undici's default UA doesn't fail-hard the whole
        // audit at the resolution gate while the crawler itself would get in.
        headers: { "user-agent": DEFAULT_USER_AGENT },
      });
      clearTimeout(timeout);
      // WR-03: drain the body so a long-lived worker doesn't retain sockets.
      await res.body?.cancel().catch(() => {});
      // WR-04: a redirect to a different registrable domain (parking pages,
      // SaaS landing) would silently audit a site the user never asked for.
      // Treat that as "not resolved" instead of crawling the wrong domain.
      if (!sameRegistrableDomain(res.url, `${scheme}://${host}`)) return null;
      // Any non-network-error response on the same site gives a usable URL.
      return res.url;
    } catch {
      clearTimeout(timeout);
      // Network error or timeout on this scheme — try the next candidate.
    }
  }

  return null;
}
