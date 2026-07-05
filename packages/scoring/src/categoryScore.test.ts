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

  it("critical issues score lower than warnings", () => {
    const criticalScore = scoreCategory([{ severity: "critical" as const }]).score;
    const warningScore = scoreCategory([{ severity: "warning" as const }]).score;
    expect(criticalScore).toBeLessThan(warningScore);
  });

  it("is size-independent: same proportion -> same score", () => {
    const small = scoreCategory([{ severity: "ok" as const }, { severity: "critical" as const }]).score;
    const large = scoreCategory(
      Array.from({ length: 100 }, (_v, i) => ({
        severity: i % 2 === 0 ? ("ok" as const) : ("critical" as const),
      }))
    ).score;
    expect(small).toBe(large); // both 50
  });

  it("bottoms out at 0 when everything is critical", () => {
    const issues = Array.from({ length: 20 }, () => ({ severity: "critical" as const }));
    const result = scoreCategory(issues);
    expect(result.score).toBe(0);
    expect(result.status).toBe("critical");
  });

  it("status thresholds: mostly-healthy category is good", () => {
    // 19 ok + 1 warning -> (19 + 0.5)/20 = 97.5 -> 98
    const issues = [
      ...Array.from({ length: 19 }, () => ({ severity: "ok" as const })),
      { severity: "warning" as const },
    ];
    const result = scoreCategory(issues);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.status).toBe("good");
  });

  it("status thresholds: half-healthy is needs_improvement", () => {
    // 1 ok + 1 critical -> 50
    const result = scoreCategory([{ severity: "ok" as const }, { severity: "critical" as const }]);
    expect(result.score).toBe(50);
    expect(result.status).toBe("needs_improvement");
  });

  it("status thresholds: mostly-broken is critical", () => {
    // 1 ok + 2 critical -> (1)/3 = 33
    const result = scoreCategory([
      { severity: "ok" as const },
      { severity: "critical" as const },
      { severity: "critical" as const },
    ]);
    expect(result.score).toBe(33);
    expect(result.status).toBe("critical");
  });
});
