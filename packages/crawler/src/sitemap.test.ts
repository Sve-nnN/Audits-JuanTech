import { describe, expect, it } from "vitest";
import { parseSitemapXml } from "./sitemap";

const URLSET_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about</loc></url>
  <url><loc>https://example.com/blog?tag=news&amp;page=2</loc></url>
</urlset>`;

const SITEMAP_INDEX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-pages.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-posts.xml</loc></sitemap>
</sitemapindex>`;

const MALFORMED_XML = `<?xml version="1.0"?>
<urlset>
  <url><loc>https://example.com/ok-1</loc></url>
  <url><loc>https://example.com/ok-2
  <url><loc>https://example.com/ok-3</loc></url>
`;

describe("parseSitemapXml", () => {
  it("extracts URLs from a <urlset> sitemap", () => {
    const result = parseSitemapXml(URLSET_XML);
    expect(result.isIndex).toBe(false);
    expect(result.locs).toEqual([
      "https://example.com/",
      "https://example.com/about",
      "https://example.com/blog?tag=news&page=2",
    ]);
  });

  it("detects a <sitemapindex> and extracts nested sitemap URLs", () => {
    const result = parseSitemapXml(SITEMAP_INDEX_XML);
    expect(result.isIndex).toBe(true);
    expect(result.locs).toEqual([
      "https://example.com/sitemap-pages.xml",
      "https://example.com/sitemap-posts.xml",
    ]);
  });

  it("is robust to malformed XML: returns whatever <loc> tags parse", () => {
    const result = parseSitemapXml(MALFORMED_XML);
    // The unclosed <loc> for ok-2 won't match the regex; ok-1 and ok-3 still do.
    expect(result.locs).toContain("https://example.com/ok-1");
    expect(result.locs).toContain("https://example.com/ok-3");
  });

  it("returns an empty list for content with no <loc> tags", () => {
    const result = parseSitemapXml("<urlset></urlset>");
    expect(result.locs).toEqual([]);
  });
});
