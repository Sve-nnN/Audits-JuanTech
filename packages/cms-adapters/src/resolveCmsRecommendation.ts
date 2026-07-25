import type { DetectedStack } from "@auditor/fingerprint";
import { registry } from "./registry";
import type { CmsLabel } from "./types";
import { ACTIVATING_CONFIDENCE } from "./types";

/**
 * Las 5 labels con adaptador. El motor valida contra esta lista ANTES de indexar
 * el `registry` (default seguro: nunca indexa con un label inesperado — V5 ASVS
 * L1). Cualquier otro `cms.value` (Drupal, Joomla, …) cae al genérico.
 */
const CMS_LABELS: readonly CmsLabel[] = [
  "WordPress",
  "Shopify",
  "Webflow",
  "Wix",
  "Squarespace",
];

/**
 * Motor puro de resolución de recomendación por CMS. Devuelve la instrucción de
 * fix específica de plataforma cuando (1) hay un `stack` detectado, (2) el CMS se
 * detectó con confianza `alto`/`medio`, (3) su label tiene adaptador y (4) el
 * `checkId` está en el catálogo del adaptador. En cualquier otro caso devuelve el
 * `generic` recibido TAL CUAL (byte-idéntico, CMSFIX-04) — el fallback nunca es
 * una copia almacenada del genérico, es el propio argumento devuelto sin tocar.
 *
 * Nunca lanza: todos los caminos inesperados (stack null, confianza baja, label
 * sin adaptador, checkId ausente, generic null) resuelven a `generic`.
 *
 * Recibe el `DetectedStack` CRUDO (no el `ReportStack` serializado): necesita el
 * eje `builder` separado y `cms.value`/`cms.confidence` sin fusionar. El Plan 03
 * pasa el `rawStack` en el punto de integración de report-model.
 */
export function resolveCmsRecommendation(
  stack: DetectedStack | null,
  checkId: string,
  generic: string | null,
): string | null {
  if (!stack) return generic;
  const { value, confidence } = stack.cms;
  if (!ACTIVATING_CONFIDENCE.has(confidence)) return generic;
  if (value == null || !CMS_LABELS.includes(value as CmsLabel)) return generic;
  const adapter = registry[value as CmsLabel];
  const instruction = adapter.lookup(checkId, value as CmsLabel, stack.builder);
  return instruction ?? generic; // catálogo ausente → fallback (CMSFIX-04)
}
