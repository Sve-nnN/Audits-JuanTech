import { describe, expect, it } from "vitest";
import { parsePsiResponse } from "./parser";
import mobileFixture from "./__fixtures__/psi-response-mobile.json";
import desktopWithInpFixture from "./__fixtures__/psi-response-desktop-with-inp.json";

describe("parsePsiResponse (PERF-02)", () => {
  it("extracts performance score, LCP, CLS and TTFB from a mobile response", () => {
    const metrics = parsePsiResponse(mobileFixture);
    expect(metrics.performanceScore).toBe(81);
    expect(metrics.lcpMs).toBe(4876);
    expect(metrics.cls).toBe(0);
    expect(metrics.ttfbMs).toBe(7); // rounds 6.5 -> 7 (Math.round banker-free)
  });

  it("returns inpMs null when CrUX field data has no INP entry", () => {
    const metrics = parsePsiResponse(mobileFixture);
    expect(metrics.inpMs).toBeNull();
  });

  it("extracts INP from loadingExperience when present", () => {
    const metrics = parsePsiResponse(desktopWithInpFixture);
    expect(metrics.inpMs).toBe(180);
    expect(metrics.performanceScore).toBe(99);
    expect(metrics.lcpMs).toBe(1001);
    expect(metrics.cls).toBeCloseTo(0.003);
  });

  it("falls back to originLoadingExperience for INP when loadingExperience lacks it", () => {
    const metrics = parsePsiResponse({
      lighthouseResult: { categories: { performance: { score: 0.5 } }, audits: {} },
      originLoadingExperience: {
        metrics: { INTERACTION_TO_NEXT_PAINT: { percentile: 350 } },
      },
    });
    expect(metrics.inpMs).toBe(350);
  });

  it("handles a fully empty response gracefully (all null)", () => {
    const metrics = parsePsiResponse({});
    expect(metrics).toEqual({
      performanceScore: null,
      lcpMs: null,
      cls: null,
      inpMs: null,
      ttfbMs: null,
    });
  });
});
