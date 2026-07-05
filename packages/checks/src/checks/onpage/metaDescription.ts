import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "ONPAGE-02";
const MIN_LENGTH = 70;
const MAX_LENGTH = 160;

/** ONPAGE-02: meta description presence, length (70-160 chars) and basic quality. */
export const metaDescriptionCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const content = $('meta[name="description"]').first().attr("content")?.trim() ?? "";
    const url = page.finalUrl ?? page.url;

    if (!content) {
      return [
        {
          checkId: CHECK_ID,
          category: "onpage",
          title: "Falta la meta description",
          severity: "warning",
          measuredValue: "sin meta description",
          source: url,
          criterion: "Toda página indexable debería tener meta description (70-160 caracteres)",
          recommendation:
            "Agrega una meta description de entre 70 y 160 caracteres que resuma el contenido de la página e invite al clic desde resultados de búsqueda.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    const length = content.length;
    if (length < MIN_LENGTH || length > MAX_LENGTH) {
      const tooShort = length < MIN_LENGTH;
      return [
        {
          checkId: CHECK_ID,
          category: "onpage",
          title: tooShort ? "Meta description demasiado corta" : "Meta description demasiado larga",
          severity: "warning",
          measuredValue: `${length} caracteres`,
          source: url,
          criterion: `Longitud recomendada: ${MIN_LENGTH}-${MAX_LENGTH} caracteres`,
          recommendation: tooShort
            ? "Amplía la meta description para describir mejor el contenido, manteniéndola entre 70 y 160 caracteres."
            : "Acorta la meta description para que no se corte en los resultados de búsqueda, manteniéndola entre 70 y 160 caracteres.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "onpage",
        title: "Meta description correcta",
        severity: "ok",
        measuredValue: `${length} caracteres`,
        source: url,
        criterion: `Longitud recomendada: ${MIN_LENGTH}-${MAX_LENGTH} caracteres`,
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
