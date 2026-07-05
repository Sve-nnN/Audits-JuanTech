import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@auditor/db";
import type { EntityGraph } from "@auditor/checks";
import { EntityGraphSvg } from "../../../../components/EntityGraphSvg";

const EMPTY_GRAPH: EntityGraph = { nodes: [], edges: [] };

interface PageProps {
  params: Promise<{ id: string; pageId: string }>;
}

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítico",
  warning: "Advertencia",
  ok: "Correcto",
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#dc2626",
  warning: "#d97706",
  ok: "#16a34a",
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

  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif", maxWidth: 900 }}>
      <p>
        <Link href={`/audits/${auditId}/pages`}>&larr; Volver a páginas</Link>
      </p>
      <h1 style={{ fontSize: 20 }}>Datos estructurados y AEO</h1>
      <p style={{ color: "#475569", wordBreak: "break-all" }}>
        {page.finalUrl ?? page.url}
        {typeof page.statusCode === "number" ? ` (HTTP ${page.statusCode})` : ""}
      </p>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Grafo de entidades</h2>
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}>
        <EntityGraphSvg graph={graph} />
      </div>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Hallazgos ({issues.length})</h2>
      {issues.length === 0 ? (
        <p style={{ color: "#475569" }}>Sin hallazgos de datos estructurados o AEO para esta página.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {issues.map((issue) => (
            <li
              key={issue.id}
              style={{
                borderLeft: `4px solid ${SEVERITY_COLOR[issue.severity] ?? "#64748b"}`,
                padding: "8px 12px",
                marginBottom: 8,
                background: "#f8fafc",
              }}
            >
              <strong>
                [{issue.checkId}] {issue.title}
              </strong>{" "}
              <span style={{ color: SEVERITY_COLOR[issue.severity] ?? "#64748b" }}>
                ({SEVERITY_LABEL[issue.severity] ?? issue.severity})
              </span>
              {issue.measuredValue && <p style={{ margin: "4px 0" }}>{issue.measuredValue}</p>}
              {issue.recommendation && (
                <p style={{ margin: "4px 0", color: "#475569" }}>{issue.recommendation}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
