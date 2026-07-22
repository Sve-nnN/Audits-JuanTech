/**
 * Verification script for FPRINT-09 (Phase 26, plan 26-02).
 *
 * Re-runs `detectStack` over the Pages of an ALREADY-CRAWLED audit and prints
 * the resulting `DetectedStack`, WITHOUT launching a new crawl. Its purpose is
 * to validate Assumption A4: that the `url/finalUrl === startUrl` equality used
 * to derive `isHome` actually matches against the crawler's normalized URLs, so
 * the CMS axis resolves instead of falling back to the first page (Pitfall 6).
 *
 * It replicates EXACTLY the same filter (`html` non-null/non-empty) and
 * `isHome` derivation the worker uses in `crawlAndCheck()` — if this script and
 * the worker ever diverge, this verification is meaningless.
 *
 * Requires DATABASE_URL and live network to Neon (it reads real Pages via
 * Prisma). NOT executed automatically in an offline environment: with no
 * network it fails loudly with `P1001` and prints the exact manual command —
 * it NEVER fabricates a DetectedStack.
 *
 * Usage:
 *   pnpm --filter @auditor/worker exec tsx scripts/verify-stack.mts [auditId]
 *
 * With no auditId it picks the most recent `status = "done"` audit.
 */

import { prisma } from "@auditor/db";
import { normalizeUrl } from "@auditor/crawler";
import {
  detectStack,
  type PageFingerprintInput,
} from "@auditor/fingerprint";

const MANUAL_HINT =
  "Corré este script manualmente con red a Neon:\n" +
  "  pnpm --filter @auditor/worker exec tsx scripts/verify-stack.mts <auditId>";

async function main(): Promise<void> {
  const argAuditId = process.argv[2];

  // Resolve the target audit: explicit argv id, or the most recent completed
  // one. Both paths hit Neon — a P1001 here means no network (see main().catch).
  const audit = argAuditId
    ? await prisma.audit.findUniqueOrThrow({
        where: { id: argAuditId },
        select: { id: true, resolvedUrl: true, status: true, site: { select: { domain: true } } },
      })
    : await prisma.audit.findFirst({
        where: { status: "done" },
        orderBy: { finishedAt: "desc" },
        select: { id: true, resolvedUrl: true, status: true, site: { select: { domain: true } } },
      });

  if (!audit) {
    console.error("[verify-stack] no hay ningún audit `done` en la base. Corré una auditoría primero.");
    await prisma.$disconnect();
    process.exit(1);
  }

  // `startUrl` MUST be the same value the worker used (the persisted resolved
  // URL). Without resolvedUrl there is no reliable home marker offline, so we
  // stop rather than guess and silently degrade isHome.
  const startUrl = audit.resolvedUrl;
  if (!startUrl) {
    console.error(
      `[verify-stack] audit ${audit.id} no tiene resolvedUrl persistido — no se puede derivar isHome de forma fiel al worker.`
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  const pages = await prisma.page.findMany({
    where: { auditId: audit.id },
    orderBy: { createdAt: "asc" },
  });

  console.log(
    `[verify-stack] audit=${audit.id} domain=${audit.site.domain} startUrl=${startUrl} pages=${pages.length}`
  );

  // Replicate the worker's mapping VERBATIM (apps/worker/src/index.ts
  // crawlAndCheck): filter pages with html, derive isHome from startUrl through
  // normalizeUrl (WR-01) — raw equality would miss the home on a normalized
  // variant and this verification would silently pass on the fallback page.
  const normalizedStart = normalizeUrl(startUrl);
  const fpInput: PageFingerprintInput[] = pages
    .filter((p) => p.html != null && p.html !== "")
    .map((p) => ({
      url: p.url,
      isHome:
        normalizedStart != null &&
        (normalizeUrl(p.url) === normalizedStart ||
          normalizeUrl(p.finalUrl ?? p.url) === normalizedStart),
      html: p.html,
      responseHeaders: (p.responseHeaders ?? {}) as Record<string, string>,
      cookieNames: p.cookieNames ?? [],
    }));

  const homeCount = fpInput.filter((p) => p.isHome).length;
  console.log(
    `[verify-stack] fpInput=${fpInput.length} páginas con html; isHome marcadas=${homeCount}`
  );
  if (homeCount === 0) {
    console.warn(
      "[verify-stack] ADVERTENCIA: ninguna página quedó marcada isHome — detectStack caerá al fallback (primera página) y la precisión del CMS baja (Pitfall 6). Revisá la normalización de URL del crawler vs resolvedUrl."
    );
  }

  const stack = detectStack({ pages: fpInput });

  console.log("[verify-stack] DetectedStack:");
  console.dir(stack, { depth: null });

  await prisma.$disconnect();
}

main().catch(async (error) => {
  const err = error as { code?: string; name?: string; message?: string };
  // Neon "can't reach database server" surfaces either as the P1001 code or,
  // at client-init time, as a PrismaClientInitializationError whose code is
  // undefined — match both so the offline case reports cleanly instead of
  // dumping a raw stack.
  const isUnreachable =
    err?.code === "P1001" ||
    err?.name === "PrismaClientInitializationError" ||
    /can't reach database server/i.test(err?.message ?? "");
  if (isUnreachable) {
    console.error(
      "[verify-stack] P1001: no se pudo alcanzar la base de datos (Neon). Este entorno no tiene red saliente.\n" +
        MANUAL_HINT
    );
  } else {
    console.error("[verify-stack] error inesperado:", error);
    console.error(MANUAL_HINT);
  }
  try {
    await prisma.$disconnect();
  } catch {
    // ignore disconnect errors on a connection that never opened
  }
  process.exit(1);
});
