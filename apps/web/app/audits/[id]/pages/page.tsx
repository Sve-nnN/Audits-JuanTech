import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@auditor/db";

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
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif", maxWidth: 900 }}>
      <p>
        <Link href="/">&larr; Inicio</Link>
      </p>
      <h1 style={{ fontSize: 20 }}>Páginas rastreadas ({pages.length})</h1>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {pages.map((page) => {
          const graph = page.schemaGraph as { nodes?: unknown[] } | null;
          const nodeCount = graph && Array.isArray(graph.nodes) ? graph.nodes.length : 0;
          return (
            <li
              key={page.id}
              style={{
                borderBottom: "1px solid #e2e8f0",
                padding: "8px 0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Link
                href={`/audits/${auditId}/pages/${page.id}`}
                style={{ wordBreak: "break-all", flex: 1 }}
              >
                {page.finalUrl ?? page.url}
              </Link>
              <span style={{ color: nodeCount > 0 ? "#16a34a" : "#94a3b8", fontSize: 13, whiteSpace: "nowrap" }}>
                {nodeCount > 0 ? `${nodeCount} entidad(es) JSON-LD` : "sin JSON-LD"}
              </span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
