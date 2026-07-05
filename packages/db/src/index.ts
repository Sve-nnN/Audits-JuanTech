import { PrismaClient } from "@prisma/client";

// Cache the PrismaClient instance on `globalThis` in dev to avoid exhausting
// Postgres connections across hot-reloads (Next.js dev server, tsx watch).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;

// Re-export generated types/enums for consumers.
export * from "@prisma/client";
