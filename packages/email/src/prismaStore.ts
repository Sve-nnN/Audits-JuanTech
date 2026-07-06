import { prisma } from "@auditor/db";
import type { VerificationStore, VerificationTokenRecord } from "./verification";

/** `VerificationStore` implementation backed by the real Postgres/Prisma schema. */
export class PrismaVerificationStore implements VerificationStore {
  async createToken(params: { emailId: string; token: string; expiresAt: Date }): Promise<void> {
    await prisma.emailVerification.create({
      data: {
        emailId: params.emailId,
        token: params.token,
        expiresAt: params.expiresAt,
      },
    });
  }

  async findByToken(token: string): Promise<VerificationTokenRecord | null> {
    const record = await prisma.emailVerification.findUnique({ where: { token } });
    if (!record) return null;
    return {
      id: record.id,
      emailId: record.emailId,
      expiresAt: record.expiresAt,
      usedAt: record.usedAt,
    };
  }

  async markTokenUsed(id: string): Promise<void> {
    await prisma.emailVerification.update({ where: { id }, data: { usedAt: new Date() } });
  }

  async markEmailVerified(
    emailId: string,
    data: { ip: string | null; consentText: string; verifiedAt: Date }
  ): Promise<void> {
    await prisma.email.update({
      where: { id: emailId },
      data: {
        verified: true,
        verifiedAt: data.verifiedAt,
        consentIp: data.ip,
        consentTextShown: data.consentText,
        consentAt: data.verifiedAt,
      },
    });
  }
}
