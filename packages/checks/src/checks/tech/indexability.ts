import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "TECH-05";

/**
 * TECH-05: indexability via meta robots noindex.
 *
 * Note: we only inspect the <meta name="robots"> tag in the parsed HTML.
 * The X-Robots-Tag HTTP header is not currently persisted on `Page` (Phase 2
 * only stores statusCode/contentType/html), so header-based noindex is not
 * detected yet — documented as a known limitation in the plan summary.
 */
export const indexabilityCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const robotsMeta = $('meta[name="robots"]').attr("content")?.toLowerCase() ?? "";
    const isNoindex = /noindex/.test(robotsMeta);

    if (isNoindex) {
      return [
        {
          checkId: CHECK_ID,
          category: "tech",
          title: "Página marcada como noindex",
          severity: "warning",
          measuredValue: robotsMeta || "noindex",
          source: url,
          criterion: "Las páginas que deben posicionar no deben tener noindex",
          recommendation:
            "Verifica si el noindex es intencional. Si esta página debería aparecer en buscadores, elimina la directiva noindex del meta robots.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "tech",
        title: "Página indexable",
        severity: "ok",
        measuredValue: robotsMeta || "sin meta robots (indexable por defecto)",
        source: url,
        criterion: "Las páginas que deben posicionar no deben tener noindex",
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
