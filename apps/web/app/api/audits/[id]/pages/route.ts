import { NextResponse } from "next/server";
import { prisma } from "@auditor/db";

export const runtime = "nodejs";

/**
 * Lists the crawled pages for an audit, with a lightweight structured-data
 * presence indicator (node/edge counts from the persisted entity graph) so
 * the web client can link straight to the pages worth inspecting (Phase 4).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  const audit = await prisma.audit.findUnique({ where: { id }, select: { id: true } });
  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  const pages = await prisma.page.findMany({
    where: { auditId: id },
    select: {
      id: true,
      url: true,
      finalUrl: true,
      statusCode: true,
      schemaGraph: true,
    },
    orderBy: { url: "asc" },
  });

  const result = pages.map((page) => {
    const graph = page.schemaGraph as { nodes?: unknown[]; edges?: unknown[] } | null;
    return {
      id: page.id,
      url: page.finalUrl ?? page.url,
      statusCode: page.statusCode,
      hasSchema: Boolean(graph && Array.isArray(graph.nodes) && graph.nodes.length > 0),
      schemaNodeCount: graph && Array.isArray(graph.nodes) ? graph.nodes.length : 0,
      schemaEdgeCount: graph && Array.isArray(graph.edges) ? graph.edges.length : 0,
    };
  });

  return NextResponse.json({ pages: result }, { status: 200 });
}
