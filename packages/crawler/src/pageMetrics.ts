/**
 * Captura de métricas de performance por página a partir de la respuesta ya
 * disponible en el `requestHandler` del crawler (Phase 28, PAGEPERF-01/02).
 * No agrega requests: ambas métricas se derivan del request que el crawler ya
 * hizo (los timings que got adjunta a la respuesta y el string HTML que ya
 * está en memoria).
 *
 * Reglas duras:
 * - `responseMs` sale de `timings.phases.total`, que INCLUYE la fase `wait`
 *   (adquisición de socket) generada por nuestro propio `maxConcurrency` en
 *   `crawl.ts` — no es tiempo atribuible sólo al sitio auditado. Decisión
 *   lockeada en el CONTEXT de la fase; si se recalibra, `phases.firstByte`
 *   (o `total - wait`) es un cambio de una sola línea, aislado acá a propósito.
 * - `htmlBytes` mide el HTML DESCOMPRIMIDO, entre 4x y 8x mayor que lo que
 *   viaja por la red, porque got descomprime la respuesta y elimina
 *   `content-encoding`/`content-length` antes de que llegue al handler. Se
 *   cuenta con `Buffer.byteLength` (bytes UTF-8), nunca con `html.length`,
 *   que cuenta unidades UTF-16.
 * - Ausencia de dato devuelve `null` en el campo correspondiente, nunca lanza:
 *   las páginas fallidas ni siquiera pasan por acá y quedan en `null` por
 *   ausencia. `html` vacío vale `0` bytes, que es un valor legítimo (guard
 *   `== null`, no falsy).
 * - El `PlainResponse` de Crawlee (`Omit<HttpResponse, 'body'> & IncomingMessage`)
 *   NO declara `timings` a nivel de tipo, aunque got-scraping sí lo adjunta en
 *   runtime. Por eso el parámetro se tipa laxo con `TimedResponse` y el call
 *   site castea, mismo precedente que `redirectUrls` en `crawl.ts`. Si Crawlee
 *   llegara a tipar `timings`, el cast se puede quitar sin tocar el helper.
 */

/** Métricas de performance derivadas de una única respuesta de crawl. */
export interface PageMetrics {
  /** Tiempo total del request en milisegundos; `null` si la respuesta no trae timings. */
  responseMs: number | null;
  /** Tamaño del HTML sin comprimir en bytes UTF-8; `null` si no hubo cuerpo. */
  htmlBytes: number | null;
}

/**
 * Forma mínima que este helper lee de la respuesta de got. Se tipa de forma
 * laxa (todo opcional) porque es lo que realmente llega al `requestHandler`:
 * `response` puede faltar entero y `phases.total` es `number | undefined`.
 */
export interface TimedResponse {
  timings?: {
    phases?: {
      total?: number;
    };
  };
}

/**
 * Deriva `{ responseMs, htmlBytes }` de la respuesta y el HTML que el
 * `requestHandler` ya tiene en memoria. Cero requests adicionales.
 */
export function extractPageMetrics(
  response: TimedResponse | undefined,
  html: string | undefined,
): PageMetrics {
  const responseMs = response?.timings?.phases?.total ?? null;
  const htmlBytes = html == null ? null : Buffer.byteLength(html, "utf-8");
  return { responseMs, htmlBytes };
}
