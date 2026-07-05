import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { h1Check } from "./h1";
import { makePage } from "../../testUtils";

function run(html: string) {
  const $ = cheerio.load(html);
  const page = makePage({ url: "https://example.com/page" });
  return h1Check.run({ page, $ });
}

describe("h1Check (ONPAGE-03)", () => {
  it("flags missing H1 as critical", () => {
    const [issue] = run("<html><body><p>no h1 here</p></body></html>");
    expect(issue?.severity).toBe("critical");
  });

  it("flags multiple H1s as warning", () => {
    const [issue] = run("<html><body><h1>One</h1><h1>Two</h1></body></html>");
    expect(issue?.severity).toBe("warning");
  });

  it("passes a single H1", () => {
    const [issue] = run("<html><body><h1>Only heading</h1></body></html>");
    expect(issue?.severity).toBe("ok");
  });
});
