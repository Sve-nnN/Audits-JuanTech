import { NextResponse } from "next/server";
import { prisma } from "@auditor/db";
import { normalizeEmail, createVerification, PrismaVerificationStore } from "@auditor/email";

// Self-hosted deploy (Dokploy/Nixpacks-or-custom-Dockerfile) builds may run
// isolated from the DB/Redis network -- force dynamic (request-time)
// rendering defensively so `next build` never attempts to touch Prisma/Redis
// during static generation.
export const dynamic = 'force-dynamic'

// Touches Postgres (Prisma) and, in production, the Resend API — neither
// runs on the Edge runtime.
export const runtime = "nodejs";

interface RequestVerificationBody {
  email?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  let body: RequestVerificationBody;
  try {
    body = (await request.json()) as RequestVerificationBody;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  if (typeof body.email !== "string" || body.email.trim().length === 0) {
    return NextResponse.json({ error: "El email es requerido" }, { status: 400 });
  }

  const normalized = normalizeEmail(body.email);
  if (!normalized.valid) {
    return NextResponse.json({ error: "El email no tiene un formato válido" }, { status: 400 });
  }
  if (normalized.isDisposable) {
    return NextResponse.json(
      { error: "No aceptamos direcciones de email temporales/desechables. Usá tu email habitual." },
      { status: 400 }
    );
  }

  const email = await prisma.email.upsert({
    where: { normalizedAddress: normalized.normalizedAddress },
    create: { address: normalized.address, normalizedAddress: normalized.normalizedAddress },
    update: {},
  });

  if (email.verified) {
    return NextResponse.json({ verified: true }, { status: 200 });
  }

  const store = new PrismaVerificationStore();
  const { url } = await createVerification(email.id, email.address, store);

  // In dev-mode (no RESEND_API_KEY), also surface the link in the response
  // so the flow can be exercised end-to-end without a real inbox. In
  // production this field is omitted — the real email is the only channel.
  const devVerifyUrl = process.env.RESEND_API_KEY ? undefined : url;

  return NextResponse.json({ sent: true, devVerifyUrl }, { status: 200 });
}
