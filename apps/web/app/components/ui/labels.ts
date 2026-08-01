import type { Category, ScoreStatus } from "@auditor/scoring";
import type { PageTemplate, Confidence } from "@auditor/report-model";

/**
 * Mapas de etiquetas neutrales en español (sin voceo) compartidos por los
 * componentes de la librería de UI (Badge, Accordion, IssuesTable, wrappers).
 * Copy extraído verbatim desde audits/[id]/page.tsx para evitar drift.
 */

/** Orden de presentación de las categorías en el reporte (SCORE-01). */
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

export const DIFF_LABEL: Record<string, string> = {
  new: "Nuevo",
  persistent: "Persistente",
  resolved: "Resuelto",
};

export const STRATEGY_LABEL: Record<string, string> = {
  mobile: "Móvil",
  desktop: "Desktop",
};

export const TEMPLATE_LABEL: Record<PageTemplate, string> = {
  home: "Home",
  category: "Categoría",
  product: "Producto",
  article: "Artículo",
  other: "Otras",
};

/**
 * Etiquetas de eje del stack técnico detectado (Phase 26, StackTable).
 * Copy verbatim del Copywriting Contract del UI-SPEC. Solo se localizan las
 * etiquetas de eje; los valores de tecnología (WordPress, GA4, Google Tag
 * Manager, Meta Pixel) van verbatim del motor de fingerprint, no se traducen.
 */
export const AXIS_LABEL = {
  cms: "CMS",
  cdn: "CDN / proxy",
  hosting: "Hosting",
  jsFramework: "Framework JS",
  analytics: "Analytics",
} as const;

/**
 * Nivel de confianza de detección → etiqueta neutral (sin voceo). La confianza
 * NUNCA es una severidad de error: "No detectado" es informativo, no crítico.
 */
export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  alto: "Confianza alta",
  medio: "Confianza media",
  bajo: "Confianza baja",
  "no-detectado": "No detectado",
};
