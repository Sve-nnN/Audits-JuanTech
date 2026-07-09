import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @auditor/db so buildReportModel runs against injected data, never a real
// Postgres connection. Only the delegates buildReportModel touches are stubbed.
vi.mock("@auditor/db", () => ({
  prisma: {
    audit: { findUnique: vi.fn() },
    issue: { findMany: vi.fn() },
    page: { findMany: vi.fn() },
  },
}));

import { prisma } from "@auditor/db";
import { buildReportModel, MAX_PRIORITY_ROWS } from "./build";

const auditFindUnique = vi.mocked(prisma.audit.findUnique);
const issueFindMany = vi.mocked(prisma.issue.findMany);
const pageFindMany = vi.mocked(prisma.page.findMany);

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
  pageFindMany.mockReset();
  // Default: no page rows unless a test opts in (keeps graphless tests simple).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pageFindMany.mockResolvedValue([] as any);
});

describe("buildReportModel", () => {
  it("returns a populated ReportModel for a done audit with issues", async () => {
    const detailIssues = [
      makeIssue({ category: "tech", severity: "critical", checkId: "TECH-04:missing" }),
      makeIssue({ category: "aeo", severity: "warning", checkId: "RENDER-01:csr" }),
      makeIssue({ category: "onpage", severity: "ok", checkId: "ONPAGE-08:order" }),
      makeIssue({
        category: "schema",
        severity: "warning",
        checkId: "SCHEMA-05:product",
        source: "https://example.com/producto/1",
      }),
      makeIssue({
        category: "onpage",
        severity: "ok",
        checkId: "ONPAGE-09:no-url",
        source: null,
        scope: null,
      }),
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
    // onpage has 2 fixtures now (the original + a null-url one added for the
    // issuesByTemplate regression check below).
    expect(model!.issuesByCategory.onpage).toHaveLength(2);
    // url derived from source like the report's issueUrl helper.
    expect(model!.issuesByCategory.tech[0]!.url).toBe("https://example.com/");

    // issuesByTemplate: classified issue lands in its bucket.
    expect(model!.issuesByTemplate.product).toHaveLength(1);
    expect(model!.issuesByTemplate.product[0]!.checkId).toBe("SCHEMA-05:product");
    // Issues without a resolvable url are skipped from issuesByTemplate but
    // remain present in issuesByCategory (no regression to the existing axis).
    const templateTotal = Object.values(model!.issuesByTemplate).reduce(
      (sum, bucket) => sum + bucket.length,
      0
    );
    const nullUrlCount = detailIssues.filter(
      (i) => (i as { source: string | null }).source == null
    ).length;
    expect(templateTotal + nullUrlCount).toBe(detailIssues.length);
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

  // --- Architecture (Plan 20-02) --------------------------------------------

  /** makeAudit variant that persists a link graph at stats.graph. */
  function makeAuditWithGraph(depthByUrl: Record<string, number>, nodes: { url: string; pageId: string }[]) {
    return makeAudit({
      stats: {
        graph: { nodes, edges: [], depthByUrl },
      },
    });
  }

  it("groups graph nodes into 0/1/2/3+ depth buckets with title from Page rows", async () => {
    const nodes = [
      { url: "https://example.com/", pageId: "p-home" },
      { url: "https://example.com/a", pageId: "p-a" },
      { url: "https://example.com/b", pageId: "p-b" },
      { url: "https://example.com/producto/c", pageId: "p-c" },
    ];
    const depthByUrl = {
      "https://example.com/": 0,
      "https://example.com/a": 1,
      "https://example.com/b": 2,
      "https://example.com/producto/c": 4,
    };
    const pages = [
      { id: "p-home", url: "https://example.com/", title: "Inicio", finalUrl: null, statusCode: 200, error: null },
      { id: "p-a", url: "https://example.com/a", title: null, finalUrl: null, statusCode: 200, error: null },
      { id: "p-b", url: "https://example.com/b", title: "B", finalUrl: null, statusCode: 200, error: null },
      { id: "p-c", url: "https://example.com/producto/c", title: "C", finalUrl: null, statusCode: 200, error: null },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAuditWithGraph(depthByUrl, nodes) as any);
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pageFindMany.mockResolvedValueOnce(pages as any);

    const model = await buildReportModel("audit-1");
    const arch = model!.architecture!;
    expect(arch).toBeDefined();

    expect(arch.nodesByDepth["0"]).toHaveLength(1);
    expect(arch.nodesByDepth["0"][0]!.url).toBe("https://example.com/");
    expect(arch.nodesByDepth["0"][0]!.title).toBe("Inicio");

    expect(arch.nodesByDepth["1"]).toHaveLength(1);
    expect(arch.nodesByDepth["1"][0]!.url).toBe("https://example.com/a");
    // title is null when the Page has no title.
    expect(arch.nodesByDepth["1"][0]!.title).toBeNull();

    expect(arch.nodesByDepth["2"]).toHaveLength(1);
    expect(arch.nodesByDepth["2"][0]!.url).toBe("https://example.com/b");

    // depth 4 -> "3+" bucket, isDeep true; others isDeep false.
    expect(arch.nodesByDepth["3+"]).toHaveLength(1);
    const deep = arch.nodesByDepth["3+"][0]!;
    expect(deep.url).toBe("https://example.com/producto/c");
    expect(deep.isDeep).toBe(true);
    // template comes from classifyTemplate.
    expect(deep.template).toBe("product");
    expect(arch.nodesByDepth["0"][0]!.isDeep).toBe(false);
    expect(arch.nodesByDepth["1"][0]!.isDeep).toBe(false);
    expect(arch.nodesByDepth["2"][0]!.isDeep).toBe(false);

    // No orphans here — every page is a graph node.
    expect(arch.orphans).toHaveLength(0);
  });

  it("puts depth exactly 3 in the 3+ bucket with isDeep=false", async () => {
    const nodes = [{ url: "https://example.com/x", pageId: "p-x" }];
    const depthByUrl = { "https://example.com/x": 3 };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAuditWithGraph(depthByUrl, nodes) as any);
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any);
    pageFindMany.mockResolvedValueOnce([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { id: "p-x", url: "https://example.com/x", title: "X", finalUrl: null, statusCode: 200, error: null },
    ] as any);

    const model = await buildReportModel("audit-1");
    const arch = model!.architecture!;
    expect(arch.nodesByDepth["3+"]).toHaveLength(1);
    expect(arch.nodesByDepth["3+"][0]!.depth).toBe(3);
    expect(arch.nodesByDepth["3+"][0]!.isDeep).toBe(false);
  });

  it("collects crawled pages absent from the graph as orphans", async () => {
    const nodes = [{ url: "https://example.com/", pageId: "p-home" }];
    const depthByUrl = { "https://example.com/": 0 };
    const pages = [
      { id: "p-home", url: "https://example.com/", title: "Inicio", finalUrl: null, statusCode: 200, error: null },
      { id: "p-orphan", url: "https://example.com/orphan", title: "Huérfana", finalUrl: null, statusCode: 200, error: null },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAuditWithGraph(depthByUrl, nodes) as any);
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pageFindMany.mockResolvedValueOnce(pages as any);

    const model = await buildReportModel("audit-1");
    const arch = model!.architecture!;

    expect(arch.orphans).toHaveLength(1);
    const orphan = arch.orphans[0]!;
    expect(orphan.url).toBe("https://example.com/orphan");
    expect(orphan.isOrphan).toBe(true);
    expect(orphan.depth).toBe(-1);
    expect(orphan.title).toBe("Huérfana");
    // Orphan is absent from every depth bucket.
    const inBuckets = Object.values(arch.nodesByDepth).flat();
    expect(inBuckets.some((n) => n.url === "https://example.com/orphan")).toBe(false);
  });

  it("excludes broken pages (4xx/5xx or error) from nodes and orphans (WR-01/WR-02)", async () => {
    // p-home reachable & ok; p-404 is a graph node but returned 404; p-broken
    // is off-graph but failed to download (error set). Neither broken page
    // should appear as a node or as an orphan.
    const nodes = [
      { url: "https://example.com/", pageId: "p-home" },
      { url: "https://example.com/gone", pageId: "p-404" },
    ];
    const depthByUrl = { "https://example.com/": 0, "https://example.com/gone": 1 };
    const pages = [
      { id: "p-home", url: "https://example.com/", title: "Inicio", finalUrl: null, statusCode: 200, error: null },
      { id: "p-404", url: "https://example.com/gone", title: "404 Not Found", finalUrl: null, statusCode: 404, error: null },
      { id: "p-broken", url: "https://example.com/broken", title: null, finalUrl: null, statusCode: null, error: "timeout" },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAuditWithGraph(depthByUrl, nodes) as any);
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pageFindMany.mockResolvedValueOnce(pages as any);

    const model = await buildReportModel("audit-1");
    const arch = model!.architecture!;

    // Only the healthy home node is drawn; the 404 node is dropped (WR-02).
    const allNodes = Object.values(arch.nodesByDepth).flat();
    expect(allNodes).toHaveLength(1);
    expect(allNodes[0]!.url).toBe("https://example.com/");
    expect(allNodes.some((n) => n.url === "https://example.com/gone")).toBe(false);
    // The failed off-graph page is NOT mislabeled as an orphan (WR-01).
    expect(arch.orphans).toHaveLength(0);
  });

  it("leaves architecture undefined when the audit has no persisted graph", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAudit() as any); // stats.perf only, no graph
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any);

    const model = await buildReportModel("audit-1");
    expect(model!.architecture).toBeUndefined();
    // No page query when there is no graph.
    expect(pageFindMany).not.toHaveBeenCalled();
  });

  it("leaves architecture undefined when the graph has an empty nodes array", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAuditWithGraph({}, []) as any);
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any);

    const model = await buildReportModel("audit-1");
    expect(model!.architecture).toBeUndefined();
    expect(pageFindMany).not.toHaveBeenCalled();
  });
});
