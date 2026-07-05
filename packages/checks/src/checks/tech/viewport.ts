import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "TECH-07";

/** TECH-07: mobile viewport meta tag presence. */
export const viewportCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const content = $('meta[name="viewport"]').attr("content")?.trim();

    if (!content) {
      return [
        {
          checkId: CHECK_ID,
          category: "tech",
          title: "Falta la etiqueta viewport",
          severity: "critical",
          measuredValue: "sin viewport",
          source: url,
          criterion: 'Toda página debe declarar <meta name="viewport" content="width=device-width, initial-scale=1">',
          recommendation: "Agrega la etiqueta meta viewport para que la página se adapte correctamente a dispositivos móviles.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "tech",
        title: "Viewport correcto",
        severity: "ok",
        measuredValue: content,
        source: url,
        criterion: 'Toda página debe declarar meta viewport',
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
