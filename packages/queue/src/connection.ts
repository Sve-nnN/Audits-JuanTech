import IORedis, { type RedisOptions } from "ioredis";

/**
 * Creates a new ioredis connection configured for BullMQ, compatible with
 * Upstash's managed Redis (TLS-only, `rediss://` scheme).
 *
 * BullMQ requires `maxRetriesPerRequest: null` on the connection used by
 * Workers/QueueEvents/Queue (blocking commands would otherwise time out and
 * throw). `enableReadyCheck: false` avoids an extra round-trip that some
 * managed Redis providers (Upstash included) don't support well.
 *
 * TLS is enabled automatically when REDIS_URL uses the `rediss://` scheme —
 * ioredis parses this from the URL itself, but we also allow overriding via
 * an explicit `tls` option if the caller needs it.
 */
export function createRedisConnection(overrides: RedisOptions = {}): IORedis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "REDIS_URL is not set. Copy .env.example to .env and set REDIS_URL (Upstash, rediss://...)."
    );
  }

  const isTls = url.startsWith("rediss://");

  return new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...(isTls ? { tls: {} } : {}),
    ...overrides,
  });
}
