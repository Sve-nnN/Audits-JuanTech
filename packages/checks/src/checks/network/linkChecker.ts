import { mapWithConcurrency, DEFAULT_NETWORK_CONCURRENCY } from "./concurrency";
import { assertPublicDestination } from "./ssrfGuard";

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

/** HEAD request with GET fallback (some servers reject/misreport HEAD). */
async function checkOne(url: string): Promise<LinkCheckResult> {
  // Deuda conocida, no olvido (amenaza T-31-02): esta validación cubre el
  // destino inicial y no cada salto, porque el fetch de abajo sigue con el modo
  // de redirección automático que TECH-12 y TECH-13 usan hoy en producción.
  // Cerrar también los saltos exige el bucle manual de redirecciones que
  // `imageProbe.ts` ya tiene, y eso es reescribir el transporte de dos checks
  // en producción: queda para la fase que toque la capa de red.
  //
  // Va fuera del bucle de métodos a propósito: la URL es la misma en los dos
  // intentos y resolverla dos veces duplica la consulta al sistema de nombres
  // sin aportar nada.
  const verdict = await assertPublicDestination(url);
  if (!verdict.ok) {
    return { url, ok: false, status: null, reason: UNVERIFIABLE_DESTINATION_REASON };
  }

  for (const method of ["HEAD", "GET"] as const) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { method, signal: controller.signal, redirect: "follow" });
      clearTimeout(timeout);
      if (res.status >= 400) {
        if (method === "HEAD") continue; // retry with GET before giving up
        return { url, ok: false, status: res.status, reason: `HTTP ${res.status}` };
      }
      return { url, ok: true, status: res.status };
    } catch (error) {
      clearTimeout(timeout);
      if (method === "HEAD") continue;
      const message = error instanceof Error ? error.message : "unknown error";
      return { url, ok: false, status: null, reason: message };
    }
  }
  return { url, ok: false, status: null, reason: "unreachable" };
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
