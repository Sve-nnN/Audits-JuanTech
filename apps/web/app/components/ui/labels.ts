import type { Category, ScoreStatus } from "@auditor/scoring";

/**
 * Mapas de etiquetas neutrales en español (sin voceo) compartidos por los
 * componentes de la librería de UI (Badge, Accordion, IssuesTable, wrappers).
 * Copy extraído verbatim desde audits/[id]/page.tsx para evitar drift.
 */

export const CATEGORY_LABEL: Record<Category, string> = {
  tech: "SEO Técnico",
  perf: "Rendimiento / CWV",
  onpage: "On-Page",
  schema: "Datos Estructurados",
  aeo: "AEO (Visibilidad en IA)",
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

export const DIFF_LABEL: Record<string, string> = {
  new: "Nuevo",
  persistent: "Persistente",
  resolved: "Resuelto",
};

export const STRATEGY_LABEL: Record<string, string> = {
  mobile: "Móvil",
  desktop: "Desktop",
};
