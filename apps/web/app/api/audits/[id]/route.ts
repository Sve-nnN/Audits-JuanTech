import { NextResponse } from "next/server";
import { prisma } from "@auditor/db";

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

  // Preview-only issue counts by category + severity. The full report
  // (issue details, scoring) is built in Phase 6 — this just gives the web
  // client enough to render a summary while an audit is running/done.
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

  // Phase 5: PerfMetric preview — scores + Core Web Vitals per url/strategy
  // for the small PSI sample (never the full crawl). The full perf report
  // (weighted scoring, per-metric breakdown UI) lands in Phase 6.
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
