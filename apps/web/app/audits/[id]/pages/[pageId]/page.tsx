import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@auditor/db";
import type { EntityGraph } from "@auditor/checks";
import { EntityGraphSvg } from "../../../../components/EntityGraphSvg";
import { SeverityBadge } from "../../../../components/ui/Badge";
import { EmptyState } from "../../../../components/ui/EmptyState";
import styles from "../pages.module.css";

const EMPTY_GRAPH: EntityGraph = { nodes: [], edges: [] };

interface PageProps {
  params: Promise<{ id: string; pageId: string }>;
}

type Severity = "critical" | "warning" | "ok";

const SEVERITY_SET = new Set<string>(["critical", "warning", "ok"]);

/** severidad → clase que setea el borde izquierdo del hallazgo por token. */
const FINDING_CLASS: Record<string, string | undefined> = {
  critical: styles.findingCritical,
  warning: styles.findingWarning,
  ok: styles.findingOk,
};

/**
 * Per-page structured-data report: entity graph (SD-05) + schema/AEO issues
 * for that page. Kept minimal — the full audit report lands in Phase 6.
 */
export default async function PageDetailPage({ params }: PageProps) {
  const { id: auditId, pageId } = await params;

  const page = await prisma.page.findFirst({
    where: { id: pageId, auditId },
    select: { id: true, url: true, finalUrl: true, statusCode: true, schemaGraph: true },
  });

  if (!page) notFound();

  const graph = (page.schemaGraph as EntityGraph | null) ?? EMPTY_GRAPH;

  const issues = await prisma.issue.findMany({
    where: { auditId, pageId, category: { in: ["schema", "aeo"] } },
    orderBy: [{ severity: "asc" }, { checkId: "asc" }],
  });

  const finalUrl = page.finalUrl ?? page.url;

  return (
    <div className={styles.main}>
      <p className={styles.breadcrumb}>
        <Link href={`/audits/${auditId}/pages`}>&larr; Volver a páginas</Link>
      </p>
      <h1 className={styles.title}>Datos estructurados y AEO</h1>
      <p className={styles.meta}>
        {finalUrl}
        {typeof page.statusCode === "number" ? ` (HTTP ${page.statusCode})` : ""}
      </p>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Grafo de entidades</h3>
        <div className={styles.graphCard}>
          <EntityGraphSvg graph={graph} />
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Hallazgos ({issues.length})</h3>
        {issues.length === 0 ? (
          <EmptyState
            titleLevel={3}
            title="Sin hallazgos"
            description="Sin hallazgos de datos estructurados ni de AEO para esta página."
          />
        ) : (
          <ul className={styles.findings}>
            {issues.map((issue) => (
              <li
                key={issue.id}
                className={`${styles.finding} ${FINDING_CLASS[issue.severity] ?? ""}`}
              >
                <div className={styles.findingHeader}>
                  <p className={styles.findingTitle}>
                    [{issue.checkId}] {issue.title}
                  </p>
                  {SEVERITY_SET.has(issue.severity) ? (
                    <SeverityBadge severity={issue.severity as Severity} />
                  ) : null}
                </div>
                {issue.measuredValue && (
                  <p className={styles.findingValue}>{issue.measuredValue}</p>
                )}
                {issue.recommendation && (
                  <p className={styles.findingRec}>{issue.recommendation}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
