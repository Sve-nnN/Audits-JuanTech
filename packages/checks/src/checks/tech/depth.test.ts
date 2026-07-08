import { describe, expect, it } from "vitest";
import { depthCheck } from "./depth";
import type { SiteCheckCtx } from "../../types";

function ctxWith(depthByUrl?: Record<string, number>): SiteCheckCtx {
  return {
    pages: [],
    origin: "https://example.com",
    sitemapUrls: [],
    depthByUrl,
  };
}

describe("depthCheck (TECH-14)", () => {
  it("returns [] when depthByUrl is undefined", () => {
    expect(depthCheck.run(ctxWith(undefined))).toEqual([]);
  });

  it("returns [] when depthByUrl is empty (no reachable pages)", () => {
    expect(depthCheck.run(ctxWith({}))).toEqual([]);
  });

  it("returns a single ok issue with 0% when all pages are <=3 clicks deep", () => {
    const result = depthCheck.run(
      ctxWith({
        "https://example.com/": 0,
        "https://example.com/a": 1,
        "https://example.com/b": 2,
        "https://example.com/c": 3,
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.severity).toBe("ok");
    expect(result[0]?.measuredValue).toContain("0%");
  });

  it("returns a single warning issue with the computed percentage when some pages exceed depth 3", () => {
    const depthByUrl: Record<string, number> = {};
    for (let i = 0; i < 8; i++) depthByUrl[`https://example.com/p${i}`] = 1;
    depthByUrl["https://example.com/deep1"] = 4;
    depthByUrl["https://example.com/deep2"] = 5;

    const result1 = depthCheck.run(ctxWith(depthByUrl));
    const result2 = depthCheck.run(ctxWith(depthByUrl));

    expect(result1).toHaveLength(1);
    expect(result1[0]?.severity).toBe("warning");
    expect(result1[0]?.measuredValue).toContain("20%");
    expect(result1[0]?.fingerprint).toBe(result2[0]?.fingerprint);
  });

  it("always returns exactly one issue regardless of how many pages exceed depth 3", () => {
    const depthByUrl: Record<string, number> = {};
    for (let i = 0; i < 20; i++) depthByUrl[`https://example.com/p${i}`] = 5;
    const result = depthCheck.run(ctxWith(depthByUrl));
    expect(result.length).toBe(1);
  });
});
