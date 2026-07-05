import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { titleCheck } from "./title";
import { makePage } from "../../testUtils";

function run(html: string) {
  const $ = cheerio.load(html);
  const page = makePage({ url: "https://example.com/page" });
  return titleCheck.run({ page, $ });
}

describe("titleCheck (ONPAGE-01)", () => {
  it("flags missing title as critical", () => {
    const [issue] = run("<html><head></head><body></body></html>");
    expect(issue?.severity).toBe("critical");
  });

  it("flags a title shorter than 30 chars as warning", () => {
    const [issue] = run("<html><head><title>Short</title></head></html>");
    expect(issue?.severity).toBe("warning");
  });

  it("flags a generic title as warning", () => {
    const [issue] = run("<html><head><title>Home</title></head></html>");
    expect(issue?.severity).toBe("warning");
    expect(issue?.title).toContain("genérico");
  });

  it("passes a well-formed title", () => {
    const title = "Auditoría SEO técnica automatizada para tu sitio web";
    expect(title.length).toBeGreaterThanOrEqual(30);
    expect(title.length).toBeLessThanOrEqual(60);
    const [issue] = run(`<html><head><title>${title}</title></head></html>`);
    expect(issue?.severity).toBe("ok");
  });
});
