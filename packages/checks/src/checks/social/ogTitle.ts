import { extractMetaSocial, firstValue, OG_TITLE_MIN, OG_TITLE_MAX } from "@auditor/meta-social";
import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "SOCIAL-01";

/** SOCIAL-01: og:title presence and length (10-60 chars) for the social share headline. */
export const ogTitleCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const value = firstValue(extractMetaSocial($), "og:title");

    if (!value) {
      return [
        {
          checkId: CHECK_ID,
          category: "social",
          title: "Falta la etiqueta og:title",
          severity: "critical",
          measuredValue: "sin og:title",
          source: url,
          criterion:
            "Toda página debe declarar og:title para controlar el titular que se muestra al compartirse en redes sociales",
          recommendation:
            "Agrega una etiqueta meta og:title de entre 10 y 60 caracteres con el titular que quieres que aparezca al compartir la página.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    const length = value.length;
    const criterion = `Longitud recomendada para og:title: ${OG_TITLE_MIN}-${OG_TITLE_MAX} caracteres`;

    if (length < OG_TITLE_MIN || length > OG_TITLE_MAX) {
      const tooShort = length < OG_TITLE_MIN;
      return [
        {
          checkId: CHECK_ID,
          category: "social",
          title: tooShort ? "og:title demasiado corto" : "og:title demasiado largo",
          severity: "warning",
          measuredValue: `${length} caracteres`,
          source: url,
          criterion,
          recommendation: tooShort
            ? "Amplía el og:title para que el titular social describa la página, manteniéndolo entre 10 y 60 caracteres."
            : "Acorta el og:title para que no se trunque en el preview de las redes sociales, manteniéndolo entre 10 y 60 caracteres.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "social",
        title: "og:title correcto",
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
