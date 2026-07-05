export type PsiStrategy = "mobile" | "desktop";

/**
 * Parsed subset of a PageSpeed Insights v5 `runPagespeed` response that the
 * rest of the app cares about. All fields are nullable because PSI can omit
 * any of them (CrUX/field data in particular is frequently absent for
 * low-traffic sites — see `inpMs`).
 */
export interface PsiMetrics {
  /** Lighthouse performance category score, 0-100 (already scaled from 0-1). */
  performanceScore: number | null;
  /** Largest Contentful Paint, milliseconds (lab data, Lighthouse). */
  lcpMs: number | null;
  /** Cumulative Layout Shift, unitless (lab data, Lighthouse). */
  cls: number | null;
  /** Interaction to Next Paint, milliseconds (field data, CrUX) — often absent. */
  inpMs: number | null;
  /** Time to First Byte / server response time, milliseconds (lab data, Lighthouse). */
  ttfbMs: number | null;
}

export interface PsiRunResult {
  ok: boolean;
  metrics?: PsiMetrics;
  error?: string;
  /** True when the result was served from cache rather than a live PSI call. */
  fromCache?: boolean;
}
