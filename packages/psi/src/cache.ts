import IORedis from "ioredis";
import type { PsiMetrics, PsiStrategy } from "./types";

// TTL: 24h. Keeps repeat/near-in-time audits from re-burning the (small,
// keyless) PSI quota on the same url+strategy pair.
const CACHE_TTL_SECONDS = 24 * 60 * 60;

let sharedConnection: IORedis | undefined;

/**
 * Lazily creates (and reuses) a Redis connection dedicated to the PSI cache.
 * Mirrors `@auditor/queue`'s `createRedisConnection` TLS auto-detection
 * (Upstash requires `rediss://`), but is kept independent so `@auditor/psi`
 * has no dependency on `@auditor/queue`.
 */
function getConnection(): IORedis {
  if (sharedConnection) return sharedConnection;

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "REDIS_URL is not set. Copy .env.example to .env and set REDIS_URL (Upstash, rediss://...)."
    );
  }
  const isTls = url.startsWith("rediss://");
  sharedConnection = new IORedis(url, isTls ? { tls: {} } : {});
  return sharedConnection;
}

/** Allows tests (and graceful shutdown) to inject/reset the connection. */
export function setPsiCacheConnection(connection: IORedis | undefined): void {
  sharedConnection = connection;
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    // Strip a single trailing slash (except for the root path) so
    // `https://x.com/foo` and `https://x.com/foo/` share a cache entry.
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function cacheKey(url: string, strategy: PsiStrategy): string {
  return `psi:${strategy}:${normalizeUrl(url)}`;
}

/** Returns the cached metrics for `url` + `strategy`, or `null` on a cache miss. */
export async function getCached(url: string, strategy: PsiStrategy): Promise<PsiMetrics | null> {
  const raw = await getConnection().get(cacheKey(url, strategy));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PsiMetrics;
  } catch {
    return null;
  }
}

/** Caches `metrics` for `url` + `strategy` with a 24h TTL. */
export async function setCached(
  url: string,
  strategy: PsiStrategy,
  metrics: PsiMetrics
): Promise<void> {
  await getConnection().set(
    cacheKey(url, strategy),
    JSON.stringify(metrics),
    "EX",
    CACHE_TTL_SECONDS
  );
}
