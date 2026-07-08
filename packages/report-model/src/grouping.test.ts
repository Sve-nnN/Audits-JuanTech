import { describe, it, expect } from "vitest";
import { groupIssuesByType } from "./grouping";
import type { ReportIssue, ReportSeverity } from "./model";

/** Minimal ReportIssue fixture for grouping tests (only fields the helper reads). */
function makeIssue(overrides: Partial<ReportIssue> = {}): ReportIssue {
  return {
    id: `issue-${Math.random().toString(36).slice(2)}`,
    checkId: "TECH-01",
    category: "tech",
    title: "Falta canonical",
    severity: "critical",
    measuredValue: null,
    source: null,
    criterion: null,
    recommendation: null,
    fingerprint: `fp-${Math.random().toString(36).slice(2)}`,
    diffStatus: null,
    url: null,
    ...overrides,
  };
}

describe("groupIssuesByType", () => {
  it("returns an empty array for an empty input", () => {
    expect(groupIssuesByType([])).toEqual([]);
  });

  it("groups issues by checkId + title", () => {
    const issues = [
      makeIssue({ checkId: "ONPAGE-08", title: "H1 duplicado" }),
      makeIssue({ checkId: "ONPAGE-08", title: "H1 duplicado" }),
      makeIssue({ checkId: "ONPAGE-08", title: "Orden de headings" }),
    ];
    const groups = groupIssuesByType(issues);
    // Same checkId, different title → two distinct groups.
    expect(groups).toHaveLength(2);
    const dup = groups.find((g) => g.title === "H1 duplicado");
    const order = groups.find((g) => g.title === "Orden de headings");
    expect(dup?.count).toBe(2);
    expect(order?.count).toBe(1);
  });

  it("orders groups by severity worst-first (critical → warning → ok)", () => {
    const issues = [
      makeIssue({ checkId: "A", title: "grupo ok", severity: "ok" }),
      makeIssue({ checkId: "B", title: "grupo warning", severity: "warning" }),
      makeIssue({ checkId: "C", title: "grupo critical", severity: "critical" }),
    ];
    const groups = groupIssuesByType(issues);
    expect(groups.map((g) => g.severity)).toEqual(["critical", "warning", "ok"]);
  });

  it("orders groups of equal severity by count descending", () => {
    const issues = [
      // group "few": 1 critical
      makeIssue({ checkId: "FEW", title: "pocas", severity: "critical" }),
      // group "many": 3 critical
      makeIssue({ checkId: "MANY", title: "muchas", severity: "critical" }),
      makeIssue({ checkId: "MANY", title: "muchas", severity: "critical" }),
      makeIssue({ checkId: "MANY", title: "muchas", severity: "critical" }),
    ];
    const groups = groupIssuesByType(issues);
    expect(groups.map((g) => g.title)).toEqual(["muchas", "pocas"]);
    expect(groups[0]!.count).toBe(3);
    expect(groups[1]!.count).toBe(1);
  });

  it("reports the worst severity present in a group", () => {
    const issues = [
      makeIssue({ checkId: "MIX", title: "mixto", severity: "warning" }),
      makeIssue({ checkId: "MIX", title: "mixto", severity: "critical" }),
      makeIssue({ checkId: "MIX", title: "mixto", severity: "ok" }),
    ];
    const groups = groupIssuesByType(issues);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.severity).toBe("critical");
    expect(groups[0]!.count).toBe(3);
  });

  it("never loses or duplicates issues (sum of counts == input length)", () => {
    const severities: ReportSeverity[] = ["critical", "warning", "ok"];
    const issues = Array.from({ length: 30 }, (_, i) =>
      makeIssue({
        checkId: `CHK-${i % 5}`,
        title: `título ${i % 5}`,
        severity: severities[i % 3]!,
      })
    );
    const groups = groupIssuesByType(issues);
    const totalCount = groups.reduce((sum, g) => sum + g.count, 0);
    const totalIssues = groups.reduce((sum, g) => sum + g.issues.length, 0);
    expect(totalCount).toBe(issues.length);
    expect(totalIssues).toBe(issues.length);
  });

  it("gives the same per-type affected-page count in both sections (WR-01)", () => {
    // A single critical type affecting 65 pages — exceeds the former 60-row
    // screen cap that used to truncate "Issues prioritarios" before grouping.
    const affected = Array.from({ length: 65 }, () =>
      makeIssue({
        checkId: "TECH-99",
        title: "Sin HTTPS",
        severity: "critical",
        category: "tech",
      })
    );
    const otherType = makeIssue({
      checkId: "ONPAGE-01",
      title: "Meta description ausente",
      severity: "warning",
      category: "onpage",
    });

    // "Issues prioritarios": groups the FULL candidate set (all critical +
    // warning issues), no slice.
    const priorityGroups = groupIssuesByType([...affected, otherType]);
    // "Detalle por categoría": groups the same type within its category,
    // also uncapped.
    const categoryGroups = groupIssuesByType(affected);

    const inPriority = priorityGroups.find((g) => g.title === "Sin HTTPS");
    const inCategory = categoryGroups.find((g) => g.title === "Sin HTTPS");

    // The count must be the true total (65), identical in both sections — not
    // a value truncated to the old 60-row cap.
    expect(inPriority?.count).toBe(65);
    expect(inCategory?.count).toBe(65);
    expect(inPriority?.count).toBe(inCategory?.count);
  });

  it("preserves input order of issues within a group and does not mutate input", () => {
    const first = makeIssue({ checkId: "G", title: "g", severity: "warning", id: "first" });
    const second = makeIssue({ checkId: "G", title: "g", severity: "critical", id: "second" });
    const input = [first, second];
    const snapshot = [...input];
    const groups = groupIssuesByType(input);
    expect(groups[0]!.issues.map((i) => i.id)).toEqual(["first", "second"]);
    // Input array not mutated (same references, same order).
    expect(input).toEqual(snapshot);
  });
});
