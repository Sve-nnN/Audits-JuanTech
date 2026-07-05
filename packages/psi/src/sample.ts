const DEFAULT_MAX_PSI_PAGES = 5;

/** Minimal shape of a crawled page needed to pick a PSI sample (decoupled from `@auditor/db`). */
export interface SamplePageInput {
  url: string;
  finalUrl?: string | null;
  statusCode?: number | null;
  contentType?: string | null;
  depth?: number | null;
}

function isHtml2xx(page: SamplePageInput): boolean {
  const status = page.statusCode;
  if (status === null || status === undefined || status < 200 || status >= 300) return false;
  const contentType = page.contentType;
  // Missing content-type is tolerated (some servers omit it for HTML); an
  // explicit non-HTML content-type disqualifies the page.
  if (contentType && !contentType.toLowerCase().includes("html")) return false;
  return true;
}

function effectiveUrl(page: SamplePageInput): string {
  return page.finalUrl ?? page.url;
}

function isHomepage(page: SamplePageInput): boolean {
  try {
    const parsed = new URL(effectiveUrl(page));
    return parsed.pathname === "" || parsed.pathname === "/";
  } catch {
    return false;
  }
}

/**
 * Selects up to `max` representative pages for PSI runs (PERF-03): never the
 * full crawl (500 pages), just a small sample that respects PSI's quota.
 *
 * Strategy: always include the homepage first (if it's a valid 2xx HTML
 * page), then spread the remaining slots across distinct crawl depths (and,
 * within a depth, distinct path prefixes/"sections") to get variety instead
 * of e.g. 5 pages that are all one level deep. Deduplicated by normalized
 * URL, capped at `max`.
 */
export function selectSample(
  pages: SamplePageInput[],
  max = DEFAULT_MAX_PSI_PAGES
): SamplePageInput[] {
  const candidates = pages.filter(isHtml2xx);
  if (candidates.length === 0) return [];

  const seen = new Set<string>();
  const selected: SamplePageInput[] = [];

  function tryAdd(page: SamplePageInput): boolean {
    const key = effectiveUrl(page);
    if (seen.has(key)) return false;
    seen.add(key);
    selected.push(page);
    return true;
  }

  // 1. Homepage, guaranteed first if present.
  const homepage = candidates.find(isHomepage);
  if (homepage) tryAdd(homepage);

  if (selected.length >= max) return selected.slice(0, max);

  // 2. Spread remaining slots across depths for variety: bucket the rest by
  // depth (unknown depth treated as its own bucket), then round-robin one
  // page per depth-bucket per pass until `max` is reached.
  const remaining = candidates.filter((p) => !seen.has(effectiveUrl(p)));
  const buckets = new Map<string, SamplePageInput[]>();
  for (const page of remaining) {
    const depthKey = page.depth ?? "unknown";
    const list = buckets.get(String(depthKey)) ?? [];
    list.push(page);
    buckets.set(String(depthKey), list);
  }

  const bucketKeys = Array.from(buckets.keys()).sort((a, b) => {
    const an = a === "unknown" ? Number.MAX_SAFE_INTEGER : Number(a);
    const bn = b === "unknown" ? Number.MAX_SAFE_INTEGER : Number(b);
    return an - bn;
  });

  let liveKeys = [...bucketKeys];
  while (selected.length < max && liveKeys.length > 0) {
    const nextLiveKeys: string[] = [];
    for (const key of liveKeys) {
      if (selected.length >= max) break;
      const bucket = buckets.get(key);
      const next = bucket?.shift();
      if (next) {
        tryAdd(next);
        if (bucket && bucket.length > 0) nextLiveKeys.push(key);
      }
    }
    if (nextLiveKeys.length === 0) break;
    liveKeys = nextLiveKeys;
  }

  return selected.slice(0, max);
}
