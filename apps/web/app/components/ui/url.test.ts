import { describe, it, expect } from "vitest";
import { shortUrl, issueUrl } from "./url";

describe("shortUrl", () => {
  it("returns em dash for null", () => {
    expect(shortUrl(null)).toBe("—");
  });

  it("shows only the path for an internal link (host matches siteHost)", () => {
    expect(shortUrl("https://aprendoclub.com/pricing", "aprendoclub.com")).toBe("/pricing");
  });

  it("treats www. as the same host when matching internal links", () => {
    expect(shortUrl("https://www.aprendoclub.com/pricing", "aprendoclub.com")).toBe("/pricing");
    expect(shortUrl("https://aprendoclub.com/x", "www.aprendoclub.com")).toBe("/x");
  });

  it("shows host + path for an external link so it is not misread as internal", () => {
    // The reported bug: a LinkedIn link rendered as a bare "/in/juan".
    expect(shortUrl("https://www.linkedin.com/in/juancangulo", "aprendoclub.com")).toBe(
      "linkedin.com/in/juancangulo"
    );
  });

  it("shows just the host for an external root link (no redundant trailing slash)", () => {
    expect(shortUrl("https://example.com/", "aprendoclub.com")).toBe("example.com");
  });

  it("without siteHost, shows host + path (external-style) for every URL", () => {
    expect(shortUrl("https://aprendoclub.com/pricing")).toBe("aprendoclub.com/pricing");
  });

  it("falls back to a truncated raw string for a non-URL", () => {
    expect(shortUrl("not a url")).toBe("not a url");
  });
});

describe("issueUrl", () => {
  it("keeps the leading URL, dropping an appended '(enlazado desde X)' note", () => {
    expect(
      issueUrl({
        source: "https://www.linkedin.com/in/juan (enlazado desde https://aprendoclub.com/)",
        scope: null,
      })
    ).toBe("https://www.linkedin.com/in/juan");
  });

  it("falls back to scope when source is null", () => {
    expect(issueUrl({ source: null, scope: "external-link:https://x.com/" })).toBe(
      "external-link:https://x.com/"
    );
  });
});
