import { describe, it, expect } from "vitest";
import { diffIssues } from "./diff";

describe("diffIssues", () => {
  it("marks a fingerprint only in current as new", () => {
    const result = diffIssues([{ fingerprint: "A" }], []);
    expect(result.statusByFingerprint.get("A")).toBe("new");
    expect(result.resolved).toEqual([]);
  });

  it("marks a fingerprint in both current and previous as persistent", () => {
    const result = diffIssues([{ fingerprint: "A" }], [{ fingerprint: "A" }]);
    expect(result.statusByFingerprint.get("A")).toBe("persistent");
    expect(result.resolved).toEqual([]);
  });

  it("marks a fingerprint only in previous as resolved", () => {
    const result = diffIssues([], [{ fingerprint: "A" }]);
    expect(result.statusByFingerprint.size).toBe(0);
    expect(result.resolved).toEqual(["A"]);
  });

  it("handles a realistic mixed set", () => {
    const current = [{ fingerprint: "A" }, { fingerprint: "B" }, { fingerprint: "C" }];
    const previous = [{ fingerprint: "A" }, { fingerprint: "D" }];

    const result = diffIssues(current, previous);

    expect(result.statusByFingerprint.get("A")).toBe("persistent");
    expect(result.statusByFingerprint.get("B")).toBe("new");
    expect(result.statusByFingerprint.get("C")).toBe("new");
    expect(result.resolved).toEqual(["D"]);
  });

  it("is a pure function with no side effects on inputs", () => {
    const current = [{ fingerprint: "A" }];
    const previous = [{ fingerprint: "A" }];
    diffIssues(current, previous);
    expect(current).toEqual([{ fingerprint: "A" }]);
    expect(previous).toEqual([{ fingerprint: "A" }]);
  });

  it("returns empty results for two empty sets", () => {
    const result = diffIssues([], []);
    expect(result.statusByFingerprint.size).toBe(0);
    expect(result.resolved).toEqual([]);
  });
});
