import { Worker, type Job } from "bullmq";
import { prisma, Prisma, type Page as PageRow } from "@auditor/db";
import { runCrawl, discoverSitemapUrls, DEFAULT_USER_AGENT } from "@auditor/crawler";
import { runAllChecks } from "@auditor/checks";
import {
  AUDIT_QUEUE,
  createRedisConnection,
  type AuditJobData,
  type AuditJobResult,
} from "@auditor/queue";
import {
  selectSample,
  runPsi,
  getCached,
  setCached,
  mapPerfIssues,
  type PsiStrategy,
  type PsiMetrics,
  type PerfIssueDraft,
} from "@auditor/psi";

// Phase 2: the worker now runs a real bounded crawl (Crawlee CheerioCrawler,
// see @auditor/crawler) for each audit job — discover URLs (sitemap or
// link-crawl fallback), fetch+parse, persist Page rows, report progress via
// Audit.stats. Web (apps/web) stays crawl-logic-free: it only enqueues and
// reads DB. Chrome/Playwright/Lighthouse are not used yet (later phases).

// Phase 3: after the crawl completes, the worker runs the full SEO técnico +
// on-page check battery (@auditor/checks) over the crawled Pages and
// persists the resulting Issues (idempotent: existing Issues for the audit
// are deleted first, so re-running an audit doesn't accumulate duplicates).

// Phase 5: after checks run, a small representative sample of pages (never
// the full crawl — see @auditor/psi `selectSample`) gets PageSpeed Insights
// runs (mobile + desktop, cache-first) for Core Web Vitals. A PSI failure or
// timeout for a given page+strategy degrades that metric to "not available"
// (see @auditor/psi `mapPerfIssues`) — it never fails the whole audit.

const ROBOTS_FETCH_TIMEOUT_MS = 10_000;
const MAX_PSI_PAGES = 5;
/** Bounded concurrency for PSI calls — keyless PSI has a low rate limit (~1 req/s). */
const PSI_CONCURRENCY = 2;
const PSI_STRATEGIES: readonly PsiStrategy[] = ["mobile", "desktop"];

/** Fetches the raw robots.txt body for `origin` (best-effort, for the TECH-01 check). */
async function fetchRobotsTxtBody(origin: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROBOTS_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      signal: controller.signal,
      headers: { "user-agent": DEFAULT_USER_AGENT },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Real crawls (up to 500 URLs) can legitimately take several minutes, and
// Phase 5 adds a PSI sample pass (up to MAX_PSI_PAGES pages x 2 strategies,
// each PSI lab run taking up to ~60s with retries) after the crawl+checks.
// This must stay comfortably above the worst-case crawl+checks+PSI
// duration, while BullMQ's stalled-job detection (below) still catches a
// genuinely dead worker.
const JOB_TIMEOUT_MS = 20 * 60_000;
const CONCURRENCY = 2;
/** Throttle Audit.stats writes so a fast crawl doesn't hammer Postgres. */
const PROGRESS_WRITE_THROTTLE_MS = 2_000;

/** Rejects if `promise` doesn't settle within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

interface StrategyPerfSummary {
  avgScore: number | null;
  avgLcpMs: number | null;
  avgCls: number | null;
  avgInpMs: number | null;
  avgTtfbMs: number | null;
}

interface PerfSampleSummary {
  sampledPages: number;
  sampledUrls: string[];
  mobile: StrategyPerfSummary;
  desktop: StrategyPerfSummary;
  error?: string;
}

function average(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return Math.round((present.reduce((sum, v) => sum + v, 0) / present.length) * 100) / 100;
}

function summarizeStrategy(rows: (PsiMetrics | null)[]): StrategyPerfSummary {
  return {
    avgScore: average(rows.map((r) => r?.performanceScore ?? null)),
    avgLcpMs: average(rows.map((r) => r?.lcpMs ?? null)),
    avgCls: average(rows.map((r) => r?.cls ?? null)),
    avgInpMs: average(rows.map((r) => r?.inpMs ?? null)),
    avgTtfbMs: average(rows.map((r) => r?.ttfbMs ?? null)),
  };
}

/**
 * Runs PageSpeed Insights (cache-first, mobile + desktop) over a small
 * representative sample of `pages` (PERF-01..04), persists `PerfMetric`
 * rows, and returns the perf `Issue` drafts + a stats summary. Best-effort:
 * a single page+strategy failing (timeout, rate limit, etc.) degrades that
 * metric to "not available" — it never throws, so it never fails the audit.
 */
async function runPerfSample(
  auditId: string,
  pages: PageRow[]
): Promise<{ issues: PerfIssueDraft[]; summary: PerfSampleSummary }> {
  const sample = selectSample(pages, MAX_PSI_PAGES) as unknown as PageRow[];

  if (sample.length === 0) {
    return {
      issues: [],
      summary: { sampledPages: 0, sampledUrls: [], mobile: summarizeStrategy([]), desktop: summarizeStrategy([]) },
    };
  }

  const issues: PerfIssueDraft[] = [];
  const metricRows: {
    pageId: string;
    url: string;
    strategy: PsiStrategy;
    performanceScore: number | null;
    lcpMs: number | null;
    cls: number | null;
    inpMs: number | null;
    ttfbMs: number | null;
    fromCache: boolean;
    error: string | null;
  }[] = [];
  const byStrategy: Record<PsiStrategy, (PsiMetrics | null)[]> = { mobile: [], desktop: [] };

  async function runOnePage(page: PageRow): Promise<void> {
    const url = page.finalUrl ?? page.url;
    const perPageMetrics: Partial<Record<PsiStrategy, PsiMetrics | null>> = {};

    for (const strategy of PSI_STRATEGIES) {
      let metrics: PsiMetrics | null = null;
      let fromCache = false;
      let error: string | null = null;

      try {
        const cached = await getCached(url, strategy);
        if (cached) {
          metrics = cached;
          fromCache = true;
        } else {
          const result = await runPsi(url, strategy);
          if (result.ok && result.metrics) {
            metrics = result.metrics;
            await setCached(url, strategy, metrics);
          } else {
            error = result.error ?? "PSI request failed";
          }
        }
      } catch (caught) {
        error = caught instanceof Error ? caught.message : "unknown PSI error";
      }

      perPageMetrics[strategy] = metrics;
      byStrategy[strategy]!.push(metrics);
      metricRows.push({
        pageId: page.id,
        url,
        strategy,
        performanceScore: metrics?.performanceScore ?? null,
        lcpMs: metrics?.lcpMs ?? null,
        cls: metrics?.cls ?? null,
        inpMs: metrics?.inpMs ?? null,
        ttfbMs: metrics?.ttfbMs ?? null,
        fromCache,
        error,
      });
    }

    issues.push(
      ...mapPerfIssues({
        url,
        pageId: page.id,
        mobile: perPageMetrics.mobile,
        desktop: perPageMetrics.desktop,
      })
    );
  }

  let cursor = 0;
  async function lane(): Promise<void> {
    while (cursor < sample.length) {
      const page = sample[cursor++];
      if (page) await runOnePage(page);
    }
  }
  await Promise.all(Array.from({ length: Math.min(PSI_CONCURRENCY, sample.length) }, () => lane()));

  // Idempotent re-run: wipe previously-generated PerfMetric rows for this
  // audit before persisting the fresh batch (mirrors the Issue table below).
  await prisma.perfMetric.deleteMany({ where: { auditId } });
  if (metricRows.length > 0) {
    await prisma.perfMetric.createMany({
      data: metricRows.map((row) => ({ auditId, ...row })),
    });
  }

  return {
    issues,
    summary: {
      sampledPages: sample.length,
      sampledUrls: sample.map((p) => p.finalUrl ?? p.url),
      mobile: summarizeStrategy(byStrategy.mobile),
      desktop: summarizeStrategy(byStrategy.desktop),
    },
  };
}

async function processAuditJob(job: Job<AuditJobData, AuditJobResult>): Promise<AuditJobResult> {
  const { auditId, simulateFailure } = job.data;

  console.log(`[worker] job ${job.id} starting audit ${auditId}`);

  const audit = await prisma.audit.update({
    where: { id: auditId },
    data: { status: "running", startedAt: new Date() },
    include: { site: true },
  });

  // Test-only failure injection: proves the failed-persistence path.
  if (simulateFailure) {
    throw new Error("simulated failure (test hook)");
  }

  const startUrl = `https://${audit.site.domain}`;
  let lastStatsWriteAt = 0;

  async function onProgress(progress: { discovered: number; crawled: number; total: number }): Promise<void> {
    const now = Date.now();
    if (now - lastStatsWriteAt < PROGRESS_WRITE_THROTTLE_MS) return;
    lastStatsWriteAt = now;
    await prisma.audit.update({
      where: { id: auditId },
      data: { stats: progress },
    });
  }

  async function crawlAndCheck(): Promise<{
    summary: Awaited<ReturnType<typeof runCrawl>>;
    issueCounts: { critical: number; warning: number; ok: number; total: number };
    perfSummary: PerfSampleSummary;
  }> {
    const summary = await runCrawl({ auditId, startUrl, urlLimit: audit.urlLimit, onProgress });

    const origin = new URL(startUrl).origin;
    const [pages, robotsTxt, sitemapUrls] = await Promise.all([
      prisma.page.findMany({ where: { auditId } }),
      fetchRobotsTxtBody(origin),
      discoverSitemapUrls(origin),
    ]);

    const { issues: issueDrafts, pageSchemaGraphs } = await runAllChecks({
      pages,
      origin,
      robotsTxt,
      sitemapUrls,
    });

    // Phase 5: PSI sample over a small representative subset of `pages`
    // (never the full crawl). Best-effort — a failure here must not lose
    // the checks we already computed above, so it's caught locally and
    // degrades to an empty perf summary rather than failing the audit.
    let perfIssues: PerfIssueDraft[] = [];
    let perfSummary: PerfSampleSummary;
    try {
      const perfResult = await runPerfSample(auditId, pages);
      perfIssues = perfResult.issues;
      perfSummary = perfResult.summary;
    } catch (error) {
      console.error(`[worker] perf sample failed for audit ${auditId}:`, error);
      perfSummary = {
        sampledPages: 0,
        sampledUrls: [],
        mobile: summarizeStrategy([]),
        desktop: summarizeStrategy([]),
        error: error instanceof Error ? error.message : "unknown perf sample error",
      };
    }

    // Normalize both draft shapes (IssueDraft from @auditor/checks, and the
    // narrower PerfIssueDraft from @auditor/psi, which has no source/scope)
    // into the same row shape before persisting, to keep `Issue.createMany`
    // typed against a single concrete input rather than a union.
    const issueRows = [
      ...issueDrafts.map((draft) => ({
        auditId,
        pageId: draft.pageId ?? null,
        checkId: draft.checkId,
        category: draft.category,
        title: draft.title,
        severity: draft.severity,
        fingerprint: draft.fingerprint,
        measuredValue: draft.measuredValue ?? null,
        source: draft.source ?? null,
        criterion: draft.criterion ?? null,
        scope: draft.scope ?? null,
        recommendation: draft.recommendation ?? null,
      })),
      ...perfIssues.map((draft) => ({
        auditId,
        pageId: draft.pageId ?? null,
        checkId: draft.checkId,
        category: draft.category,
        title: draft.title,
        severity: draft.severity,
        fingerprint: draft.fingerprint,
        measuredValue: draft.measuredValue ?? null,
        source: null as string | null,
        criterion: draft.criterion ?? null,
        scope: null as string | null,
        recommendation: draft.recommendation ?? null,
      })),
    ];

    // Idempotent re-run: wipe previously-generated Issues for this audit
    // before persisting the fresh batch.
    await prisma.issue.deleteMany({ where: { auditId } });

    if (issueRows.length > 0) {
      await prisma.issue.createMany({ data: issueRows });
    }

    // Persist each page's entity graph (SD-05) for the graph-visualization
    // route in apps/web. Only pages with JSON-LD produce a graph.
    if (pageSchemaGraphs.size > 0) {
      await Promise.all(
        Array.from(pageSchemaGraphs.entries()).map(([pageId, graph]) =>
          prisma.page.update({
            where: { id: pageId },
            data: { schemaGraph: graph as unknown as Prisma.InputJsonValue },
          })
        )
      );
    }

    const issueCounts = { critical: 0, warning: 0, ok: 0, total: issueRows.length };
    for (const row of issueRows) {
      issueCounts[row.severity]++;
    }

    return { summary, issueCounts, perfSummary };
  }

  const { summary, issueCounts, perfSummary } = await withTimeout(
    crawlAndCheck(),
    JOB_TIMEOUT_MS,
    `audit ${auditId} crawl+checks+perf`
  );

  await prisma.audit.update({
    where: { id: auditId },
    data: {
      status: "done",
      finishedAt: new Date(),
      stats: {
        discovered: summary.discovered,
        crawled: summary.crawled,
        total: audit.urlLimit,
        failed: summary.failed,
        issues: issueCounts,
        perf: perfSummary,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  console.log(
    `[worker] job ${job.id} finished audit ${auditId} (discovered=${summary.discovered} crawled=${summary.crawled} failed=${summary.failed} issues=${issueCounts.total})`
  );

  return { auditId, status: "done" };
}

const connection = createRedisConnection();

// A real crawl + the CPU-heavy check pass (Cheerio re-parse + SimHash over
// hundreds of pages) can block the event loop long enough that BullMQ's
// mid-job lock renewal (every lockDuration/2) can't fire. If lockDuration is
// shorter than the worst-case job duration, the lock expires mid-run and the
// job is wrongly treated as stalled -> duplicate processing ("Lock mismatch").
// Keep lockDuration comfortably ABOVE JOB_TIMEOUT so a legitimately-running
// job never loses its lock; stalled detection then only fires for a truly
// dead worker.
const worker = new Worker<AuditJobData, AuditJobResult>(AUDIT_QUEUE, processAuditJob, {
  connection,
  concurrency: CONCURRENCY,
  lockDuration: JOB_TIMEOUT_MS + 60_000,
  stalledInterval: JOB_TIMEOUT_MS + 60_000,
  maxStalledCount: 1,
});

worker.on("active", (job) => {
  console.log(`[worker] job ${job.id} active`);
});

worker.on("completed", (job) => {
  console.log(`[worker] job ${job.id} completed`);
});

worker.on("failed", async (job, error) => {
  console.error(`[worker] job ${job?.id} failed: ${error.message}`);

  const auditId = job?.data.auditId;
  if (!auditId) return;

  try {
    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      select: { status: true },
    });

    // Don't overwrite a terminal state that was already set (e.g. a
    // concurrent run already marked it done).
    if (audit && audit.status !== "done" && audit.status !== "failed") {
      await prisma.audit.update({
        where: { id: auditId },
        data: {
          status: "failed",
          error: error.message,
          finishedAt: new Date(),
        },
      });
    }
  } catch (persistError) {
    console.error(
      `[worker] failed to persist failure state for audit ${auditId}:`,
      persistError
    );
  }
});

worker.on("stalled", (jobId) => {
  console.warn(`[worker] job ${jobId} stalled`);
});

worker.on("error", (error) => {
  console.error("[worker] worker error:", error);
});

console.log(`[worker] listening on queue "${AUDIT_QUEUE}" (concurrency=${CONCURRENCY})`);

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] received ${signal}, shutting down gracefully...`);
  try {
    await worker.close();
    await prisma.$disconnect();
    console.log("[worker] shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error("[worker] error during shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
