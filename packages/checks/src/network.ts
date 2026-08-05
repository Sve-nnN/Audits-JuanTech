/**
 * Superficie de red importable desde `apps/web` (`@auditor/checks/network`).
 *
 * El barrel del paquete (`@auditor/checks`) NO sirve para esto: arrastra
 * `network/index.ts` → `brokenResources.ts` → `@auditor/crawler` → Crawlee, que
 * depende de `tls`, y el build de Next falla con `Module not found: 'tls'`
 * (medido en Plan 32-01). Este módulo re-exporta únicamente las hojas de la
 * defensa de destino, cuyo grafo se cierra en `node:dns`/`node:net`/`undici`.
 *
 * Existe para que el proxy de imágenes del reporte (Plan 32-02) defienda su
 * destino con exactamente la misma guardia SSRF y la misma política de
 * redirecciones que el sondeo de Phase 31: una segunda implementación paralela
 * sería la vía por la que las dos se desincronizan.
 */
export {
  assertPublicDestination,
  pinnedDispatcher,
  isPrivateAddress,
  REASON_NOT_PUBLIC,
  REASON_UNRESOLVABLE,
  type DestinationVerdict,
} from "./checks/network/ssrfGuard";
export {
  resolveRedirect,
  isRedirectStatus,
  MAX_REDIRECT_HOPS,
  REASON_TOO_MANY_REDIRECTS,
  REASON_INVALID_REDIRECT,
  type RedirectDecision,
} from "./checks/network/redirects";
export { readUpTo, IMAGE_PROBE_TIMEOUT_MS } from "./checks/network/imageProbe";
