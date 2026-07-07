import type { ReportIssue } from "@auditor/report-model";
import { CATEGORY_ORDER, SEVERITY_SORT_WEIGHT } from "./labels";

/**
 * Shared top-N volume guardrail (EXPORT-05). This is the SINGLE source of the
 * cap for all three export formats (Markdown, PPTX, PDF). Tunable — change here
 * to make every format show more/fewer issues.
 */
export const EXPORT_TOP_N = 50;

export interface PrioritizedIssues {
  /** Top `EXPORT_TOP_N` issues after severity ordering. */
  issues: ReportIssue[];
  /** Number of issues actually emitted (== issues.length). */
  shown: number;
  /** Total candidates before the cap (== "M" in "mostrando N de M"). */
  total: number;
  /** Whether the cap trimmed the set (total > EXPORT_TOP_N). */
  capped: boolean;
  /** Neutral-Spanish note "Mostrando N de M issues" when capped, else null. */
  note: string | null;
}

const categoryRank = (cat: string): number => {
  const idx = CATEGORY_ORDER.indexOf(cat as (typeof CATEGORY_ORDER)[number]);
  return idx === -1 ? CATEGORY_ORDER.length : idx;
};

/**
 * Prioritize and cap the FULL critical+warning candidate set.
 *
 * IMPORTANT (EXPORT-05 correctness): callers MUST pass
 * `model.priorityCandidates` (all critical+warning, untrimmed) — NOT
 * `model.priorityIssues` (already capped to 60 for the screen table) and NOT
 * the "ok"-inclusive set. `total` therefore equals `totalPriorityCandidates`.
 *
 * Ordering: severity (critical < warning < ok) → category (CATEGORY_ORDER) →
 * checkId → id, a fully deterministic, stable order.
 */
export function prioritizeIssues(candidates: ReportIssue[]): PrioritizedIssues {
  const sorted = [...candidates].sort((a, b) => {
    const sev =
      (SEVERITY_SORT_WEIGHT[a.severity] ?? 99) -
      (SEVERITY_SORT_WEIGHT[b.severity] ?? 99);
    if (sev !== 0) return sev;
    const cat = categoryRank(a.category) - categoryRank(b.category);
    if (cat !== 0) return cat;
    const check = a.checkId.localeCompare(b.checkId);
    if (check !== 0) return check;
    return a.id.localeCompare(b.id);
  });

  const total = candidates.length;
  const issues = sorted.slice(0, EXPORT_TOP_N);
  const shown = issues.length;
  const capped = total > EXPORT_TOP_N;
  const note = capped ? `Mostrando ${shown} de ${total} issues` : null;

  return { issues, shown, total, capped, note };
}
