import { describe, expect, it } from "vitest";
import { hreflangCheck } from "./hreflang";
import { makePage } from "../../testUtils";

describe("hreflangCheck (TECH-10)", () => {
  it("flags missing reciprocal hreflang links", () => {
    const es = makePage({
      url: "https://example.com/es",
      html:
        '<html><head><link rel="alternate" hreflang="en" href="https://example.com/en"></head></html>',
    });
    const en = makePage({
      url: "https://example.com/en",
      html: "<html><head></head></html>",
    });

    const issues = hreflangCheck.run({
      pages: [es, en],
      origin: "https://example.com",
      sitemapUrls: [],
    });

    expect(issues.some((i) => i.title.includes("sin enlace de retorno"))).toBe(true);
  });

  it("does not flag when hreflang is reciprocal", () => {
    const es = makePage({
      url: "https://example.com/es",
      html:
        '<html><head><link rel="alternate" hreflang="en" href="https://example.com/en"></head></html>',
    });
    const en = makePage({
      url: "https://example.com/en",
      html:
        '<html><head><link rel="alternate" hreflang="es" href="https://example.com/es"></head></html>',
    });

    const issues = hreflangCheck.run({
      pages: [es, en],
      origin: "https://example.com",
      sitemapUrls: [],
    });

    expect(issues.some((i) => i.title.includes("sin enlace de retorno"))).toBe(false);
  });

  it("flags a canonical-hreflang conflict", () => {
    const es = makePage({
      url: "https://example.com/es",
      html:
        '<html><head><link rel="alternate" hreflang="en" href="https://example.com/en"></head></html>',
    });
    const en = makePage({
      url: "https://example.com/en",
      html:
        '<html><head><link rel="canonical" href="https://example.com/en-us"><link rel="alternate" hreflang="es" href="https://example.com/es"></head></html>',
    });

    const issues = hreflangCheck.run({
      pages: [es, en],
      origin: "https://example.com",
      sitemapUrls: [],
    });

    expect(issues.some((i) => i.title.includes("Conflicto entre hreflang y canonical"))).toBe(true);
  });
});
