import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@auditor/db";
import type { Category, ScoreStatus } from "@auditor/scoring";
import { buildReportModel, type ReportIssue } from "@auditor/report-model";
import { ScoreGauge } from "../../components/ui/ScoreGauge";
import { CategoryCard } from "../../components/ui/CategoryCard";
import { IssuesTable, type IssuesTableColumn } from "../../components/ui/IssuesTable";
import {
  CategoryAccordion,
  AccordionSubgroup,
  IssueDetail,
} from "../../components/ui/CategoryAccordion";
import { Badge, SeverityBadge, DiffBadge } from "../../components/ui/Badge";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { Reveal } from "../../components/motion/useReveal";
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  STRATEGY_LABEL,
} from "../../components/ui/labels";
import { shortUrl } from "../../components/ui/url";
import { AuditProgress } from "./AuditProgress";
import { ScoreGaugeAnimated } from "./ScoreGaugeAnimated";
import styles from "./report.module.css";

interface PageProps {
  params: Promise<{ id: string }>;
}

const CATEGORY_ORDER: Category[] = ["tech", "perf", "onpage", "schema", "aeo"];

/** Estado de score → variante de Badge (reusa el eje de severidad, DS-02). */
const STATUS_BADGE_VARIANT: Record<ScoreStatus, "ok" | "warning" | "critical"> = {
  good: "ok",
  needs_improvement: "warning",
  critical: "critical",
};

type Severity = "critical" | "warning" | "ok";
type Diff = "new" | "persistent" | "resolved";

const SEVERITY_SORT_WEIGHT: Record<string, number> = { critical: 0, warning: 1, ok: 2 };

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function formatPerfNumber(value: number | null, unit: string): string {
  if (value === null) return "no disponible";
  return `${value}${unit}`;
}

/** Renderiza la celda "Página / URL": enlace real si es http(s), texto si no. */
function urlValue(url: string | null): ReactNode {
  if (url && /^https?:\/\//i.test(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        {url}
      </a>
    );
  }
  return url ?? "—";
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
      <div className={styles.page}>
        <div className={styles.container}>
          <p className={styles.breadcrumb}>
            <Link href="/">
              <ArrowLeft size={16} aria-hidden="true" /> Inicio
            </Link>
          </p>
          <div className={styles.header}>
            <div>
              <h1 className={styles.domain}>{audit.site.domain}</h1>
              <p className={styles.meta}>Auditoría iniciada el {formatDate(audit.createdAt)}</p>
            </div>
          </div>
          <AuditProgress auditId={auditId} />
        </div>
      </div>
    );
  }

  // Single source of truth for the report: buildReportModel (@auditor/report-model)
  // reads the same persisted data this component assembled inline before.
  const model = await buildReportModel(auditId);
  if (!model) notFound();

  const { byCategory, diff, perf, priorityIssues, totalPriorityCandidates } = model;
  const resolvedIssues = diff.resolvedIssues;
  const issuesByCategory = model.issuesByCategory;

  const overallStatus = model.status;
  const overall = model.overall;
  const hasScores = model.hasScores;

  // --- Issues prioritarios → filas de IssuesTable (orden por severidad) ---
  const issueColumns: IssuesTableColumn[] = [
    { key: "cat", header: "Categoría" },
    { key: "issue", header: "Issue" },
    { key: "page", header: "Página", sticky: true },
    { key: "sev", header: "Severidad" },
    { key: "val", header: "Valor medido", mono: true },
    { key: "state", header: "Estado" },
  ];

  const issueRows: ReactNode[][] = priorityIssues
    .slice()
    .sort(
      (a, b) =>
        (SEVERITY_SORT_WEIGHT[a.severity] ?? 99) - (SEVERITY_SORT_WEIGHT[b.severity] ?? 99)
    )
    .map((issue) => {
      const url = issue.url;
      const pageCell: ReactNode =
        url && /^https?:\/\//i.test(url) ? url : shortUrl(url);
      return [
        <span className={styles.categoryTag}>
          {CATEGORY_LABEL[issue.category as Category] ?? issue.category}
        </span>,
        issue.title,
        pageCell,
        <SeverityBadge severity={issue.severity as Severity} />,
        issue.measuredValue ?? "—",
        issue.diffStatus ? <DiffBadge diff={issue.diffStatus as Diff} /> : "—",
      ];
    });

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <p className={styles.breadcrumb}>
          <Link href="/">
            <ArrowLeft size={16} aria-hidden="true" /> Inicio
          </Link>
        </p>

        <div className={styles.header}>
          <div>
            <h1 className={styles.domain}>{audit.site.domain}</h1>
            <p className={styles.meta}>
              Auditoría completada el {formatDate(audit.finishedAt)} · {audit.urlLimit} URLs máx.
            </p>
          </div>
          <div className={styles.headerActions}>
            <Link href={`/audits/${auditId}/pages`} className={styles.linkOut}>
              Ver páginas y grafo de entidades
            </Link>
            <ExportMenu auditId={auditId} domain={audit.site.domain} />
          </div>
        </div>

        {/* Score general */}
        <Reveal as="section" className={styles.section} delay={0}>
          <div className={styles.hero}>
            <div className={styles.heroGauge}>
              {overall !== null ? (
                <ScoreGaugeAnimated
                  value={overall}
                  status={hasScores ? overallStatus : null}
                  ariaLabel={`Score general ${overall} de 100, ${STATUS_LABEL[overallStatus]}`}
                />
              ) : (
                <ScoreGauge
                  size="lg"
                  value={null}
                  status={null}
                  aria-label="Score general sin datos"
                />
              )}
            </div>
            <div className={styles.heroBody}>
              <h2 className={styles.heroTitle}>Score general</h2>
              <p className={styles.heroText}>
                Promedio ponderado de SEO técnico, rendimiento, on-page, datos estructurados y
                AEO, calculado con los hallazgos de esta auditoría.
              </p>
              {hasScores ? (
                <Badge variant={STATUS_BADGE_VARIANT[overallStatus]}>
                  {STATUS_LABEL[overallStatus]}
                </Badge>
              ) : null}
            </div>
          </div>
        </Reveal>

        {/* Scores por categoría */}
        <Reveal as="section" className={styles.section} delay={60}>
          <h3 className={styles.sectionTitle}>Scores por categoría</h3>
          <div className={styles.categoryGrid}>
            {CATEGORY_ORDER.map((category, i) => {
              const result = byCategory[category];
              const status = result?.status ?? null;
              return (
                <Reveal key={category} delay={Math.min(i, 3) * 60}>
                  <CategoryCard
                    label={CATEGORY_LABEL[category]}
                    score={result ? result.score : null}
                    status={status}
                    statusLabel={
                      status ? STATUS_LABEL[status] : result ? undefined : "sin datos"
                    }
                  />
                </Reveal>
              );
            })}
          </div>
        </Reveal>

        {/* Cambios desde la auditoría anterior */}
        {diff.previousAuditId && (
          <Reveal as="section" className={styles.section} delay={120}>
            <h3 className={styles.sectionTitle}>Cambios desde la auditoría anterior</h3>
            <div className={styles.diffSummary}>
              <div className={styles.diffItem}>
                <DiffBadge diff="new" />
                <span className={styles.diffCount}>{diff.newCount}</span>
                <span className={styles.diffItemLabel}>Nuevos</span>
              </div>
              <div className={styles.diffItem}>
                <DiffBadge diff="persistent" />
                <span className={styles.diffCount}>{diff.persistentCount}</span>
                <span className={styles.diffItemLabel}>Persistentes</span>
              </div>
              <div className={styles.diffItem}>
                <DiffBadge diff="resolved" />
                <span className={styles.diffCount}>{diff.resolvedCount}</span>
                <span className={styles.diffItemLabel}>Resueltos</span>
              </div>
            </div>
            {resolvedIssues.length > 0 && (
              <ul className={styles.resolvedList}>
                {resolvedIssues.map((issue, i) => (
                  <li key={`${issue.checkId}-${i}`} className={styles.resolvedItem}>
                    <DiffBadge diff="resolved" />
                    <span className={styles.categoryTag}>
                      {CATEGORY_LABEL[issue.category as Category] ?? issue.category}
                    </span>
                    <span>{issue.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        )}

        {/* Issues prioritarios */}
        <Reveal as="section" className={styles.section} delay={180}>
          <h3 className={styles.sectionTitle}>Issues prioritarios</h3>
          <IssuesTable
            columns={issueColumns}
            rows={issueRows}
            caption="Issues prioritarios"
            emptyLabel="Sin issues críticos ni de advertencia. Buen trabajo."
            note={
              totalPriorityCandidates > issueRows.length
                ? `Mostrando los ${issueRows.length} de ${totalPriorityCandidates} issues críticos y de advertencia más relevantes.`
                : undefined
            }
          />
        </Reveal>

        {/* Resumen de rendimiento */}
        <Reveal as="section" className={styles.section} delay={0}>
          <h3 className={styles.sectionTitle}>Resumen de rendimiento</h3>
          {!perf || perf.sampledPages === 0 ? (
            perf?.error ? (
              <ErrorState
                title={`No pudimos obtener métricas de rendimiento: ${perf.error}.`}
                description=""
                titleLevel={3}
              />
            ) : (
              <EmptyState
                title="Esta auditoría no tiene muestra de rendimiento."
                description=""
                titleLevel={3}
              />
            )
          ) : (
            <>
              <div className={styles.perfGrid}>
                {(["mobile", "desktop"] as const).map((strategy) => {
                  const s = perf[strategy];
                  return (
                    <div key={strategy} className={styles.perfCard}>
                      <h4 className={styles.perfCardTitle}>{STRATEGY_LABEL[strategy]}</h4>
                      <div className={styles.perfMetricRow}>
                        <span className={styles.perfMetricLabel}>Performance Score</span>
                        <span className={styles.perfMetricValue}>
                          {s.avgScore ?? "no disponible"}
                        </span>
                      </div>
                      <div className={styles.perfMetricRow}>
                        <span className={styles.perfMetricLabel}>LCP</span>
                        <span className={styles.perfMetricValue}>
                          {formatPerfNumber(s.avgLcpMs, "ms")}
                        </span>
                      </div>
                      <div className={styles.perfMetricRow}>
                        <span className={styles.perfMetricLabel}>CLS</span>
                        <span className={styles.perfMetricValue}>
                          {s.avgCls ?? "no disponible"}
                        </span>
                      </div>
                      <div className={styles.perfMetricRow}>
                        <span className={styles.perfMetricLabel}>INP</span>
                        <span className={styles.perfMetricValue}>
                          {formatPerfNumber(s.avgInpMs, "ms")}
                        </span>
                      </div>
                      <div className={styles.perfMetricRow}>
                        <span className={styles.perfMetricLabel}>TTFB</span>
                        <span className={styles.perfMetricValue}>
                          {formatPerfNumber(s.avgTtfbMs, "ms")}
                        </span>
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
        </Reveal>

        {/* Detalle por categoría */}
        <Reveal as="section" className={styles.section} delay={60}>
          <h3 className={styles.sectionTitle}>Detalle por categoría</h3>
          {CATEGORY_ORDER.map((category) => {
            const issues = issuesByCategory[category] ?? [];
            if (issues.length === 0) return null;
            const problems = issues.filter(
              (i) => i.severity === "critical" || i.severity === "warning"
            );
            const passing = issues.filter((i) => i.severity === "ok");

            const renderIssue = (issue: ReportIssue) => {
              const url = issue.url;
              return (
                <IssueDetail
                  key={issue.id}
                  checkId={issue.checkId}
                  title={issue.title}
                  badges={
                    <>
                      <SeverityBadge severity={issue.severity as Severity} />
                      {issue.diffStatus ? (
                        <DiffBadge diff={issue.diffStatus as Diff} />
                      ) : null}
                    </>
                  }
                  fields={[
                    { label: "Página / URL", value: urlValue(url) },
                    { label: "Valor medido", value: issue.measuredValue ?? "—" },
                    { label: "Criterio", value: issue.criterion ?? "—" },
                    { label: "Recomendación", value: issue.recommendation ?? "—" },
                  ]}
                />
              );
            };

            return (
              <CategoryAccordion
                key={category}
                title={CATEGORY_LABEL[category]}
                count={`${problems.length} problema(s) · ${passing.length} correcto(s)`}
              >
                <AccordionSubgroup kind="problems" count={problems.length}>
                  {problems.map(renderIssue)}
                </AccordionSubgroup>
                <AccordionSubgroup kind="correct" count={passing.length}>
                  {passing.map(renderIssue)}
                </AccordionSubgroup>
              </CategoryAccordion>
            );
          })}
        </Reveal>

        <p className={styles.footerLinks}>
          <Link href={`/audits/${auditId}/pages`}>Ver páginas rastreadas y grafo de entidades</Link>
        </p>
      </div>
    </div>
  );
}
