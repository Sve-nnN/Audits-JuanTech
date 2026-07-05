import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "ONPAGE-04";

/** ONPAGE-04: alt text coverage on <img> elements. */
export const altTextCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const images = $("img").toArray();

    if (images.length === 0) {
      return [
        {
          checkId: CHECK_ID,
          category: "onpage",
          title: "Sin imágenes en la página",
          severity: "ok",
          measuredValue: "0 imágenes",
          source: url,
          criterion: "Toda imagen de contenido debe tener alt descriptivo",
          recommendation: "Sin acción necesaria.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    const missing = images.filter((el) => {
      const alt = $(el).attr("alt");
      return alt === undefined || alt.trim() === "";
    });

    const coverage = Math.round(((images.length - missing.length) / images.length) * 100);

    if (missing.length > 0) {
      return [
        {
          checkId: CHECK_ID,
          category: "onpage",
          title: "Imágenes sin alt text",
          severity: coverage < 50 ? "critical" : "warning",
          measuredValue: `${missing.length}/${images.length} imágenes sin alt (${coverage}% cobertura)`,
          source: url,
          criterion: "Toda imagen de contenido debe tener alt descriptivo",
          recommendation:
            "Agrega texto alternativo descriptivo a las imágenes que faltan, para accesibilidad y para que los buscadores entiendan su contenido.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "onpage",
        title: "Alt text completo",
        severity: "ok",
        measuredValue: `${images.length}/${images.length} imágenes con alt (100% cobertura)`,
        source: url,
        criterion: "Toda imagen de contenido debe tener alt descriptivo",
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
