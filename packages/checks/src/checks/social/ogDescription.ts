import { extractMetaSocial, firstValue, OG_DESC_MIN, OG_DESC_MAX } from "@auditor/meta-social";
import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "SOCIAL-02";

/** SOCIAL-02: og:description presence and length (55-200 chars) for the social share summary. */
export const ogDescriptionCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const value = firstValue(extractMetaSocial($), "og:description");

    if (!value) {
      return [
        {
          checkId: CHECK_ID,
          category: "social",
          title: "Falta la etiqueta og:description",
          severity: "warning",
          measuredValue: "sin og:description",
          source: url,
          criterion:
            "Toda página debe declarar og:description para controlar el texto de apoyo que acompaña al titular cuando la página se comparte en redes sociales",
          recommendation:
            "Agrega una etiqueta meta og:description de entre 55 y 200 caracteres que resuma el contenido de la página para quien la vea compartida.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    const length = value.length;
    const criterion = `Longitud recomendada para og:description: ${OG_DESC_MIN}-${OG_DESC_MAX} caracteres`;

    if (length < OG_DESC_MIN || length > OG_DESC_MAX) {
      const tooShort = length < OG_DESC_MIN;
      return [
        {
          checkId: CHECK_ID,
          category: "social",
          title: tooShort ? "og:description demasiado corta" : "og:description demasiado larga",
          severity: "warning",
          measuredValue: `${length} caracteres`,
          source: url,
          criterion,
          recommendation: tooShort
            ? "Amplía la og:description para que el resumen social describa la página, manteniéndola entre 55 y 200 caracteres."
            : "Acorta la og:description para que no se trunque en el preview de las redes sociales, manteniéndola entre 55 y 200 caracteres.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "social",
        title: "og:description correcta",
        severity: "ok",
        measuredValue: `${length} caracteres`,
        source: url,
        criterion,
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
