import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { schemaValidateCheck } from "./schemaValidate";
import { makePage } from "../../testUtils";

function run(html: string, url = "https://example.com/page") {
  const $ = cheerio.load(html);
  const page = makePage({ url });
  return schemaValidateCheck.run({ page, $ });
}

describe("schemaValidateCheck (SD-04)", () => {
  it("flags a missing required property as critical", () => {
    // Organization requires "name".
    const issues = run(
      `<html><body><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization"}</script></body></html>`
    );
    const critical = issues.find((i) => i.severity === "critical");
    expect(critical).toBeTruthy();
    expect(critical?.measuredValue).toContain("name");
  });

  it("flags a missing recommended property as a warning", () => {
    // Organization has "name" but no url/logo/sameAs.
    const issues = run(
      `<html><body><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme"}</script></body></html>`
    );
    const warning = issues.find((i) => i.severity === "warning" && i.title.includes("recomendadas"));
    expect(warning).toBeTruthy();
  });

  it("flags a dangling @id reference (not resolved to a defined node)", () => {
    const issues = run(`<html><body><script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "Jane",
        "worksFor": { "@id": "#missing-org" }
      }
    </script></body></html>`);
    const dangling = issues.find((i) => i.title === "Referencias @id sin resolver");
    expect(dangling).toBeTruthy();
    expect(dangling?.measuredValue).toContain("#missing-org");
  });

  it("does not flag a resolved @id reference as dangling", () => {
    const issues = run(`<html><body><script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "Organization", "@id": "#org", "name": "Acme", "url": "https://acme.example", "logo": "https://acme.example/logo.png", "sameAs": ["https://twitter.com/acme"] },
          { "@type": "Person", "name": "Jane", "url": "https://acme.example/jane", "sameAs": ["https://twitter.com/jane"], "jobTitle": "CEO", "worksFor": { "@id": "#org" } }
        ]
      }
    </script></body></html>`);
    const dangling = issues.find((i) => i.title === "Referencias @id sin resolver");
    expect(dangling).toBeUndefined();
  });

  it("reports ok with no errors when all required/recommended props are present", () => {
    const issues = run(`<html><body><script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Organization","name":"Acme","url":"https://acme.example","logo":"https://acme.example/logo.png","sameAs":["https://twitter.com/acme"]}
    </script></body></html>`);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("ok");
  });

  it("ignores types without a local rule (no false positives)", () => {
    const issues = run(
      `<html><body><script type="application/ld+json">{"@context":"https://schema.org","@type":"SomeUnknownType","foo":"bar"}</script></body></html>`
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("ok");
  });
});
