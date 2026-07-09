import { describe, expect, it } from "vitest";
import { schemaContentMismatchCheck } from "./contentMismatch";
import { makePage } from "../../testUtils";

const SD06_TITLE = "Datos estructurados sin contenido visible correspondiente";

function faqHtml(bodyText: string): string {
  return `<html><body><p>${bodyText}</p><script type="application/ld+json">
    { "@context":"https://schema.org","@type":"FAQPage","mainEntity":[
      {"@type":"Question","name":"How do I reset my password?","acceptedAnswer":{"@type":"Answer","text":"Go to settings"}},
      {"@type":"Question","name":"What is your refund policy?","acceptedAnswer":{"@type":"Answer","text":"30 days"}}
    ]}
  </script></body></html>`;
}

const faqMismatchHtml = faqHtml("Welcome to our site, we sell great products.");
const faqMatchHtml = faqHtml(
  "How do I reset my password? Go to settings. What is your refund policy? 30 days.",
);

function howToHtml(bodyText: string): string {
  return `<html><body><p>${bodyText}</p><script type="application/ld+json">
    { "@context":"https://schema.org","@type":"HowTo","name":"How to bake bread","step":[
      {"@type":"HowToStep","name":"Mix the flour and water"},
      {"@type":"HowToStep","name":"Let the dough rest for an hour"}
    ]}
  </script></body></html>`;
}

const howToMismatchHtml = howToHtml("Bread is a staple food made from flour.");
const howToMatchHtml = howToHtml(
  "Step 1: Mix the flour and water. Step 2: Let the dough rest for an hour.",
);

function productRatingHtml(bodyText: string): string {
  return `<html><body><p>${bodyText}</p><script type="application/ld+json">
    { "@context":"https://schema.org","@type":"Product","name":"Widget","aggregateRating":{"@type":"AggregateRating","ratingValue":"4.5","reviewCount":"120"}}
  </script></body></html>`;
}

const productMismatchHtml = productRatingHtml("Buy our amazing widget today.");
const productMatchHtml = productRatingHtml("Our widget is rated 4.5 de 5 (120 reseñas).");

function reviewHtml(bodyText: string): string {
  return `<html><body><p>${bodyText}</p><script type="application/ld+json">
    { "@context":"https://schema.org","@type":"Review","reviewBody":"This product changed my life completely" }
  </script></body></html>`;
}

const reviewMismatchHtml = reviewHtml("Thanks for visiting our store.");
const reviewMatchHtml = reviewHtml("This product changed my life completely, highly recommend.");

const lowRiskHtml = `<html><body><p>Just a normal article about gardening.</p><script type="application/ld+json">
  { "@context":"https://schema.org","@type":"Organization","name":"Acme Corp" }
</script>
<script type="application/ld+json">
  { "@context":"https://schema.org","@type":"Article","headline":"Gardening tips for beginners" }
</script></body></html>`;

const multiMismatchHtml = `<html><body><p>Welcome to our site.</p><script type="application/ld+json">
  [
    { "@context":"https://schema.org","@type":"FAQPage","mainEntity":[
      {"@type":"Question","name":"How do I reset my password?","acceptedAnswer":{"@type":"Answer","text":"Go to settings"}},
      {"@type":"Question","name":"What is your refund policy?","acceptedAnswer":{"@type":"Answer","text":"30 days"}}
    ]},
    { "@context":"https://schema.org","@type":"Review","reviewBody":"This product changed my life completely" }
  ]
</script></body></html>`;

describe("schemaContentMismatchCheck (SD-06 site-level)", () => {
  it("Test 1: flags FAQPage JSON-LD with no matching visible questions", () => {
    const pages = [makePage({ id: "p1", url: "https://site.example/faq", html: faqMismatchHtml })];
    const issues = schemaContentMismatchCheck.run({ pages, origin: "https://site.example", sitemapUrls: [] });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.checkId).toBe("SD-06");
    expect(issues[0]?.severity).toBe("warning");
    expect(issues[0]?.title).toBe(SD06_TITLE);
  });

  it("Test 2: does NOT flag FAQPage when visible body contains the question texts", () => {
    const pages = [makePage({ id: "p1", url: "https://site.example/faq", html: faqMatchHtml })];
    const issues = schemaContentMismatchCheck.run({ pages, origin: "https://site.example", sitemapUrls: [] });
    expect(issues).toHaveLength(0);
  });

  it("Test 3: flags HowTo JSON-LD with no matching visible step names", () => {
    const pages = [makePage({ id: "p1", url: "https://site.example/howto", html: howToMismatchHtml })];
    const issues = schemaContentMismatchCheck.run({ pages, origin: "https://site.example", sitemapUrls: [] });
    expect(issues).toHaveLength(1);
  });

  it("Test 4: does NOT flag HowTo when visible body contains step names", () => {
    const pages = [makePage({ id: "p1", url: "https://site.example/howto", html: howToMatchHtml })];
    const issues = schemaContentMismatchCheck.run({ pages, origin: "https://site.example", sitemapUrls: [] });
    expect(issues).toHaveLength(0);
  });

  it("Test 5: flags Product+AggregateRating with no visible rating pattern", () => {
    const pages = [makePage({ id: "p1", url: "https://site.example/product", html: productMismatchHtml })];
    const issues = schemaContentMismatchCheck.run({ pages, origin: "https://site.example", sitemapUrls: [] });
    expect(issues).toHaveLength(1);
  });

  it("Test 6: does NOT flag Product+AggregateRating when visible text has a rating pattern", () => {
    const pages = [makePage({ id: "p1", url: "https://site.example/product", html: productMatchHtml })];
    const issues = schemaContentMismatchCheck.run({ pages, origin: "https://site.example", sitemapUrls: [] });
    expect(issues).toHaveLength(0);
  });

  it("Test 7: flags standalone Review with no matching visible text or rating pattern", () => {
    const pages = [makePage({ id: "p1", url: "https://site.example/review", html: reviewMismatchHtml })];
    const issues = schemaContentMismatchCheck.run({ pages, origin: "https://site.example", sitemapUrls: [] });
    expect(issues).toHaveLength(1);
  });

  it("Test 8: does NOT flag Review when visible text contains the reviewBody snippet", () => {
    const pages = [makePage({ id: "p1", url: "https://site.example/review", html: reviewMatchHtml })];
    const issues = schemaContentMismatchCheck.run({ pages, origin: "https://site.example", sitemapUrls: [] });
    expect(issues).toHaveLength(0);
  });

  it("Test 9: does NOT flag low-risk types (Organization, Article)", () => {
    const pages = [makePage({ id: "p1", url: "https://site.example/about", html: lowRiskHtml })];
    const issues = schemaContentMismatchCheck.run({ pages, origin: "https://site.example", sitemapUrls: [] });
    expect(issues).toHaveLength(0);
  });

  it("Test 10: suppresses the mismatch when renderVerdictByPageId marks the page as csr", () => {
    const pages = [makePage({ id: "p1", url: "https://site.example/faq", html: faqMismatchHtml })];
    const issues = schemaContentMismatchCheck.run({
      pages,
      origin: "https://site.example",
      sitemapUrls: [],
      renderVerdictByPageId: { p1: "csr" },
    });
    expect(issues).toHaveLength(0);
  });

  it("Test 11: still flags when renderVerdictByPageId marks the page as undetermined or is absent", () => {
    const pages = [makePage({ id: "p1", url: "https://site.example/faq", html: faqMismatchHtml })];
    const issuesUndetermined = schemaContentMismatchCheck.run({
      pages,
      origin: "https://site.example",
      sitemapUrls: [],
      renderVerdictByPageId: { p1: "undetermined" },
    });
    expect(issuesUndetermined).toHaveLength(1);

    const issuesAbsent = schemaContentMismatchCheck.run({
      pages,
      origin: "https://site.example",
      sitemapUrls: [],
      renderVerdictByPageId: {},
    });
    expect(issuesAbsent).toHaveLength(1);
  });

  it("Test 12: aggregates multiple mismatched types on the same page into ONE issue", () => {
    const pages = [makePage({ id: "p1", url: "https://site.example/multi", html: multiMismatchHtml })];
    const issues = schemaContentMismatchCheck.run({ pages, origin: "https://site.example", sitemapUrls: [] });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.measuredValue).toContain("FAQPage");
    expect(issues[0]?.measuredValue).toContain("Review");
  });

  it("Test 13 (guardrail): severity is always warning, never critical, across all fixtures", () => {
    const pages = [
      makePage({ id: "p1", url: "https://site.example/faq", html: faqMismatchHtml }),
      makePage({ id: "p2", url: "https://site.example/howto", html: howToMismatchHtml }),
      makePage({ id: "p3", url: "https://site.example/product", html: productMismatchHtml }),
      makePage({ id: "p4", url: "https://site.example/review", html: reviewMismatchHtml }),
      makePage({ id: "p5", url: "https://site.example/multi", html: multiMismatchHtml }),
    ];
    const issues = schemaContentMismatchCheck.run({ pages, origin: "https://site.example", sitemapUrls: [] });
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(issue.severity).toBe("warning");
    }
  });
});
