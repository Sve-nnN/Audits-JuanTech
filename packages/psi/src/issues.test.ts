import { describe, expect, it } from "vitest";
import { mapPerfIssues } from "./issues";
import type { PsiMetrics } from "./types";

const mobile: PsiMetrics = { performanceScore: 81, lcpMs: 4876, cls: 0, inpMs: null, ttfbMs: 7 };
const desktop: PsiMetrics = { performanceScore: 99, lcpMs: 1001, cls: 0.003, inpMs: 180, ttfbMs: 5 };

describe("mapPerfIssues (PERF-02/04)", () => {
  it("produces one issue per metric with combined mobile/desktop measuredValue", () => {
    const issues = mapPerfIssues({ url: "https://example.com/", pageId: "page-1", mobile, desktop });
    const score = issues.find((i) => i.checkId === "PERF-01");
    expect(score?.measuredValue).toBe("Móvil: 81/100 / Desktop: 99/100");
    expect(score?.severity).toBe("warning"); // mobile 81 -> warning is worst case

    const lcp = issues.find((i) => i.checkId === "PERF-02-LCP");
    expect(lcp?.measuredValue).toContain("4876ms");
    expect(lcp?.severity).toBe("critical"); // mobile 4876ms is critical
  });

  it("marks INP as informational 'no disponible' when both strategies lack field data", () => {
    const mobileNoInp: PsiMetrics = { ...mobile, inpMs: null };
    const desktopNoInp: PsiMetrics = { ...desktop, inpMs: null };
    const issues = mapPerfIssues({ url: "https://example.com/", mobile: mobileNoInp, desktop: desktopNoInp });
    const inp = issues.find((i) => i.checkId === "PERF-02-INP");
    expect(inp?.severity).toBe("ok");
    expect(inp?.measuredValue).toContain("no disponible");
  });

  it("reports INP severity when at least one strategy has field data", () => {
    const issues = mapPerfIssues({ url: "https://example.com/", mobile, desktop });
    const inp = issues.find((i) => i.checkId === "PERF-02-INP");
    expect(inp?.measuredValue).toBe("Desktop: 180ms");
    expect(inp?.severity).toBe("ok");
  });

  it("degrades gracefully to a single 'not available' issue when both strategies fail", () => {
    const issues = mapPerfIssues({ url: "https://example.com/broken", mobile: null, desktop: null });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("ok");
    expect(issues[0]?.measuredValue).toContain("no disponible");
  });

  it("fingerprints are stable per checkId + url (diffable across re-runs)", () => {
    const first = mapPerfIssues({ url: "https://example.com/", mobile, desktop });
    const second = mapPerfIssues({ url: "https://example.com/", mobile, desktop });
    expect(first.map((i) => i.fingerprint)).toEqual(second.map((i) => i.fingerprint));
  });
});
