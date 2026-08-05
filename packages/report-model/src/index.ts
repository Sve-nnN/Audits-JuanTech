export { buildReportModel, MAX_PRIORITY_ROWS } from "./build";
export { groupIssuesByType } from "./grouping";
export type { IssueTypeGroup } from "./grouping";
export { jsonLdStateForPage } from "./jsonld";
export type { JsonLdState } from "./jsonld";
export { classifyTemplate, TEMPLATE_ORDER } from "./template";
export type { PageTemplate } from "./template";
export type {
  ReportModel,
  ReportIssue,
  ReportResolvedIssue,
  ReportDiff,
  ReportPerf,
  ReportStrategyPerf,
  ReportAuditMeta,
  ReportSeverity,
  ReportDiffStatus,
  ArchNode,
  ArchTreeNode,
  ReportArchitecture,
  ReportStack,
  ReportStackAxis,
  SocialPreviewData,
  SocialImageStatus,
} from "./model";
export { extractSocialPreview } from "./socialPreview";
// Re-export Confidence so apps/web (labels.ts, StackTable.tsx) imports it from
// @auditor/report-model without a direct dep on @auditor/fingerprint (same
// pattern by which labels.ts already imports PageTemplate from here).
export type { Confidence } from "@auditor/fingerprint";
