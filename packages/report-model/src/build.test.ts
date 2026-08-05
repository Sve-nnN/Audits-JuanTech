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
import { buildReportModel, toReportStack, MAX_PRIORITY_ROWS, CATEGORY_ORDER } from "./build";
import { CATEGORY_WEIGHTS } from "@auditor/scoring";
import type { Category } from "@auditor/scoring";
import type { AxisResult, DetectedStack } from "@auditor/fingerprint";

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

/** A resolved AxisResult fixture. Signals carry debug detail toReportStack must drop. */
function axis(
  value: string | null,
  confidence: AxisResult["confidence"] = "alto"
): AxisResult {
  return {
    value,
    confidence,
    signals:
      value == null
        ? []
        : [{ id: "sig-1", axis: "cms", strength: "fuerte", evidence: `detected ${value}` }],
  };
}

/** DetectedStack fixture: WordPress+Elementor, Cloudflare CDN, no hosting, GA4. */
function makeDetectedStack(overrides: Partial<DetectedStack> = {}): DetectedStack {
  return {
    cms: axis("WordPress", "alto"),
    builder: axis("Elementor", "medio"),
    cdn: axis("Cloudflare", "alto"),
    hosting: axis(null, "no-detectado"),
    jsFramework: axis("Next.js", "medio"),
    analytics: [axis("Google Analytics 4", "alto")],
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

/**
 * Guardarraíl de exhaustividad de CATEGORY_ORDER.
 *
 * Este es el sitio crítico de los tres que declaran un orden de categorías:
 * `CATEGORY_ORDER` siembra los buckets de `issuesByCategory` y el `if (bucket)`
 * de `build.ts` descarta SIN ERROR todo issue cuya categoría no esté listada.
 * TypeScript no exige exhaustividad en un array `Category[]`, así que una
 * categoría nueva en el union puede quedar fuera sin romper compilación y sin
 * poner rojo ningún test: sus issues simplemente desaparecen del reporte y de
 * los tres exports. Este test convierte ese defecto silencioso en suite roja.
 *
 * La fuente de verdad en runtime es `Object.keys(CATEGORY_WEIGHTS)`, exhaustivo
 * por construcción al estar tipado `Record<Category, number>`. Deliberadamente
 * no se declara acá una lista literal de categorías, que sería otro sitio más
 * capaz de desincronizarse.
 */
describe("CATEGORY_ORDER", () => {
  it("cubre todas las categorías de CATEGORY_WEIGHTS", () => {
    expect([...CATEGORY_ORDER].sort()).toEqual(
      (Object.keys(CATEGORY_WEIGHTS) as Category[]).sort()
    );
  });
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

  /**
   * Guardarraíl del descarte silencioso de `issuesByCategory` (build.ts:243-249):
   * los buckets se siembran desde CATEGORY_ORDER y el `if (bucket)` tira sin
   * error todo issue cuya categoría no esté en ese array. Una categoría nueva
   * en el union `Category` pero ausente de CATEGORY_ORDER desaparece del
   * acordeón del reporte y de los exports sin ningún test rojo. Este test hace
   * pasar un issue `social` de punta a punta por buildReportModel (SCORE-01).
   */
  it("conserva un issue de categoría social hasta issuesByCategory.social", async () => {
    const socialIssue = makeIssue({
      category: "social",
      severity: "warning",
      checkId: "SOCIAL-01:og-title",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAudit() as any);
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([socialIssue] as any) // priorityCandidates
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([socialIssue] as any); // issuesForDetail

    const model = await buildReportModel("audit-1");

    expect(model).not.toBeNull();
    expect(model!.issuesByCategory.social).toHaveLength(1);
    expect(model!.issuesByCategory.social[0]!.checkId).toBe("SOCIAL-01:og-title");
  });

  // --- Social previews (Plan 32-01, PREVIEW-01) -----------------------------

  it("deriva socialPreviews del HTML de las páginas con issues sociales", async () => {
    const socialIssue = makeIssue({
      category: "social",
      severity: "critical",
      checkId: "SOCIAL-01",
      pageId: "p-social",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAudit() as any);
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([socialIssue] as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([socialIssue] as any);
    pageFindMany.mockResolvedValueOnce([
      {
        id: "p-social",
        url: "https://example.com/post",
        finalUrl: null,
        html: `<html><head><title>Nativo</title><meta property="og:description" content="Desde OG"></head><body></body></html>`,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const model = await buildReportModel("audit-1");

    const preview = model!.socialPreviews!["p-social"]!;
    expect(preview.pageId).toBe("p-social");
    expect(preview.pageUrl).toBe("https://example.com/post");
    expect(preview.domain).toBe("example.com");
    // Sin og:title, el <title> nativo llena el hueco pero la bandera queda en false.
    expect(preview.title).toBe("Nativo");
    expect(preview.ogTitleDeclared).toBe(false);
    expect(preview.description).toBe("Desde OG");
    expect(preview.ogDescriptionDeclared).toBe(true);
    expect(preview.imageStatus).toBe("none");
    // La consulta de páginas está acotada a los ids con problema social.
    expect(pageFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["p-social"] } },
      select: { id: true, url: true, finalUrl: true, html: true },
    });
    // El propio issue conserva su pageId en el modelo (Gap 1).
    expect(model!.issuesByCategory.social[0]!.pageId).toBe("p-social");
  });

  it("no consulta páginas ni define socialPreviews sin issues sociales críticos", async () => {
    const okSocial = makeIssue({
      category: "social",
      severity: "ok",
      checkId: "SOCIAL-01",
      pageId: "p-social",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAudit() as any);
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([okSocial] as any);

    const model = await buildReportModel("audit-1");

    expect(model!.socialPreviews).toBeUndefined();
    expect(pageFindMany).not.toHaveBeenCalled();
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

  // --- Architecture (Plan 22-01) --------------------------------------------

  /** makeAudit variant that persists a link graph at stats.graph. */
  function makeAuditWithGraph(
    depthByUrl: Record<string, number>,
    nodes: { url: string; pageId: string }[],
    edges: { from: string; to: string }[] = []
  ) {
    return makeAudit({
      stats: {
        graph: { nodes, edges, depthByUrl },
      },
    });
  }

  /** Find a node anywhere in the reconstructed tree by url. */
  type TreeNode = {
    url: string;
    title: string | null;
    depth: number;
    template: string;
    isDeep: boolean;
    isOrphan: boolean;
    children: TreeNode[];
  };
  function findInTree(tree: TreeNode[], url: string): TreeNode | undefined {
    for (const node of tree) {
      if (node.url === url) return node;
      const found = findInTree(node.children, url);
      if (found) return found;
    }
    return undefined;
  }
  function childUrls(node: TreeNode | undefined): string[] {
    return (node?.children ?? []).map((c) => c.url);
  }

  it("maps node signals (title, depth, template, isDeep) from Page rows", async () => {
    // No edges → every valid node is a root; asserts the per-node v1.3 signals.
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

    // No edges → 4 roots (all nodes), stable graph.nodes order.
    expect(arch.tree.map((n) => n.url)).toEqual([
      "https://example.com/",
      "https://example.com/a",
      "https://example.com/b",
      "https://example.com/producto/c",
    ]);

    const home = findInTree(arch.tree, "https://example.com/")!;
    expect(home.title).toBe("Inicio");
    expect(home.isDeep).toBe(false);

    const a = findInTree(arch.tree, "https://example.com/a")!;
    // title is null when the Page has no title.
    expect(a.title).toBeNull();
    expect(a.isDeep).toBe(false);

    const b = findInTree(arch.tree, "https://example.com/b")!;
    expect(b.depth).toBe(2);
    expect(b.isDeep).toBe(false);

    // depth 4 -> isDeep true; template comes from classifyTemplate.
    const deep = findInTree(arch.tree, "https://example.com/producto/c")!;
    expect(deep.isDeep).toBe(true);
    expect(deep.template).toBe("product");

    // No orphans here — every page is a graph node.
    expect(arch.orphans).toHaveLength(0);
  });

  it("reconstructs parent-child hierarchy from edges", async () => {
    const nodes = [
      { url: "https://example.com/", pageId: "p-home" },
      { url: "https://example.com/a", pageId: "p-a" },
      { url: "https://example.com/b", pageId: "p-b" },
      { url: "https://example.com/a/c", pageId: "p-c" },
    ];
    const depthByUrl = {
      "https://example.com/": 0,
      "https://example.com/a": 1,
      "https://example.com/b": 1,
      "https://example.com/a/c": 2,
    };
    const edges = [
      { from: "https://example.com/", to: "https://example.com/a" },
      { from: "https://example.com/", to: "https://example.com/b" },
      { from: "https://example.com/a", to: "https://example.com/a/c" },
    ];
    const pages = [
      { id: "p-home", url: "https://example.com/", title: "Inicio", finalUrl: null, statusCode: 200, error: null },
      { id: "p-a", url: "https://example.com/a", title: "A", finalUrl: null, statusCode: 200, error: null },
      { id: "p-b", url: "https://example.com/b", title: "B", finalUrl: null, statusCode: 200, error: null },
      { id: "p-c", url: "https://example.com/a/c", title: "C", finalUrl: null, statusCode: 200, error: null },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAuditWithGraph(depthByUrl, nodes, edges) as any);
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pageFindMany.mockResolvedValueOnce(pages as any);

    const model = await buildReportModel("audit-1");
    const arch = model!.architecture!;

    // Single root = home; A and B hang off home; C hangs off A.
    expect(arch.tree.map((n) => n.url)).toEqual(["https://example.com/"]);
    const home = arch.tree[0]! as unknown as TreeNode;
    expect(childUrls(home)).toEqual(["https://example.com/a", "https://example.com/b"]);
    const a = findInTree(arch.tree as unknown as TreeNode[], "https://example.com/a");
    expect(childUrls(a)).toEqual(["https://example.com/a/c"]);

    // C conserves its v1.3 signals.
    const c = findInTree(arch.tree as unknown as TreeNode[], "https://example.com/a/c")!;
    expect(c.depth).toBe(2);
    expect(c.isDeep).toBe(false);
    // template is preserved from classifyTemplate for the child node.
    expect(c.template).toBe("category");
  });

  it("assigns the lowest-depth linker as parent", async () => {
    // leaf (depth 2) is linked by BOTH mid (depth 1, listed first) and home
    // (depth 0). The lower-depth linker (home) must win regardless of edge order.
    const nodes = [
      { url: "https://example.com/", pageId: "p-home" },
      { url: "https://example.com/mid", pageId: "p-mid" },
      { url: "https://example.com/leaf", pageId: "p-leaf" },
    ];
    const depthByUrl = {
      "https://example.com/": 0,
      "https://example.com/mid": 1,
      "https://example.com/leaf": 2,
    };
    const edges = [
      { from: "https://example.com/", to: "https://example.com/mid" },
      { from: "https://example.com/mid", to: "https://example.com/leaf" },
      { from: "https://example.com/", to: "https://example.com/leaf" },
    ];
    const pages = [
      { id: "p-home", url: "https://example.com/", title: "Inicio", finalUrl: null, statusCode: 200, error: null },
      { id: "p-mid", url: "https://example.com/mid", title: "Mid", finalUrl: null, statusCode: 200, error: null },
      { id: "p-leaf", url: "https://example.com/leaf", title: "Leaf", finalUrl: null, statusCode: 200, error: null },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAuditWithGraph(depthByUrl, nodes, edges) as any);
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pageFindMany.mockResolvedValueOnce(pages as any);

    const model = await buildReportModel("audit-1");
    const arch = model!.architecture! as unknown as { tree: TreeNode[]; orphans: unknown[] };

    // Single root = home; leaf is a child of home, NOT of mid.
    expect(arch.tree.map((n) => n.url)).toEqual(["https://example.com/"]);
    const home = arch.tree[0]!;
    expect(childUrls(home)).toEqual(["https://example.com/mid", "https://example.com/leaf"]);
    const mid = findInTree(arch.tree, "https://example.com/mid");
    expect(childUrls(mid)).toEqual([]);
  });

  it("keeps a node at depth exactly 3 with isDeep=false", async () => {
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
    expect(arch.tree).toHaveLength(1);
    expect(arch.tree[0]!.depth).toBe(3);
    expect(arch.tree[0]!.isDeep).toBe(false);
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
    // Orphan is absent from the tree.
    expect(findInTree(arch.tree as unknown as TreeNode[], "https://example.com/orphan")).toBeUndefined();
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
    expect(arch.tree.map((n) => n.url)).toEqual(["https://example.com/"]);
    expect(findInTree(arch.tree as unknown as TreeNode[], "https://example.com/gone")).toBeUndefined();
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

  // --- Stack (Plan 26-03, FPRINT-09 / STACKUI-02) ---------------------------

  it("builds model.stack from the persisted Audit.stack (no re-detection)", async () => {
    // audit.stack is present; no page HTML is provided. If stack still populates,
    // buildReportModel read the persisted value instead of re-running detection.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAudit({ stack: makeDetectedStack() }) as any);
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any);

    const model = await buildReportModel("audit-1");
    expect(model!.stack).toBeDefined();
    // CMS+builder combined into the CMS axis; no separate builder axis exists.
    expect(model!.stack!.cms.value).toBe("WordPress (Elementor)");
    expect(model!.stack!.cdn.value).toBe("Cloudflare");
    // Debug detection signals are never carried into the serialized model.
    expect(JSON.stringify(model!.stack)).not.toContain("signals");
    expect(JSON.stringify(model!.stack)).not.toContain("evidence");
  });

  it("leaves model.stack undefined when Audit.stack is null (pre-v1.5 audits)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAudit({ stack: null }) as any);
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any);

    const model = await buildReportModel("audit-1");
    expect(model!.stack).toBeUndefined();
  });

  // --- CMS recommendation integration (Plan 27-03, CMSFIX-04/05) -------------
  // The real persisted `Issue.checkId` is the bare id (e.g. "ONPAGE-04",
  // "TECH-10") — matching @auditor/cms-adapters SUPPORTED_CHECK_IDS exactly.
  // These generics are the verbatim strings the checks package emits today; the
  // engine returns them byte-identical whenever it does not personalize.
  const GENERIC_ONPAGE04 =
    "Agrega texto alternativo descriptivo a las imágenes que faltan, para accesibilidad y para que los buscadores entiendan su contenido.";
  const GENERIC_TECH10 = "Añade etiquetas hreflang para las variantes de idioma.";
  const OK_RECOMMENDATION = "Sin acción necesaria.";

  it("keeps the ok-severity recommendation verbatim even under an activating stack (guard)", async () => {
    // ONPAGE-01 is a supported checkId; were the guard absent, the WordPress
    // adapter WOULD rewrite it. Severity "ok" must short-circuit before the engine.
    const okIssue = makeIssue({
      checkId: "ONPAGE-01",
      category: "onpage",
      severity: "ok",
      recommendation: OK_RECOMMENDATION,
      source: "https://example.com/",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAudit({ stack: makeDetectedStack() }) as any);
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([] as any) // priority: no critical/warning
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([okIssue] as any); // detail

    const model = await buildReportModel("audit-1");
    expect(model!.issuesByCategory.onpage[0]!.recommendation).toBe(OK_RECOMMENDATION);
  });

  it("personalizes an ONPAGE-04 warning under a WordPress stack (≠ generic, starts with 'En WordPress')", async () => {
    const issue = makeIssue({
      checkId: "ONPAGE-04",
      category: "onpage",
      severity: "warning",
      recommendation: GENERIC_ONPAGE04,
      source: "https://example.com/",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAudit({ stack: makeDetectedStack() }) as any);
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([issue] as any) // priorityCandidates
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([issue] as any); // issuesForDetail

    const model = await buildReportModel("audit-1");
    const rec = model!.priorityIssues[0]!.recommendation!;
    expect(rec).not.toBe(GENERIC_ONPAGE04);
    expect(rec.startsWith("En WordPress")).toBe(true);
    // Same resolution flows into the per-category detail (single source of truth).
    expect(model!.issuesByCategory.onpage[0]!.recommendation).toBe(rec);
  });

  it("leaves a check outside the 10 (TECH-10) byte-identical to its generic (CMSFIX-04)", async () => {
    const issue = makeIssue({
      checkId: "TECH-10",
      category: "tech",
      severity: "warning",
      recommendation: GENERIC_TECH10,
      source: "https://example.com/",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAudit({ stack: makeDetectedStack() }) as any);
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([issue] as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([issue] as any);

    const model = await buildReportModel("audit-1");
    expect(model!.priorityIssues[0]!.recommendation).toBe(GENERIC_TECH10);
  });

  it("falls back to the generic for a supported check when Audit.stack is null", async () => {
    const issue = makeIssue({
      checkId: "ONPAGE-04",
      category: "onpage",
      severity: "warning",
      recommendation: GENERIC_ONPAGE04,
      source: "https://example.com/",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditFindUnique.mockResolvedValueOnce(makeAudit({ stack: null }) as any);
    issueFindMany
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([issue] as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([issue] as any);

    const model = await buildReportModel("audit-1");
    expect(model!.priorityIssues[0]!.recommendation).toBe(GENERIC_ONPAGE04);
  });
});

describe("toReportStack", () => {
  it("maps the 5 axes carrying only { value, confidence } (drops signals)", () => {
    const stack = toReportStack(makeDetectedStack());

    // Single-value axes are present with just value + confidence.
    for (const axis of [stack.cms, stack.cdn, stack.hosting, stack.jsFramework]) {
      expect(Object.keys(axis).sort()).toEqual(["confidence", "value"]);
      expect(axis).not.toHaveProperty("signals");
    }
    for (const axis of stack.analytics) {
      expect(Object.keys(axis).sort()).toEqual(["confidence", "value"]);
      expect(axis).not.toHaveProperty("signals");
    }
    expect(stack.cdn.value).toBe("Cloudflare");
    expect(stack.cdn.confidence).toBe("alto");
    // A non-detected axis keeps null value + no-detectado confidence.
    expect(stack.hosting.value).toBeNull();
    expect(stack.hosting.confidence).toBe("no-detectado");
  });

  it("combines CMS + builder into a single value with the CMS confidence", () => {
    const stack = toReportStack(
      makeDetectedStack({
        cms: axis("WordPress", "alto"),
        builder: axis("Elementor", "bajo"),
      })
    );
    expect(stack.cms.value).toBe("WordPress (Elementor)");
    // Confidence shown is the CMS one, NOT the builder's (builder is a refinement).
    expect(stack.cms.confidence).toBe("alto");
  });

  it("keeps the plain CMS value when there is no builder", () => {
    const stack = toReportStack(
      makeDetectedStack({
        cms: axis("WordPress", "alto"),
        builder: axis(null, "no-detectado"),
      })
    );
    expect(stack.cms.value).toBe("WordPress");
  });

  it("does not combine a builder when the CMS is not WordPress", () => {
    const stack = toReportStack(
      makeDetectedStack({
        cms: axis("Shopify", "alto"),
        // A stray builder value must never leak into a non-WordPress CMS label.
        builder: axis("Elementor", "medio"),
      })
    );
    expect(stack.cms.value).toBe("Shopify");
  });

  it("maps analytics as an ordered array preserving coexistence", () => {
    const stack = toReportStack(
      makeDetectedStack({
        analytics: [
          axis("Google Analytics 4", "alto"),
          axis("Google Tag Manager", "alto"),
          axis("Meta Pixel", "medio"),
        ],
      })
    );
    expect(stack.analytics.map((a) => a.value)).toEqual([
      "Google Analytics 4",
      "Google Tag Manager",
      "Meta Pixel",
    ]);
    expect(stack.analytics[2]!.confidence).toBe("medio");
  });

  it("maps an empty analytics array to []", () => {
    const stack = toReportStack(makeDetectedStack({ analytics: [] }));
    expect(stack.analytics).toEqual([]);
  });
});
