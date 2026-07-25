import type { CmsAdapter, CmsLabel } from "./types";
import { wordpressAdapter } from "./wordpress";
import { shopifyAdapter } from "./shopify";
import { webflowAdapter } from "./webflow";
import { wixSquarespaceAdapter } from "./wixSquarespace";

/**
 * Registry de adaptadores por `CmsLabel`: la ÚNICA fuente que consulta el motor
 * (`resolveCmsRecommendation`). Mismo patrón que
 * `packages/fingerprint/src/signatures/registry.ts` — un import por módulo de
 * datos; el copy calibrable queda aislado del motor (lógica estable).
 *
 * Wix y Squarespace mapean al MISMO `wixSquarespaceAdapter` (módulo técnico
 * compartido, CMSFIX-01); el adaptador ramifica internamente por el `label`
 * recibido en `lookup` para elegir su catálogo interno.
 */
export const registry: Record<CmsLabel, CmsAdapter> = {
  WordPress: wordpressAdapter,
  Shopify: shopifyAdapter,
  Webflow: webflowAdapter,
  Wix: wixSquarespaceAdapter, // mismo módulo,
  Squarespace: wixSquarespaceAdapter, // distinto label interno
};
