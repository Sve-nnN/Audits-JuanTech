import robotsParser from "robots-parser";

export const DEFAULT_USER_AGENT = "AuditorBot/1.0 (+https://juan-tech.com)";

const ROBOTS_FETCH_TIMEOUT_MS = 10_000;

// `robots-parser`'s .d.ts declares an ambient (non-exported) `Robot`
// interface — derive the type from the function's return value instead.
type Robot = ReturnType<typeof robotsParser>;

type RobotsEntry =
  | { kind: "allow-all" }
  | { kind: "disallow-all" }
  | { kind: "parsed"; robot: Robot };

/** Per-origin robots.txt cache so we only fetch it once per crawl. */
const cache = new Map<string, Promise<RobotsEntry>>();

function originOf(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

async function fetchRobots(origin: string): Promise<RobotsEntry> {
  const robotsUrl = `${origin}/robots.txt`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROBOTS_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(robotsUrl, { signal: controller.signal });

    if (res.status === 404) {
      // No robots.txt at all: no restrictions (RFC 9309 / Google convention).
      return { kind: "allow-all" };
    }

    if (res.status >= 500) {
      // Server error fetching robots.txt: fail-closed conservatively —
      // we can't confirm what's allowed, so don't crawl this origin yet.
      return { kind: "disallow-all" };
    }

    if (!res.ok) {
      // Other 4xx: per RFC 9309 convention, treated as "no robots.txt" -> allow all.
      return { kind: "allow-all" };
    }

    const body = await res.text();
    return { kind: "parsed", robot: robotsParser(robotsUrl, body) };
  } catch {
    // Network error / timeout: fail-closed conservatively.
    return { kind: "disallow-all" };
  } finally {
    clearTimeout(timeout);
  }
}

function getRobotsEntry(origin: string): Promise<RobotsEntry> {
  let entry = cache.get(origin);
  if (!entry) {
    entry = fetchRobots(origin);
    cache.set(origin, entry);
  }
  return entry;
}

/** Clears the per-origin robots.txt cache. Mainly useful for tests. */
export function resetRobotsCache(): void {
  cache.clear();
}

/**
 * Returns true if `url` may be fetched by `userAgent` per the origin's
 * robots.txt. Fetches + caches robots.txt per origin on first use.
 */
export async function isAllowed(
  url: string,
  userAgent: string = DEFAULT_USER_AGENT
): Promise<boolean> {
  const origin = originOf(url);
  const entry = await getRobotsEntry(origin);

  switch (entry.kind) {
    case "allow-all":
      return true;
    case "disallow-all":
      return false;
    case "parsed": {
      const allowed = entry.robot.isAllowed(url, userAgent);
      // robots-parser returns `undefined` when it can't determine (treat as allowed).
      return allowed !== false;
    }
  }
}

/** Returns the `Sitemap:` directives declared in the origin's robots.txt, if any. */
export async function getSitemapsFromRobots(origin: string): Promise<string[]> {
  const entry = await getRobotsEntry(origin);
  if (entry.kind !== "parsed") return [];
  const sitemaps = entry.robot.getSitemaps();
  return Array.isArray(sitemaps) ? sitemaps : [];
}
