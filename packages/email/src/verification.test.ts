import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createVerification,
  verifyToken,
  type VerificationStore,
  type VerificationTokenRecord,
} from "./verification";
import type { EmailProvider } from "./provider";

/** In-memory fake store + provider so this suite runs fully offline. */
function makeFakeStore() {
  const tokens = new Map<string, VerificationTokenRecord & { token: string }>();
  const verifiedEmails = new Map<
    string,
    { ip: string | null; consentText: string; verifiedAt: Date }
  >();
  let idCounter = 0;

  const store: VerificationStore = {
    async createToken({ emailId, token, expiresAt }) {
      idCounter += 1;
      tokens.set(token, { id: `tok_${idCounter}`, emailId, expiresAt, usedAt: null, token });
    },
    async findByToken(token) {
      const record = tokens.get(token);
      return record ? { ...record } : null;
    },
    async markTokenUsed(id) {
      for (const record of tokens.values()) {
        if (record.id === id) record.usedAt = new Date();
      }
    },
    async markEmailVerified(emailId, data) {
      verifiedEmails.set(emailId, data);
    },
  };

  return { store, tokens, verifiedEmails };
}

function makeFakeProvider() {
  const sent: Array<{ to: string; subject: string; html: string; text: string }> = [];
  const provider: EmailProvider = {
    async send(message) {
      sent.push(message);
    },
  };
  return { provider, sent };
}

describe("createVerification + verifyToken lifecycle", () => {
  let ctx: ReturnType<typeof makeFakeStore>;
  let providerCtx: ReturnType<typeof makeFakeProvider>;

  beforeEach(() => {
    ctx = makeFakeStore();
    providerCtx = makeFakeProvider();
  });

  it("creates a token, sends the link, and verifies successfully", async () => {
    const { token, url } = await createVerification(
      "email_1",
      "user@example.com",
      ctx.store,
      providerCtx.provider
    );

    expect(token).toHaveLength(64); // 32 bytes hex-encoded
    expect(url).toContain(token);
    expect(providerCtx.sent).toHaveLength(1);
    expect(providerCtx.sent[0]!.to).toBe("user@example.com");
    expect(providerCtx.sent[0]!.text).toContain(token);

    const result = await verifyToken(
      token,
      { ip: "203.0.113.1", consentText: "Acepto..." },
      ctx.store
    );

    expect(result).toEqual({ ok: true, emailId: "email_1" });
    expect(ctx.verifiedEmails.get("email_1")).toMatchObject({
      ip: "203.0.113.1",
      consentText: "Acepto...",
    });
  });

  it("rejects an unknown token", async () => {
    const result = await verifyToken("not-a-real-token", { ip: null, consentText: "x" }, ctx.store);
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("rejects reuse of an already-used token", async () => {
    const { token } = await createVerification("email_2", "a@b.com", ctx.store, providerCtx.provider);
    const first = await verifyToken(token, { ip: null, consentText: "x" }, ctx.store);
    expect(first.ok).toBe(true);

    const second = await verifyToken(token, { ip: null, consentText: "x" }, ctx.store);
    expect(second).toEqual({ ok: false, reason: "used" });
  });

  it("rejects an expired token", async () => {
    vi.useFakeTimers();
    try {
      const { token } = await createVerification(
        "email_3",
        "a@b.com",
        ctx.store,
        providerCtx.provider
      );
      vi.advanceTimersByTime(25 * 60 * 60 * 1000); // 25h > 24h TTL

      const result = await verifyToken(token, { ip: null, consentText: "x" }, ctx.store);
      expect(result).toEqual({ ok: false, reason: "expired" });
    } finally {
      vi.useRealTimers();
    }
  });
});
