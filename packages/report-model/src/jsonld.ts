import type { ReportSeverity } from "./model";

/**
 * The per-page JSON-LD state (REPORT-04), derived from the page's `schema`
 * issues crossed with the presence of a schema graph. Semantic only — the UI
 * (Plan 03) maps these to badge variants/colours.
 */
export type JsonLdState = "error" | "warning" | "ok" | "absent";

/**
 * Derive the worst JSON-LD state for a single page from the severities of its
 * `schema`-category issues and whether it has a schema graph (nodes > 0).
 *
 * Precedence (worst first): error > warning > ok > absent.
 * - "error"   → any `critical` schema issue.
 * - "warning" → any `warning` and no `critical`.
 * - "ok"      → no critical/warning AND a schema graph is present.
 * - "absent"  → no critical/warning and no schema graph.
 */
export function jsonLdStateForPage(
  schemaSeverities: ReportSeverity[],
  hasSchemaGraph: boolean
): JsonLdState {
  if (schemaSeverities.includes("critical")) return "error";
  if (schemaSeverities.includes("warning")) return "warning";
  return hasSchemaGraph ? "ok" : "absent";
}
