import { randomBytes } from "node:crypto";
import { getEmailProvider, type EmailProvider } from "./provider";

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Consent copy shown to the user at the moment they confirm their email.
 * Persisted verbatim as evidence of consent (AUTH-05 / GDPR-style record).
 */
export const CONSENT_TEXT =
  "Acepto recibir el reporte de esta auditoría por email y confirmo que soy el titular de esta casilla de correo.";

export interface VerificationTokenRecord {
  id: string;
  emailId: string;
  expiresAt: Date;
  usedAt: Date | null;
}

/**
 * Storage abstraction so token creation/verification logic can be unit
 * tested offline, without a real database.
 */
export interface VerificationStore {
  createToken(params: { emailId: string; token: string; expiresAt: Date }): Promise<void>;
  findByToken(token: string): Promise<VerificationTokenRecord | null>;
  markTokenUsed(id: string): Promise<void>;
  markEmailVerified(
    emailId: string,
    data: { ip: string | null; consentText: string; verifiedAt: Date }
  ): Promise<void>;
}

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

export function buildVerificationUrl(
  token: string,
  appUrl: string = process.env.APP_URL ?? "http://localhost:3000"
): string {
  return `${appUrl.replace(/\/+$/, "")}/verify?token=${encodeURIComponent(token)}`;
}

/**
 * Creates a fresh verification token for `emailId`, persists it, and sends
 * the verification link to `to` via the configured provider (Resend in
 * production, console log in dev-mode). Returns the token/url mainly for
 * dev-mode convenience (surfacing the link in the UI without a real inbox).
 */
export async function createVerification(
  emailId: string,
  to: string,
  store: VerificationStore,
  provider: EmailProvider = getEmailProvider()
): Promise<{ token: string; url: string }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await store.createToken({ emailId, token, expiresAt });

  const url = buildVerificationUrl(token);

  await provider.send({
    to,
    subject: "Confirmá tu email para lanzar tu auditoría SEO",
    html: `<p>Hacé clic en el siguiente enlace para confirmar tu email y poder lanzar tu auditoría gratuita:</p><p><a href="${url}">${url}</a></p><p>Este enlace vence en 24 horas. Si no solicitaste esta auditoría, podés ignorar este mensaje.</p>`,
    text: `Confirmá tu email para lanzar tu auditoría (el enlace vence en 24hs):\n${url}\n\nSi no solicitaste esta auditoría, podés ignorar este mensaje.`,
  });

  return { token, url };
}

export interface VerifyResult {
  ok: boolean;
  emailId?: string;
  reason?: "not_found" | "used" | "expired";
}

/**
 * Verifies a token: must exist, be unused, and unexpired. On success marks
 * the token used and the Email verified, recording the consent evidence
 * (IP + exact consent text shown + timestamp).
 */
export async function verifyToken(
  token: string,
  ctx: { ip: string | null; consentText: string },
  store: VerificationStore
): Promise<VerifyResult> {
  const record = await store.findByToken(token);
  if (!record) return { ok: false, reason: "not_found" };
  if (record.usedAt) return { ok: false, reason: "used" };
  if (record.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  await store.markTokenUsed(record.id);
  await store.markEmailVerified(record.emailId, {
    ip: ctx.ip,
    consentText: ctx.consentText,
    verifiedAt: new Date(),
  });

  return { ok: true, emailId: record.emailId };
}
