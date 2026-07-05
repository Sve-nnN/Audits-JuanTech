import { Worker, type Job } from "bullmq";
import { prisma } from "@auditor/db";
import {
  AUDIT_QUEUE,
  createRedisConnection,
  type AuditJobData,
  type AuditJobResult,
} from "@auditor/queue";

// Phase 1: no real crawl logic yet. This worker exists purely to prove the
// end-to-end wiring — web enqueues, worker picks up, DB transitions
// queued -> running -> done (or -> failed on error/timeout). Real crawl
// logic (Crawlee/Playwright/Lighthouse) lands in later phases, and only
// ever runs here, never in apps/web.

const JOB_TIMEOUT_MS = 15_000;
const NOOP_WORK_DELAY_MS = 1_000;
const CONCURRENCY = 2;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  const { auditId } = job.data;

  console.log(`[worker] job ${job.id} starting audit ${auditId}`);

  await prisma.audit.update({
    where: { id: auditId },
    data: { status: "running", startedAt: new Date() },
  });

  // Simulated no-op work. Real crawl orchestration replaces this in a later
  // phase; kept behind a timeout guard so hangs are caught deterministically.
  await withTimeout(delay(NOOP_WORK_DELAY_MS), JOB_TIMEOUT_MS, `audit ${auditId} no-op work`);

  await prisma.audit.update({
    where: { id: auditId },
    data: { status: "done", finishedAt: new Date() },
  });

  console.log(`[worker] job ${job.id} finished audit ${auditId}`);

  return { auditId, status: "done" };
}

const connection = createRedisConnection();

const worker = new Worker<AuditJobData, AuditJobResult>(AUDIT_QUEUE, processAuditJob, {
  connection,
  concurrency: CONCURRENCY,
  lockDuration: 30_000,
  stalledInterval: 30_000,
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
