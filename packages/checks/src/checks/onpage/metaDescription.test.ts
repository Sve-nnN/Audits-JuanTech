import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { metaDescriptionCheck } from "./metaDescription";
import { makePage } from "../../testUtils";

function run(html: string) {
  const $ = cheerio.load(html);
  const page = makePage({ url: "https://example.com/page" });
  return metaDescriptionCheck.run({ page, $ });
}

describe("metaDescriptionCheck (ONPAGE-02)", () => {
  it("flags missing meta description", () => {
    const [issue] = run("<html><head></head></html>");
    expect(issue?.severity).toBe("warning");
    expect(issue?.measuredValue).toContain("sin meta description");
  });

  it("flags a description shorter than 70 chars", () => {
    const [issue] = run('<html><head><meta name="description" content="Too short"></head></html>');
    expect(issue?.severity).toBe("warning");
  });

  it("passes a description within 70-160 chars", () => {
    const desc = "Auditoría SEO técnica completa y automatizada para detectar errores y mejorar tu posicionamiento web rápidamente.";
    expect(desc.length).toBeGreaterThanOrEqual(70);
    expect(desc.length).toBeLessThanOrEqual(160);
    const [issue] = run(`<html><head><meta name="description" content="${desc}"></head></html>`);
    expect(issue?.severity).toBe("ok");
  });
});
