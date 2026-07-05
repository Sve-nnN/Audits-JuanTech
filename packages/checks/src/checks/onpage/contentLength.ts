import type { PageCheck } from "../../types";
import { extractVisibleText, pageFingerprint, wordCount } from "../../util";

const CHECK_ID = "ONPAGE-06";
const MIN_WORDS = 300;

/** ONPAGE-06: content length (visible body word count). */
export const contentLengthCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const text = extractVisibleText($);
    const words = wordCount(text);

    if (words < MIN_WORDS) {
      return [
        {
          checkId: CHECK_ID,
          category: "onpage",
          title: "Contenido escaso",
          severity: words < MIN_WORDS / 2 ? "critical" : "warning",
          measuredValue: `${words} palabras`,
          source: url,
          criterion: `Mínimo recomendado: ${MIN_WORDS} palabras`,
          recommendation:
            "Amplía el contenido de la página con información relevante y original para el usuario; el contenido delgado suele posicionar peor.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "onpage",
        title: "Longitud de contenido correcta",
        severity: "ok",
        measuredValue: `${words} palabras`,
        source: url,
        criterion: `Mínimo recomendado: ${MIN_WORDS} palabras`,
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
