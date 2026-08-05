import type { NetworkCheck } from "../../types";
import { brokenExternalLinksCheck } from "./brokenExternalLinks";
import { brokenResourcesCheck } from "./brokenResources";
import { ogImageNetworkCheck } from "./ogImageNetwork";

export const networkChecks: NetworkCheck[] = [
  brokenExternalLinksCheck,
  brokenResourcesCheck,
  ogImageNetworkCheck,
];

export { brokenExternalLinksCheck, brokenResourcesCheck, ogImageNetworkCheck };

/*
 * Superficie pública de la infraestructura de red de Phase 31. La consume el
 * proxy de imágenes del reporte (Plan 32-02), que debe defender su destino con
 * exactamente la misma guardia SSRF y la misma política de redirecciones que el
 * sondeo del check: una segunda implementación paralela sería la vía por la que
 * las dos se desincronizan.
 */
export {
  assertPublicDestination,
  pinnedDispatcher,
  REASON_NOT_PUBLIC,
  REASON_UNRESOLVABLE,
} from "./ssrfGuard";
export {
  resolveRedirect,
  isRedirectStatus,
  MAX_REDIRECT_HOPS,
  REASON_TOO_MANY_REDIRECTS,
  REASON_INVALID_REDIRECT,
} from "./redirects";
export { readUpTo, IMAGE_PROBE_TIMEOUT_MS } from "./imageProbe";
export {
  OG_IMAGE_UNREACHABLE_SUBTYPE,
  OG_IMAGE_UNVERIFIABLE_SUBTYPE,
  OG_IMAGE_SVG_SUBTYPE,
  OG_IMAGE_NOT_IMAGE_SUBTYPE,
  OG_IMAGE_UNDETERMINED_SUBTYPE,
  OG_IMAGE_TOO_SMALL_SUBTYPE,
  OG_IMAGE_SUBOPTIMAL_SUBTYPE,
  OG_IMAGE_TOO_LARGE_SUBTYPE,
  OG_IMAGE_HEAVY_SUBTYPE,
  subtypeFromImgFingerprint,
} from "./ogImageNetwork";
