import Link from "next/link";
import { ArrowLeft, ArrowRight, Network } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@auditor/db";
import type { Category, ScoreStatus } from "@auditor/scoring";
import {
  buildReportModel,
  TEMPLATE_ORDER,
  type PageTemplate,
  type ReportIssue,
  type ReportModel,
  type SocialPreviewData,
} from "@auditor/report-model";
import { ScoreGauge } from "../../components/ui/ScoreGauge";
import { CategoryCard } from "../../components/ui/CategoryCard";
import {
  CategoryAccordion,
  AccordionSubgroup,
} from "../../components/ui/CategoryAccordion";
import { IssueTypeGroup } from "../../components/ui/IssueTypeGroup";
import { StackTable } from "../../components/ui/StackTable";
import { Badge, DiffBadge } from "../../components/ui/Badge";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { Reveal } from "../../components/motion/useReveal";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  STATUS_LABEL,
  STRATEGY_LABEL,
  TEMPLATE_LABEL,
} from "../../components/ui/labels";
import { AuditProgress } from "./AuditProgress";
import { GroupingToggle } from "./GroupingToggle";
import { ScoreGaugeAnimated } from "./ScoreGaugeAnimated";
import styles from "./report.module.css";

// Self-hosted deploy (Dokploy/Nixpacks-or-custom-Dockerfile) builds may run
// isolated from the DB/Redis network -- force dynamic (request-time)
// rendering defensively so `next build` never attempts to touch Prisma/Redis
// during static generation.
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Estado de score → variante de Badge (reusa el eje de severidad, DS-02). */
const STATUS_BADGE_VARIANT: Record<ScoreStatus, "ok" | "warning" | "critical"> = {
  good: "ok",
  needs_improvement: "warning",
  critical: "critical",
};

/**
 * Previews de compartición de las páginas presentes en `issues`, en orden de
 * primera aparición y sin repetir página. Una página sin entrada derivada
 * (HTML ausente o issue de alcance de sitio) simplemente no aporta preview.
 */
function socialPreviewsFor(issues: ReportIssue[], model: ReportModel): SocialPreviewData[] {
  const previews: SocialPreviewData[] = [];
  const seen = new Set<string>();
  for (const issue of issues) {
    if (!issue.pageId || seen.has(issue.pageId)) continue;
    seen.add(issue.pageId);
    const preview = model.socialPreviews?.[issue.pageId];
    if (preview) previews.push(preview);
  }
  return previews;
}

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

/**
 * Decide si la URL resuelta (URLRES-02) merece mostrarse en el reporte:
 * solo cuando difiere del dominio ingresado (protocolo http, subdominio www,
 * o cualquier path/host distinto). Comparación laxa: un `https://<domain>`
 * con o sin barra final ni `www.` se considera equivalente y no se muestra.
 */
function resolvedDiffersFromDomain(resolvedUrl: string | null, domain: string): boolean {
  if (!resolvedUrl) return false;
  const stripWww = (host: string) => host.replace(/^www\./, "");
  const bareDomain = stripWww(domain.toLowerCase());
  try {
    const parsed = new URL(resolvedUrl);
    const sameHost = stripWww(parsed.hostname.toLowerCase()) === bareDomain;
    const rootPath = parsed.pathname === "" || parsed.pathname === "/";
    const httpsProtocol = parsed.protocol === "https:";
    const noQueryOrHash = parsed.search === "" && parsed.hash === "";
    return !(sameHost && rootPath && httpsProtocol && noQueryOrHash);
  } catch {
    return false;
  }
}

function formatPerfNumber(value: number | null, unit: string): string {
  if (value === null) return "no disponible";
  return `${value}${unit}`;
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

  const { byCategory, diff, perf, priorityCandidates } = model;
  const resolvedIssues = diff.resolvedIssues;
  const issuesByCategory = model.issuesByCategory;
  const issuesByTemplate = model.issuesByTemplate;

  const overallStatus = model.status;
  const overall = model.overall;
  const hasScores = model.hasScores;

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
            {resolvedDiffersFromDomain(audit.resolvedUrl, audit.site.domain) && (
              <p className={styles.meta}>Analizamos: {audit.resolvedUrl}</p>
            )}
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
                Promedio ponderado de SEO técnico, rendimiento, on-page, datos estructurados,
                AEO y meta tags/social, calculado con los hallazgos de esta auditoría.
              </p>
              {hasScores ? (
                <Badge variant={STATUS_BADGE_VARIANT[overallStatus]}>
                  {STATUS_LABEL[overallStatus]}
                </Badge>
              ) : null}
            </div>
          </div>
        </Reveal>

        {/* Stack técnico detectado — solo cuando el audit trae stack (Phase 26).
            El guard vive acá: con model.stack undefined (audits pre-v1.5) la
            sección entera se omite; nunca se pinta una tabla vacía. */}
        {model.stack && (
          <Reveal as="section" className={styles.section} delay={30}>
            <StackTable stack={model.stack} />
          </Reveal>
        )}

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
          {priorityCandidates.length === 0 ? (
            <EmptyState
              variant="success"
              title="Sin issues críticos ni de advertencia. Buen trabajo."
            />
          ) : (
            // Se agrupa el conjunto COMPLETO de candidatos (todos los issues
            // críticos y de advertencia), no un slice: así el conteo "N páginas"
            // de cada grupo es el total real y coincide con "Detalle por
            // categoría" (WR-01). La agrupación ya condensa la tabla, por lo que
            // el antiguo cap de 60 filas ya no hace falta.
            <IssueTypeGroup issues={priorityCandidates} siteHost={model.audit.domain} />
          )}
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

        {/* Detalle por categoría / plantilla */}
        <Reveal as="section" className={styles.section} delay={60}>
          <h3 className={styles.sectionTitle}>Detalle por categoría / plantilla</h3>
          <GroupingToggle
            byType={
              <>
                {CATEGORY_ORDER.map((category) => {
                  const issues = issuesByCategory[category] ?? [];
                  if (issues.length === 0) return null;
                  const problems = issues.filter(
                    (i) => i.severity === "critical" || i.severity === "warning"
                  );
                  const passing = issues.filter((i) => i.severity === "ok");

                  return (
                    <CategoryAccordion
                      key={category}
                      title={CATEGORY_LABEL[category]}
                      count={`${problems.length} problema(s) · ${passing.length} correcto(s)`}
                    >
                      <AccordionSubgroup kind="problems" count={problems.length}>
                        <IssueTypeGroup
                          issues={problems}
                          siteHost={model.audit.domain}
                          {...(category === "social"
                            ? {
                                auditId,
                                socialPreviews: socialPreviewsFor(problems, model),
                              }
                            : {})}
                        />
                      </AccordionSubgroup>
                      <AccordionSubgroup kind="correct" count={passing.length}>
                        <IssueTypeGroup issues={passing} siteHost={model.audit.domain} />
                      </AccordionSubgroup>
                    </CategoryAccordion>
                  );
                })}
              </>
            }
            byTemplate={
              <>
                {TEMPLATE_ORDER.map((template: PageTemplate) => {
                  const issues = issuesByTemplate[template] ?? [];
                  if (issues.length === 0) return null;
                  const problems = issues.filter(
                    (i) => i.severity === "critical" || i.severity === "warning"
                  );
                  const passing = issues.filter((i) => i.severity === "ok");

                  return (
                    <CategoryAccordion
                      key={template}
                      title={TEMPLATE_LABEL[template]}
                      count={`${problems.length} problema(s) · ${passing.length} correcto(s)`}
                    >
                      <AccordionSubgroup kind="problems" count={problems.length}>
                        <IssueTypeGroup issues={problems} siteHost={model.audit.domain} />
                      </AccordionSubgroup>
                      <AccordionSubgroup kind="correct" count={passing.length}>
                        <IssueTypeGroup issues={passing} siteHost={model.audit.domain} />
                      </AccordionSubgroup>
                    </CategoryAccordion>
                  );
                })}
              </>
            }
          />
        </Reveal>

        {/* Arquitectura del sitio: link a la página-mapa a pantalla completa */}
        {model.architecture && (
          <Reveal as="section" className={styles.section} delay={120}>
            <h3 className={styles.sectionTitle}>Arquitectura del sitio</h3>
            <Link href={`/audits/${auditId}/arquitectura`} className={styles.archCard}>
              <span className={styles.archCardBody}>
                <Network size={20} aria-hidden />
                <span className={styles.archCardText}>
                  <span className={styles.archCardTitle}>Ver mapa de arquitectura del sitio</span>
                  <span className={styles.archCardSubtitle}>
                    Ábrelo a pantalla completa para acercar, alejar y arrastrar.
                  </span>
                </span>
              </span>
              <ArrowRight size={18} aria-hidden />
            </Link>
          </Reveal>
        )}

        <p className={styles.footerLinks}>
          <Link href={`/audits/${auditId}/pages`}>Ver páginas rastreadas y grafo de entidades</Link>
        </p>
      </div>
    </div>
  );
}
