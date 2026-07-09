import { describe, expect, it } from "vitest";
import { mapDiagnosticIssues, mapPerfIssues } from "./issues";
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

  it("stamps every draft with source = analyzed url (REPORT-03)", () => {
    const url = "https://example.com/pagina-analizada";
    const issues = mapPerfIssues({ url, pageId: "page-1", mobile, desktop });
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(issue.source).toBe(url);
    }
  });

  it("stamps source on the early-return 'not available' issue (no mobile/desktop)", () => {
    const url = "https://example.com/broken";
    const issues = mapPerfIssues({ url, mobile: null, desktop: null });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.source).toBe(url);
  });
});

describe("mapDiagnosticIssues (PERF-05..09)", () => {
  const fullDiagnostics: NonNullable<PsiMetrics["diagnostics"]> = {
    modernImageFormats: { score: 0.4 },
    unusedCssRules: { score: 0.6 },
    renderBlockingResources: { score: 0.3 },
    textCompression: { score: 1 },
    unminifiedCss: { score: 0.8 },
    unminifiedJavascript: { score: 0.5 },
  };

  it("produces PERF-05 with worst-case severity across strategies", () => {
    const mobileDiag: PsiMetrics = {
      ...mobile,
      diagnostics: { modernImageFormats: { score: 0.4 } },
    };
    const desktopDiag: PsiMetrics = {
      ...desktop,
      diagnostics: { modernImageFormats: { score: 0.95 } },
    };
    const issues = mapDiagnosticIssues({ url: "https://example.com/", mobile: mobileDiag, desktop: desktopDiag });
    const issue = issues.find((i) => i.checkId === "PERF-05");
    expect(issue?.severity).toBe("warning");
    expect(issue?.measuredValue).toContain("Móvil");
    expect(issue?.measuredValue).toContain("Desktop");
  });

  it("never emits severity 'critical', even for a score of 0", () => {
    const mobileDiag: PsiMetrics = {
      ...mobile,
      diagnostics: {
        modernImageFormats: { score: 0 },
        unusedCssRules: { score: 0.6 },
        renderBlockingResources: { score: 0.3 },
        textCompression: { score: 1 },
        unminifiedCss: { score: 0.8 },
        unminifiedJavascript: { score: 0.5 },
      },
    };
    const issues = mapDiagnosticIssues({ url: "https://example.com/", mobile: mobileDiag, desktop: null });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.severity !== "critical")).toBe(true);
  });

  it("scores >= 0.9 grade 'ok', scores < 0.9 grade 'warning'", () => {
    const mobileDiag: PsiMetrics = { ...mobile, diagnostics: { textCompression: { score: 1 } } };
    const issues = mapDiagnosticIssues({ url: "https://example.com/", mobile: mobileDiag, desktop: null });
    const issue = issues.find((i) => i.checkId === "PERF-08");
    expect(issue?.severity).toBe("ok");
  });

  it("omits the checkId when the diagnostic is absent in both strategies", () => {
    const mobileDiag: PsiMetrics = { ...mobile, diagnostics: { modernImageFormats: { score: 0.4 } } };
    const desktopDiag: PsiMetrics = { ...desktop, diagnostics: { modernImageFormats: { score: 0.5 } } };
    const issues = mapDiagnosticIssues({ url: "https://example.com/", mobile: mobileDiag, desktop: desktopDiag });
    expect(issues.find((i) => i.checkId === "PERF-07")).toBeUndefined();
  });

  it("combines unminified-css + unminified-javascript into a single PERF-09 using the worst score", () => {
    const mobileDiag: PsiMetrics = {
      ...mobile,
      diagnostics: { unminifiedCss: { score: 0.9 }, unminifiedJavascript: { score: 0.3 } },
    };
    const issues = mapDiagnosticIssues({ url: "https://example.com/", mobile: mobileDiag, desktop: null });
    const combined = issues.filter((i) => i.checkId === "PERF-09");
    expect(combined).toHaveLength(1);
    expect(combined[0]?.severity).toBe("warning");
  });

  it("PERF-09 uses the single present diagnostic when the other is absent, without throwing", () => {
    const mobileDiag: PsiMetrics = { ...mobile, diagnostics: { unminifiedCss: { score: 0.95 } } };
    expect(() =>
      mapDiagnosticIssues({ url: "https://example.com/", mobile: mobileDiag, desktop: null })
    ).not.toThrow();
    const issues = mapDiagnosticIssues({ url: "https://example.com/", mobile: mobileDiag, desktop: null });
    const combined = issues.find((i) => i.checkId === "PERF-09");
    expect(combined?.severity).toBe("ok");
  });

  it("produces exactly 5 distinct checkIds when all 6 audits are present in both strategies", () => {
    const mobileDiag: PsiMetrics = { ...mobile, diagnostics: fullDiagnostics };
    const desktopDiag: PsiMetrics = { ...desktop, diagnostics: fullDiagnostics };
    const issues = mapDiagnosticIssues({ url: "https://example.com/", mobile: mobileDiag, desktop: desktopDiag });
    expect(new Set(issues.map((i) => i.checkId)).size).toBe(5);
    expect(new Set(issues.map((i) => i.checkId))).toEqual(
      new Set(["PERF-05", "PERF-06", "PERF-07", "PERF-08", "PERF-09"])
    );
  });

  it("returns an empty array when neither strategy has data", () => {
    const issues = mapDiagnosticIssues({ url: "https://example.com/broken", mobile: null, desktop: null });
    expect(issues).toEqual([]);
  });

  it("fingerprints are stable across repeated calls with the same input", () => {
    const mobileDiag: PsiMetrics = { ...mobile, diagnostics: fullDiagnostics };
    const desktopDiag: PsiMetrics = { ...desktop, diagnostics: fullDiagnostics };
    const first = mapDiagnosticIssues({ url: "https://example.com/", mobile: mobileDiag, desktop: desktopDiag });
    const second = mapDiagnosticIssues({ url: "https://example.com/", mobile: mobileDiag, desktop: desktopDiag });
    expect(first.map((i) => i.fingerprint)).toEqual(second.map((i) => i.fingerprint));
  });
});
