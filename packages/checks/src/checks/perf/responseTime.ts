import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "PERF-10";
const WARN_MS = 600;
const CRITICAL_MS = 1500;

const CRITERION = `Máximo recomendado: ${WARN_MS} ms (advertencia) y ${CRITICAL_MS} ms (crítico). Medición tomada durante el rastreo desde nuestro servidor: no es un tiempo de usuario real ni un dato de campo.`;

/** PERF-10: tiempo de respuesta del servidor por página, medido durante el rastreo. */
export const responseTimeCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page }) {
    // Dato ausente: no se emite ningún issue. Este caso NO es alcanzable vía
    // `runAllChecks`, que filtra con `if (!page.html) continue` antes de correr
    // cualquier PageCheck, así que las páginas fallidas (las únicas sin
    // `responseMs`) nunca llegan hasta acá. El guard existe para auditorías
    // anteriores a esta fase que se reprocesen: sus filas `Page` tienen HTML
    // pero `responseMs` en NULL porque no hubo backfill. No es código muerto.
    if (page.responseMs == null) return [];

    const url = page.finalUrl ?? page.url;
    const ms = page.responseMs;
    // Comparación estrictamente mayor: el valor límite exacto cuenta como el
    // escalón inferior (600 ms es "ok", 1500 ms es "warning").
    const severity = ms > CRITICAL_MS ? "critical" : ms > WARN_MS ? "warning" : "ok";
    const isProblem = severity !== "ok";

    return [
      {
        checkId: CHECK_ID,
        category: "perf",
        title: isProblem ? "Tiempo de respuesta alto" : "Tiempo de respuesta correcto",
        severity,
        measuredValue: `${ms} ms`,
        source: url,
        criterion: CRITERION,
        recommendation: isProblem
          ? "Reduce el tiempo de respuesta del servidor: activa caché de página, revisa las consultas lentas a la base de datos y sirve la página desde una CDN cercana al usuario."
          : "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
