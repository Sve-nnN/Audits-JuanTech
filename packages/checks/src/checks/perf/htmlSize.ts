import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "PERF-11";
const WARN_BYTES = 100 * 1024;
const CRITICAL_BYTES = 300 * 1024;

const CRITERION = `Máximo recomendado: ${WARN_BYTES / 1024} KB (advertencia) y ${CRITICAL_BYTES / 1024} KB (crítico). La medición corresponde al documento HTML sin comprimir: las herramientas del navegador muestran el tamaño transferido, que suele ser varias veces menor porque el servidor lo envía comprimido.`;

/** PERF-11: peso del documento HTML por página, medido sin comprimir. */
export const htmlSizeCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page }) {
    // Dato ausente: no se emite ningún issue. Este caso NO es alcanzable vía
    // `runAllChecks`, que filtra con `if (!page.html) continue` antes de correr
    // cualquier PageCheck, así que las páginas fallidas (las únicas sin
    // `htmlBytes`) nunca llegan hasta acá. El guard existe para auditorías
    // anteriores a esta fase que se reprocesen: sus filas `Page` tienen HTML
    // pero la métrica en NULL porque no hubo backfill. No es código muerto.
    if (page.htmlBytes == null) return [];

    const url = page.finalUrl ?? page.url;
    const bytes = page.htmlBytes;
    // Comparación estrictamente mayor: el valor límite exacto cuenta como el
    // escalón inferior (100 KB es "ok", 300 KB es "warning").
    const severity = bytes > CRITICAL_BYTES ? "critical" : bytes > WARN_BYTES ? "warning" : "ok";
    const isProblem = severity !== "ok";
    // Se redondea a KB, nunca se trunca: el reporte declara sus umbrales en KB
    // y un truncamiento haría que 100.5 KB se lea como el límite exacto.
    const kb = Math.round(bytes / 1024);

    return [
      {
        checkId: CHECK_ID,
        category: "perf",
        title: isProblem ? "Documento HTML pesado" : "Tamaño de HTML correcto",
        severity,
        measuredValue: `${kb} KB`,
        source: url,
        criterion: CRITERION,
        recommendation: isProblem
          ? "Reduce el peso del documento: mueve el CSS y el JavaScript en línea a archivos externos, elimina marcado duplicado y limita el contenido embebido (JSON de estado, SVG en línea). La medición es sobre el HTML sin comprimir, así que activar compresión en el servidor no cambia este valor."
          : "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
