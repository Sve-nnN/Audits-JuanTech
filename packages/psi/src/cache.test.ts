import { beforeEach, describe, expect, it } from "vitest";
import { getCached, setCached, cacheKey, setPsiCacheConnection } from "./cache";
import type { PsiMetrics } from "./types";

/** Minimal in-memory fake standing in for the ioredis client (no real network). */
class FakeRedis {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, _flag: string, _ttl: number): Promise<"OK"> {
    this.store.set(key, value);
    return "OK";
  }
}

const sampleMetrics: PsiMetrics = {
  performanceScore: 81,
  lcpMs: 4876,
  cls: 0,
  inpMs: null,
  ttfbMs: 7,
};

describe("psi cache (PERF-03)", () => {
  beforeEach(() => {
    setPsiCacheConnection(new FakeRedis() as unknown as Parameters<typeof setPsiCacheConnection>[0]);
  });

  it("cacheKey namespaces by strategy + normalized url", () => {
    expect(cacheKey("https://example.com/foo/", "mobile")).toBe("psi:mobile:https://example.com/foo");
    expect(cacheKey("https://example.com/foo", "mobile")).toBe("psi:mobile:https://example.com/foo");
    expect(cacheKey("https://example.com/foo", "desktop")).not.toBe(
      cacheKey("https://example.com/foo", "mobile")
    );
  });

  it("returns null on a cache miss", async () => {
    const result = await getCached("https://example.com/", "mobile");
    expect(result).toBeNull();
  });

  it("returns the cached metrics on a hit after setCached", async () => {
    await setCached("https://example.com/", "mobile", sampleMetrics);
    const result = await getCached("https://example.com/", "mobile");
    expect(result).toEqual(sampleMetrics);
  });

  it("keeps mobile and desktop cache entries independent", async () => {
    await setCached("https://example.com/", "mobile", sampleMetrics);
    const desktopResult = await getCached("https://example.com/", "desktop");
    expect(desktopResult).toBeNull();
  });

  it("reads a pre-v1.3 cache entry (no diagnostics field) without throwing", async () => {
    const redis = new FakeRedis();
    setPsiCacheConnection(redis as unknown as Parameters<typeof setPsiCacheConnection>[0]);
    // Simulates a value written by a worker running before this phase, when
    // PsiMetrics had no `diagnostics` field at all.
    await redis.set(
      cacheKey("https://example.com/legacy", "mobile"),
      JSON.stringify({ performanceScore: 81, lcpMs: 4876, cls: 0, inpMs: null, ttfbMs: 7 }),
      "EX",
      86400
    );
    const result = await getCached("https://example.com/legacy", "mobile");
    expect(result).not.toBeNull();
    expect(result?.diagnostics).toBeUndefined();
  });
});
