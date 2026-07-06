import { prisma } from "@auditor/db";
import type { AuditCountStore, RecentAuditsSummary } from "./canRunAudit";

/** `AuditCountStore` implementation backed by the real Postgres/Prisma schema. */
export class PrismaAuditCountStore implements AuditCountStore {
  async countRecentAudits(emailId: string, since: Date): Promise<RecentAuditsSummary> {
    const [count, oldest] = await Promise.all([
      prisma.audit.count({ where: { emailId, createdAt: { gte: since } } }),
      prisma.audit.findFirst({
        where: { emailId, createdAt: { gte: since } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

    return { count, oldestCreatedAt: oldest?.createdAt ?? null };
  }
}
