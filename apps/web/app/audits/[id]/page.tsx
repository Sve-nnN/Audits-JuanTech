import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@auditor/db";
import type { Category, ScoreStatus, CategoryScoreResult } from "@auditor/scoring";
import { AuditProgress } from "./AuditProgress";
import styles from "./report.module.css";

interface PageProps {
  params: Promise<{ id: string }>;
}

const CATEGORY_ORDER: Category[] = ["tech", "perf", "onpage", "schema", "aeo"];

const CATEGORY_LABEL: Record<Category, string> = {
  tech: "SEO Técnico",
  perf: "Rendimiento / CWV",
  onpage: "On-Page",
  schema: "Datos Estructurados",
  aeo: "AEO (Visibilidad en IA)",
};

const STATUS_LABEL: Record<ScoreStatus, string> = {
  good: "Bueno",
  needs_improvement: "Necesita mejora",
  critical: "Crítico",
};

const STATUS_CLASS: Record<ScoreStatus, string> = {
  good: styles.good!,
  needs_improvement: styles.needs_improvement!,
  critical: styles.critical!,
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítico",
  warning: "Advertencia",
  ok: "Correcto",
};

const SEVERITY_BADGE_CLASS: Record<string, string> = {
  critical: styles.severityCritical!,
  warning: styles.severityWarning!,
  ok: styles.severityOk!,
};

const DIFF_LABEL: Record<string, string> = {
  new: "Nuevo",
  persistent: "Persistente",
  resolved: "Resuelto",
};

const DIFF_BADGE_CLASS: Record<string, string> = {
  new: styles.diffNew!,
  persistent: styles.diffPersistent!,
  resolved: styles.diffResolved!,
};

const STRATEGY_LABEL: Record<string, string> = {
  mobile: "Móvil",
  desktop: "Desktop",
};

/** Shape persisted at `Audit.scores` by the worker (Phase 6, SCORE-01..05 + DIFF-01/02). */
interface AuditScores {
  overall: number;
  status: ScoreStatus;
  byCategory: Partial<Record<Category, CategoryScoreResult>>;
  diff: {
    newCount: number;
    persistentCount: number;
    resolvedCount: number;
    resolvedFingerprints: string[];
    previousAuditId: string | null;
  };
}

interface StrategyPerfSummary {
  avgScore: number | null;
  avgLcpMs: number | null;
  avgCls: number | null;
  avgInpMs: number | null;
  avgTtfbMs: number | null;
}

interface PerfStatsSummary {
  sampledPages: number;
  sampledUrls: string[];
  mobile: StrategyPerfSummary;
  desktop: StrategyPerfSummary;
  error?: string;
}

interface AuditStats {
  discovered?: number;
  crawled?: number;
  total?: number;
  failed?: number;
  issues?: { critical: number; warning: number; ok: number; total: number };
  perf?: PerfStatsSummary;
}

const SEVERITY_SORT_WEIGHT: Record<string, number> = { critical: 0, warning: 1, ok: 2 };
const MAX_PRIORITY_ROWS = 60;

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function formatPerfNumber(value: number | null, unit: string): string {
  if (value === null) return "no disponible";
  return `${value}${unit}`;
}

/**
 * The URL an issue is about. Page-level checks put the page URL in `source`;
 * some checks append " (enlazado desde X)" — keep just the leading URL. Falls
 * back to `scope`. Returned as a compact path for the table.
 */
function issueUrl(issue: { source: string | null; scope: string | null }): string | null {
  const raw = issue.source ?? issue.scope ?? null;
  if (!raw) return null;
  const firstToken = raw.split(" ")[0] ?? raw;
  return firstToken;
}

function shortUrl(url: string | null): string {
  if (!url) return "—";
  try {
    const u = new URL(url);
    return (u.pathname + u.search) || "/";
  } catch {
    return url.length > 48 ? `${url.slice(0, 48)}…` : url;
  }
}

export default async function AuditReportPage({ params }: PageProps) {
  const { id: auditId } = await params;

  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: { site: true },
  });

  if (!audit) notFound();

  if (audit.status !== "done") {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <p className={styles.breadcrumb}>
            <Link href="/">&larr; Inicio</Link>
          </p>
          <div className={styles.header}>
            <div>
              <h1 className={styles.domain}>{audit.site.domain}</h1>
              <p className={styles.meta}>Auditoría iniciada el {formatDate(audit.createdAt)}</p>
            </div>
          </div>
          <AuditProgress auditId={auditId} />
        </div>
      </main>
    );
  }

  const scores = audit.scores as unknown as AuditScores | null;
  const stats = audit.stats as unknown as AuditStats | null;
  const perf = stats?.perf;

  const [priorityIssues, issuesForDetail, resolvedIssues] = await Promise.all([
    prisma.issue.findMany({
      where: { auditId, severity: { in: ["critical", "warning"] } },
      orderBy: [{ severity: "asc" }, { category: "asc" }],
      take: MAX_PRIORITY_ROWS,
    }),
    prisma.issue.findMany({
      where: { auditId },
      orderBy: [{ category: "asc" }, { severity: "asc" }, { checkId: "asc" }],
    }),
    scores?.diff.previousAuditId && scores.diff.resolvedFingerprints.length > 0
      ? prisma.issue.findMany({
          where: {
            auditId: scores.diff.previousAuditId,
            fingerprint: { in: scores.diff.resolvedFingerprints },
          },
          select: { checkId: true, title: true, category: true },
        })
      : Promise.resolve([]),
  ]);

  const totalPriorityCandidates = await prisma.issue.count({
    where: { auditId, severity: { in: ["critical", "warning"] } },
  });

  const issuesByCategory = new Map<string, typeof issuesForDetail>();
  for (const issue of issuesForDetail) {
    const bucket = issuesByCategory.get(issue.category) ?? [];
    bucket.push(issue);
    issuesByCategory.set(issue.category, bucket);
  }

  const overallStatus = scores?.status ?? "critical";

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <p className={styles.breadcrumb}>
          <Link href="/">&larr; Inicio</Link>
        </p>

        <div className={styles.header}>
          <div>
            <h1 className={styles.domain}>{audit.site.domain}</h1>
            <p className={styles.meta}>
              Auditoría completada el {formatDate(audit.finishedAt)} · {audit.urlLimit} URLs máx.
            </p>
          </div>
          <Link href={`/audits/${auditId}/pages`} className={styles.linkOut}>
            Ver páginas y grafo de entidades &rarr;
          </Link>
        </div>

        {/* Score general */}
        <section className={styles.section}>
          <div className={`${styles.hero} ${STATUS_CLASS[overallStatus]}`}>
            <div className={styles.scoreCircle}>
              <span className={styles.scoreCircleNumber}>{scores?.overall ?? "—"}</span>
              <span className={styles.scoreCircleMax}>/ 100</span>
            </div>
            <div className={styles.heroBody}>
              <h2>Score general</h2>
              <p>
                Promedio ponderado de SEO Técnico, Rendimiento, On-Page, Datos Estructurados y AEO,
                calculado a partir de los hallazgos de esta auditoría.
              </p>
              <span className={`${styles.statusBadge} ${STATUS_CLASS[overallStatus]}`}>
                {STATUS_LABEL[overallStatus]}
              </span>
            </div>
          </div>
        </section>

        {/* Scores por categoría */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Scores por categoría</h3>
          <div className={styles.categoryGrid}>
            {CATEGORY_ORDER.map((category) => {
              const result = scores?.byCategory[category];
              const status = result?.status ?? null;
              return (
                <div key={category} className={styles.categoryCard}>
                  <p className={styles.categoryCardLabel}>{CATEGORY_LABEL[category]}</p>
                  <p className={`${styles.categoryCardScore} ${status ? STATUS_CLASS[status] : ""}`}>
                    {result ? result.score : "—"}
                  </p>
                  <p className={`${styles.categoryCardStatus} ${status ? STATUS_CLASS[status] : ""}`}>
                    {status ? STATUS_LABEL[status] : "sin datos"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Diff vs auditoría anterior */}
        {scores?.diff.previousAuditId && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Cambios desde la auditoría anterior</h3>
            <div className={styles.diffSummary}>
              <div className={styles.diffSummaryItem}>
                <strong>{scores.diff.newCount}</strong>
                Nuevos
              </div>
              <div className={styles.diffSummaryItem}>
                <strong>{scores.diff.persistentCount}</strong>
                Persistentes
              </div>
              <div className={styles.diffSummaryItem}>
                <strong>{scores.diff.resolvedCount}</strong>
                Resueltos
              </div>
            </div>
            {resolvedIssues.length > 0 && (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {resolvedIssues.map((issue, i) => (
                  <li key={`${issue.checkId}-${i}`} style={{ fontSize: 13, padding: "4px 0" }}>
                    <span className={`${styles.badge} ${styles.diffResolved}`}>Resuelto</span>{" "}
                    <span className={styles.categoryTag}>[{CATEGORY_LABEL[issue.category as Category] ?? issue.category}]</span>{" "}
                    {issue.title}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Issues prioritarios */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Issues prioritarios</h3>
          {priorityIssues.length === 0 ? (
            <div className={styles.emptyState}>Sin issues críticos ni de advertencia. Buen trabajo.</div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th>Issue</th>
                    <th>Página</th>
                    <th>Severidad</th>
                    <th>Valor medido</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {priorityIssues
                    .slice()
                    .sort(
                      (a, b) =>
                        (SEVERITY_SORT_WEIGHT[a.severity] ?? 99) - (SEVERITY_SORT_WEIGHT[b.severity] ?? 99)
                    )
                    .map((issue) => {
                      const url = issueUrl(issue);
                      return (
                        <tr key={issue.id}>
                          <td className={styles.categoryTag}>
                            {CATEGORY_LABEL[issue.category as Category] ?? issue.category}
                          </td>
                          <td>{issue.title}</td>
                          <td>
                            {url && url.startsWith("http") ? (
                              <a href={url} target="_blank" rel="noreferrer" title={url}>
                                {shortUrl(url)}
                              </a>
                            ) : (
                              <span title={url ?? undefined}>{shortUrl(url)}</span>
                            )}
                          </td>
                          <td>
                            <span className={`${styles.badge} ${SEVERITY_BADGE_CLASS[issue.severity]}`}>
                              {SEVERITY_LABEL[issue.severity]}
                            </span>
                          </td>
                          <td>{issue.measuredValue ?? "—"}</td>
                          <td>
                            {issue.diffStatus ? (
                              <span className={`${styles.badge} ${DIFF_BADGE_CLASS[issue.diffStatus]}`}>
                                {DIFF_LABEL[issue.diffStatus]}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {totalPriorityCandidates > priorityIssues.length && (
                <p className={styles.tableNote}>
                  Mostrando los {priorityIssues.length} de {totalPriorityCandidates} issues críticos/de
                  advertencia más relevantes.
                </p>
              )}
            </>
          )}
        </section>

        {/* Resumen de rendimiento */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Resumen de rendimiento</h3>
          {!perf || perf.sampledPages === 0 ? (
            <div className={styles.emptyState}>
              {perf?.error
                ? `No se pudieron obtener métricas de rendimiento: ${perf.error}`
                : "Sin muestra de rendimiento para esta auditoría."}
            </div>
          ) : (
            <>
              <div className={styles.perfGrid}>
                {(["mobile", "desktop"] as const).map((strategy) => {
                  const s = perf[strategy];
                  return (
                    <div key={strategy} className={styles.perfCard}>
                      <p className={styles.perfCardTitle}>{STRATEGY_LABEL[strategy]}</p>
                      <div className={styles.perfMetricRow}>
                        <span className={styles.perfMetricLabel}>Performance Score</span>
                        <strong>{s.avgScore ?? "no disponible"}</strong>
                      </div>
                      <div className={styles.perfMetricRow}>
                        <span className={styles.perfMetricLabel}>LCP</span>
                        <span>{formatPerfNumber(s.avgLcpMs, "ms")}</span>
                      </div>
                      <div className={styles.perfMetricRow}>
                        <span className={styles.perfMetricLabel}>CLS</span>
                        <span>{s.avgCls ?? "no disponible"}</span>
                      </div>
                      <div className={styles.perfMetricRow}>
                        <span className={styles.perfMetricLabel}>INP</span>
                        <span>{formatPerfNumber(s.avgInpMs, "ms")}</span>
                      </div>
                      <div className={styles.perfMetricRow}>
                        <span className={styles.perfMetricLabel}>TTFB</span>
                        <span>{formatPerfNumber(s.avgTtfbMs, "ms")}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className={styles.tableNote}>
                Basado en una muestra de {perf.sampledPages} página(s) representativas (PageSpeed
                Insights, no el crawl completo).
              </p>
            </>
          )}
        </section>

        {/* Detalle por categoría — separado en Problemas vs Correcto */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Detalle por categoría</h3>
          {CATEGORY_ORDER.map((category) => {
            const issues = issuesByCategory.get(category) ?? [];
            if (issues.length === 0) return null;
            const problems = issues.filter((i) => i.severity === "critical" || i.severity === "warning");
            const passing = issues.filter((i) => i.severity === "ok");

            const renderIssue = (issue: (typeof issues)[number]) => {
              const url = issueUrl(issue);
              return (
                <div key={issue.id} className={styles.issueDetail}>
                  <div className={styles.issueHeader}>
                    <span className={styles.issueTitle}>
                      [{issue.checkId}] {issue.title}
                    </span>
                    <span className={`${styles.badge} ${SEVERITY_BADGE_CLASS[issue.severity]}`}>
                      {SEVERITY_LABEL[issue.severity]}
                    </span>
                    {issue.diffStatus && (
                      <span className={`${styles.badge} ${DIFF_BADGE_CLASS[issue.diffStatus]}`}>
                        {DIFF_LABEL[issue.diffStatus]}
                      </span>
                    )}
                  </div>
                  <dl className={styles.issueFields}>
                    <div className={styles.issueField}>
                      <dt>Página / URL</dt>
                      <dd>
                        {url && url.startsWith("http") ? (
                          <a href={url} target="_blank" rel="noreferrer">
                            {url}
                          </a>
                        ) : (
                          url ?? "—"
                        )}
                      </dd>
                    </div>
                    <div className={styles.issueField}>
                      <dt>Valor medido</dt>
                      <dd>{issue.measuredValue ?? "—"}</dd>
                    </div>
                    <div className={styles.issueField}>
                      <dt>Criterio</dt>
                      <dd>{issue.criterion ?? "—"}</dd>
                    </div>
                    <div className={styles.issueField}>
                      <dt>Recomendación</dt>
                      <dd>{issue.recommendation ?? "—"}</dd>
                    </div>
                  </dl>
                </div>
              );
            };

            return (
              <details key={category} className={styles.categoryGroup}>
                <summary className={styles.categoryGroupSummary}>
                  <span>{CATEGORY_LABEL[category]}</span>
                  <span className={styles.categoryGroupCount}>
                    {problems.length} problema(s) · {passing.length} correcto(s)
                  </span>
                </summary>

                <h4 className={styles.subGroupTitle}>
                  <span className={`${styles.badge} ${styles.severityCritical}`}>Problemas</span>{" "}
                  {problems.length}
                </h4>
                {problems.length === 0 ? (
                  <p className={styles.subGroupEmpty}>Sin problemas en esta categoría.</p>
                ) : (
                  problems.map(renderIssue)
                )}

                <h4 className={styles.subGroupTitle}>
                  <span className={`${styles.badge} ${styles.severityOk}`}>Correcto</span>{" "}
                  {passing.length}
                </h4>
                {passing.length === 0 ? (
                  <p className={styles.subGroupEmpty}>Sin checks marcados como correctos.</p>
                ) : (
                  passing.map(renderIssue)
                )}
              </details>
            );
          })}
        </section>

        <p className={styles.footerLinks}>
          <Link href={`/audits/${auditId}/pages`}>Ver páginas rastreadas y grafo de entidades &rarr;</Link>
        </p>
      </div>
    </main>
  );
}
