import type { AxisResult } from "@auditor/fingerprint";

/**
 * Unión cerrada de las 5 labels de CMS que este paquete personaliza. Son
 * exactamente los valores que `@auditor/fingerprint` puede emitir en
 * `cms.value` y para los que existe un adaptador de copy.
 *
 * HALLAZGO (27-PATTERNS, Pitfall 3): `fingerprint` NO exporta un tipo
 * `CmsPlatform`; `AxisResult.value` es `string | null`. Por eso la unión se
 * declara localmente aquí y el motor (Plan 02) matchea el string contra ella.
 */
export type CmsLabel =
  | "WordPress"
  | "Shopify"
  | "Webflow"
  | "Wix"
  | "Squarespace";

/**
 * Los 10 checkIds de mayor volumen para los que cada adaptador provee una
 * instrucción de fix específica de plataforma. Orden fijo (tuple `as const`)
 * para que el test de cobertura itere una superficie estable de 10 × 5 = 50
 * entradas.
 */
export const SUPPORTED_CHECK_IDS = [
  "ONPAGE-01",
  "ONPAGE-02",
  "ONPAGE-03",
  "ONPAGE-04",
  "ONPAGE-05",
  "TECH-01",
  "TECH-02",
  "TECH-04",
  "SD-01",
  "SD-02",
] as const;

/**
 * Contrato común de un adaptador de plataforma: resuelve un `checkId` a la
 * instrucción de fix específica del CMS, o `null` cuando el checkId no está en
 * su catálogo (nunca lanza).
 *
 * La firma threadea el `label` (corrección de diseño sobre 27-RESEARCH, que
 * usaba 2 args): el módulo `wixSquarespace` mapea DOS labels (`Wix` y
 * `Squarespace`) al mismo adaptador y necesita saber cuál disparó la
 * resolución para elegir el catálogo interno correcto. Los adaptadores de
 * label único (WordPress/Shopify/Webflow) ignoran el parámetro `label`.
 *
 * El parámetro `builder` (el eje `builder` crudo del `DetectedStack`) solo lo
 * usa WordPress para las variantes por builder de ONPAGE-04/SD-01/SD-02; el
 * resto de los adaptadores lo ignora.
 */
export interface CmsAdapter {
  lookup(checkId: string, label: CmsLabel, builder: AxisResult): string | null;
}
