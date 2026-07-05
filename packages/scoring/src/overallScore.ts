import { statusForScore, type ScoreStatus } from "./status";
import type { CategoryScoreResult } from "./categoryScore";

/**
 * The five report categories (mirrors the reference report: SEO Técnico,
 * On-Page, Datos Estructurados, Rendimiento/CWV, AEO). `perf` is scored
 * separately from PerfMetric (PSI), never from Issues — see
 * `scorePerfCategory` below.
 */
export type Category = "tech" | "onpage" | "schema" | "perf" | "aeo";

/**
 * Default category weights for the overall score, tuned to land in the
 * reference report's range (juan-tech.com ~86/100): Technical SEO and
 * Performance carry the most weight, AEO the least (its ranking impact is
 * not yet confirmed). Tunable — adjust these constants to rebalance the
 * model without touching the averaging logic.
 *
 * Weights sum to 1.0; if a category is missing from a given audit (e.g. no
 * PSI sample succeeded), `scoreOverall` renormalizes across the categories
 * that ARE present rather than silently treating the missing one as 0.
 */
export const CATEGORY_WEIGHTS: Record<Category, number> = {
  tech: 0.3,
  perf: 0.3,
  onpage: 0.15,
  schema: 0.1,
  aeo: 0.15,
};

/** Mobile/desktop PSI weighting for the perf category score, matching the reference report. */
export const PERF_STRATEGY_WEIGHTS = { mobile: 0.7, desktop: 0.3 } as const;

export interface PerfScoreInput {
  mobileAvgScore: number | null;
  desktopAvgScore: number | null;
}

/**
 * Scores the `perf` category (0-100) from averaged PageSpeed Insights
 * Performance Scores (already 0-100), weighting mobile 70% / desktop 30%
 * per the reference report. Returns `null` when neither strategy produced a
 * score (e.g. the PSI sample failed entirely) so the overall score can
 * renormalize weights across the remaining categories instead of treating
 * an unmeasured category as a 0.
 */
export function scorePerfCategory(perf: PerfScoreInput): CategoryScoreResult | null {
  const { mobileAvgScore, desktopAvgScore } = perf;
  if (mobileAvgScore === null && desktopAvgScore === null) return null;

  const score =
    mobileAvgScore !== null && desktopAvgScore !== null
      ? mobileAvgScore * PERF_STRATEGY_WEIGHTS.mobile + desktopAvgScore * PERF_STRATEGY_WEIGHTS.desktop
      : (mobileAvgScore ?? desktopAvgScore)!;

  const rounded = Math.round(score);
  return { score: rounded, status: statusForScore(rounded) };
}

export interface OverallScoreResult {
  overall: number;
  status: ScoreStatus;
  byCategory: Partial<Record<Category, CategoryScoreResult>>;
}

/**
 * Computes the overall score (0-100) as a weighted average of the five
 * category scores. `categoryScores` holds the four Issue-derived categories
 * (tech/onpage/schema/aeo); `perf` is supplied separately (PSI averages) and
 * scored internally via `scorePerfCategory`.
 *
 * Any category absent from the input (score is `undefined`/perf is `null`)
 * is excluded and the remaining weights are renormalized to sum to 1, so a
 * missing PSI sample doesn't unfairly tank the overall score.
 */
export function scoreOverall(
  categoryScores: Partial<Record<Exclude<Category, "perf">, CategoryScoreResult>>,
  perf: PerfScoreInput
): OverallScoreResult {
  const perfScore = scorePerfCategory(perf);
  const byCategory: Partial<Record<Category, CategoryScoreResult>> = { ...categoryScores };
  if (perfScore) byCategory.perf = perfScore;

  const present = (Object.keys(byCategory) as Category[]).filter((cat) => byCategory[cat] !== undefined);
  const totalWeight = present.reduce((sum, cat) => sum + CATEGORY_WEIGHTS[cat], 0);

  if (present.length === 0 || totalWeight === 0) {
    return { overall: 0, status: statusForScore(0), byCategory };
  }

  const weightedSum = present.reduce((sum, cat) => sum + byCategory[cat]!.score * CATEGORY_WEIGHTS[cat], 0);
  const overall = Math.round(weightedSum / totalWeight);

  return { overall, status: statusForScore(overall), byCategory };
}
