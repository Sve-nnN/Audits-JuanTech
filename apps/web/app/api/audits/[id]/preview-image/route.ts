import { prisma } from "@auditor/db";
import {
  assertPublicDestination,
  pinnedDispatcher,
  resolveRedirect,
  isRedirectStatus,
  readUpTo,
  MAX_REDIRECT_HOPS,
  IMAGE_PROBE_TIMEOUT_MS,
} from "@auditor/checks/network";
import { OG_IMAGE_MAX_BYTES } from "@auditor/meta-social";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

/**
 * Proxy de las imágenes del panel de preview social (PREVIEW-04).
 *
 * Es la ÚNICA puerta por la que una imagen del sitio auditado llega al
 * navegador del lector del reporte: el preview nunca hace hotlink directo
 * (decisión bloqueada en `32-CONTEXT.md`). Eso concentra acá toda la superficie
 * de seguridad de la fase, defendida en dos capas independientes:
 *
 *   1. Allowlist de origin EXACTO contra `audit.resolvedUrl`, antes de
 *      cualquier E/S. Un `?url=` que apunte a otro host ni siquiera llega a
 *      resolverse (T-32-05).
 *   2. La misma guardia de destino de Phase 31 — `assertPublicDestination` +
 *      `pinnedDispatcher` — importada, no reimplementada: resolución del
 *      nombre, clasificación numérica de TODAS sus direcciones y conexión
 *      anclada a las ya clasificadas, que es lo que cierra el rebinding
 *      (T-32-06). Las redirecciones se siguen a mano revalidando cada salto:
 *      el seguimiento automático del transporte resuelve y conecta cada salto
 *      donde nuestra guardia no corre, así que este archivo no lo usa y no
 *      puede empezar a usarlo.
 *
 * Ninguna rama de rechazo dice por qué rechazó: los 400/403/404 salen con
 * cuerpo vacío y sin headers de diagnóstico, así que el status HTTP real del
 * origen, el motivo del veredicto SSRF y la URL interna rechazada nunca cruzan
 * de vuelta (T-32-09).
 */

/**
 * Allowlist cerrado de tipos servibles. El `Content-Type` de la respuesta se
 * re-deriva SIEMPRE contra esta tabla y jamás se reenvía el header crudo del
 * origen: el sitio auditado es hostil por defecto y un `text/html` disfrazado
 * de imagen se ejecutaría en nuestro propio origen (T-32-07).
 */
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const DENIED = () => new Response(null, { status: 403 });
const NOT_FOUND = () => new Response(null, { status: 404 });
const BAD_REQUEST = () => new Response(null, { status: 400 });

/**
 * Normaliza el tipo declarado y lo valida. Los parámetros del header
 * (`; charset=…`, `; boundary=…`) se descartan: lo que se sirve de vuelta es
 * el tipo base de nuestra tabla, no la cadena que escribió el origen.
 */
function allowedContentType(raw: string | null): string | null {
  const base = raw?.split(";")[0]?.toLowerCase().trim();
  if (!base || !ALLOWED_IMAGE_TYPES.has(base)) return null;
  return base;
}

type FetchOutcome =
  | { kind: "image"; contentType: string; body: Uint8Array }
  /** Rechazado por nuestra propia defensa de destino: no se abrió la conexión. */
  | { kind: "denied" }
  /** El destino contestó mal, no contestó, o no sirve una imagen. */
  | { kind: "failed" };

/**
 * Sigue la cadena hasta la respuesta final, revalidando el destino en cada
 * salto.
 *
 * El temporizador de aborto cubre también la lectura del cuerpo, igual que
 * `requestOnce` en el sondeo de Phase 31: limpiarlo al llegar las cabeceras
 * dejaría sin cota de tiempo a un servidor que gotea bytes, que es la misma
 * denegación de servicio que el tope de bytes existe para frenar (T-32-08).
 */
async function fetchImage(startUrl: string, startAddresses: string[]): Promise<FetchOutcome> {
  let currentUrl = startUrl;
  let addresses = startAddresses;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_PROBE_TIMEOUT_MS);
    const dispatcher = pinnedDispatcher(addresses);
    try {
      // La aserción existe porque `@types/node` embebe su propia copia de los
      // tipos de undici: en ejecución es el mismo objeto que el transporte
      // espera, pero las dos declaraciones de `Dispatcher` no son asignables.
      const res = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        dispatcher,
      } as RequestInit);

      if (isRedirectStatus(res.status)) {
        const decision = await resolveRedirect(res, currentUrl);
        if (decision.kind === "reject") return { kind: "denied" };
        addresses = decision.addresses;
        currentUrl = decision.url;
        continue;
      }

      if (res.status >= 400) return { kind: "failed" };

      const contentType = allowedContentType(res.headers.get("content-type"));
      if (!contentType) return { kind: "failed" };

      return { kind: "image", contentType, body: await readUpTo(res, OG_IMAGE_MAX_BYTES) };
    } catch {
      // El texto del error de red lo influye el destino: no se lee ni se
      // propaga, sólo se convierte en el mismo 404 genérico de todo lo demás.
      return { kind: "failed" };
    } finally {
      clearTimeout(timeout);
      void dispatcher.destroy().catch(() => {});
    }
  }

  return { kind: "failed" };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  // Sin la URL resuelta de la auditoría no hay allowlist contra el cual
  // comparar, y sin allowlist este handler sería un proxy abierto.
  const audit = await prisma.audit.findUnique({ where: { id }, select: { resolvedUrl: true } });
  if (!audit?.resolvedUrl) return NOT_FOUND();

  // `new URL(request.url)`, nunca `request.nextUrl`: este repo no usa
  // `NextRequest` en sus route handlers (mismo patrón que `pages/route.ts`).
  const rawUrl = new URL(request.url).searchParams.get("url");
  if (!rawUrl) return BAD_REQUEST();

  let target: URL;
  let auditedOrigin: string;
  try {
    target = new URL(rawUrl);
    auditedOrigin = new URL(audit.resolvedUrl).origin;
  } catch {
    return BAD_REQUEST();
  }

  // Primera capa, antes de cualquier E/S: comparación de origin completo
  // (esquema + host + puerto), nunca de sufijo de host.
  if (target.origin !== auditedOrigin) return DENIED();

  // Segunda capa: la guardia de destino de Phase 31. Un destino que no se pudo
  // verificar se trata igual que uno privado — la conexión no se abre.
  const verdict = await assertPublicDestination(target.toString());
  if (!verdict.ok) return DENIED();

  // WR-02: `fetchImage`'s per-hop loop only wraps the `fetch()` call itself in
  // a `try/catch` — `pinnedDispatcher(addresses)` (called before that inner
  // try) and `dispatcher.destroy()` (in the `finally`) are NOT covered. Nothing
  // in either throws today, but if a future change introduced a throw there,
  // it would propagate out of `fetchImage` uncaught and let Next.js's default
  // error handling take over instead of this route's generic-response
  // contract (T-32-09: no rejection branch may say why it rejected). This
  // top-level catch is defense-in-depth: it guarantees every exception from
  // `fetchImage`, not just `fetch`'s, degrades to the same generic 404.
  let outcome: FetchOutcome;
  try {
    outcome = await fetchImage(target.toString(), verdict.addresses);
  } catch {
    return NOT_FOUND();
  }
  if (outcome.kind === "denied") return DENIED();
  if (outcome.kind === "failed") return NOT_FOUND();

  // `.slice()` desprende la vista de su buffer de respaldo: sin eso el tipo
  // es `Uint8Array<ArrayBufferLike>`, que `BodyInit` no admite, y el resto del
  // buffer del lector viajaría adjunto a la respuesta.
  return new Response(outcome.body.slice().buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": outcome.contentType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
