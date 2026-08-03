import { hasCharsetInFirstKB, CHARSET_WINDOW_BYTES } from "@auditor/meta-social";
import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "SOCIAL-08";

const CRITERION = `El charset debe declararse dentro de los primeros ${CHARSET_WINDOW_BYTES} bytes del documento. Esta auditoría evalúa la declaración escrita en el HTML: un charset enviado únicamente en el header HTTP Content-Type no es visible acá, así que el aviso puede aparecer en un sitio que igualmente esté bien configurado.`;

/** SOCIAL-08: charset declared within the first kilobyte of the raw HTML. */
export const charsetCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page }) {
    const url = page.finalUrl ?? page.url;
    const html = page.html;

    // Dato ausente: no se emite ningún issue. Este caso NO es alcanzable vía
    // `runAllChecks`, que filtra las páginas sin HTML antes de correr cualquier
    // PageCheck. El guard existe porque el check también se invoca directo
    // desde los tests y desde el guardarraíl de 30-06. No es código muerto.
    if (!html) return [];

    if (!hasCharsetInFirstKB(html)) {
      return [
        {
          checkId: CHECK_ID,
          category: "social",
          title: "Falta la declaración de charset al inicio del HTML",
          severity: "warning",
          measuredValue: "sin declaración de charset en el primer KB",
          source: url,
          criterion: CRITERION,
          recommendation:
            "Declara el charset con una etiqueta meta ubicada como primer elemento dentro del head, antes del title y de cualquier script o CSS en línea, para que la declaración quede dentro del primer kilobyte del documento.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "social",
        title: "Charset declarado al inicio del HTML",
        severity: "ok",
        measuredValue: "declarado dentro del primer KB",
        source: url,
        criterion: CRITERION,
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
