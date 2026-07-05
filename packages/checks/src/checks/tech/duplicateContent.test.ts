import { describe, expect, it } from "vitest";
import { duplicateContentCheck } from "./duplicateContent";
import { makePage } from "../../testUtils";

const PARAGRAPH = Array.from(
  { length: 60 },
  (_v, i) => `palabra${i}`
).join(" ");

function htmlWith(text: string): string {
  return `<html><body><p>${text}</p></body></html>`;
}

describe("duplicateContentCheck (TECH-08)", () => {
  it("flags exact duplicates across pages", () => {
    const a = makePage({ url: "https://example.com/a", html: htmlWith(PARAGRAPH) });
    const b = makePage({ url: "https://example.com/b", html: htmlWith(PARAGRAPH) });
    const c = makePage({ url: "https://example.com/c", html: htmlWith("contenido totalmente distinto sin relación " + PARAGRAPH.split(" ").reverse().join(" ")) });

    const issues = duplicateContentCheck.run({ pages: [a, b, c], origin: "https://example.com", sitemapUrls: [] });

    expect(issues.some((i) => i.title.includes("duplicado exacto"))).toBe(true);
  });

  it("does not flag short/near-empty pages as duplicates", () => {
    const a = makePage({ url: "https://example.com/a", html: htmlWith("hola mundo") });
    const b = makePage({ url: "https://example.com/b", html: htmlWith("hola mundo") });

    const issues = duplicateContentCheck.run({ pages: [a, b], origin: "https://example.com", sitemapUrls: [] });

    expect(issues.length).toBe(0);
  });

  it("flags near-duplicate content via SimHash", () => {
    const words = PARAGRAPH.split(" ");
    const nearWords = [...words];
    nearWords[0] = "diferente";
    nearWords[1] = "otropalabra";

    const a = makePage({ url: "https://example.com/a", html: htmlWith(words.join(" ")) });
    const b = makePage({ url: "https://example.com/b", html: htmlWith(nearWords.join(" ")) });

    const issues = duplicateContentCheck.run({ pages: [a, b], origin: "https://example.com", sitemapUrls: [] });

    expect(issues.some((i) => i.title.includes("near-duplicate"))).toBe(true);
  });
});
