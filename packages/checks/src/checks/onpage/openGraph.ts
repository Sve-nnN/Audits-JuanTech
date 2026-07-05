import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "ONPAGE-05";
const REQUIRED_TAGS = ["og:title", "og:description", "og:image", "og:url"];

/** ONPAGE-05: presence of core Open Graph tags. */
export const openGraphCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const present = new Set(
      $("meta[property]")
        .map((_i, el) => $(el).attr("property"))
        .get()
        .filter((p): p is string => Boolean(p))
    );

    const missing = REQUIRED_TAGS.filter((tag) => !present.has(tag));

    if (missing.length === REQUIRED_TAGS.length) {
      return [
        {
          checkId: CHECK_ID,
          category: "onpage",
          title: "Sin etiquetas Open Graph",
          severity: "warning",
          measuredValue: "0/4 etiquetas OG",
          source: url,
          criterion: `Etiquetas esperadas: ${REQUIRED_TAGS.join(", ")}`,
          recommendation:
            "Agrega las etiquetas Open Graph básicas (og:title, og:description, og:image, og:url) para controlar cómo se ve la página al compartirla en redes sociales.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    if (missing.length > 0) {
      return [
        {
          checkId: CHECK_ID,
          category: "onpage",
          title: "Faltan etiquetas Open Graph",
          severity: "warning",
          measuredValue: `${REQUIRED_TAGS.length - missing.length}/${REQUIRED_TAGS.length} etiquetas OG (faltan: ${missing.join(", ")})`,
          source: url,
          criterion: `Etiquetas esperadas: ${REQUIRED_TAGS.join(", ")}`,
          recommendation: `Agrega las etiquetas Open Graph faltantes (${missing.join(", ")}) para un preview completo al compartir la página.`,
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "onpage",
        title: "Open Graph completo",
        severity: "ok",
        measuredValue: `${REQUIRED_TAGS.length}/${REQUIRED_TAGS.length} etiquetas OG`,
        source: url,
        criterion: `Etiquetas esperadas: ${REQUIRED_TAGS.join(", ")}`,
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
