import { describe, expect, it } from "vitest";
import { normalizeUrl, registrableDomain, sameRegistrableDomain } from "./normalizeUrl";

describe("normalizeUrl", () => {
  it("lowercases protocol and hostname", () => {
    expect(normalizeUrl("HTTPS://Example.COM/Path")).toBe("https://example.com/Path");
  });

  it("strips the fragment", () => {
    expect(normalizeUrl("https://example.com/page#section")).toBe("https://example.com/page");
  });

  it("removes trailing slash except for root", () => {
    expect(normalizeUrl("https://example.com/blog/")).toBe("https://example.com/blog");
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("strips known tracking query params and sorts the rest", () => {
    const result = normalizeUrl(
      "https://example.com/page?utm_source=x&b=2&a=1&fbclid=abc"
    );
    expect(result).toBe("https://example.com/page?a=1&b=2");
  });

  it("drops default ports", () => {
    expect(normalizeUrl("https://example.com:443/page")).toBe("https://example.com/page");
    expect(normalizeUrl("http://example.com:80/page")).toBe("http://example.com/page");
  });

  it("resolves relative URLs against a base", () => {
    expect(normalizeUrl("/relative", "https://example.com/base/")).toBe(
      "https://example.com/relative"
    );
  });

  it("returns null for unparsable input", () => {
    expect(normalizeUrl("not a url")).toBeNull();
  });

  it("returns null for non-http(s) protocols", () => {
    expect(normalizeUrl("mailto:test@example.com")).toBeNull();
  });
});

describe("registrableDomain / sameRegistrableDomain", () => {
  it("strips leading www.", () => {
    expect(registrableDomain("www.example.com")).toBe("example.com");
  });

  it("keeps last two labels for a normal domain", () => {
    expect(registrableDomain("sub.example.com")).toBe("example.com");
  });

  it("matches same registrable domain across subdomains/protocols", () => {
    expect(sameRegistrableDomain("https://www.example.com/a", "https://blog.example.com/b")).toBe(
      true
    );
  });

  it("rejects different domains", () => {
    expect(sameRegistrableDomain("https://example.com", "https://example.org")).toBe(false);
  });
});
