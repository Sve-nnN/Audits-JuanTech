import { NextResponse } from "next/server";
import { prisma } from "@auditor/db";
import { verifyToken, PrismaVerificationStore } from "@auditor/email";

export const runtime = "nodejs";

interface VerifyBody {
  token?: unknown;
  consentText?: unknown;
}

const REASON_MESSAGE: Record<string, string> = {
  not_found: "El enlace de verificación no es válido.",
  used: "Este enlace ya fue utilizado. Si necesitás verificar de nuevo, pedí un nuevo enlace.",
  expired: "Este enlace venció. Pedí un nuevo enlace de verificación.",
};

/** Best-effort client IP extraction behind a proxy (Vercel/most PaaS set this). */
function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip");
}

export async function POST(request: Request): Promise<Response> {
  let body: VerifyBody;
  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  if (typeof body.token !== "string" || body.token.trim().length === 0) {
    return NextResponse.json({ error: "Falta el token de verificación" }, { status: 400 });
  }
  if (typeof body.consentText !== "string" || body.consentText.trim().length === 0) {
    return NextResponse.json({ error: "Falta el texto de consentimiento" }, { status: 400 });
  }

  const store = new PrismaVerificationStore();
  const result = await verifyToken(
    body.token,
    { ip: clientIp(request), consentText: body.consentText },
    store
  );

  if (!result.ok) {
    const message = REASON_MESSAGE[result.reason ?? ""] ?? "No se pudo verificar el email.";
    return NextResponse.json({ error: message, reason: result.reason }, { status: 400 });
  }

  const email = await prisma.email.findUnique({
    where: { id: result.emailId },
    select: { address: true },
  });

  return NextResponse.json({ ok: true, email: email?.address ?? null }, { status: 200 });
}
