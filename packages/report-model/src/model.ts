import type { Category, ScoreStatus, CategoryScoreResult } from "@auditor/scoring";
import type { PageTemplate } from "./template";

/**
 * Serializable report model shared by the on-screen report
 * (`apps/web/app/audits/[id]/page.tsx`) and the export serializers
 * (`@auditor/export`, Plans 02/03). Pure data — no React, no classes, no
 * Prisma models. NEVER contains PII (email / verification token); only audit
 * data (audited URL, score, categories, issues, pages).
 */

export type ReportSeverity = "critical" | "warning" | "ok";
export type ReportDiffStatus = "new" | "persistent" | "resolved";

/**
 * The subset of a persisted Issue that the report uses, plus the derived `url`
 * the issue is about (resolved exactly like the report's `issueUrl` helper).
 */
export interface ReportIssue {
  id: string;
  checkId: string;
  category: string;
  title: string;
  severity: ReportSeverity;
  measuredValue: string | null;
  source: string | null;
  criterion: string | null;
  recommendation: string | null;
  fingerprint: string;
  diffStatus: ReportDiffStatus | null;
  /** URL the issue is about, derived from `source`/`scope`. */
  url: string | null;
}

/** A resolved issue carried over from the previous audit's diff. */
export interface ReportResolvedIssue {
  checkId: string;
  title: string;
  category: string;
}

export interface ReportStrategyPerf {
  avgScore: number | null;
  avgLcpMs: number | null;
  avgCls: number | null;
  avgInpMs: number | null;
  avgTtfbMs: number | null;
}

export interface ReportPerf {
  sampledPages: number;
  sampledUrls: string[];
  mobile: ReportStrategyPerf;
  desktop: ReportStrategyPerf;
  error?: string;
}

export interface ReportDiff {
  previousAuditId: string | null;
  newCount: number;
  persistentCount: number;
  resolvedCount: number;
  resolvedIssues: ReportResolvedIssue[];
}

/** Audit meta rendered in the report header. No PII. */
export interface ReportAuditMeta {
  domain: string;
  createdAt: Date | null;
  finishedAt: Date | null;
  urlLimit: number;
  /** Audit lifecycle status (always "done" for a built model). */
  status: string;
}

/**
 * A single node in the site architecture tree (Plan 20-02). Built purely from
 * the persisted link graph (`Audit.stats.graph`, Phase 16) plus the audit's
 * `Page` rows — no HTML is re-parsed (ARCH-03). `template` comes from
 * `classifyTemplate` (ARCH-04); `title` from the real `Page.title` column
 * (added in Plan 20-01), `null` when the page has no title.
 */
export interface ArchNode {
  url: string;
  title: string | null;
  /** BFS click-depth from home (`-1` sentinel for orphans with no path). */
  depth: number;
  template: PageTemplate;
  /** `depth > 3` — the "más de 3 clics" indicator (strictly greater than the "3+" bucket floor). */
  isDeep: boolean;
  /** A crawled page not present in the link graph (no reachable path from home). */
  isOrphan: boolean;
}

/**
 * A node in the reconstructed site-architecture tree (Plan 22-01, ARCH-05). It
 * carries every {@link ArchNode} signal (url/title/depth/template/isDeep/
 * isOrphan) plus its real children, so the dendrogram (Plan 22-02) can draw
 * parent→child connections. The tree is rebuilt from `graph.edges`: each node
 * hangs off the lowest-depth node that links to it.
 */
export interface ArchTreeNode extends ArchNode {
  children: ArchTreeNode[];
}

/**
 * The serializable site-architecture model the SVG tree (Plan 22-02) renders.
 * `tree` holds the real nested hierarchy reconstructed from `graph.edges`
 * (Plan 22-01, ARCH-05): its roots are normally the home page at depth 0, and
 * every node hangs off the lowest-depth node that links to it — replacing the
 * old flat depth buckets. `orphans` still holds crawled pages absent from the
 * graph (no parent link, depth `-1`).
 */
export interface ReportArchitecture {
  tree: ArchTreeNode[];
  orphans: ArchNode[];
}

export interface ReportModel {
  audit: ReportAuditMeta;
  /** Whether the audit persisted a scoring snapshot (drives the status badge). */
  hasScores: boolean;
  overall: number | null;
  /** Overall score status (defaults to "critical" when no scores were persisted). */
  status: ScoreStatus;
  byCategory: Partial<Record<Category, CategoryScoreResult>>;
  diff: ReportDiff;
  /**
   * ALL critical+warning issues, ordered by severity (critical < warning) then
   * category, WITHOUT truncation. This is the "M" (total) source for the
   * "mostrando N de M" note in the report and exports.
   */
  priorityCandidates: ReportIssue[];
  /** First `MAX_PRIORITY_ROWS` of `priorityCandidates` — what the on-screen table shows. */
  priorityIssues: ReportIssue[];
  /** `priorityCandidates.length` — the "M" in "mostrando N de M". */
  totalPriorityCandidates: number;
  /** Every persisted issue grouped by category (includes Phase 11/12 checks). */
  issuesByCategory: Record<Category, ReportIssue[]>;
  /**
   * Every persisted issue with a resolvable URL, grouped by page template
   * (TEMPLATE-01/02). Issues with `url === null` are omitted here but remain
   * present in `issuesByCategory` (no regression to the existing axis).
   */
  issuesByTemplate: Record<PageTemplate, ReportIssue[]>;
  perf?: ReportPerf;
  /**
   * Site architecture built from the persisted link graph (`Audit.stats.graph`,
   * Phase 16). `undefined` for audits with no persisted graph (pre-Phase-16) —
   * the UI hides the whole architecture section when absent (degradation-safe).
   */
  architecture?: ReportArchitecture;
}
