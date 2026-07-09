import { prisma } from "@auditor/db";
import type { Category, ScoreStatus, CategoryScoreResult } from "@auditor/scoring";
import type {
  ReportModel,
  ReportIssue,
  ReportDiff,
  ReportPerf,
  ReportResolvedIssue,
  ReportSeverity,
  ReportDiffStatus,
  ArchNode,
  ReportArchitecture,
} from "./model";
import { classifyTemplate, TEMPLATE_ORDER } from "./template";
import type { PageTemplate } from "./template";

/** Max priority rows the on-screen table renders (screen cap, NOT the total). */
export const MAX_PRIORITY_ROWS = 60;

const CATEGORY_ORDER: Category[] = ["tech", "perf", "onpage", "schema", "aeo"];

/** Shape persisted at `Audit.scores` by the worker (Phase 6, SCORE-01..05 + DIFF-01/02). */
interface AuditScores {
  overall: number;
  status: ScoreStatus;
  byCategory: Partial<Record<Category, CategoryScoreResult>>;
  diff: {
    newCount: number;
    persistentCount: number;
    resolvedCount: number;
    resolvedFingerprints: string[];
    previousAuditId: string | null;
  };
}

/** Shape persisted at `Audit.stats` by the worker. */
interface AuditStats {
  perf?: ReportPerf;
  /**
   * Link graph persisted once per audit by the worker (Phase 16, mirrors the
   * `LinkGraph` shape from `@auditor/graph`). `edges` is unused here.
   */
  graph?: {
    nodes: { url: string; pageId: string }[];
    edges: unknown[];
    depthByUrl: Record<string, number>;
  };
}

/** Minimal Page row buildReportModel loads to build the architecture model. */
interface ArchPageRow {
  id: string;
  url: string;
  title: string | null;
  finalUrl: string | null;
  statusCode: number | null;
  error: string | null;
}

/**
 * A page that failed to download (error set) or returned a 4xx/5xx is not part
 * of the real site architecture: it must not be drawn as a legitimate node
 * (WR-02) nor mislabeled as an orphan (WR-01). Pages with no status yet are
 * treated as broken (they never resolved).
 */
function isBrokenPage(page: ArchPageRow): boolean {
  if (page.error != null) return true;
  if (page.statusCode == null) return true;
  return page.statusCode >= 400;
}

/** Minimal persisted-issue shape buildReportModel reads. */
interface IssueRow {
  id: string;
  checkId: string;
  category: string;
  title: string;
  severity: string;
  measuredValue: string | null;
  source: string | null;
  criterion: string | null;
  scope: string | null;
  recommendation: string | null;
  fingerprint: string;
  diffStatus: string | null;
}

/**
 * The URL an issue is about. Page-level checks put the page URL in `source`;
 * some checks append " (enlazado desde X)" — keep just the leading URL. Falls
 * back to `scope`. Mirrors the report's `issueUrl` helper verbatim to keep the
 * rendered output identical.
 */
function issueUrl(issue: { source: string | null; scope: string | null }): string | null {
  const raw = issue.source ?? issue.scope ?? null;
  if (!raw) return null;
  const firstToken = raw.split(" ")[0] ?? raw;
  return firstToken;
}

function toReportIssue(issue: IssueRow): ReportIssue {
  return {
    id: issue.id,
    checkId: issue.checkId,
    category: issue.category,
    title: issue.title,
    severity: issue.severity as ReportSeverity,
    measuredValue: issue.measuredValue,
    source: issue.source,
    criterion: issue.criterion,
    recommendation: issue.recommendation,
    fingerprint: issue.fingerprint,
    diffStatus: (issue.diffStatus as ReportDiffStatus | null) ?? null,
    url: issueUrl({ source: issue.source, scope: issue.scope }),
  };
}

/**
 * Assemble the shared, serializable `ReportModel` for an audit from persisted
 * data only (Audit.scores/stats, Issue rows) — no checks are recomputed. Returns
 * `null` when the audit does not exist or is not yet `done`; the caller handles
 * notFound()/progress.
 */
export async function buildReportModel(auditId: string): Promise<ReportModel | null> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: { site: true },
  });

  if (!audit || audit.status !== "done") return null;

  const scores = audit.scores as unknown as AuditScores | null;
  const stats = audit.stats as unknown as AuditStats | null;
  const perf = stats?.perf;
  const graph = stats?.graph;
  const hasGraph = !!graph && graph.nodes.length > 0;

  const [priorityCandidatesRaw, issuesForDetail, resolvedRaw, pagesRaw] = await Promise.all([
    // ALL critical+warning issues, no take — single source for both the full
    // candidate set (M) and the screen-capped slice (N).
    prisma.issue.findMany({
      where: { auditId, severity: { in: ["critical", "warning"] } },
      orderBy: [{ severity: "asc" }, { category: "asc" }],
    }),
    // Every persisted issue, for the per-category detail accordion.
    prisma.issue.findMany({
      where: { auditId },
      orderBy: [{ category: "asc" }, { severity: "asc" }, { checkId: "asc" }],
    }),
    scores?.diff.previousAuditId && scores.diff.resolvedFingerprints.length > 0
      ? prisma.issue.findMany({
          where: {
            auditId: scores.diff.previousAuditId,
            fingerprint: { in: scores.diff.resolvedFingerprints },
          },
          select: { checkId: true, title: true, category: true },
        })
      : Promise.resolve([]),
    // SINGLE additional query, only when a graph exists — same round-trip as the
    // issue reads. `title` is a real column (Plan 20-01), so this select typechecks.
    hasGraph
      ? prisma.page.findMany({
          where: { auditId },
          select: { id: true, url: true, title: true, finalUrl: true, statusCode: true, error: true },
        })
      : Promise.resolve([]),
  ]);

  const priorityCandidates = (priorityCandidatesRaw as unknown as IssueRow[]).map(toReportIssue);
  const priorityIssues = priorityCandidates.slice(0, MAX_PRIORITY_ROWS);
  const totalPriorityCandidates = priorityCandidates.length;

  const issuesByCategory = Object.fromEntries(
    CATEGORY_ORDER.map((c) => [c, [] as ReportIssue[]])
  ) as Record<Category, ReportIssue[]>;
  for (const issue of issuesForDetail as unknown as IssueRow[]) {
    const bucket = issuesByCategory[issue.category as Category];
    if (bucket) bucket.push(toReportIssue(issue));
  }

  const issuesByTemplate = Object.fromEntries(
    TEMPLATE_ORDER.map((t) => [t, [] as ReportIssue[]])
  ) as Record<PageTemplate, ReportIssue[]>;
  for (const issue of issuesForDetail as unknown as IssueRow[]) {
    const reportIssue = toReportIssue(issue);
    if (reportIssue.url != null) {
      issuesByTemplate[classifyTemplate(reportIssue.url)].push(reportIssue);
    }
  }

  const resolvedIssues: ReportResolvedIssue[] = (
    resolvedRaw as unknown as ReportResolvedIssue[]
  ).map((r) => ({ checkId: r.checkId, title: r.title, category: r.category }));

  // Site architecture from the persisted link graph + the single Page-rows load.
  // Undefined for graphless (pre-Phase-16) audits — the UI hides the section.
  let architecture: ReportArchitecture | undefined;
  if (hasGraph && graph) {
    const pages = pagesRaw as unknown as ArchPageRow[];
    const pagesById = new Map(pages.map((p) => [p.id, p]));
    const nodePageIds = new Set(graph.nodes.map((n) => n.pageId));
    const brokenPageIds = new Set(pages.filter(isBrokenPage).map((p) => p.id));

    const nodesByDepth: ReportArchitecture["nodesByDepth"] = {
      "0": [],
      "1": [],
      "2": [],
      "3+": [],
    };
    for (const node of graph.nodes) {
      // WR-02: a 4xx/5xx page can carry HTML (an error page) and thus land in
      // the persisted graph — skip it so broken URLs aren't drawn as real
      // architecture nodes.
      if (brokenPageIds.has(node.pageId)) continue;
      const depth = graph.depthByUrl[node.url] ?? 0;
      const bucket = depth >= 3 ? "3+" : (String(depth) as "0" | "1" | "2");
      const archNode: ArchNode = {
        url: node.url,
        title: pagesById.get(node.pageId)?.title ?? null,
        depth,
        template: classifyTemplate(node.url),
        isDeep: depth > 3,
        isOrphan: false,
      };
      nodesByDepth[bucket].push(archNode);
    }

    const orphans: ArchNode[] = [];
    for (const page of pages) {
      if (nodePageIds.has(page.id)) continue;
      // WR-01: a page that failed to download or returned 4xx/5xx is broken,
      // not an orphan — don't mislabel it as unreachable-but-valid structure.
      if (isBrokenPage(page)) continue;
      orphans.push({
        url: page.url,
        title: page.title ?? null,
        depth: -1,
        template: classifyTemplate(page.url),
        isDeep: false,
        isOrphan: true,
      });
    }

    architecture = { nodesByDepth, orphans };
  }

  const diff: ReportDiff = {
    previousAuditId: scores?.diff.previousAuditId ?? null,
    newCount: scores?.diff.newCount ?? 0,
    persistentCount: scores?.diff.persistentCount ?? 0,
    resolvedCount: scores?.diff.resolvedCount ?? 0,
    resolvedIssues,
  };

  return {
    audit: {
      domain: audit.site.domain,
      createdAt: audit.createdAt,
      finishedAt: audit.finishedAt,
      urlLimit: audit.urlLimit,
      status: audit.status,
    },
    hasScores: scores != null,
    overall: scores?.overall ?? null,
    status: scores?.status ?? "critical",
    byCategory: scores?.byCategory ?? {},
    diff,
    priorityCandidates,
    priorityIssues,
    totalPriorityCandidates,
    issuesByCategory,
    issuesByTemplate,
    perf,
    architecture,
  };
}
