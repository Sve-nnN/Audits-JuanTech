import { mapWithConcurrency, DEFAULT_NETWORK_CONCURRENCY } from "./concurrency";
import {
  assertPublicDestination,
  pinnedDispatcher,
  REASON_NOT_PUBLIC,
  REASON_UNRESOLVABLE,
} from "./ssrfGuard";
import {
  isRedirectStatus,
  resolveRedirect,
  MAX_REDIRECT_HOPS,
  REASON_TOO_MANY_REDIRECTS,
} from "./redirects";

const REQUEST_TIMEOUT_MS = 5_000;

/**
 * Hard cap on how many unique URLs a single network check will probe. On a
 * large crawl (hundreds of pages) the unique external-link / resource set can
 * be huge; probing every one (HEAD+GET, with timeouts) can take many minutes
 * and makes the audit look hung. Callers slice to this and report the cap.
 */
export const MAX_URLS_PER_NETWORK_CHECK = 150;

/**
 * Único contrato entre este módulo y los checks que lo consumen (TECH-12 y
 * TECH-13) para el destino que la defensa rechazó. Viaja en el campo de motivo
 * del resultado y del otro lado se compara contra esta misma constante: escribir
 * la cadena a mano en los dos lados es garantizar que diverjan en la primera
 * reescritura del copy.
 *
 * El motivo es deliberadamente uno solo para los dos veredictos de la defensa
 * (no público y no resoluble): al usuario del reporte le decimos que no pudimos
 * verificar el destino, no por cuál de las dos razones internas.
 */
export const UNVERIFIABLE_DESTINATION_REASON = "destino no verificable";

export type LinkCheckResult =
  | { url: string; ok: true; status: number }
  | { url: string; ok: false; status: number | null; reason: string };

type RequestOutcome =
  | { kind: "response"; status: number }
  | { kind: "error"; reason: string }
  | { kind: "redirect"; res: Response };

/**
 * One probe of one URL: `HEAD` first, `GET` as the fallback that some servers
 * force, and **never** automatic redirect following.
 *
 * The connection goes through the address the guard already classified, so the
 * name cannot be rebound between the verdict and the socket.
 */
async function requestOnce(url: string, addresses: string[]): Promise<RequestOutcome> {
  for (const method of ["HEAD", "GET"] as const) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const dispatcher = pinnedDispatcher(addresses);
    try {
      // La aserción existe porque `@types/node` embebe su propia copia de los
      // tipos de undici y las dos declaraciones de `Dispatcher` no son
      // asignables entre sí, aunque en ejecución sean el mismo objeto.
      const res = await fetch(url, {
        method,
        signal: controller.signal,
        redirect: "manual",
        dispatcher,
      } as RequestInit);
      if (isRedirectStatus(res.status)) return { kind: "redirect", res };
      if (res.status >= 400 && method === "HEAD") continue; // retry with GET before giving up
      return { kind: "response", status: res.status };
    } catch (error) {
      if (method === "HEAD") continue;
      const message = error instanceof Error ? error.message : "unknown error";
      return { kind: "error", reason: message };
    } finally {
      clearTimeout(timeout);
      void dispatcher.destroy().catch(() => {});
    }
  }
  return { kind: "error", reason: "unreachable" };
}

/**
 * Checks one link end to end, revalidating every redirect hop.
 *
 * **`url` in the result is always the URL we were asked about**, never the one
 * a hop led to: the caller maps `results[i]` back to `urls[i]` and keys issue
 * rows on it. The destination we refused travels in the reason instead.
 */
async function checkOne(url: string): Promise<LinkCheckResult> {
  const verdict = await assertPublicDestination(url);
  if (!verdict.ok) {
    return { url, ok: false, status: null, reason: UNVERIFIABLE_DESTINATION_REASON };
  }

  let currentUrl = url;
  let addresses = verdict.addresses;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
    const outcome = await requestOnce(currentUrl, addresses);
    if (outcome.kind === "error") {
      return { url, ok: false, status: null, reason: outcome.reason };
    }
    if (outcome.kind === "response") {
      if (outcome.status >= 400) {
        return { url, ok: false, status: outcome.status, reason: `HTTP ${outcome.status}` };
      }
      return { url, ok: true, status: outcome.status };
    }

    // Cada salto vuelve a pasar por la defensa. Seguirlos automáticamente es el
    // bypass más barato que tiene esta capa: un 302 hacia la dirección de
    // metadatos no necesita ningún truco de nombres (amenaza T-31-02).
    const decision = await resolveRedirect(outcome.res, currentUrl);
    if (decision.kind === "reject") {
      const rejectedByGuard =
        decision.reason === REASON_NOT_PUBLIC || decision.reason === REASON_UNRESOLVABLE;
      return {
        url,
        ok: false,
        status: decision.status,
        reason: rejectedByGuard ? UNVERIFIABLE_DESTINATION_REASON : decision.reason,
      };
    }

    currentUrl = decision.url;
    addresses = decision.addresses;
  }

  return { url, ok: false, status: null, reason: REASON_TOO_MANY_REDIRECTS };
}

/**
 * Runs `checkOne` over `urls` with bounded concurrency.
 *
 * El runner es el compartido de toda la capa de red, no una copia local: la
 * segunda copia es la que se queda sin la corrección que reciba la primera, y
 * el modo de fallo de esa divergencia es abrir más conexiones simultáneas
 * contra un sitio de tercero de las que nadie autorizó (amenaza T-31-10). La
 * propiedad de la que dependen TECH-12 y TECH-13 sigue intacta: el resultado en
 * la posición i corresponde a la URL en la posición i.
 */
export async function checkLinks(urls: string[]): Promise<LinkCheckResult[]> {
  return mapWithConcurrency(urls, DEFAULT_NETWORK_CONCURRENCY, checkOne);
}
