export type PerfSeverity = "critical" | "warning" | "ok";

export type PerfMetricName = "performanceScore" | "lcp" | "cls" | "inp" | "ttfb";

/**
 * Official Google thresholds (Lighthouse / Core Web Vitals) used to grade
 * each PSI metric. Higher-is-better for `performanceScore`; lower-is-better
 * for the rest.
 */
export const THRESHOLDS = {
  performanceScore: { ok: 90, warning: 50 }, // >=90 ok, 50-89 warning, <50 critical
  lcp: { ok: 2500, warning: 4000 }, // ms; <=2500 ok, <=4000 warning, else critical
  inp: { ok: 200, warning: 500 }, // ms; <=200 ok, <=500 warning, else critical
  cls: { ok: 0.1, warning: 0.25 }, // <=0.1 ok, <=0.25 warning, else critical
  ttfb: { ok: 800, warning: 1800 }, // ms; <=800 ok, <=1800 warning, else critical (CrUX TTFB)
} as const;

/**
 * Grades `value` for `metric` against the official Google thresholds.
 * `performanceScore` is higher-is-better; every other metric is
 * lower-is-better.
 */
export function severityFor(metric: "performanceScore", value: number): PerfSeverity;
export function severityFor(metric: "lcp" | "cls" | "inp" | "ttfb", value: number): PerfSeverity;
export function severityFor(
  metric: keyof typeof THRESHOLDS,
  value: number
): PerfSeverity {
  const t = THRESHOLDS[metric];
  if (metric === "performanceScore") {
    if (value >= t.ok) return "ok";
    if (value >= t.warning) return "warning";
    return "critical";
  }
  if (value <= t.ok) return "ok";
  if (value <= t.warning) return "warning";
  return "critical";
}
