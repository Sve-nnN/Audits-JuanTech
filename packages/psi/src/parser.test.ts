import { describe, expect, it } from "vitest";
import { extractDiagnostics, parsePsiResponse } from "./parser";
import mobileFixture from "./__fixtures__/psi-response-mobile.json";
import desktopWithInpFixture from "./__fixtures__/psi-response-desktop-with-inp.json";
import diagnosticsFixture from "./__fixtures__/psi-response-diagnostics.json";

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

  it("parsePsiResponse output is unchanged when the response also has diagnostic audits", () => {
    const metrics = parsePsiResponse(diagnosticsFixture);
    expect(metrics).toEqual({
      performanceScore: 60,
      lcpMs: null,
      cls: null,
      inpMs: null,
      ttfbMs: null,
    });
  });
});

describe("extractDiagnostics (PERF-05..PERF-09)", () => {
  it("extracts all 6 diagnostic audit IDs when present", () => {
    const diagnostics = extractDiagnostics(diagnosticsFixture);
    expect(diagnostics).toEqual({
      modernImageFormats: { score: 0.4, displayValue: "Podrías ahorrar 120 KiB" },
      unusedCssRules: { score: 0.6 },
      renderBlockingResources: { score: 0.3 },
      textCompression: { score: 1 },
      unminifiedCss: { score: 0.8 },
      unminifiedJavascript: { score: 0.5 },
    });
  });

  it("omits keys for audits absent from the response instead of setting undefined", () => {
    const raw = {
      lighthouseResult: {
        audits: {
          "unused-css-rules": { score: 0.6 },
        },
      },
    };
    const diagnostics = extractDiagnostics(raw);
    expect(Object.keys(diagnostics)).toEqual(["unusedCssRules"]);
    expect("modernImageFormats" in diagnostics).toBe(false);
  });

  it("returns an empty object (not null, no exception) for a fully empty response", () => {
    const diagnostics = extractDiagnostics({});
    expect(diagnostics).toEqual({});
  });

  it("includes the key with score: null when Lighthouse reports a null score", () => {
    const raw = {
      lighthouseResult: {
        audits: {
          "render-blocking-resources": { score: null },
        },
      },
    };
    const diagnostics = extractDiagnostics(raw);
    expect(diagnostics.renderBlockingResources).toEqual({ score: null });
  });
});
