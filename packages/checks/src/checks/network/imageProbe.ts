import { imageSize } from "image-size";
import { mapWithConcurrency, DEFAULT_NETWORK_CONCURRENCY } from "./concurrency";
import {
  isRedirectStatus,
  resolveRedirect,
  MAX_REDIRECT_HOPS,
  REASON_TOO_MANY_REDIRECTS,
} from "./redirects";
import {
  assertPublicDestination,
  pinnedDispatcher,
  REASON_NOT_PUBLIC,
  REASON_UNRESOLVABLE,
} from "./ssrfGuard";

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

/**
 * The failure reasons produced by **our own** destination guard, i.e. the two
 * cases where no HTTP response was ever obtained because we refused to open
 * the connection.
 *
 * It is exported as the contract that lets the check tell "we could not verify
 * this" apart from "it answers badly", without comparing against strings typed
 * by hand in two files. Every other reason of the closed vocabulary — a status
 * of the client or server error families, a timeout, no answer at all, too
 * many redirect hops — means the destination did speak (or refused to), and is
 * classified as unreachable.
 *
 * The type annotation is explicit and not a const assertion on purpose: the
 * caller tests membership of a plain `string` read from a probe result, and a
 * tuple of literals would fail the typecheck on that comparison.
 */
export const UNVERIFIABLE_PROBE_REASONS: readonly string[] = [
  REASON_NOT_PUBLIC,
  REASON_UNRESOLVABLE,
];

/**
 * Reads at most `maxBytes` of the response body, chunk by chunk, and **always
 * cancels the reader**.
 *
 * The cap is a hard count of accumulated bytes; it never trusts that the
 * server honoured the `Range` header, because RFC 7233 explicitly allows a
 * server to ignore it and answer `200` with the whole resource, and plenty of
 * CDNs do exactly that. The cancel in the final branch is the piece that
 * actually closes the connection when the server still had megabytes to send —
 * without it the cap protects nothing at all (threat T-31-03).
 */
export async function readUpTo(res: Response, maxBytes: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(0);

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    // Siempre: tanto si la lectura terminó por agotamiento como si terminó por
    // tope. El error de la propia cancelación se traga para que no enmascare
    // el resultado ya obtenido.
    await reader.cancel().catch(() => {});
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.subarray(0, Math.min(total, maxBytes));
}

/**
 * Accepts a header value only when it is a finite, non-negative integer.
 *
 * Everything else — a value with decimals, negative, in exponential notation
 * beyond the finite range, or plainly not a number — becomes `null`. This is
 * the precision contract of IMG-04 and it is not relaxed: without it a hostile
 * header value propagates all the way into the weight threshold comparison
 * (threat T-31-07).
 */
function toByteCount(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  if (!Number.isInteger(value) || value < 0) return null;
  return value;
}

/**
 * Derives the size of the whole file, which depends on the status.
 *
 * On a `206` the length header describes **the returned fragment**, not the
 * file: the total only appears on the right-hand side of the range header
 * (`bytes 0-65535/1234567`), and an asterisk there means unknown. Confusing
 * the two is a silent defect — every image would measure exactly the fragment
 * size and the weight threshold would never be crossed. When the server
 * exposes neither header (chunked transfer, or a range with unknown total) the
 * answer is `null` and the weight evaluation is skipped for that image: never
 * a full download just to measure the weight.
 */
export function deriveTotalBytes(res: Response): number | null {
  if (res.status === 206) {
    const contentRange = res.headers.get("content-range");
    const declared = contentRange?.split("/")[1]?.trim();
    if (!declared || declared === "*") return null;
    return toByteCount(declared);
  }
  return toByteCount(res.headers.get("content-length"));
}

/**
 * Reads the dimensions out of the fragment that is already in memory, without
 * asking the audited site for a single extra byte.
 *
 * **Never retried with a larger range when the read fails.** Doing so would
 * double the load on the audited site to chase a secondary signal, and the
 * correct outcome of that situation is to declare the dimensions
 * undetermined (threat T-31-06).
 *
 * The library is synchronous and **throws instead of returning null**, with at
 * least three known families of exception: unsupported file type, invalid PNG
 * raised by its own detection, and a JPEG whose dimension marker fell outside
 * the fragment. None of them escapes, and none of their messages is read: that
 * text is influenced by the content the destination serves and carries nothing
 * actionable (control V7 / threat T-31-08).
 */
export function readDimensions(
  head: Uint8Array,
): { width: number; height: number; type?: string } | null {
  if (head.byteLength === 0) return null;

  try {
    const size = imageSize(head);
    if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) return null;
    return { width: size.width, height: size.height, type: size.type };
  } catch {
    return null;
  }
}

type FetchOutcome =
  | { kind: "response"; res: Response; head: Uint8Array }
  | { kind: "error"; reason: string };

/**
 * Issues exactly one ranged (or, on retry, unranged) `GET` and reads its
 * bounded head.
 *
 * The body read lives **inside** the same block that owns the abort timer, so
 * the 5 s budget covers the read too. Clearing the timer as soon as the
 * headers arrive would leave a server that dribbles bytes forever without any
 * time bound, which is the same denial of service the byte cap exists to stop.
 * The cost is reading up to 64 KiB of a body we may end up discarding (a
 * redirect, an error page, a response we are about to retry without the range
 * header) — bounded, and cheaper than a second request.
 *
 * It has its **own** catch, though: the timer firing during the read is not
 * the same event as the request failing. Once the headers are in, the response
 * is evidence and is kept; only the dimensions degrade to undetermined.
 *
 * The failure reason belongs to a short vocabulary of our own and is never
 * the message of the thrown error: a network error message is text the
 * destination can influence, and it ends up persisted in an `Issue` row
 * (control V7 / threat T-31-05).
 */
async function requestOnce(
  url: string,
  withRange: boolean,
  addresses: string[],
): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_PROBE_TIMEOUT_MS);
  // La conexión se abre contra la dirección que la defensa ya clasificó, no
  // contra lo que el sistema de nombres conteste ahora: entre la validación y
  // esta línea el nombre puede haber cambiado de dirección (amenaza T-31-01).
  const dispatcher = pinnedDispatcher(addresses);
  try {
    const headers: Record<string, string> = withRange
      ? { Range: `bytes=0-${IMAGE_HEAD_BYTES - 1}` }
      : {};
    // La aserción existe porque `@types/node` embebe su propia copia de los
    // tipos de undici: en ejecución es el mismo objeto que el transporte
    // espera, pero las dos declaraciones de `Dispatcher` no son asignables
    // entre sí.
    const res = await fetch(url, {
      method: "GET",
      headers,
      redirect: "manual",
      signal: controller.signal,
      dispatcher,
    } as RequestInit);

    // El fallo de la LECTURA no invalida la respuesta. Las cabeceras ya
    // llegaron: status y tipo de contenido son evidencia válida, y perderlos
    // porque un CDN lento gotea los bytes convierte un `200 image/png` en un
    // `critical` de "imagen social inalcanzable" abanicado por página — en un
    // sitio de 500 páginas con una sola og:image, quinientas filas críticas
    // falsas. Lo único que se pierde acá son las dimensiones, que caen en la
    // rama informativa de "dimensiones indeterminadas".
    let head: Uint8Array = new Uint8Array(0);
    try {
      head = await readUpTo(res, IMAGE_HEAD_BYTES);
    } catch {
      head = new Uint8Array(0);
    }
    return { kind: "response", res, head };
  } catch (error) {
    const aborted =
      controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
    return { kind: "error", reason: aborted ? "tiempo agotado" : "sin respuesta" };
  } finally {
    clearTimeout(timeout);
    // El agente es de una sola petición: sin esto queda un socket abierto por
    // cada sondeo, y con 12 en vuelo eso es un descriptor por imagen.
    void dispatcher.destroy().catch(() => {});
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
  let addresses = initialVerdict.addresses;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
    const outcome = await requestOnce(currentUrl, true, addresses);
    if (outcome.kind === "error") {
      return { ok: false, url: currentUrl, status: null, reason: outcome.reason };
    }

    let res = outcome.res;
    let head = outcome.head;

    // El servidor rechaza el método o la petición con rango: se reintenta una
    // única vez el mismo GET sin la cabecera de rango, con el mismo corte de
    // lectura. Es la única forma de respaldo por método que esta fase admite.
    //
    // El 416 entra en la misma rama: un rango que empieza en cero sobre un
    // recurso no vacío siempre es satisfacible, así que ese status no es un
    // resultado esperado, y si aparece la respuesta correcta es pedir lo mismo
    // sin rango, no darlo por roto.
    if (res.status === 405 || res.status === 501 || res.status === 416) {
      const retry = await requestOnce(currentUrl, false, addresses);
      if (retry.kind === "error") {
        return { ok: false, url: currentUrl, status: null, reason: retry.reason };
      }
      res = retry.res;
      head = retry.head;
    }

    if (isRedirectStatus(res.status)) {
      // Segunda validación, en CADA salto: validar sólo la URL inicial es el
      // bypass clásico de esta defensa — un destino público que redirige al
      // bucle local. La decisión vive en `redirects.ts` porque los checks de
      // enlaces y de recursos siguen exactamente el mismo camino.
      const decision = await resolveRedirect(res, currentUrl);
      if (decision.kind === "reject") {
        return { ok: false, url: decision.url, status: decision.status, reason: decision.reason };
      }

      addresses = decision.addresses;
      currentUrl = decision.url;
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
      totalBytes: deriveTotalBytes(res),
      // Las cuatro señales del contrato salen de esta única petición: `head` es
      // el fragmento que ella misma trajo, nunca una segunda descarga.
      dimensions: readDimensions(head),
    };
  }

  return { ok: false, url: currentUrl, status: null, reason: REASON_TOO_MANY_REDIRECTS };
}

/**
 * Probes every URL with bounded concurrency. This is the only door the check
 * uses; its order guarantee is what lets the caller map `results[i]` back to
 * the image (and therefore the pages) at `urls[i]`.
 */
export async function probeImages(urls: string[]): Promise<ImageProbeResult[]> {
  return mapWithConcurrency(urls, DEFAULT_NETWORK_CONCURRENCY, probeImage);
}
