import { describe, it, expect, vi, beforeEach } from "vitest";
import { makePage } from "../../testUtils";
import type { SiteCheckCtx } from "../../types";

// Mock the network layer so no real HTTP is issued — we only test how the
// check CLASSIFIES the statuses returned by checkLinks.
vi.mock("./linkChecker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./linkChecker")>();
  return { ...actual, checkLinks: vi.fn() };
});

import { checkLinks, UNVERIFIABLE_DESTINATION_REASON } from "./linkChecker";
import { brokenExternalLinksCheck } from "./brokenExternalLinks";

const mockedCheckLinks = vi.mocked(checkLinks);

function ctxWithExternalLinks(hrefs: string[]): SiteCheckCtx {
  const anchors = hrefs.map((h) => `<a href="${h}">x</a>`).join("");
  return {
    pages: [makePage({ url: "https://aprendoclub.com/", html: `<html><body>${anchors}</body></html>` })],
    origin: "https://aprendoclub.com",
    robotsTxt: null,
    sitemapUrls: [],
  } as unknown as SiteCheckCtx;
}

describe("brokenExternalLinksCheck classification", () => {
  beforeEach(() => mockedCheckLinks.mockReset());

  it("reports anti-bot / auth / paywall statuses as informational, not broken", async () => {
    const urls = [
      "https://www.linkedin.com/in/juancangulo",
      "https://kajabi.com/offers/x/checkout",
      "https://paywall.com/",
    ];
    mockedCheckLinks.mockResolvedValueOnce([
      { url: urls[0]!, ok: false, status: 999, reason: "HTTP 999" }, // LinkedIn anti-bot
      { url: urls[1]!, ok: false, status: 403, reason: "HTTP 403" }, // forbidden to bots
      { url: urls[2]!, ok: false, status: 402, reason: "HTTP 402" }, // payment required
    ]);

    const issues = await brokenExternalLinksCheck.run(ctxWithExternalLinks(urls));

    expect(issues).toHaveLength(3);
    for (const issue of issues) {
      expect(issue.severity).toBe("ok");
      expect(issue.title).toBe("Enlace externo no verificable");
    }
  });

  it("still flags genuinely broken statuses (404/5xx) as warning", async () => {
    const urls = ["https://example.com/gone", "https://example.com/boom"];
    mockedCheckLinks.mockResolvedValueOnce([
      { url: urls[0]!, ok: false, status: 404, reason: "HTTP 404" },
      { url: urls[1]!, ok: false, status: 500, reason: "HTTP 500" },
    ]);

    const issues = await brokenExternalLinksCheck.run(ctxWithExternalLinks(urls));

    expect(issues).toHaveLength(2);
    for (const issue of issues) {
      expect(issue.severity).toBe("warning");
      expect(issue.title).toBe("Enlace externo roto");
    }
  });

  it("reports a destination rejected by the guard as informational, never as broken", async () => {
    const urls = ["http://169.254.169.254/latest/meta-data/"];
    mockedCheckLinks.mockResolvedValueOnce([
      { url: urls[0]!, ok: false, status: null, reason: UNVERIFIABLE_DESTINATION_REASON },
    ]);

    const issues = await brokenExternalLinksCheck.run(ctxWithExternalLinks(urls));

    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("ok");
    expect(issues[0]!.title).toBe("Enlace externo no verificable por destino");
    expect(issues.filter((i) => i.title === "Enlace externo roto")).toHaveLength(0);
  });

  it("keeps the guard-rejected row and a broken row on separate fingerprints", async () => {
    const urls = ["http://10.0.0.5/internal", "https://example.com/gone"];
    mockedCheckLinks.mockResolvedValueOnce([
      { url: urls[0]!, ok: false, status: null, reason: UNVERIFIABLE_DESTINATION_REASON },
      { url: urls[1]!, ok: false, status: 404, reason: "HTTP 404" },
    ]);

    const issues = await brokenExternalLinksCheck.run(ctxWithExternalLinks(urls));

    expect(issues).toHaveLength(2);
    expect(new Set(issues.map((i) => i.fingerprint)).size).toBe(2);
    expect(issues.map((i) => i.severity)).toEqual(["ok", "warning"]);
  });

  it("does not emit anything for links that resolve ok", async () => {
    const urls = ["https://example.com/fine"];
    mockedCheckLinks.mockResolvedValueOnce([{ url: urls[0]!, ok: true, status: 200 }]);

    const issues = await brokenExternalLinksCheck.run(ctxWithExternalLinks(urls));

    expect(issues).toHaveLength(0);
  });
});
