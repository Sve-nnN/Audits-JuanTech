/** Free-tier limits (v1, no billing — see PRD deferred: PAY in v2). */
export const FREE_WEEKLY_LIMIT = 1;
export const FREE_URL_LIMIT = 500;

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // rolling 7-day window

export interface RecentAuditsSummary {
  count: number;
  /** createdAt of the oldest audit within the window, used to compute when the quota resets. */
  oldestCreatedAt: Date | null;
}

/** Storage abstraction so quota logic can be unit tested offline. */
export interface AuditCountStore {
  countRecentAudits(emailId: string, since: Date): Promise<RecentAuditsSummary>;
}

export interface QuotaResult {
  allowed: boolean;
  reason?: string;
  nextAllowedAt?: Date;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/**
 * Checks whether `emailId` may launch another audit right now: at most
 * `FREE_WEEKLY_LIMIT` audits per rolling 7-day window (QUOTA-01/03).
 */
export async function canRunAudit(
  emailId: string,
  store: AuditCountStore,
  now: Date = new Date()
): Promise<QuotaResult> {
  const since = new Date(now.getTime() - WINDOW_MS);
  const { count, oldestCreatedAt } = await store.countRecentAudits(emailId, since);

  if (count < FREE_WEEKLY_LIMIT) {
    return { allowed: true };
  }

  const nextAllowedAt = oldestCreatedAt ? new Date(oldestCreatedAt.getTime() + WINDOW_MS) : undefined;

  return {
    allowed: false,
    reason: nextAllowedAt
      ? `Ya usaste tu auditoría gratuita de esta semana. Podés lanzar otra a partir del ${formatDate(nextAllowedAt)}.`
      : "Ya usaste tu auditoría gratuita de esta semana.",
    nextAllowedAt,
  };
}
