import { severityFor } from "./thresholds";
import type { PsiMetrics, PsiStrategy } from "./types";

export type PerfIssueSeverity = "critical" | "warning" | "ok";

/**
 * Shape-compatible with `@auditor/checks`' `IssueDraft` (category "perf"),
 * kept as a local type so `@auditor/psi` doesn't depend on `@auditor/checks`
 * — the worker maps 1:1 when persisting.
 */
export interface PerfIssueDraft {
  checkId: string;
  category: "perf";
  title: string;
  severity: PerfIssueSeverity;
  measuredValue?: string;
  criterion?: string;
  recommendation?: string;
  fingerprint: string;
  pageId?: string;
}

const STRATEGY_LABEL: Record<PsiStrategy, string> = {
  mobile: "Móvil",
  desktop: "Desktop",
};

function combineMeasured(mobile?: string, desktop?: string): string {
  const parts: string[] = [];
  if (mobile) parts.push(`Móvil: ${mobile}`);
  if (desktop) parts.push(`Desktop: ${desktop}`);
  return parts.join(" / ") || "no disponible";
}

/** Per-page, per-strategy PSI result the mapper reads from. */
export interface PagePerfResult {
  url: string;
  pageId?: string;
  mobile?: PsiMetrics | null;
  desktop?: PsiMetrics | null;
}

interface MetricSpec {
  checkId: string;
  title: string;
  criterion: string;
  recommendation: string;
  format: (value: number) => string;
  grade: (value: number) => PerfIssueSeverity;
  pick: (metrics: PsiMetrics) => number | null;
}

const METRIC_SPECS: MetricSpec[] = [
  {
    checkId: "PERF-01",
    title: "Performance Score (PageSpeed Insights)",
    criterion: "Puntaje >= 90 óptimo, 50-89 mejorable, < 50 deficiente",
    recommendation:
      "Optimizá imágenes, eliminá JavaScript/CSS que bloquea el renderizado y reducí el tiempo de respuesta del servidor para mejorar el puntaje de rendimiento.",
    format: (v) => `${v}/100`,
    grade: (v) => severityFor("performanceScore", v),
    pick: (m) => m.performanceScore,
  },
  {
    checkId: "PERF-02-LCP",
    title: "Largest Contentful Paint (LCP)",
    criterion: "LCP <= 2500ms bueno, <= 4000ms mejorable, > 4000ms deficiente",
    recommendation:
      "Reducí el tiempo de carga del elemento principal (imagen/hero o bloque de texto grande): precargá recursos críticos, optimizá imágenes y evitá renderizado bloqueante.",
    format: (v) => `${Math.round(v)}ms`,
    grade: (v) => severityFor("lcp", v),
    pick: (m) => m.lcpMs,
  },
  {
    checkId: "PERF-02-CLS",
    title: "Cumulative Layout Shift (CLS)",
    criterion: "CLS <= 0.1 bueno, <= 0.25 mejorable, > 0.25 deficiente",
    recommendation:
      "Reservá espacio para imágenes/anuncios/embeds con dimensiones explícitas y evitá insertar contenido dinámico por encima de contenido existente.",
    format: (v) => v.toFixed(2),
    grade: (v) => severityFor("cls", v),
    pick: (m) => m.cls,
  },
  {
    checkId: "PERF-02-TTFB",
    title: "Time to First Byte (TTFB)",
    criterion: "TTFB <= 800ms bueno, <= 1800ms mejorable, > 1800ms deficiente",
    recommendation:
      "Mejorá el tiempo de respuesta del servidor: usá caché en el servidor/CDN, optimizá consultas y considerá acercar el hosting geográficamente a tus usuarios.",
    format: (v) => `${Math.round(v)}ms`,
    grade: (v) => severityFor("ttfb", v),
    pick: (m) => m.ttfbMs,
  },
];

/**
 * Maps a page's mobile/desktop PSI metrics into `PerfIssueDraft`s (category
 * "perf"): one issue per metric (Performance Score, LCP, CLS, TTFB) that
 * combines both strategies in `measuredValue`, plus a dedicated INP issue
 * that degrades to "informational, not available" instead of failing when
 * CrUX field data is absent (common for low-traffic sites).
 */
export function mapPerfIssues(result: PagePerfResult): PerfIssueDraft[] {
  const { url, pageId, mobile, desktop } = result;

  // Both strategies failed outright: emit a single "no disponible" issue so
  // the report reflects the attempt without treating it as a broken audit,
  // instead of five metric issues all reading "not available".
  if (!mobile && !desktop) {
    return [
      {
        checkId: "PERF-01",
        category: "perf",
        title: "Performance Score (PageSpeed Insights)",
        severity: "ok",
        measuredValue: "no disponible (PSI no respondió para esta página)",
        criterion: "Puntaje >= 90 óptimo, 50-89 mejorable, < 50 deficiente",
        recommendation:
          "PageSpeed Insights no devolvió resultados para esta página en este análisis. Se reintentará en la próxima auditoría.",
        pageId,
        fingerprint: `PERF-01-unavailable:${url}`,
      },
    ];
  }

  const issues: PerfIssueDraft[] = [];

  for (const spec of METRIC_SPECS) {
    const mobileValue = mobile ? spec.pick(mobile) : null;
    const desktopValue = desktop ? spec.pick(desktop) : null;
    if (mobileValue === null && desktopValue === null) continue;

    const severities: PerfIssueSeverity[] = [];
    if (mobileValue !== null) severities.push(spec.grade(mobileValue));
    if (desktopValue !== null) severities.push(spec.grade(desktopValue));
    // Worst-case severity across strategies drives the issue's severity.
    const severity = severities.includes("critical")
      ? "critical"
      : severities.includes("warning")
        ? "warning"
        : "ok";

    issues.push({
      checkId: spec.checkId,
      category: "perf",
      title: spec.title,
      severity,
      measuredValue: combineMeasured(
        mobileValue !== null ? spec.format(mobileValue) : undefined,
        desktopValue !== null ? spec.format(desktopValue) : undefined
      ),
      criterion: spec.criterion,
      recommendation: spec.recommendation,
      pageId,
      fingerprint: `${spec.checkId}:${url}`,
    });
  }

  // INP: field data (CrUX), frequently absent. Absence is informational
  // ("ok" severity, explicit "no disponible" wording), never an error.
  const mobileInp = mobile?.inpMs ?? null;
  const desktopInp = desktop?.inpMs ?? null;
  if (mobileInp !== null || desktopInp !== null) {
    const severities: PerfIssueSeverity[] = [];
    if (mobileInp !== null) severities.push(severityFor("inp", mobileInp));
    if (desktopInp !== null) severities.push(severityFor("inp", desktopInp));
    const severity = severities.includes("critical")
      ? "critical"
      : severities.includes("warning")
        ? "warning"
        : "ok";
    issues.push({
      checkId: "PERF-02-INP",
      category: "perf",
      title: "Interaction to Next Paint (INP)",
      severity,
      measuredValue: combineMeasured(
        mobileInp !== null ? `${mobileInp}ms` : undefined,
        desktopInp !== null ? `${desktopInp}ms` : undefined
      ),
      criterion: "INP <= 200ms bueno, <= 500ms mejorable, > 500ms deficiente",
      recommendation:
        "Reducí el trabajo de JavaScript en respuesta a interacciones del usuario (clicks, taps) para que la página responda más rápido.",
      pageId,
      fingerprint: `PERF-02-INP:${url}`,
    });
  } else {
    issues.push({
      checkId: "PERF-02-INP",
      category: "perf",
      title: "Interaction to Next Paint (INP)",
      severity: "ok",
      measuredValue: "no disponible (datos de campo insuficientes)",
      criterion: "INP <= 200ms bueno, <= 500ms mejorable, > 500ms deficiente",
      recommendation:
        "No hay suficiente tráfico real (CrUX) para esta página todavía. Esta métrica se completará automáticamente cuando haya datos de campo disponibles.",
      pageId,
      fingerprint: "PERF-02-INP:" + url,
    });
  }

  return issues;
}
