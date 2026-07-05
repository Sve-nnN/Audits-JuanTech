import { NextResponse } from "next/server";
import { prisma } from "@auditor/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  const audit = await prisma.audit.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      error: true,
      urlLimit: true,
      stats: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      _count: { select: { pages: true } },
    },
  });

  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  const { _count, ...rest } = audit;

  return NextResponse.json({ ...rest, pageCount: _count.pages }, { status: 200 });
}
