import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { altTextCheck } from "./altText";
import { makePage } from "../../testUtils";

function run(html: string) {
  const $ = cheerio.load(html);
  const page = makePage({ url: "https://example.com/page" });
  return altTextCheck.run({ page, $ });
}

describe("altTextCheck (ONPAGE-04)", () => {
  it("is ok when there are no images", () => {
    const [issue] = run("<html><body><p>text only</p></body></html>");
    expect(issue?.severity).toBe("ok");
  });

  it("flags images missing alt as critical when coverage is low", () => {
    const [issue] = run(
      '<html><body><img src="a.jpg"><img src="b.jpg"><img src="c.jpg" alt="ok"></body></html>'
    );
    expect(issue?.severity).toBe("critical");
    expect(issue?.measuredValue).toContain("2/3");
  });

  it("passes when all images have alt text", () => {
    const [issue] = run('<html><body><img src="a.jpg" alt="describes a"></body></html>');
    expect(issue?.severity).toBe("ok");
  });
});
