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

  const [priorityCandidatesRaw, issuesForDetail, resolvedRaw] = await Promise.all([
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
  };
}
