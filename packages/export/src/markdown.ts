import type { ReportModel, ReportIssue } from "@auditor/report-model";
import type { Category } from "@auditor/scoring";
import { prioritizeIssues } from "./priority";
import {
  CATEGORY_ORDER,
  CATEGORY_LABEL,
  STATUS_LABEL,
  SEVERITY_LABEL,
} from "./labels";

/**
 * Markdown-para-LLM serializer (EXPORT-02). A pure string builder (no heavy
 * dependency) that produces a structured document an LLM can read and act on:
 * header (domain + overall score + status + per-category scores) followed by
 * one section per prioritized issue in the FIXED order
 * issue/checkId → página/selector → valor medido → criterio → recomendación.
 *
 * The cap comes exclusively from `prioritizeIssues(model.priorityCandidates)`
 * (EXPORT-05) — the full critical+warning set, so the "M" in "mostrando N de M"
 * is `totalPriorityCandidates`, not the 60-row screen cap.
 *
 * Accents / ñ are preserved verbatim (UTF-8, never escaped). NO PII: only audit
 * data reaches this function via ReportModel.
 */
export function toMarkdown(model: ReportModel): string {
  const lines: string[] = [];
  const val = (v: string | null | undefined): string =>
    v === null || v === undefined || v === "" ? "no disponible" : v;

  // Header
  lines.push(`# Auditoría web — ${model.audit.domain}`);
  lines.push("");
  const overall = model.overall === null ? "no disponible" : String(model.overall);
  lines.push(`- **Score general:** ${overall} / 100`);
  lines.push(`- **Estado:** ${STATUS_LABEL[model.status]}`);
  if (model.audit.finishedAt) {
    lines.push(`- **Finalizada:** ${model.audit.finishedAt.toISOString()}`);
  }
  lines.push("");

  // Per-category scores in CATEGORY_ORDER
  lines.push("## Scores por categoría");
  lines.push("");
  for (const category of CATEGORY_ORDER) {
    const result = model.byCategory[category as Category];
    if (result) {
      lines.push(
        `- **${CATEGORY_LABEL[category]}:** ${result.score} / 100 — ${STATUS_LABEL[result.status]}`
      );
    } else {
      lines.push(`- **${CATEGORY_LABEL[category]}:** sin datos`);
    }
  }
  lines.push("");

  // Prioritized issues (shared cap over the FULL critical+warning set)
  const prioritized = prioritizeIssues(model.priorityCandidates);
  lines.push(`## Issues priorizados (${prioritized.shown})`);
  if (prioritized.note) {
    lines.push("");
    lines.push(`> ${prioritized.note}`);
  }
  lines.push("");

  prioritized.issues.forEach((issue: ReportIssue, i: number) => {
    const label = SEVERITY_LABEL[issue.severity] ?? issue.severity;
    lines.push(`### ${i + 1}. [${issue.checkId}] ${issue.title} (${label})`);
    lines.push("");
    // FIXED order: checkId → página/selector → valor → criterio → recomendación
    lines.push(`- **Check:** ${issue.checkId}`);
    lines.push(`- **Página / selector:** ${val(issue.url ?? issue.source)}`);
    lines.push(`- **Valor medido:** ${val(issue.measuredValue)}`);
    lines.push(`- **Criterio:** ${val(issue.criterion)}`);
    lines.push(`- **Recomendación:** ${val(issue.recommendation)}`);
    lines.push("");
  });

  return lines.join("\n");
}
