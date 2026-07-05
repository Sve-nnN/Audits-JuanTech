import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { canonicalCheck } from "./canonical";
import { makePage } from "../../testUtils";

function run(html: string, url = "https://example.com/page") {
  const $ = cheerio.load(html);
  const page = makePage({ url });
  return canonicalCheck.run({ page, $ });
}

describe("canonicalCheck (TECH-04)", () => {
  it("flags missing canonical", () => {
    const [issue] = run("<html><head></head></html>");
    expect(issue?.severity).toBe("warning");
    expect(issue?.measuredValue).toContain("sin canonical");
  });

  it("flags multiple canonical tags", () => {
    const [issue] = run(
      '<html><head><link rel="canonical" href="https://example.com/page"><link rel="canonical" href="https://example.com/other"></head></html>'
    );
    expect(issue?.severity).toBe("warning");
    expect(issue?.title).toContain("Múltiples");
  });

  it("flags a canonical pointing elsewhere", () => {
    const [issue] = run('<html><head><link rel="canonical" href="https://example.com/other-page"></head></html>');
    expect(issue?.severity).toBe("warning");
    expect(issue?.title).toContain("otra URL");
  });

  it("passes a self-referencing canonical", () => {
    const [issue] = run('<html><head><link rel="canonical" href="https://example.com/page"></head></html>');
    expect(issue?.severity).toBe("ok");
  });
});
