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
  /** URL of the analyzed page; propagated so the report shows it (REPORT-03). */
  source?: string;
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
        source: url,
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
      source: url,
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
      source: url,
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
      source: url,
      fingerprint: "PERF-02-INP:" + url,
    });
  }

  return issues;
}

interface DiagnosticSpec {
  checkId: string;
  title: string;
  criterion: string;
  recommendation: string;
  /** Returns null when the diagnostic is absent or its score is non-gradable (null). */
  pick: (metrics: PsiMetrics) => { score: number; displayValue?: string } | null;
}

function pickAudit(
  audit: { score: number | null; displayValue?: string } | undefined
): { score: number; displayValue?: string } | null {
  if (!audit || audit.score === null) return null;
  return audit.displayValue !== undefined
    ? { score: audit.score, displayValue: audit.displayValue }
    : { score: audit.score };
}

const DIAGNOSTIC_SPECS: DiagnosticSpec[] = [
  {
    checkId: "PERF-05",
    title: "Formatos de imagen modernos (WebP/AVIF)",
    criterion: "Puntaje Lighthouse >= 0.9 óptimo, < 0.9 mejorable",
    recommendation:
      "Serví las imágenes en formatos modernos (WebP o AVIF) en lugar de JPEG/PNG para reducir su peso sin perder calidad visual.",
    pick: (m) => pickAudit(m.diagnostics?.modernImageFormats),
  },
  {
    checkId: "PERF-06",
    title: "CSS sin usar",
    criterion: "Puntaje Lighthouse >= 0.9 óptimo, < 0.9 mejorable",
    recommendation:
      "Eliminá o difierí las reglas CSS que no se usan en la carga inicial de la página para reducir el tamaño de las hojas de estilo descargadas.",
    pick: (m) => pickAudit(m.diagnostics?.unusedCssRules),
  },
  {
    checkId: "PERF-07",
    title: "Recursos que bloquean el renderizado",
    criterion: "Puntaje Lighthouse >= 0.9 óptimo, < 0.9 mejorable",
    recommendation:
      "Diferí o incluí en línea el CSS/JavaScript crítico para evitar que recursos externos bloqueen el primer renderizado de la página.",
    pick: (m) => pickAudit(m.diagnostics?.renderBlockingResources),
  },
  {
    checkId: "PERF-08",
    title: "Compresión de texto",
    criterion: "Puntaje Lighthouse >= 0.9 óptimo, < 0.9 mejorable",
    recommendation:
      "Activá compresión (gzip o brotli) en el servidor/CDN para los recursos de texto (HTML, CSS, JavaScript) y reducir el tiempo de descarga.",
    pick: (m) => pickAudit(m.diagnostics?.textCompression),
  },
  {
    checkId: "PERF-09",
    title: "CSS/JS sin minificar",
    criterion: "Puntaje Lighthouse >= 0.9 óptimo, < 0.9 mejorable",
    recommendation:
      "Minificá los archivos CSS y JavaScript (eliminando espacios, comentarios y nombres largos) para reducir su tamaño de descarga.",
    pick: (m) => {
      const css = pickAudit(m.diagnostics?.unminifiedCss);
      const js = pickAudit(m.diagnostics?.unminifiedJavascript);
      if (css === null && js === null) return null;
      if (css === null) return js;
      if (js === null) return css;
      return css.score <= js.score ? css : js;
    },
  },
];

/** Grades a Lighthouse diagnostic score: never "critical" (informational, not a hard failure). */
function gradeDiagnostic(score: number): PerfIssueSeverity {
  return score >= 0.9 ? "ok" : "warning";
}

/**
 * Maps a page's mobile/desktop PSI diagnostics into `PerfIssueDraft`s
 * (PERF-05..PERF-09). Diagnostics absent from both strategies are silently
 * skipped (no issue emitted). Severity is always "ok" or "warning", never
 * "critical" — these are optimization opportunities, not hard failures.
 * Returns `[]` when there's no data at all (mirrors `mapPerfIssues`'s own
 * PERF-01 "not available" issue covering the "PSI didn't respond" case).
 */
export function mapDiagnosticIssues(result: PagePerfResult): PerfIssueDraft[] {
  const { url, pageId, mobile, desktop } = result;
  const issues: PerfIssueDraft[] = [];

  for (const spec of DIAGNOSTIC_SPECS) {
    const mobilePick = mobile ? spec.pick(mobile) : null;
    const desktopPick = desktop ? spec.pick(desktop) : null;
    if (mobilePick === null && desktopPick === null) continue;

    const severities: PerfIssueSeverity[] = [];
    if (mobilePick !== null) severities.push(gradeDiagnostic(mobilePick.score));
    if (desktopPick !== null) severities.push(gradeDiagnostic(desktopPick.score));
    const severity = severities.includes("warning") ? "warning" : "ok";

    const formatPick = (pick: { score: number; displayValue?: string } | null): string | undefined => {
      if (pick === null) return undefined;
      return pick.displayValue ?? `score ${Math.round(pick.score * 100)}/100`;
    };

    issues.push({
      checkId: spec.checkId,
      category: "perf",
      title: spec.title,
      severity,
      measuredValue: combineMeasured(formatPick(mobilePick), formatPick(desktopPick)),
      criterion: spec.criterion,
      recommendation: spec.recommendation,
      pageId,
      source: url,
      fingerprint: `${spec.checkId}:${url}`,
    });
  }

  return issues;
}
