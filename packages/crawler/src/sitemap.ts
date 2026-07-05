import { gunzipSync } from "node:zlib";
import { normalizeUrl } from "./normalizeUrl";
import { getSitemapsFromRobots } from "./robots";

const SITEMAP_FETCH_TIMEOUT_MS = 15_000;
const MAX_SITEMAP_INDEX_DEPTH = 3;
const MAX_SITEMAPS_TO_FETCH = 50;

interface ParsedSitemap {
  /** True if this document looks like a `<sitemapindex>` (list of sub-sitemaps). */
  isIndex: boolean;
  /** All `<loc>` values found, regardless of document type. */
  locs: string[];
}

/**
 * Extracts `<loc>...</loc>` values via regex instead of a strict XML parser.
 * This is intentionally lenient: malformed/truncated XML still yields
 * whatever `<loc>` tags parse cleanly, satisfying "robust to malformed XML —
 * return what parses" rather than throwing and discarding everything.
 */
export function parseSitemapXml(xml: string): ParsedSitemap {
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const locs: string[] = [];
  const locRegex = /<loc>\s*([^<\s][^<]*?)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = locRegex.exec(xml)) !== null) {
    const loc = match[1]?.trim();
    if (loc) locs.push(decodeXmlEntities(loc));
  }
  return { isIndex, locs };
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** Fetches a sitemap URL, transparently gunzipping `.gz` responses. */
async function fetchSitemapText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SITEMAP_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentEncoding = res.headers.get("content-encoding") ?? "";
    const looksGzipped =
      url.toLowerCase().endsWith(".gz") ||
      contentEncoding.includes("gzip") ||
      (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b);

    if (looksGzipped) {
      try {
        return gunzipSync(buffer).toString("utf-8");
      } catch {
        // Fall through to raw text if it wasn't actually gzip despite the hint.
        return buffer.toString("utf-8");
      }
    }

    return buffer.toString("utf-8");
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Discovers all page URLs declared via sitemap(s) for `origin`, starting
 * from `Sitemap:` directives in robots.txt (or the conventional
 * `/sitemap.xml` path as fallback), recursing into nested sitemap indexes
 * (bounded depth + fetch count to avoid runaway/cyclic recursion).
 *
 * Returns an empty array if no sitemap is found or none parse — callers
 * should fall back to link-crawl discovery in that case.
 */
export async function discoverSitemapUrls(origin: string): Promise<string[]> {
  const fromRobots = await getSitemapsFromRobots(origin);
  const seedSitemaps = fromRobots.length > 0 ? fromRobots : [`${origin}/sitemap.xml`];

  const visited = new Set<string>();
  const pageUrls = new Set<string>();
  let queue: Array<{ url: string; depth: number }> = seedSitemaps.map((url) => ({
    url,
    depth: 0,
  }));
  let fetchCount = 0;

  while (queue.length > 0 && fetchCount < MAX_SITEMAPS_TO_FETCH) {
    const next = queue.shift();
    if (!next) break;
    const { url, depth } = next;

    const normalized = normalizeUrl(url) ?? url;
    if (visited.has(normalized)) continue;
    visited.add(normalized);

    fetchCount++;
    const xml = await fetchSitemapText(url);
    if (!xml) continue;

    const { isIndex, locs } = parseSitemapXml(xml);

    if (isIndex && depth < MAX_SITEMAP_INDEX_DEPTH) {
      const nextBatch = locs
        .map((loc) => ({ url: loc, depth: depth + 1 }))
        .filter((entry) => !visited.has(normalizeUrl(entry.url) ?? entry.url));
      queue = queue.concat(nextBatch);
    } else {
      for (const loc of locs) {
        const pageUrl = normalizeUrl(loc);
        if (pageUrl) pageUrls.add(pageUrl);
      }
    }
  }

  return Array.from(pageUrls);
}
