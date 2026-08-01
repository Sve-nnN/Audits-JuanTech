import type { Category, ScoreStatus } from "@auditor/scoring";

/**
 * Neutral-Spanish labels (sin voceo) for the export serializers. Copied
 * verbatim from the on-screen report (`apps/web/app/components/ui/labels.ts`)
 * so exports read identically to the UI, without the export package depending
 * on the web app.
 */

export const CATEGORY_ORDER: Category[] = ["tech", "perf", "onpage", "schema", "aeo", "social"];

export const CATEGORY_LABEL: Record<Category, string> = {
  tech: "SEO Técnico",
  perf: "Rendimiento / CWV",
  onpage: "On-Page",
  schema: "Datos Estructurados",
  aeo: "AEO (Visibilidad en IA)",
  social: "Meta Tags / Social",
};

export const STATUS_LABEL: Record<ScoreStatus, string> = {
  good: "Bueno",
  needs_improvement: "Necesita mejora",
  critical: "Crítico",
};

export const SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítico",
  warning: "Advertencia",
  ok: "Correcto",
};

/**
 * Severity ordering weight — same axis as the on-screen report
 * (`SEVERITY_SORT_WEIGHT` in page.tsx): critical first, then warning, then ok.
 */
export const SEVERITY_SORT_WEIGHT: Record<string, number> = {
  critical: 0,
  warning: 1,
  ok: 2,
};
