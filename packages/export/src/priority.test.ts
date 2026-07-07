import { describe, it, expect } from "vitest";
import { EXPORT_TOP_N, prioritizeIssues } from "./priority";
import { makeCandidates, makeIssue } from "./test-fixtures";

describe("EXPORT_TOP_N", () => {
  it("is the tunable cap of 50", () => {
    expect(EXPORT_TOP_N).toBe(50);
  });
});

describe("prioritizeIssues", () => {
  it("does not cap or note when candidates <= N", () => {
    const result = prioritizeIssues(makeCandidates(EXPORT_TOP_N));
    expect(result.capped).toBe(false);
    expect(result.note).toBeNull();
    expect(result.issues).toHaveLength(EXPORT_TOP_N);
    expect(result.shown).toBe(EXPORT_TOP_N);
    expect(result.total).toBe(EXPORT_TOP_N);
  });

  it("caps to N and emits a 'N de M' note when candidates > N", () => {
    const candidates = makeCandidates(70);
    const result = prioritizeIssues(candidates);
    expect(result.capped).toBe(true);
    expect(result.shown).toBe(EXPORT_TOP_N);
    expect(result.issues).toHaveLength(EXPORT_TOP_N);
    expect(result.total).toBe(70);
    expect(result.note).toContain("50");
    expect(result.note).toContain("70");
  });

  it("orders critical issues before warning issues", () => {
    const warning = makeIssue({ severity: "warning", checkId: "W" });
    const critical = makeIssue({ severity: "critical", checkId: "C" });
    const result = prioritizeIssues([warning, critical]);
    expect(result.issues[0]?.severity).toBe("critical");
    expect(result.issues[1]?.severity).toBe("warning");
  });

  it("is deterministic / stable across calls", () => {
    const candidates = makeCandidates(60);
    const a = prioritizeIssues(candidates).issues.map((i) => i.id);
    const b = prioritizeIssues(candidates).issues.map((i) => i.id);
    expect(a).toEqual(b);
  });
});
