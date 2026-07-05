import { statusForScore, type ScoreStatus } from "./status";

export type IssueSeverityValue = "critical" | "warning" | "ok";

/** Minimal shape `scoreCategory` needs from an Issue row. */
export interface ScorableIssue {
  severity: IssueSeverityValue;
}

export interface CategoryScoreResult {
  score: number;
  status: ScoreStatus;
}

/**
 * Penalty (points deducted from a 100 base) per issue of a given severity.
 * `ok` issues represent a passing check surfaced explicitly (e.g. "title tag
 * present and well-formed") and never penalize. Tunable constants — bump
 * these to make the scoring model stricter/looser without touching the
 * averaging logic below.
 */
export const SEVERITY_PENALTY: Record<IssueSeverityValue, number> = {
  critical: 15,
  warning: 5,
  ok: 0,
};

/**
 * Scores a single category (0-100) from its Issues.
 *
 * Model: "percentage of checks passed weighted by severity" — start at a
 * perfect 100 and subtract a fixed penalty per issue found, worse severities
 * costing more. This is deterministic (same issue set -> same score, order
 * independent) and explainable (each issue's contribution to the score is
 * visible). The total penalty is floored at 0 so a category can't go
 * negative; a category with zero issues scores a perfect 100.
 */
export function scoreCategory(issues: ScorableIssue[]): CategoryScoreResult {
  const totalPenalty = issues.reduce((sum, issue) => sum + SEVERITY_PENALTY[issue.severity], 0);
  const score = Math.max(0, Math.min(100, 100 - totalPenalty));
  return { score, status: statusForScore(score) };
}
