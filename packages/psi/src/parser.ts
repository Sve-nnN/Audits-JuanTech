import type { PsiMetrics } from "./types";

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
    audits?: Record<string, { numericValue?: number | null } | undefined>;
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
