import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @auditor/db so buildReportModel runs against injected data, never a real
// Postgres connection. Only the delegates buildReportModel touches are stubbed.
vi.mock("@auditor/db", () => ({
  prisma: {
    audit: { findUnique: vi.fn() },
    issue: { findMany: vi.fn() },
  },
}));

import { prisma } from "@auditor/db";
import { buildReportModel, MAX_PRIORITY_ROWS } from "./build";

const auditFindUnique = vi.mocked(prisma.audit.findUnique);
const issueFindMany = vi.mocked(prisma.issue.findMany);

/** Persisted-issue fixture with every field buildReportModel reads. */
function makeIssue(
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    id: `issue-${Math.random().toString(36).slice(2)}`,
    auditId: "audit-1",
    pageId: null,
    checkId: "TECH-01",
    category: "tech",
    title: "Falta canonical",
    severity: "critical",
    fingerprint: "fp-1",
    measuredValue: "0",
    source: "https://example.com/",
    criterion: "Debe existir un canonical",
    scope: null,
    recommendation: "Añade una etiqueta canonical",
    diffStatus: "new",
    createdAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  };
}

function makeAudit(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "audit-1",
    siteId: "site-1",
    emailId: "email-1",
    status: "done",
    urlLimit: 500,
    stats: {
      perf: {
        sampledPages: 2,
        sampledUrls: ["https://example.com/"],
        mobile: { avgScore: 80, avgLcpMs: 2000, avgCls: 0.1, avgInpMs: 200, avgTtfbMs: 300 },
        desktop: { avgScore: 90, avgLcpMs: 1500, avgCls: 0.05, avgInpMs: 100, avgTtfbMs: 200 },
      },
    },
    scores: {
      overall: 72,
      status: "needs_improvement",
      byCategory: {
        tech: { score: 60, status: "needs_improvement" },
        perf: { score: 85, status: "needs_improvement" },
      },
      diff: {
        newCount: 1,
        persistentCount: 0,
        resolvedCount: 0,
        resolvedFingerprints: [],
        previousAuditId: null,
      },
    },
    error: null,
    createdAt: new Date("2026-07-01T00:00:00Z"),
    startedAt: new Date("2026-07-01T00:01:00Z"),
    finishedAt: new Date("2026-07-01T00:05:00Z"),
    site: { id: "site-1", domain: "example.com" },
    ...overrides,
  };
}

beforeEach(() => {
  auditFindUnique.mockReset();
  issueFindMany.mockReset();
});

describe("buildReportModel", () => {
  it("returns a populated ReportModel for a done audit with issues", async () => {
    const detailIssues = [
      makeIssue({ category: "tech", severity: "critical", checkId: "TECH-04:missing" }),
      makeIssue({ category: "aeo", severity: "warning", checkId: "RENDER-01:csr" }),
      makeIssue({ category: "onpage", severity: "ok", checkId: "ONPAGE-08:order" }),
    ];
    const priority = detailIssues.filter((i) => i.severity !== "ok");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAudit() as any);
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(priority as any) // priorityCandidates
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(detailIssues as any); // issuesForDetail

    const model = await buildReportModel("audit-1");

    expect(model).not.toBeNull();
    expect(model!.overall).toBe(72);
    expect(model!.status).toBe("needs_improvement");
    expect(model!.byCategory.tech?.score).toBe(60);
    expect(model!.audit.domain).toBe("example.com");
    expect(model!.perf?.sampledPages).toBe(2);
    // Every persisted issue is grouped under its category.
    expect(model!.issuesByCategory.tech).toHaveLength(1);
    expect(model!.issuesByCategory.aeo).toHaveLength(1);
    expect(model!.issuesByCategory.onpage).toHaveLength(1);
    // url derived from source like the report's issueUrl helper.
    expect(model!.issuesByCategory.tech[0]!.url).toBe("https://example.com/");
  });

  it("returns null for a non-existent audit", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(null as any);
    const model = await buildReportModel("missing");
    expect(model).toBeNull();
  });

  it("returns null when the audit status is not done", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAudit({ status: "running" }) as any);
    const model = await buildReportModel("audit-1");
    expect(model).toBeNull();
  });

  it("exposes the full critical+warning set while capping priorityIssues at 60", async () => {
    const many = Array.from({ length: 65 }, (_, i) =>
      makeIssue({ severity: i % 2 === 0 ? "critical" : "warning", checkId: `C-${i}` })
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAudit() as any);
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(many as any) // priorityCandidates (no take)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(many as any); // issuesForDetail

    const model = await buildReportModel("audit-1");

    expect(model!.priorityCandidates).toHaveLength(65);
    expect(model!.totalPriorityCandidates).toBe(65);
    expect(model!.priorityIssues).toHaveLength(MAX_PRIORITY_ROWS);
    // The screen/exports note "mostrando N de M" fires only when M > N.
    expect(model!.totalPriorityCandidates).toBeGreaterThan(model!.priorityIssues.length);
  });

  it("never leaks PII (email/token) in the serialized model", async () => {
    // Sentinel PII on the audit row + issues, in fields OUTSIDE buildReportModel's
    // whitelist (emailId is a real FK column; email/verificationToken/token are
    // adjacent columns). buildReportModel must map only whitelisted fields, so
    // none of this may reach the model — making this a real leak detector.
    const CANARY_EMAIL = "pii-leak-canary@example.com";
    const CANARY_TOKEN = "SECRET_TOKEN_CANARY";
    const audit = makeAudit({
      emailId: "email-1",
      email: { address: CANARY_EMAIL, verificationToken: CANARY_TOKEN },
      verificationToken: CANARY_TOKEN,
    });
    const detailIssues = [makeIssue({ email: CANARY_EMAIL, token: CANARY_TOKEN })];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(audit as any);
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(detailIssues as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(detailIssues as any);

    const model = await buildReportModel("audit-1");
    const serialized = JSON.stringify(model);

    // No PII KEY leaks — a plain /"email"/ would miss a leaked "emailId" key, so
    // match the whole family of PII key names (email/emailId/token/verification*).
    expect(serialized).not.toMatch(/"(email\w*|token\w*|verification\w*)"/i);
    // No PII VALUE leaks. (Dropped the brittle not.toContain("@"): legit model
    // content — a mailto: link or a URL with userinfo — may contain "@".)
    expect(serialized).not.toContain(CANARY_EMAIL);
    expect(serialized).not.toContain(CANARY_TOKEN);
  });
});
