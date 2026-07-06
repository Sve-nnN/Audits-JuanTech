export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Abstraction over "send a transactional email" so the app can swap providers by env. */
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * Sends via the Resend API. Requires `RESEND_API_KEY`; a verified sending
 * domain (or Resend's shared test domain) is required for real delivery.
 */
export class ResendProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string = process.env.EMAIL_FROM ?? "Auditor <onboarding@resend.dev>"
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend API error (${res.status}): ${body}`);
    }
  }
}

/**
 * Offline fallback used when no `RESEND_API_KEY` is configured (local dev,
 * tests, or before a real domain is set up). Logs the message — including
 * the verification link — to the console so the flow can be exercised
 * end-to-end without sending real email.
 */
export class DevProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(
      [
        "",
        "=== [DEV EMAIL - no RESEND_API_KEY set] ===",
        `Para: ${message.to}`,
        `Asunto: ${message.subject}`,
        message.text,
        "============================================",
        "",
      ].join("\n")
    );
  }
}

/** Picks Resend if `RESEND_API_KEY` is set, otherwise the console-logging dev provider. */
export function getEmailProvider(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) return new ResendProvider(apiKey);
  return new DevProvider();
}
