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
  /**
   * Lighthouse diagnostic audits (PERF-05..PERF-09), optional so cache
   * entries written before this field existed still deserialize cleanly
   * (T-18-01).
   */
  diagnostics?: PsiDiagnostics;
}

/** A single Lighthouse diagnostic audit's raw score + optional display value. */
export interface PsiDiagnosticAudit {
  score: number | null;
  displayValue?: string;
}

/**
 * Subset of Lighthouse diagnostic audits extracted from a PSI response
 * (PERF-05..PERF-09). Each key is optional — absent when the audit was not
 * present in the underlying Lighthouse run.
 */
export interface PsiDiagnostics {
  modernImageFormats?: PsiDiagnosticAudit;
  unusedCssRules?: PsiDiagnosticAudit;
  renderBlockingResources?: PsiDiagnosticAudit;
  textCompression?: PsiDiagnosticAudit;
  unminifiedCss?: PsiDiagnosticAudit;
  unminifiedJavascript?: PsiDiagnosticAudit;
}

export interface PsiRunResult {
  ok: boolean;
  metrics?: PsiMetrics;
  error?: string;
  /** True when the result was served from cache rather than a live PSI call. */
  fromCache?: boolean;
}
