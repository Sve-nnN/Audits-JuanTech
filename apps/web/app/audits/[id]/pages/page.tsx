import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@auditor/db";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { shortUrl } from "../../../components/ui/url";
import { Reveal } from "../../../components/motion/useReveal";
import styles from "./pages.module.css";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Lists crawled pages for an audit with a structured-data presence indicator, linking to each page's report. */
export default async function AuditPagesPage({ params }: PageProps) {
  const { id: auditId } = await params;

  const audit = await prisma.audit.findUnique({ where: { id: auditId }, select: { id: true } });
  if (!audit) notFound();

  const pages = await prisma.page.findMany({
    where: { auditId },
    select: { id: true, url: true, finalUrl: true, statusCode: true, schemaGraph: true },
    orderBy: { url: "asc" },
  });

  return (
    <main className={styles.main}>
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
                  {shortUrl(fullUrl)}
                </Link>
                {nodeCount > 0 ? (
                  <Badge variant="ok">{nodeCount} entidad(es) JSON-LD</Badge>
                ) : (
                  <Badge variant="neutral">sin JSON-LD</Badge>
                )}
              </Reveal>
            );
          })}
        </ul>
      )}
    </main>
  );
}
