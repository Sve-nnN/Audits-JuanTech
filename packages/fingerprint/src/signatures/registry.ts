import type { Axis, Signature } from "../types";
import { cmsSignatures } from "./cms";
import { builderSignatures } from "./builder";
import { cdnSignatures } from "./cdn";
import { hostingSignatures } from "./hosting";
import { jsFrameworkSignatures } from "./jsFramework";
import { analyticsSignatures } from "./analytics";

/**
 * Registry de signatures por eje: la ÚNICA fuente de reglas de detección que
 * consumirá `detectStack` (Plan 25-04). Mismo patrón que
 * `packages/checks/src/registry.ts` (agregar arrays de reglas por tipo).
 *
 * Cada clave de `Axis` mapea a su lista de `Signature`. Las reglas (dato
 * calibrable, confianza MEDIUM) quedan aisladas del motor (lógica estable).
 */
export const registry: Record<Axis, Signature[]> = {
  cms: cmsSignatures,
  builder: builderSignatures,
  cdn: cdnSignatures,
  hosting: hostingSignatures,
  jsFramework: jsFrameworkSignatures,
  analytics: analyticsSignatures,
};
