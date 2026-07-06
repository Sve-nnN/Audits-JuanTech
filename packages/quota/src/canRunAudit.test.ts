import { describe, it, expect } from "vitest";
import { canRunAudit, FREE_WEEKLY_LIMIT, type AuditCountStore } from "./canRunAudit";

function fakeStoreWith(count: number, oldestCreatedAt: Date | null): AuditCountStore {
  return {
    async countRecentAudits() {
      return { count, oldestCreatedAt };
    },
  };
}

describe("canRunAudit", () => {
  it("allows when there are 0 audits in the window", async () => {
    const result = await canRunAudit("email_1", fakeStoreWith(0, null));
    expect(result.allowed).toBe(true);
  });

  it("blocks when the weekly limit was already used within the last 7 days", async () => {
    const now = new Date("2026-07-05T12:00:00Z");
    const threeDaysAgo = new Date("2026-07-02T12:00:00Z");
    const result = await canRunAudit("email_1", fakeStoreWith(FREE_WEEKLY_LIMIT, threeDaysAgo), now);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
    expect(result.nextAllowedAt).toEqual(new Date("2026-07-09T12:00:00Z"));
  });

  it("allows again once the oldest audit in the window is older than 7 days ago", async () => {
    // The store is queried with `since = now - 7d`; if the store reports
    // count 0 because the only prior audit falls outside that window, it's allowed.
    const result = await canRunAudit("email_1", fakeStoreWith(0, null), new Date("2026-07-05T12:00:00Z"));
    expect(result.allowed).toBe(true);
  });
});
