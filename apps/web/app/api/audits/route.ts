import { NextResponse } from "next/server";
import { prisma } from "@auditor/db";
import { getAuditQueue } from "@auditor/queue";

// Force the Node.js runtime: this route touches Postgres (Prisma) and
// Redis (BullMQ), neither of which run on the Edge runtime.
export const runtime = "nodejs";

const DEFAULT_URL_LIMIT = 500;
const MAX_URL_LIMIT = 500;

interface CreateAuditBody {
  /** Full URL (e.g. "https://example.com/") or bare domain (e.g. "example.com"). */
  url?: unknown;
  /** @deprecated kept for backwards compat with the Phase 1 wiring test. */
  domain?: unknown;
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
      status: "queued",
      urlLimit,
    },
  });

  const queue = getAuditQueue();
  await queue.add("audit", { auditId: audit.id });

  return NextResponse.json({ auditId: audit.id }, { status: 201 });
}
