import { prisma } from "@auditor/db";
import { getAuditQueue } from "@auditor/queue";

async function main() {
  const site = await prisma.site.upsert({
    where: { domain: "verify-failed.local" },
    create: { domain: "verify-failed.local" },
    update: {},
  });
  const audit = await prisma.audit.create({ data: { siteId: site.id, status: "queued" } });
  console.log(`[verify-failed] audit ${audit.id}, enqueue with simulateFailure`);
  const queue = getAuditQueue();
  await queue.add("audit", { auditId: audit.id, simulateFailure: true }, { attempts: 1 });

  const start = Date.now();
  let last: string | null = null;
  while (Date.now() - start < 30000) {
    const cur = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id }, select: { status: true, error: true } });
    if (cur.status !== last) { console.log(`[verify-failed] status: ${cur.status}${cur.error ? " ("+cur.error+")" : ""}`); last = cur.status; }
    if (cur.status === "failed") { console.log("[verify-failed] SUCCESS: audit marked failed, not zombie."); await prisma.$disconnect(); process.exit(0); }
    if (cur.status === "done") { console.error("[verify-failed] UNEXPECTED done"); await prisma.$disconnect(); process.exit(1); }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.error("[verify-failed] TIMEOUT (zombie)"); await prisma.$disconnect(); process.exit(1);
}
main().catch(e => { console.error(e); process.exit(1); });
