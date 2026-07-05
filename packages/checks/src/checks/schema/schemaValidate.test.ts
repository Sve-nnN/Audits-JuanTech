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

  // Dangling @id detection moved to the site-level danglingIdRefsCheck
  // (resolves references site-wide); see danglingIds.test.ts.

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
