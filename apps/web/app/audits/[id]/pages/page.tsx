import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@auditor/db";
import type { ReportSeverity } from "@auditor/report-model";
import { JsonLdBadge } from "../../../components/ui/JsonLdBadge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { shortUrl } from "../../../components/ui/url";
import { Reveal } from "../../../components/motion/useReveal";
import styles from "./pages.module.css";

// Self-hosted deploy (Dokploy/Nixpacks-or-custom-Dockerfile) builds may run
// isolated from the DB/Redis network -- force dynamic (request-time)
// rendering defensively so `next build` never attempts to touch Prisma/Redis
// during static generation.
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Lists crawled pages for an audit with a structured-data presence indicator, linking to each page's report. */
export default async function AuditPagesPage({ params }: PageProps) {
  const { id: auditId } = await params;

  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { id: true, site: { select: { domain: true } } },
  });
  if (!audit) notFound();
  const siteHost = audit.site.domain;

  const pages = await prisma.page.findMany({
    where: { auditId },
    select: { id: true, url: true, finalUrl: true, statusCode: true, schemaGraph: true },
    orderBy: { url: "asc" },
  });

  // Severidades de issues de categoría `schema` agrupadas por pageId (REPORT-04).
  const schemaIssues = await prisma.issue.findMany({
    where: { auditId, category: "schema" },
    select: { pageId: true, severity: true },
  });
  const schemaSeverityByPage = new Map<string, ReportSeverity[]>();
  for (const issue of schemaIssues) {
    if (!issue.pageId) continue;
    const list = schemaSeverityByPage.get(issue.pageId) ?? [];
    list.push(issue.severity as ReportSeverity);
    schemaSeverityByPage.set(issue.pageId, list);
  }

  return (
    <div className={styles.main}>
      <p className={styles.breadcrumb}>
        <Link href="/">&larr; Inicio</Link>
      </p>
      <h1 className={styles.title}>Páginas rastreadas ({pages.length})</h1>

      {pages.length === 0 ? (
        <EmptyState
          title="Sin páginas rastreadas"
          description="Todavía no hay páginas rastreadas para esta auditoría."
        />
      ) : (
        <ul className={styles.list}>
          {pages.map((page, i) => {
            const graph = page.schemaGraph as { nodes?: unknown[] } | null;
            const nodeCount = graph && Array.isArray(graph.nodes) ? graph.nodes.length : 0;
            const fullUrl = page.finalUrl ?? page.url;
            return (
              <Reveal
                as="li"
                key={page.id}
                className={styles.row}
                delay={Math.min(i, 8) * 40}
              >
                <Link
                  href={`/audits/${auditId}/pages/${page.id}`}
                  className={styles.rowLink}
                  title={fullUrl}
                >
                  {shortUrl(fullUrl, siteHost)}
                </Link>
                <JsonLdBadge
                  schemaSeverities={schemaSeverityByPage.get(page.id) ?? []}
                  nodeCount={nodeCount}
                />
              </Reveal>
            );
          })}
        </ul>
      )}
    </div>
  );
}
