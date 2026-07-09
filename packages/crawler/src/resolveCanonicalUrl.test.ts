import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveCanonicalUrl } from "./resolveCanonicalUrl";

/** Builds a minimal fetch Response stand-in exposing the fields we read. */
function fakeResponse(finalUrl: string, status = 200): Response {
  return { url: finalUrl, status, ok: status < 400 } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("resolveCanonicalUrl", () => {
  it("returns the real finalUrl when https redirects to www", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse("https://www.example.com/"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCanonicalUrl("example.com");

    expect(result).toBe("https://www.example.com/");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({ method: "GET", redirect: "follow" }),
    );
  });

  it("sends the auditor User-Agent (WR-02)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(fakeResponse("https://www.example.com/"));
    vi.stubGlobal("fetch", fetchMock);

    await resolveCanonicalUrl("example.com");

    const opts = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((opts.headers as Record<string, string>)["user-agent"]).toMatch(/AuditorBot/);
  });

  it("returns null when the home redirects to a different registrable domain (WR-04)", async () => {
    // A parking page / SaaS landing on another domain must not silently
    // become the audited site.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse("https://parking-service.com/expired"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCanonicalUrl("example.com");

    expect(result).toBeNull();
  });

  it("falls back to http when https fails to connect", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce(fakeResponse("http://example.com/"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCanonicalUrl("example.com");

    expect(result).toBe("http://example.com/");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://example.com", expect.anything());
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://example.com", expect.anything());
  });

  it("returns null (without throwing) when both protocols fail", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ENOTFOUND"))
      .mockRejectedValueOnce(new Error("ENOTFOUND"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCanonicalUrl("nope.invalid");

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null when both protocols abort by timeout", async () => {
    // Simulate the AbortController firing: fetch rejects with an AbortError.
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(abortError)
      .mockRejectedValueOnce(abortError);
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCanonicalUrl("slow.example.com");

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("accepts a non-2xx response as a valid canonical URL (no 2xx requirement)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse("https://example.com/", 403));
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCanonicalUrl("example.com");

    expect(result).toBe("https://example.com/");
  });

  it("normalizes the input host (strips protocol, www and trailing slash)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse("https://www.example.com/"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCanonicalUrl("https://www.example.com/");

    expect(result).toBe("https://www.example.com/");
    expect(fetchMock).toHaveBeenCalledWith("https://example.com", expect.anything());
  });
});
