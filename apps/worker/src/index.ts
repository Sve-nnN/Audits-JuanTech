import { Worker, type Job } from "bullmq";
import { prisma } from "@auditor/db";
import { runCrawl, discoverSitemapUrls, DEFAULT_USER_AGENT } from "@auditor/crawler";
import { runAllChecks } from "@auditor/checks";
import {
  AUDIT_QUEUE,
  createRedisConnection,
  type AuditJobData,
  type AuditJobResult,
} from "@auditor/queue";

// Phase 2: the worker now runs a real bounded crawl (Crawlee CheerioCrawler,
// see @auditor/crawler) for each audit job — discover URLs (sitemap or
// link-crawl fallback), fetch+parse, persist Page rows, report progress via
// Audit.stats. Web (apps/web) stays crawl-logic-free: it only enqueues and
// reads DB. Chrome/Playwright/Lighthouse are not used yet (later phases).

// Phase 3: after the crawl completes, the worker runs the full SEO técnico +
// on-page check battery (@auditor/checks) over the crawled Pages and
// persists the resulting Issues (idempotent: existing Issues for the audit
// are deleted first, so re-running an audit doesn't accumulate duplicates).

const ROBOTS_FETCH_TIMEOUT_MS = 10_000;

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

// Real crawls (up to 500 URLs) can legitimately take several minutes; this
// must stay comfortably above the worst-case crawl duration, while BullMQ's
// stalled-job detection (below) still catches a genuinely dead worker.
const JOB_TIMEOUT_MS = 10 * 60_000;
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
  }> {
    const summary = await runCrawl({ auditId, startUrl, urlLimit: audit.urlLimit, onProgress });

    const origin = new URL(startUrl).origin;
    const [pages, robotsTxt, sitemapUrls] = await Promise.all([
      prisma.page.findMany({ where: { auditId } }),
      fetchRobotsTxtBody(origin),
      discoverSitemapUrls(origin),
    ]);

    const issueDrafts = await runAllChecks({ pages, origin, robotsTxt, sitemapUrls });

    // Idempotent re-run: wipe previously-generated Issues for this audit
    // before persisting the fresh batch.
    await prisma.issue.deleteMany({ where: { auditId } });

    if (issueDrafts.length > 0) {
      await prisma.issue.createMany({
        data: issueDrafts.map((draft) => ({
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
      });
    }

    const issueCounts = { critical: 0, warning: 0, ok: 0, total: issueDrafts.length };
    for (const draft of issueDrafts) {
      issueCounts[draft.severity]++;
    }

    return { summary, issueCounts };
  }

  const { summary, issueCounts } = await withTimeout(
    crawlAndCheck(),
    JOB_TIMEOUT_MS,
    `audit ${auditId} crawl+checks`
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
      },
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
