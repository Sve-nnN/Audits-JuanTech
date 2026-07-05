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
 * "Health" weight per issue severity: the fraction of a perfect check each
 * issue contributes. `ok` = a passing check (full credit), `warning` = half
 * credit, `critical` = no credit. Tunable constants — adjust to make the model
 * stricter/looser without touching the aggregation below.
 */
export const SEVERITY_HEALTH: Record<IssueSeverityValue, number> = {
  ok: 1,
  warning: 0.5,
  critical: 0,
};

/**
 * Scores a single category (0-100) from its Issues.
 *
 * Model: severity-weighted PASS RATE (Ahrefs/Semrush style) — the score is the
 * average health across every check result, where each result scores 1 (ok),
 * 0.5 (warning) or 0 (critical). This is:
 * - size-independent: a 500-page site and a 5-page site with the same
 *   proportion of healthy checks score the same (an absolute penalty-sum model
 *   would drive every large site to 0);
 * - deterministic and order-independent;
 * - bounded to 0-100.
 * A category with zero issues (no data) scores a perfect 100.
 */
export function scoreCategory(issues: ScorableIssue[]): CategoryScoreResult {
  if (issues.length === 0) {
    return { score: 100, status: statusForScore(100) };
  }
  const health = issues.reduce((sum, issue) => sum + SEVERITY_HEALTH[issue.severity], 0);
  const score = Math.round((100 * health) / issues.length);
  return { score, status: statusForScore(score) };
}
