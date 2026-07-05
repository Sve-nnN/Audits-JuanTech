import { NextResponse } from "next/server";
import { prisma } from "@auditor/db";
import { getAuditQueue } from "@auditor/queue";

// Force the Node.js runtime: this route touches Postgres (Prisma) and
// Redis (BullMQ), neither of which run on the Edge runtime.
export const runtime = "nodejs";

interface CreateAuditBody {
  domain?: unknown;
}

function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

export async function POST(request: Request): Promise<Response> {
  let body: CreateAuditBody;
  try {
    body = (await request.json()) as CreateAuditBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.domain !== "string" || body.domain.trim().length === 0) {
    return NextResponse.json({ error: "`domain` is required" }, { status: 400 });
  }

  const domain = normalizeDomain(body.domain);
  if (domain.length === 0) {
    return NextResponse.json({ error: "`domain` is invalid" }, { status: 400 });
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
    },
  });

  const queue = getAuditQueue();
  await queue.add("audit", { auditId: audit.id });

  return NextResponse.json({ auditId: audit.id }, { status: 201 });
}
