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
}
