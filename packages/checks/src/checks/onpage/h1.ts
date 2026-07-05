import type { IssueDraft, PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "ONPAGE-03";

/** ONPAGE-03: H1 presence and uniqueness (exactly one H1 per page). */
export const h1Check: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const h1s = $("h1")
      .map((_i, el) => $(el).text().trim())
      .get()
      .filter(Boolean);

    if (h1s.length === 0) {
      return [
        {
          checkId: CHECK_ID,
          category: "onpage",
          title: "Falta la etiqueta H1",
          severity: "critical",
          measuredValue: "0 H1",
          source: url,
          criterion: "Toda página debe tener exactamente un H1 con el tema principal",
          recommendation: "Agrega un único H1 que describa el tema principal de la página.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    const issues: IssueDraft[] = [];

    if (h1s.length > 1) {
      issues.push({
        checkId: CHECK_ID,
        category: "onpage",
        title: "Más de un H1 en la página",
        severity: "warning",
        measuredValue: `${h1s.length} H1`,
        source: url,
        criterion: "Toda página debe tener exactamente un H1",
        recommendation: "Deja un único H1 con el tema principal y convierte los demás en H2/H3 según la jerarquía del contenido.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      });
    } else {
      issues.push({
        checkId: CHECK_ID,
        category: "onpage",
        title: "H1 correcto",
        severity: "ok",
        measuredValue: h1s[0],
        source: url,
        criterion: "Toda página debe tener exactamente un H1",
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      });
    }

    return issues;
  },
};
