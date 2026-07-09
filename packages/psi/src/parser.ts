import type { PsiDiagnosticAudit, PsiDiagnostics, PsiMetrics } from "./types";

/**
 * Minimal shape of the PageSpeed Insights v5 `runPagespeed` JSON response
 * that we read from. The real response has many more fields; we only type
 * what `parsePsiResponse` touches.
 */
export interface RawPsiResponse {
  lighthouseResult?: {
    categories?: {
      performance?: { score?: number | null };
    };
    audits?: Record<
      string,
      { numericValue?: number | null; score?: number | null; displayValue?: string } | undefined
    >;
  };
  loadingExperience?: {
    metrics?: {
      INTERACTION_TO_NEXT_PAINT?: { percentile?: number | null };
      [key: string]: { percentile?: number | null } | undefined;
    };
  };
  originLoadingExperience?: {
    metrics?: {
      INTERACTION_TO_NEXT_PAINT?: { percentile?: number | null };
      [key: string]: { percentile?: number | null } | undefined;
    };
  };
}

function roundOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.round(value);
}

/**
 * Extracts the metrics we care about from a raw PSI API response.
 *
 * - Performance Score comes from Lighthouse (`categories.performance.score`,
 *   0-1 scale — we rescale to 0-100).
 * - LCP, CLS and TTFB come from Lighthouse lab audits.
 * - INP comes from CrUX field data (`loadingExperience`, falling back to
 *   `originLoadingExperience` for the whole origin). Both are frequently
 *   absent for low-traffic sites — that's expected, not an error.
 */
export function parsePsiResponse(raw: RawPsiResponse): PsiMetrics {
  const rawScore = raw.lighthouseResult?.categories?.performance?.score;
  const performanceScore =
    typeof rawScore === "number" ? Math.round(rawScore * 100) : null;

  const audits = raw.lighthouseResult?.audits ?? {};
  const lcpMs = roundOrNull(audits["largest-contentful-paint"]?.numericValue);
  const clsRaw = audits["cumulative-layout-shift"]?.numericValue;
  const cls = typeof clsRaw === "number" && !Number.isNaN(clsRaw) ? clsRaw : null;
  const ttfbMs = roundOrNull(audits["server-response-time"]?.numericValue);

  const inpMs = roundOrNull(
    raw.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT?.percentile ??
      raw.originLoadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT?.percentile
  );

  return { performanceScore, lcpMs, cls, inpMs, ttfbMs };
}

/** Maps `PsiDiagnostics` keys to their Lighthouse audit IDs. */
const DIAGNOSTIC_AUDIT_IDS: Record<keyof PsiDiagnostics, string> = {
  modernImageFormats: "modern-image-formats",
  unusedCssRules: "unused-css-rules",
  renderBlockingResources: "render-blocking-resources",
  textCompression: "uses-text-compression",
  unminifiedCss: "unminified-css",
  unminifiedJavascript: "unminified-javascript",
};

/**
 * Extracts Lighthouse diagnostic audits (PERF-05..PERF-09) from a raw PSI
 * response. Reads from the same `lighthouseResult.audits` map already
 * present in the response used by `parsePsiResponse` — no extra API calls.
 * An audit missing from the response simply omits that key (no exception,
 * no `undefined` placeholder).
 */
export function extractDiagnostics(raw: RawPsiResponse): PsiDiagnostics {
  const audits = raw.lighthouseResult?.audits ?? {};
  const result: PsiDiagnostics = {};

  for (const [key, auditId] of Object.entries(DIAGNOSTIC_AUDIT_IDS) as [
    keyof PsiDiagnostics,
    string,
  ][]) {
    const audit = audits[auditId];
    if (audit === undefined) continue;

    const entry: PsiDiagnosticAudit = { score: audit.score ?? null };
    if (audit.displayValue !== undefined) entry.displayValue = audit.displayValue;
    result[key] = entry;
  }

  return result;
}
