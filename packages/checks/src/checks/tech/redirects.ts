import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "TECH-06";
const LONG_CHAIN_THRESHOLD = 2;

/** TECH-06: redirect chain detection from Page.redirectChain (populated by the crawler). */
export const redirectsCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page }) {
    const url = page.url;
    const chain = Array.isArray(page.redirectChain) ? (page.redirectChain as unknown[]) : [];

    if (chain.length === 0) {
      return [
        {
          checkId: CHECK_ID,
          category: "tech",
          title: "Sin redirects",
          severity: "ok",
          measuredValue: "0 saltos",
          source: url,
          criterion: "Los enlaces internos deberían apuntar directo a la URL final, sin redirects",
          recommendation: "Sin acción necesaria.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    const hops = chain.length;
    const severity = hops > LONG_CHAIN_THRESHOLD ? "critical" : "warning";

    return [
      {
        checkId: CHECK_ID,
        category: "tech",
        title: hops > LONG_CHAIN_THRESHOLD ? "Cadena de redirects larga" : "Redirect detectado",
        severity,
        measuredValue: `${hops} salto(s): ${url} -> ${page.finalUrl ?? "?"}`,
        source: url,
        criterion: `Se recomienda evitar cadenas de más de ${LONG_CHAIN_THRESHOLD} redirects`,
        recommendation:
          "Actualiza los enlaces internos para que apunten directo a la URL final y elimina saltos intermedios innecesarios.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
