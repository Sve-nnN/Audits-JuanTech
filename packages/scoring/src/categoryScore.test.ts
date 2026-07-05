import { describe, it, expect } from "vitest";
import { scoreCategory } from "./categoryScore";

describe("scoreCategory", () => {
  it("scores a perfect 100 with no issues", () => {
    expect(scoreCategory([])).toEqual({ score: 100, status: "good" });
  });

  it("is deterministic: same issue set always yields the same score", () => {
    const issues = [{ severity: "warning" as const }, { severity: "critical" as const }];
    const first = scoreCategory(issues);
    const second = scoreCategory([...issues]);
    expect(first).toEqual(second);
  });

  it("is order-independent", () => {
    const a = scoreCategory([{ severity: "critical" as const }, { severity: "warning" as const }]);
    const b = scoreCategory([{ severity: "warning" as const }, { severity: "critical" as const }]);
    expect(a).toEqual(b);
  });

  it("ok issues never penalize", () => {
    const issues = Array.from({ length: 20 }, () => ({ severity: "ok" as const }));
    expect(scoreCategory(issues)).toEqual({ score: 100, status: "good" });
  });

  it("critical issues penalize more than warnings", () => {
    const criticalScore = scoreCategory([{ severity: "critical" as const }]).score;
    const warningScore = scoreCategory([{ severity: "warning" as const }]).score;
    expect(criticalScore).toBeLessThan(warningScore);
  });

  it("floors at 0, never goes negative", () => {
    const issues = Array.from({ length: 20 }, () => ({ severity: "critical" as const }));
    const result = scoreCategory(issues);
    expect(result.score).toBe(0);
    expect(result.status).toBe("critical");
  });

  it("applies status thresholds: good >= 90", () => {
    // 0 penalty -> 100
    expect(scoreCategory([]).status).toBe("good");
  });

  it("applies status thresholds: needs_improvement between 50 and 89", () => {
    // one critical (15) + one warning (5) = 20 penalty -> 80
    const result = scoreCategory([{ severity: "critical" as const }, { severity: "warning" as const }]);
    expect(result.score).toBe(80);
    expect(result.status).toBe("needs_improvement");
  });

  it("applies status thresholds: critical below 50", () => {
    // 4 criticals = 60 penalty -> 40
    const issues = Array.from({ length: 4 }, () => ({ severity: "critical" as const }));
    const result = scoreCategory(issues);
    expect(result.score).toBe(40);
    expect(result.status).toBe("critical");
  });
});
