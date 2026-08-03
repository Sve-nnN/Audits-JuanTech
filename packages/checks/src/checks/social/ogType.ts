import { extractMetaSocial, firstValue, MAX_MEASURED_VALUE_CHARS } from "@auditor/meta-social";
import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "SOCIAL-05";

const CRITERION =
  "Toda página debe declarar og:type para indicar a las redes sociales qué clase de contenido está compartiendo. Esta auditoría verifica la presencia de la etiqueta, no el valor declarado";

/** SOCIAL-05: og:type presence only — the declared value is never validated against a fixed vocabulary. */
export const ogTypeCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const value = firstValue(extractMetaSocial($), "og:type");

    if (!value) {
      return [
        {
          checkId: CHECK_ID,
          category: "social",
          title: "Falta la etiqueta og:type",
          severity: "warning",
          measuredValue: "sin og:type",
          source: url,
          criterion: CRITERION,
          recommendation:
            "Agrega una etiqueta meta og:type que declare la clase de contenido de la página.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    // El valor lo controla por completo el sitio auditado, se persiste como
    // texto en la fila Issue y Phase 32 lo pinta en el panel de preview, así
    // que se acota al tope compartido de la categoría (mitigación T-30-06).
    return [
      {
        checkId: CHECK_ID,
        category: "social",
        title: "og:type correcto",
        severity: "ok",
        measuredValue: value.slice(0, MAX_MEASURED_VALUE_CHARS),
        source: url,
        criterion: CRITERION,
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
