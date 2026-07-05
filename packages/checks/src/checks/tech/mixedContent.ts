import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "TECH-11";

const RESOURCE_SELECTORS: { selector: string; attr: string }[] = [
  { selector: "img[src]", attr: "src" },
  { selector: "script[src]", attr: "src" },
  { selector: 'link[rel="stylesheet"][href]', attr: "href" },
  { selector: "iframe[src]", attr: "src" },
];

/** TECH-11: mixed content — http:// resources referenced from an https:// page. */
export const mixedContentCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;

    if (!url.startsWith("https://")) {
      return [
        {
          checkId: CHECK_ID,
          category: "tech",
          title: "Página no servida por HTTPS",
          severity: "ok",
          measuredValue: "página http, mixed content no aplica",
          source: url,
          criterion: "Mixed content sólo aplica a páginas servidas por HTTPS",
          recommendation: "Sin acción necesaria (revisar por separado la migración a HTTPS si corresponde).",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    const insecure = new Set<string>();
    for (const { selector, attr } of RESOURCE_SELECTORS) {
      $(selector).each((_i, el) => {
        const value = $(el).attr(attr);
        if (value && value.trim().toLowerCase().startsWith("http://")) {
          insecure.add(value.trim());
        }
      });
    }

    if (insecure.size > 0) {
      return [
        {
          checkId: CHECK_ID,
          category: "tech",
          title: "Mixed content detectado",
          severity: "critical",
          measuredValue: `${insecure.size} recurso(s) http:// en página https`,
          source: url,
          criterion: "Toda página https debe cargar sus recursos por https",
          recommendation: "Actualiza las referencias a recursos (imágenes, scripts, CSS, iframes) para que usen https:// en lugar de http://.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "tech",
        title: "Sin mixed content",
        severity: "ok",
        measuredValue: "0 recursos http:// detectados",
        source: url,
        criterion: "Toda página https debe cargar sus recursos por https",
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
