import { NextResponse } from "next/server";
import { prisma } from "@auditor/db";

// Self-hosted deploy (Dokploy/Nixpacks-or-custom-Dockerfile) builds may run
// isolated from the DB/Redis network -- force dynamic (request-time)
// rendering defensively so `next build` never attempts to touch Prisma/Redis
// during static generation.
export const dynamic = 'force-dynamic'

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  const audit = await prisma.audit.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      error: true,
      urlLimit: true,
      stats: true,
      scores: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      _count: { select: { pages: true } },
    },
  });

  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  const { _count, ...rest } = audit;

  // Issue counts by category + severity, for the lightweight polling view
  // on the home page. The full report (issue details, scoring, diff) lives
  // at `/audits/[id]` (Phase 6) and queries Issue/PerfMetric directly.
  const issueGroups = await prisma.issue.groupBy({
    by: ["category", "severity"],
    where: { auditId: id },
    _count: { _all: true },
  });

  const issuesByCategory: Record<string, { critical: number; warning: number; ok: number; total: number }> = {};
  for (const group of issueGroups) {
    const bucket =
      issuesByCategory[group.category] ??
      (issuesByCategory[group.category] = { critical: 0, warning: 0, ok: 0, total: 0 });
    bucket[group.severity] += group._count._all;
    bucket.total += group._count._all;
  }

  // PerfMetric preview — scores + Core Web Vitals per url/strategy for the
  // small PSI sample (never the full crawl).
  const perfMetrics = await prisma.perfMetric.findMany({
    where: { auditId: id },
    select: {
      url: true,
      strategy: true,
      performanceScore: true,
      lcpMs: true,
      cls: true,
      inpMs: true,
      ttfbMs: true,
      fromCache: true,
      error: true,
      fetchedAt: true,
    },
    orderBy: { fetchedAt: "asc" },
  });

  return NextResponse.json(
    { ...rest, pageCount: _count.pages, issuesByCategory, perf: perfMetrics },
    { status: 200 }
  );
}
