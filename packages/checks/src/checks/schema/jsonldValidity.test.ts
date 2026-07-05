import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { jsonldValidityCheck } from "./jsonldValidity";
import { makePage } from "../../testUtils";

function run(html: string, url = "https://example.com/page") {
  const $ = cheerio.load(html);
  const page = makePage({ url });
  return jsonldValidityCheck.run({ page, $ });
}

describe("jsonldValidityCheck (SD-02)", () => {
  it("returns no issue when there is no JSON-LD (SD-01's job)", () => {
    const issues = run(`<html><body><p>no schema</p></body></html>`);
    expect(issues).toHaveLength(0);
  });

  it("passes when every block is valid JSON", () => {
    const [issue] = run(
      `<html><body><script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script></body></html>`
    );
    expect(issue?.severity).toBe("ok");
  });

  it("flags a block with invalid JSON and reports the parse error", () => {
    const [issue] = run(
      `<html><body><script type="application/ld+json">{ "@type": "Organization", }</script></body></html>`
    );
    expect(issue?.severity).toBe("critical");
    expect(issue?.measuredValue).toContain("bloque #1");
  });
});
