/**
 * End-to-end wiring verification script for Phase 1.
 *
 * Documents (and automates) the manual check described in
 * `.planning/phases/01-fundamentos-monorepo-esquema-de-datos-y-cola/01-PLAN.md`
 * task 6. Requires DATABASE_URL (Postgres) and REDIS_URL (Upstash) to be set,
 * and the worker (`pnpm --filter @auditor/worker dev`) to be running
 * separately. NOT executed automatically by this plan — run manually once
 * real connection strings are available.
 *
 * Usage:
 *   pnpm --filter @auditor/worker exec tsx scripts/verify-wiring.ts
 *
 * What it does:
 *   1. Creates a throwaway Site + Audit(status=queued) directly via Prisma.
 *   2. Enqueues an audit job for it via @auditor/queue.
 *   3. Polls the Audit row every second, printing status transitions.
 *   4. Expects to observe: queued -> running -> done within ~JOB_TIMEOUT_MS.
 *   5. Exits 0 on "done", exits 1 on "failed" or on timeout waiting.
 */

import { prisma } from "@auditor/db";
import { getAuditQueue } from "@auditor/queue";

const POLL_INTERVAL_MS = 1_000;
const MAX_WAIT_MS = 30_000;

async function main(): Promise<void> {
  console.log("[verify-wiring] creating test site + audit...");

  const site = await prisma.site.upsert({
    where: { domain: "verify-wiring.local" },
    create: { domain: "verify-wiring.local" },
    update: {},
  });

  const audit = await prisma.audit.create({
    data: { siteId: site.id, status: "queued" },
  });

  console.log(`[verify-wiring] created audit ${audit.id}, enqueueing job...`);

  const queue = getAuditQueue();
  await queue.add("audit", { auditId: audit.id });

  const startedAt = Date.now();
  let lastStatus: string | null = null;

  while (Date.now() - startedAt < MAX_WAIT_MS) {
    const current = await prisma.audit.findUniqueOrThrow({
      where: { id: audit.id },
      select: { status: true, error: true },
    });

    if (current.status !== lastStatus) {
      console.log(`[verify-wiring] status: ${current.status}`);
      lastStatus = current.status;
    }

    if (current.status === "done") {
      console.log("[verify-wiring] SUCCESS: audit reached `done`.");
      await prisma.$disconnect();
      process.exit(0);
    }

    if (current.status === "failed") {
      console.error(`[verify-wiring] FAILED: audit marked failed (${current.error}).`);
      await prisma.$disconnect();
      process.exit(1);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  console.error("[verify-wiring] TIMEOUT: audit never reached a terminal state.");
  await prisma.$disconnect();
  process.exit(1);
}

main().catch((error) => {
  console.error("[verify-wiring] unexpected error:", error);
  process.exit(1);
});
