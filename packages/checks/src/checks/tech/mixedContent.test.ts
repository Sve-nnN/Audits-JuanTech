import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { mixedContentCheck } from "./mixedContent";
import { makePage } from "../../testUtils";

function run(html: string, url = "https://example.com/page") {
  const $ = cheerio.load(html);
  const page = makePage({ url });
  return mixedContentCheck.run({ page, $ });
}

describe("mixedContentCheck (TECH-11)", () => {
  it("does not apply to http pages", () => {
    const [issue] = run('<html><body><img src="http://example.com/a.jpg"></body></html>', "http://example.com/page");
    expect(issue?.severity).toBe("ok");
    expect(issue?.measuredValue).toContain("no aplica");
  });

  it("flags http:// resources on an https page", () => {
    const [issue] = run('<html><body><img src="http://cdn.example.com/a.jpg"></body></html>');
    expect(issue?.severity).toBe("critical");
  });

  it("passes when all resources are https", () => {
    const [issue] = run('<html><body><img src="https://cdn.example.com/a.jpg"></body></html>');
    expect(issue?.severity).toBe("ok");
  });
});
