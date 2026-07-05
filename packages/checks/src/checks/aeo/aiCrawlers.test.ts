import { describe, expect, it } from "vitest";
import { aiCrawlersCheck } from "./aiCrawlers";

const ORIGIN = "https://example.com";

describe("aiCrawlersCheck (AEO-01)", () => {
  it("reports allowed when robots.txt has no restrictions", () => {
    const robotsTxt = "User-agent: *\nAllow: /\n";
    const [issue] = aiCrawlersCheck.run({ pages: [], origin: ORIGIN, robotsTxt, sitemapUrls: [] });
    expect(issue?.severity).toBe("ok");
    expect(issue?.measuredValue).toContain("GPTBot");
  });

  it("reports denied bots when robots.txt blocks a specific AI user-agent", () => {
    const robotsTxt = "User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n";
    const [issue] = aiCrawlersCheck.run({ pages: [], origin: ORIGIN, robotsTxt, sitemapUrls: [] });
    expect(issue?.severity).toBe("warning");
    expect(issue?.measuredValue).toContain("Bloqueados: GPTBot");
    expect(issue?.measuredValue).toContain("Permitidos:");
  });

  it("reports a warning when robots.txt is not accessible", () => {
    const [issue] = aiCrawlersCheck.run({ pages: [], origin: ORIGIN, robotsTxt: null, sitemapUrls: [] });
    expect(issue?.severity).toBe("warning");
    expect(issue?.measuredValue).toContain("no accesible");
  });

  it("blocks all AI bots when disallowing all user-agents", () => {
    const robotsTxt = "User-agent: *\nDisallow: /\n";
    const [issue] = aiCrawlersCheck.run({ pages: [], origin: ORIGIN, robotsTxt, sitemapUrls: [] });
    expect(issue?.severity).toBe("warning");
    expect(issue?.measuredValue).toContain("ClaudeBot");
  });
});
