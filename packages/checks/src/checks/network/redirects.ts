import { assertPublicDestination } from "./ssrfGuard";

/**
 * Manual redirect handling shared by every network check (threat T-31-02).
 *
 * **Why no check may use `redirect: "follow"`.** Automatic following resolves
 * and connects to each hop inside the transport, where our destination guard
 * never runs: a public host that answers `302 Location:
 * http://169.254.169.254/…` reaches the internal endpoint with no DNS trick at
 * all, and the status it returns ends up persisted in a report the attacker
 * receives. So every hop comes back here, gets validated, and only then is
 * followed.
 *
 * This module exists so there is exactly one copy of that loop's decision
 * logic. A second copy is the one that misses the next correction.
 */

/** Redirects followed manually before giving up. Each hop is revalidated, never followed blindly. */
export const MAX_REDIRECT_HOPS = 3;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Reason for a `Location` that is not a URL we can even evaluate. */
export const REASON_INVALID_REDIRECT = "redirección no válida";

/** Reason for a chain longer than the hop budget. */
export const REASON_TOO_MANY_REDIRECTS = "demasiadas redirecciones";

export function isRedirectStatus(status: number): boolean {
  return REDIRECT_STATUSES.has(status);
}

export type RedirectDecision =
  | { kind: "follow"; url: string; addresses: string[] }
  | { kind: "reject"; url: string; status: number | null; reason: string };

/**
 * Decides what to do with a redirect response: follow the hop, or refuse it.
 *
 * A rejection coming from the destination guard reports **the hop's URL** and
 * a null status, not the URL we started from: the caller persists that value,
 * and naming the destination we refused is the whole diagnostic. The two
 * malformed cases (no `Location`, unparseable `Location`) keep the status,
 * because there the response itself is the defect.
 */
export async function resolveRedirect(
  res: Response,
  currentUrl: string,
): Promise<RedirectDecision> {
  const location = res.headers.get("location");
  if (!location) {
    return { kind: "reject", url: currentUrl, status: res.status, reason: `HTTP ${res.status}` };
  }

  let next: string;
  try {
    next = new URL(location, currentUrl).toString();
  } catch {
    return {
      kind: "reject",
      url: currentUrl,
      status: res.status,
      reason: REASON_INVALID_REDIRECT,
    };
  }

  const verdict = await assertPublicDestination(next);
  if (!verdict.ok) {
    return { kind: "reject", url: next, status: null, reason: verdict.reason };
  }

  return { kind: "follow", url: next, addresses: verdict.addresses };
}
