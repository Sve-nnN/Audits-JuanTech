import { describe, expect, it } from "vitest";
import { danglingIdRefsCheck } from "./danglingIds";
import { makePage } from "../../testUtils";

const homepageHtml = `<html><body><script type="application/ld+json">
  { "@context":"https://schema.org","@type":"Person","@id":"https://site.example/#person","name":"Jane" }
</script></body></html>`;

const internalRefsHtml = `<html><body><script type="application/ld+json">
  { "@context":"https://schema.org","@type":"Article","headline":"X","author":{ "@id":"https://site.example/#person" } }
</script></body></html>`;

const brokenRefHtml = `<html><body><script type="application/ld+json">
  { "@context":"https://schema.org","@type":"Article","headline":"Y","author":{ "@id":"https://site.example/#missing" } }
</script></body></html>`;

describe("danglingIdRefsCheck (SD-04 site-level)", () => {
  it("does NOT flag a cross-page @id defined on another page (site-wide resolution)", () => {
    const pages = [
      makePage({ id: "home", url: "https://site.example/", html: homepageHtml }),
      makePage({ id: "internal", url: "https://site.example/post", html: internalRefsHtml }),
    ];
    const issues = danglingIdRefsCheck.run({ pages, origin: "https://site.example", sitemapUrls: [] });
    expect(issues.find((i) => i.title === "Referencias @id sin resolver")).toBeUndefined();
  });

  it("flags an @id referenced nowhere in the site", () => {
    const pages = [
      makePage({ id: "home", url: "https://site.example/", html: homepageHtml }),
      makePage({ id: "broken", url: "https://site.example/bad", html: brokenRefHtml }),
    ];
    const issues = danglingIdRefsCheck.run({ pages, origin: "https://site.example", sitemapUrls: [] });
    const dangling = issues.find((i) => i.title === "Referencias @id sin resolver");
    expect(dangling).toBeTruthy();
    expect(dangling?.measuredValue).toContain("#missing");
  });
});
