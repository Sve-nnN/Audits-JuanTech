import { NextResponse } from "next/server";
import { prisma } from "@auditor/db";
import { getAuditQueue } from "@auditor/queue";
import { normalizeEmail } from "@auditor/email";
import { canRunAudit, PrismaAuditCountStore, FREE_URL_LIMIT } from "@auditor/quota";

// Self-hosted deploy (Dokploy/Nixpacks-or-custom-Dockerfile) builds may run
// isolated from the DB/Redis network -- force dynamic (request-time)
// rendering defensively so `next build` never attempts to touch Prisma/Redis
// during static generation.
export const dynamic = 'force-dynamic'

// Force the Node.js runtime: this route touches Postgres (Prisma) and
// Redis (BullMQ), neither of which run on the Edge runtime.
export const runtime = "nodejs";

const DEFAULT_URL_LIMIT = FREE_URL_LIMIT;
const MAX_URL_LIMIT = FREE_URL_LIMIT;

interface CreateAuditBody {
  /** Full URL (e.g. "https://example.com/") or bare domain (e.g. "example.com"). */
  url?: unknown;
  /** @deprecated kept for backwards compat with the Phase 1 wiring test. */
  domain?: unknown;
  /** Verified email launching this audit (Phase 7, AUTH-04 launch gate). */
  email?: unknown;
  /** Optional override for testing/verification; capped at 500. */
  urlLimit?: unknown;
}

/**
 * Derives a normalized bare domain from either a full URL or a bare domain
 * string. Accepts input with or without a protocol/trailing slash/path.
 */
function normalizeDomain(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let hostname: string;
  try {
    hostname = new URL(withProtocol).hostname;
  } catch {
    return null;
  }

  const domain = hostname.toLowerCase();
  return domain.length > 0 ? domain : null;
}

export async function POST(request: Request): Promise<Response> {
  let body: CreateAuditBody;
  try {
    body = (await request.json()) as CreateAuditBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawInput = body.url ?? body.domain;
  if (typeof rawInput !== "string" || rawInput.trim().length === 0) {
    return NextResponse.json({ error: "`url` is required" }, { status: 400 });
  }

  const domain = normalizeDomain(rawInput);
  if (!domain) {
    return NextResponse.json({ error: "`url` is invalid" }, { status: 400 });
  }

  if (typeof body.email !== "string" || body.email.trim().length === 0) {
    return NextResponse.json({ error: "El email es requerido" }, { status: 400 });
  }

  const normalized = normalizeEmail(body.email);
  if (!normalized.valid) {
    return NextResponse.json({ error: "El email no tiene un formato válido" }, { status: 400 });
  }

  // Launch gate (AUTH-04): only a verified email may enqueue an audit.
  const email = await prisma.email.findUnique({
    where: { normalizedAddress: normalized.normalizedAddress },
  });

  if (!email || !email.verified) {
    return NextResponse.json(
      {
        error: "Tenés que verificar tu email antes de lanzar la auditoría.",
        needsVerification: true,
      },
      { status: 403 }
    );
  }

  // Quota gate (QUOTA-01/03): 1 free audit per rolling 7-day window.
  // Local-dev escape hatch: set DISABLE_QUOTA=1 to skip the weekly limit so
  // you can test against many sites with one email. Double-guarded — it is
  // ignored in production (NODE_ENV === "production") even if the env is set.
  const quotaDisabled =
    process.env.DISABLE_QUOTA === "1" && process.env.NODE_ENV !== "production";

  if (!quotaDisabled) {
    const quota = await canRunAudit(email.id, new PrismaAuditCountStore());
    if (!quota.allowed) {
      return NextResponse.json(
        { error: quota.reason, nextAllowedAt: quota.nextAllowedAt },
        { status: 429 }
      );
    }
  }

  let urlLimit = DEFAULT_URL_LIMIT;
  if (body.urlLimit !== undefined) {
    const parsed = Number(body.urlLimit);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return NextResponse.json({ error: "`urlLimit` must be a positive number" }, { status: 400 });
    }
    urlLimit = Math.min(Math.floor(parsed), MAX_URL_LIMIT);
  }

  const site = await prisma.site.upsert({
    where: { domain },
    create: { domain },
    update: {},
  });

  const audit = await prisma.audit.create({
    data: {
      siteId: site.id,
      emailId: email.id,
      status: "queued",
      urlLimit,
    },
  });

  const queue = getAuditQueue();
  await queue.add("audit", { auditId: audit.id });

  return NextResponse.json({ auditId: audit.id }, { status: 201 });
}
