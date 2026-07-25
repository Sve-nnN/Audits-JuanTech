/**
 * Verification script for CMSFIX-05 (Phase 27, plan 27-03).
 *
 * Reconstructs the `ReportModel` of an ALREADY-CRAWLED audit via
 * `buildReportModel` and prints, for the 10 supported checkIds
 * (`SUPPORTED_CHECK_IDS`), the `recommendation` each issue carries — so a human
 * can confirm the CMS-specific fix copy (e.g. "En WordPress…") is resolved at
 * read time instead of the generic. It also prints the detected `model.stack`
 * for context (which platform drove the personalization).
 *
 * It does NOT re-detect the stack nor re-crawl: the whole point is to prove that
 * the resolution happens purely inside `buildReportModel` from persisted data
 * (Audit.stack + Issue rows). Pick a known WordPress audit (e.g. aprendoclub)
 * to see the personalized copy; an audit with `Audit.stack` null (pre-v1.5) or a
 * low-confidence CMS falls back to the generic — both are correct outcomes.
 *
 * Requires DATABASE_URL and live network to Postgres (it reads a real audit via
 * Prisma). NOT executed automatically in an offline environment: with no network
 * it fails loudly with `P1001` and prints the exact manual command — it NEVER
 * fabricates a ReportModel.
 *
 * Usage:
 *   pnpm --filter @auditor/worker exec tsx scripts/verify-cms-fix.mts [auditId]
 *
 * With no auditId it picks the most recent `status = "done"` audit.
 */

import { prisma } from "@auditor/db";
import { buildReportModel } from "@auditor/report-model";
import { SUPPORTED_CHECK_IDS } from "@auditor/cms-adapters";

const MANUAL_HINT =
  "Corré este script manualmente con red a Postgres:\n" +
  "  pnpm --filter @auditor/worker exec tsx scripts/verify-cms-fix.mts <auditId>";

/** The 10 checkIds the CMS engine personalizes, as a Set for O(1) filtering. */
const SUPPORTED = new Set<string>(SUPPORTED_CHECK_IDS);

async function main(): Promise<void> {
  const argAuditId = process.argv[2];

  // Resolve the target audit: explicit argv id, or the most recent completed
  // one. Both paths hit Postgres — a P1001 here means no network (see main().catch).
  const audit = argAuditId
    ? await prisma.audit.findUniqueOrThrow({
        where: { id: argAuditId },
        select: { id: true, status: true, site: { select: { domain: true } } },
      })
    : await prisma.audit.findFirst({
        where: { status: "done" },
        orderBy: { finishedAt: "desc" },
        select: { id: true, status: true, site: { select: { domain: true } } },
      });

  if (!audit) {
    console.error(
      "[verify-cms-fix] no hay ningún audit `done` en la base. Corré una auditoría primero."
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  // Reconstruct the ReportModel exactly as the report UI / exports consume it —
  // no re-detection, no re-crawl. Returns null if the audit is not `done`.
  const model = await buildReportModel(audit.id);
  if (!model) {
    console.error(
      `[verify-cms-fix] buildReportModel devolvió null para audit ${audit.id} (¿status != done?). No hay ReportModel que inspeccionar.`
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(
    `[verify-cms-fix] audit=${audit.id} domain=${audit.site.domain} stack=`
  );
  console.dir(model.stack ?? null, { depth: null });

  // Collect every issue that targets one of the 10 supported checkIds, from BOTH
  // the priority set and the per-category detail (single source: the same
  // resolved recommendation appears in both). Dedupe by issue id.
  const seen = new Set<string>();
  const rows: { checkId: string; severity: string; recommendation: string | null }[] = [];
  const allIssues = [
    ...model.priorityCandidates,
    ...Object.values(model.issuesByCategory).flat(),
  ];
  for (const issue of allIssues) {
    if (!SUPPORTED.has(issue.checkId)) continue;
    if (seen.has(issue.id)) continue;
    seen.add(issue.id);
    rows.push({
      checkId: issue.checkId,
      severity: issue.severity,
      recommendation: issue.recommendation,
    });
  }

  console.log(
    `[verify-cms-fix] issues de los ${SUPPORTED.size} checkIds objetivo encontrados: ${rows.length}`
  );
  if (rows.length === 0) {
    console.warn(
      "[verify-cms-fix] ADVERTENCIA: ningún issue de los checkIds objetivo en este audit. " +
        "Elegí un audit con issues de ONPAGE-01..05 / TECH-01/02/04 / SD-01/02 para ver la personalización."
    );
  }
  console.dir(rows, { depth: null });

  await prisma.$disconnect();
}

main().catch(async (error) => {
  const err = error as { code?: string; name?: string; message?: string };
  // Postgres "can't reach database server" surfaces either as the P1001 code or,
  // at client-init time, as a PrismaClientInitializationError whose code is
  // undefined — match both so the offline case reports cleanly instead of
  // dumping a raw stack.
  const isUnreachable =
    err?.code === "P1001" ||
    err?.name === "PrismaClientInitializationError" ||
    /can't reach database server/i.test(err?.message ?? "");
  if (isUnreachable) {
    console.error(
      "[verify-cms-fix] P1001: no se pudo alcanzar la base de datos. Este entorno no tiene red saliente.\n" +
        MANUAL_HINT
    );
  } else {
    console.error("[verify-cms-fix] error inesperado:", error);
    console.error(MANUAL_HINT);
  }
  try {
    await prisma.$disconnect();
  } catch {
    // ignore disconnect errors on a connection that never opened
  }
  process.exit(1);
});
