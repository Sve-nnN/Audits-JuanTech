import type { ReportModel, ReportIssue } from "@auditor/report-model";
import type { Category, CategoryScoreResult } from "@auditor/scoring";

/**
 * Test fixtures for the export serializers. Pure data builders — no PII by
 * construction. The optional `email`/`token` args in `buildModel` live in
 * ADJACENT scope only (never inside the returned ReportModel) so the zero-PII
 * test can assert the pipeline never leaks them.
 */

let idSeq = 0;

export function makeIssue(overrides: Partial<ReportIssue> = {}): ReportIssue {
  idSeq += 1;
  return {
    id: `issue-${idSeq}`,
    checkId: "TECH-01",
    category: "tech",
    title: "Título de prueba",
    severity: "critical",
    measuredValue: "valor medido",
    source: "https://example.com/pagina",
    criterion: "criterio esperado",
    recommendation: "recomendación de arreglo",
    fingerprint: `fp-${idSeq}`,
    diffStatus: "new",
    url: "https://example.com/pagina",
    ...overrides,
  };
}

/** N critical + warning candidates, alternating severity. */
export function makeCandidates(count: number): ReportIssue[] {
  return Array.from({ length: count }, (_, i) =>
    makeIssue({
      severity: i % 2 === 0 ? "critical" : "warning",
      checkId: `CHECK-${String(i).padStart(3, "0")}`,
      title: `Issue número ${i}`,
    })
  );
}

const CATS: Category[] = ["tech", "perf", "onpage", "schema", "aeo"];

function scoreResult(score: number): CategoryScoreResult {
  return {
    score,
    status: score >= 90 ? "good" : score >= 50 ? "needs_improvement" : "critical",
  };
}

interface BuildModelOptions {
  candidatesCount?: number;
  priorityIssuesCount?: number;
  candidates?: ReportIssue[];
  overall?: number | null;
  byCategoryScores?: Partial<Record<Category, number>>;
  includeCategoryData?: boolean;
}

export function buildModel(opts: BuildModelOptions = {}): ReportModel {
  const candidates =
    opts.candidates ?? makeCandidates(opts.candidatesCount ?? 3);
  const priorityIssues = candidates.slice(0, opts.priorityIssuesCount ?? 60);

  const byCategory: Partial<Record<Category, CategoryScoreResult>> = {};
  const issuesByCategory = {
    tech: [] as ReportIssue[],
    perf: [] as ReportIssue[],
    onpage: [] as ReportIssue[],
    schema: [] as ReportIssue[],
    aeo: [] as ReportIssue[],
  } as Record<Category, ReportIssue[]>;

  if (opts.includeCategoryData !== false) {
    for (const cat of CATS) {
      const s = opts.byCategoryScores?.[cat];
      if (s !== undefined) byCategory[cat] = scoreResult(s);
      else byCategory[cat] = scoreResult(75);
    }
  }
  for (const issue of candidates) {
    const cat = (issue.category as Category) ?? "tech";
    if (issuesByCategory[cat]) issuesByCategory[cat].push(issue);
  }

  return {
    audit: {
      domain: "example.com",
      createdAt: new Date("2026-07-01T00:00:00Z"),
      finishedAt: new Date("2026-07-01T00:10:00Z"),
      urlLimit: 500,
      status: "done",
    },
    hasScores: opts.includeCategoryData !== false,
    overall: opts.overall ?? 72,
    status: "needs_improvement",
    byCategory,
    diff: {
      previousAuditId: null,
      newCount: candidates.length,
      persistentCount: 0,
      resolvedCount: 0,
      resolvedIssues: [],
    },
    priorityCandidates: candidates,
    priorityIssues,
    totalPriorityCandidates: candidates.length,
    issuesByCategory,
  };
}

/**
 * Sentinel PII values that must NEVER surface in any serialized output. Distinct,
 * unmistakable strings so a leak is unambiguous in an assertion failure.
 */
export const PII_CANARY_EMAIL = "pii-leak-canary@example.com";
export const PII_CANARY_TOKEN = "SECRET_TOKEN_CANARY";

/**
 * A `ReportModel` whose `audit` and every issue carry ADJACENT PII columns
 * (email / emailId / token / verificationToken) attached as extra, non-schema
 * fields — exactly the shape a DB row would have if the whitelist ever slipped.
 *
 * This makes the zero-PII guardrail a REAL leak detector: the serializers must
 * render only whitelisted fields, so a serializer that ever dumps the whole
 * object (JSON.stringify, object spread) would surface the canaries and fail the
 * test. Unlike the old "assert an arbitrary literal that was never in the model"
 * pattern, this assertion CAN fail.
 */
export function buildModelWithLeakedPii(opts: BuildModelOptions = {}): ReportModel {
  const model = buildModel(opts);
  const inject = (target: object): void => {
    const rec = target as Record<string, unknown>;
    rec.email = PII_CANARY_EMAIL;
    rec.emailId = "email-1";
    rec.token = PII_CANARY_TOKEN;
    rec.verificationToken = PII_CANARY_TOKEN;
  };
  inject(model.audit);
  for (const issue of model.priorityCandidates) inject(issue);
  for (const list of Object.values(model.issuesByCategory)) {
    for (const issue of list) inject(issue);
  }
  return model;
}
