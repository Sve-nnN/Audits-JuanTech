import { describe, expect, it } from "vitest";
import { severityFor } from "./thresholds";

describe("severityFor (PERF-04)", () => {
  it("grades performanceScore: >=90 ok, 50-89 warning, <50 critical", () => {
    expect(severityFor("performanceScore", 95)).toBe("ok");
    expect(severityFor("performanceScore", 90)).toBe("ok");
    expect(severityFor("performanceScore", 81)).toBe("warning");
    expect(severityFor("performanceScore", 50)).toBe("warning");
    expect(severityFor("performanceScore", 49)).toBe("critical");
  });

  it("grades LCP: <=2500 ok, <=4000 warning, else critical", () => {
    expect(severityFor("lcp", 1001)).toBe("ok");
    expect(severityFor("lcp", 2500)).toBe("ok");
    expect(severityFor("lcp", 4000)).toBe("warning");
    expect(severityFor("lcp", 4876)).toBe("critical");
  });

  it("grades CLS: <=0.1 ok, <=0.25 warning, else critical", () => {
    expect(severityFor("cls", 0)).toBe("ok");
    expect(severityFor("cls", 0.1)).toBe("ok");
    expect(severityFor("cls", 0.2)).toBe("warning");
    expect(severityFor("cls", 0.3)).toBe("critical");
  });

  it("grades INP: <=200 ok, <=500 warning, else critical", () => {
    expect(severityFor("inp", 180)).toBe("ok");
    expect(severityFor("inp", 200)).toBe("ok");
    expect(severityFor("inp", 400)).toBe("warning");
    expect(severityFor("inp", 600)).toBe("critical");
  });

  it("grades TTFB: <=800 ok, <=1800 warning, else critical", () => {
    expect(severityFor("ttfb", 7)).toBe("ok");
    expect(severityFor("ttfb", 1500)).toBe("warning");
    expect(severityFor("ttfb", 2000)).toBe("critical");
  });
});
