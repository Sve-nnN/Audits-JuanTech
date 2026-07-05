import { describe, expect, it } from "vitest";
import { selectSample, type SamplePageInput } from "./sample";

function page(url: string, overrides: Partial<SamplePageInput> = {}): SamplePageInput {
  return { url, statusCode: 200, contentType: "text/html; charset=utf-8", depth: 0, ...overrides };
}

describe("selectSample (PERF-03)", () => {
  it("always includes the homepage first when present", () => {
    const pages = [
      page("https://example.com/blog/post-1", { depth: 2 }),
      page("https://example.com/", { depth: 0 }),
      page("https://example.com/about", { depth: 1 }),
    ];
    const sample = selectSample(pages, 5);
    expect(sample[0]?.url).toBe("https://example.com/");
  });

  it("caps the sample at `max`", () => {
    const pages = Array.from({ length: 20 }, (_, i) => page(`https://example.com/page-${i}`, { depth: i % 4 }));
    const sample = selectSample(pages, 5);
    expect(sample.length).toBe(5);
  });

  it("dedupes by URL", () => {
    const pages = [page("https://example.com/"), page("https://example.com/"), page("https://example.com/about")];
    const sample = selectSample(pages, 5);
    const urls = sample.map((p) => p.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("spreads across depths instead of picking only the first depth bucket", () => {
    const pages = [
      page("https://example.com/", { depth: 0 }),
      page("https://example.com/a1", { depth: 1 }),
      page("https://example.com/a2", { depth: 1 }),
      page("https://example.com/a3", { depth: 1 }),
      page("https://example.com/b1", { depth: 2 }),
      page("https://example.com/c1", { depth: 3 }),
    ];
    const sample = selectSample(pages, 4);
    const depths = new Set(sample.map((p) => p.depth));
    expect(depths.size).toBeGreaterThan(1);
  });

  it("excludes non-2xx and non-HTML pages", () => {
    const pages = [
      page("https://example.com/", { depth: 0 }),
      page("https://example.com/broken", { statusCode: 404 }),
      page("https://example.com/image.png", { contentType: "image/png" }),
      page("https://example.com/redirect", { statusCode: 301 }),
    ];
    const sample = selectSample(pages, 5);
    expect(sample.map((p) => p.url)).toEqual(["https://example.com/"]);
  });

  it("returns an empty array when there are no eligible pages", () => {
    expect(selectSample([])).toEqual([]);
    expect(selectSample([page("https://example.com/x", { statusCode: 500 })])).toEqual([]);
  });
});
