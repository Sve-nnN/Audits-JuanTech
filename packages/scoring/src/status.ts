/** Status labels shown in the report, mirroring the reference report's wording. */
export type ScoreStatus = "good" | "needs_improvement" | "critical";

/**
 * Score -> status thresholds, shared by category and overall scoring so the
 * report is internally consistent (a 92 is always "Bueno" regardless of
 * whether it's a category score or the overall score).
 *
 * - >= 90  -> good ("Bueno")
 * - 50-89  -> needs_improvement ("Necesita mejora")
 * - < 50   -> critical ("Crítico")
 */
export const STATUS_THRESHOLDS = {
  good: 90,
  needsImprovement: 50,
} as const;

export function statusForScore(score: number): ScoreStatus {
  if (score >= STATUS_THRESHOLDS.good) return "good";
  if (score >= STATUS_THRESHOLDS.needsImprovement) return "needs_improvement";
  return "critical";
}
