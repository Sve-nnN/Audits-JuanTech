import { describe, it, expect } from "vitest";
import { scoreOverall, scorePerfCategory, CATEGORY_WEIGHTS } from "./overallScore";
import { scoreCategory } from "./categoryScore";

describe("CATEGORY_WEIGHTS", () => {
  it("sums to 1.0", () => {
    const sum = Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
});

describe("scorePerfCategory", () => {
  it("weights mobile 70% / desktop 30%", () => {
    const result = scorePerfCategory({ mobileAvgScore: 80, desktopAvgScore: 90 });
    // 80*0.7 + 90*0.3 = 56 + 27 = 83
    expect(result?.score).toBe(83);
  });

  it("falls back to the single available strategy", () => {
    expect(scorePerfCategory({ mobileAvgScore: 75, desktopAvgScore: null })?.score).toBe(75);
    expect(scorePerfCategory({ mobileAvgScore: null, desktopAvgScore: 60 })?.score).toBe(60);
  });

  it("returns null when neither strategy has data", () => {
    expect(scorePerfCategory({ mobileAvgScore: null, desktopAvgScore: null })).toBeNull();
  });
});

describe("scoreOverall", () => {
  it("computes a weighted average across all 5 categories", () => {
    const perfect = scoreCategory([]); // 100, good
    const result = scoreOverall(
      { tech: perfect, onpage: perfect, schema: perfect, aeo: perfect },
      { mobileAvgScore: 100, desktopAvgScore: 100 }
    );
    expect(result.overall).toBe(100);
    expect(result.status).toBe("good");
  });

  it("renormalizes weights when perf is unavailable", () => {
    const perfect = scoreCategory([]);
    const result = scoreOverall(
      { tech: perfect, onpage: perfect, schema: perfect, aeo: perfect },
      { mobileAvgScore: null, desktopAvgScore: null }
    );
    // perf excluded entirely; remaining 4 categories are all 100 -> still 100
    expect(result.overall).toBe(100);
    expect(result.byCategory.perf).toBeUndefined();
  });

  it("lands in a plausible range for a mostly-healthy site (reference: ~86/100)", () => {
    // Realistic per-category issue sets: mostly passing checks (many "ok")
    // with a scatter of warnings and the odd critical — roughly matching a
    // real multi-page crawl of a site like juan-tech.com in the reference.
    const many = (ok: number, warning: number, critical: number) => [
      ...Array.from({ length: ok }, () => ({ severity: "ok" as const })),
      ...Array.from({ length: warning }, () => ({ severity: "warning" as const })),
      ...Array.from({ length: critical }, () => ({ severity: "critical" as const })),
    ];
    const tech = scoreCategory(many(40, 5, 1));
    const onpage = scoreCategory(many(30, 3, 0));
    const schema = scoreCategory(many(25, 2, 0));
    const aeo = scoreCategory(many(10, 0, 0));

    const result = scoreOverall(
      { tech, onpage, schema, aeo },
      { mobileAvgScore: 78, desktopAvgScore: 92 }
    );

    expect(result.overall).toBeGreaterThanOrEqual(75);
    expect(result.overall).toBeLessThanOrEqual(92);
  });

  it("weights categories according to CATEGORY_WEIGHTS (higher-weight category dominates)", () => {
    const good = scoreCategory([]); // 100
    const bad = scoreCategory(Array.from({ length: 20 }, () => ({ severity: "critical" as const }))); // 0

    // tech (weight 0.3) bad, everything else good
    const techBad = scoreOverall(
      { tech: bad, onpage: good, schema: good, aeo: good },
      { mobileAvgScore: 100, desktopAvgScore: 100 }
    );
    // schema (weight 0.1) bad, everything else good
    const schemaBad = scoreOverall(
      { tech: good, onpage: good, schema: bad, aeo: good },
      { mobileAvgScore: 100, desktopAvgScore: 100 }
    );

    expect(techBad.overall).toBeLessThan(schemaBad.overall);
  });

  it("returns 0/critical when nothing is scored", () => {
    const result = scoreOverall({}, { mobileAvgScore: null, desktopAvgScore: null });
    expect(result.overall).toBe(0);
    expect(result.status).toBe("critical");
  });
});
