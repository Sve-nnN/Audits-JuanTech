import { mapWithConcurrency, DEFAULT_NETWORK_CONCURRENCY } from "./concurrency";
import { assertPublicDestination } from "./ssrfGuard";

/**
 * HTTP transport for the social-image probe (IMG-01..04).
 *
 * **One `GET` with a `Range` header, never a `HEAD` first.** This is a
 * deliberate, documented deviation from the letter of IMG-01 and of
 * `31-CONTEXT.md`, which described reusing the `HEAD` -> `GET` fallback of
 * `linkChecker.ts`. A `HEAD` carries no signal this ranged `GET` does not
 * already bring — status, content type and size all arrive in the same
 * response — and the `GET` additionally brings the leading bytes that the
 * dimension read needs, which a `HEAD` could never provide. Issuing both
 * would simply double the load on the audited site, against the stated goal
 * of the phase and against threat T-31-04. The method-rejected fallback is
 * kept but inverted: on 405 or 501 the same `GET` is retried once without the
 * `Range` header. `HEAD` is not used anywhere in this module.
 *
 * Hard constraints of this file, which later plans may not relax:
 * never consume the whole response body at once, never use automatic
 * redirect following, and never leave a timer uncleared.
 */

/** Leading bytes requested per image: enough for the dimension header of every common format. */
export const IMAGE_HEAD_BYTES = 64 * 1024;

/** Hard lifetime of a single probe request, same budget the rest of the network layer uses. */
export const IMAGE_PROBE_TIMEOUT_MS = 5_000;

/** Redirects followed manually before giving up. Each hop is revalidated, never followed blindly. */
export const MAX_REDIRECT_HOPS = 3;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Full result contract of the phase. It does not grow later: 31-02 fills
 * `totalBytes` and `dimensions` by reading the partial body, without changing
 * this type or the signature of `probeImage`.
 */
export type ImageProbeResult =
  | {
      ok: true;
      url: string;
      status: number;
      contentType: string | null;
      totalBytes: number | null;
      dimensions: { width: number; height: number; type?: string } | null;
    }
  | { ok: false; url: string; status: number | null; reason: string };

type FetchOutcome = { kind: "response"; res: Response } | { kind: "error"; reason: string };

/**
 * Issues exactly one ranged (or, on retry, unranged) `GET`.
 *
 * The failure reason belongs to a short vocabulary of our own and is never
 * the message of the thrown error: a network error message is text the
 * destination can influence, and it ends up persisted in an `Issue` row
 * (control V7 / threat T-31-05).
 */
async function requestOnce(url: string, withRange: boolean): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_PROBE_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = withRange
      ? { Range: `bytes=0-${IMAGE_HEAD_BYTES - 1}` }
      : {};
    const res = await fetch(url, {
      method: "GET",
      headers,
      redirect: "manual",
      signal: controller.signal,
    });
    return { kind: "response", res };
  } catch (error) {
    const aborted =
      controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
    return { kind: "error", reason: aborted ? "tiempo agotado" : "sin respuesta" };
  } finally {
    clearTimeout(timeout);
  }
}

/** Probes a single image URL: status, headers and (from 31-02) the leading bytes. */
export async function probeImage(url: string): Promise<ImageProbeResult> {
  let currentUrl = url;

  // Primera de las dos validaciones: la URL inicial, antes de abrir nada.
  const initialVerdict = await assertPublicDestination(currentUrl);
  if (!initialVerdict.ok) {
    return { ok: false, url: currentUrl, status: null, reason: initialVerdict.reason };
  }

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
    const outcome = await requestOnce(currentUrl, true);
    if (outcome.kind === "error") {
      return { ok: false, url: currentUrl, status: null, reason: outcome.reason };
    }

    let res = outcome.res;

    // El servidor rechaza el método o la petición con rango: se reintenta una
    // única vez el mismo GET sin la cabecera de rango. Es la única forma de
    // respaldo por método que esta fase admite.
    if (res.status === 405 || res.status === 501) {
      const retry = await requestOnce(currentUrl, false);
      if (retry.kind === "error") {
        return { ok: false, url: currentUrl, status: null, reason: retry.reason };
      }
      res = retry.res;
    }

    if (REDIRECT_STATUSES.has(res.status)) {
      const location = res.headers.get("location");
      if (!location) {
        return { ok: false, url: currentUrl, status: res.status, reason: `HTTP ${res.status}` };
      }
      let next: string;
      try {
        next = new URL(location, currentUrl).toString();
      } catch {
        return {
          ok: false,
          url: currentUrl,
          status: res.status,
          reason: "redirección no válida",
        };
      }
      // Segunda validación, en CADA salto: validar sólo la URL inicial es el
      // bypass clásico de esta defensa — un destino público que redirige al
      // bucle local.
      const hopVerdict = await assertPublicDestination(next);
      if (!hopVerdict.ok) {
        return { ok: false, url: next, status: null, reason: hopVerdict.reason };
      }

      currentUrl = next;
      continue;
    }

    if (res.status >= 400) {
      return { ok: false, url: currentUrl, status: res.status, reason: `HTTP ${res.status}` };
    }

    const rawContentType = res.headers.get("content-type");
    return {
      ok: true,
      url: currentUrl,
      status: res.status,
      contentType: rawContentType ? rawContentType.toLowerCase().trim() : null,
      // Explícitamente nulos en este plan: 31-02 los llena leyendo el cuerpo
      // por trozos con corte a IMAGE_HEAD_BYTES, sin cambiar esta firma.
      totalBytes: null,
      dimensions: null,
    };
  }

  return { ok: false, url: currentUrl, status: null, reason: "demasiadas redirecciones" };
}

/**
 * Probes every URL with bounded concurrency. This is the only door the check
 * uses; its order guarantee is what lets the caller map `results[i]` back to
 * the image (and therefore the pages) at `urls[i]`.
 */
export async function probeImages(urls: string[]): Promise<ImageProbeResult[]> {
  return mapWithConcurrency(urls, DEFAULT_NETWORK_CONCURRENCY, probeImage);
}
