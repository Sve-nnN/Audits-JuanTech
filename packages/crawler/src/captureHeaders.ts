/**
 * Captura de fingerprinting a partir de los headers ya disponibles en el
 * `requestHandler` del crawler (Phase 25, FPRINT-01). No agrega requests: sólo
 * cura/normaliza lo que la respuesta ya trae.
 *
 * Reglas duras:
 * - `curateHeaders` itera SOLO sobre el allowlist `CURATED_HEADER_KEYS`, nunca
 *   sobre las keys del objeto entrante (controladas por el sitio auditado) —
 *   previene prototype pollution y evita persistir headers sensibles (T-25-02/03).
 * - `parseCookieNames` extrae únicamente NOMBRES de cookie, nunca valores,
 *   expiry, domain ni flags — evita almacenar tokens de sitios auditados (T-25-01).
 */

/**
 * Lista curada de headers relevantes a fingerprinting (server, CDN, framework).
 * Keys en minúscula: `response.headers` de got-scraping las normaliza así.
 */
export const CURATED_HEADER_KEYS = [
  "server",
  "x-powered-by",
  "via",
  "x-generator",
  "cf-ray",
  "cf-cache-status",
  "x-served-by",
  "x-cache",
  "x-akamai-transformed",
  "x-amz-cf-id",
  "x-amz-cf-pop",
  "x-drupal-cache",
  "x-drupal-dynamic-cache",
  "x-shopify-stage",
  "x-sorting-hat-shopid",
  "x-shardid",
  "x-wix-request-id",
  "x-hs-hub-id",
  "link",
  "x-nextjs-cache",
] as const;

export type CuratedHeaderKey = (typeof CURATED_HEADER_KEYS)[number];

/**
 * Devuelve un objeto con SOLO las keys del allowlist presentes en `headers`,
 * uniendo valores repetidos (array) con ", " y omitiendo ausentes/undefined.
 */
export function curateHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of CURATED_HEADER_KEYS) {
    const v = headers[key];
    if (v == null) continue;
    out[key] = Array.isArray(v) ? v.join(", ") : v;
  }
  return out;
}

/**
 * Parsea los NOMBRES de cookie de un header Set-Cookie (string único o string[]).
 * Nunca devuelve valores ni atributos. Deduplica dentro de la misma página.
 */
export function parseCookieNames(setCookie: string | string[] | undefined): string[] {
  if (!setCookie) return [];
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  const names = arr
    .map((c) => {
      const firstPair = c.split(";")[0] ?? "";
      const name = firstPair.split("=")[0] ?? "";
      return name.trim();
    })
    .filter(Boolean);
  return Array.from(new Set(names));
}
