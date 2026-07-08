"use client";

import {
  jsonLdStateForPage,
  type JsonLdState,
  type ReportSeverity,
} from "@auditor/report-model";
import { Badge, type BadgeVariant } from "./Badge";

interface JsonLdBadgeProps {
  /** Severidades de los issues de categoría `schema` de la página (por pageId). */
  schemaSeverities: ReportSeverity[];
  /** Cantidad de entidades JSON-LD (nodos del schemaGraph) presentes en la página. */
  nodeCount: number;
}

/** Estado JSON-LD → variante de `Badge` existente (sin colores nuevos). */
const STATE_VARIANT: Record<JsonLdState, BadgeVariant> = {
  error: "critical",
  warning: "warning",
  ok: "ok",
  absent: "neutral",
};

/** Estado JSON-LD → copy en español neutro (UI-SPEC Componente 2). */
function stateLabel(state: JsonLdState, nodeCount: number): string {
  switch (state) {
    case "error":
      return "JSON-LD con errores";
    case "warning":
      return "JSON-LD con advertencias";
    case "ok":
      return `${nodeCount} entidad(es) JSON-LD`;
    case "absent":
      return "Sin JSON-LD";
  }
}

/**
 * JsonLdBadge (REPORT-04) — badge estático de estado JSON-LD por página.
 *
 * Deriva el peor de 4 estados con `jsonLdStateForPage` (helper puro, plan 15-01)
 * cruzando las severidades de los issues `schema` de la página con la presencia
 * de grafo (`nodeCount > 0`), y lo mapea a una variante existente de `Badge`.
 * Cero colores nuevos: el color es refuerzo, el texto porta el significado.
 */
export function JsonLdBadge({ schemaSeverities, nodeCount }: JsonLdBadgeProps) {
  const state = jsonLdStateForPage(schemaSeverities, nodeCount > 0);
  return <Badge variant={STATE_VARIANT[state]}>{stateLabel(state, nodeCount)}</Badge>;
}
