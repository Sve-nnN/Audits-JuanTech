import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";
import { normalizeUrl } from "@auditor/crawler";

const CHECK_ID = "TECH-04";

/** TECH-04: canonical tag presence, single occurrence, and self-consistency. */
export const canonicalCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const canonicalTags = $('link[rel="canonical"]');

    if (canonicalTags.length === 0) {
      return [
        {
          checkId: CHECK_ID,
          category: "tech",
          title: "Falta etiqueta canonical",
          severity: "warning",
          measuredValue: "sin canonical",
          source: url,
          criterion: "Toda página indexable debe declarar su URL canonical",
          recommendation: 'Agrega <link rel="canonical" href="..."> apuntando a la URL preferida de esta página.',
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    if (canonicalTags.length > 1) {
      return [
        {
          checkId: CHECK_ID,
          category: "tech",
          title: "Múltiples etiquetas canonical",
          severity: "warning",
          measuredValue: `${canonicalTags.length} etiquetas canonical`,
          source: url,
          criterion: "Debe existir una única etiqueta canonical por página",
          recommendation: "Deja una sola etiqueta canonical por página; múltiples declaraciones generan señales contradictorias.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    const href = canonicalTags.first().attr("href")?.trim();
    if (!href) {
      return [
        {
          checkId: CHECK_ID,
          category: "tech",
          title: "Etiqueta canonical vacía",
          severity: "warning",
          measuredValue: "canonical sin href",
          source: url,
          criterion: "La etiqueta canonical debe tener un href válido",
          recommendation: "Completa el atributo href de la etiqueta canonical con la URL absoluta de esta página.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    const canonicalUrl = normalizeUrl(href, url) ?? href;
    const selfUrl = normalizeUrl(url) ?? url;

    if (canonicalUrl !== selfUrl) {
      return [
        {
          checkId: CHECK_ID,
          category: "tech",
          title: "Canonical apunta a otra URL",
          severity: "warning",
          measuredValue: canonicalUrl,
          source: url,
          criterion: "La canonical debería auto-referenciar la página salvo que exista una duplicación intencional",
          recommendation:
            "Confirma si esta página debe ser canonical de sí misma o si realmente es un duplicado de la URL declarada; si es un error, corrige el href.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "tech",
        title: "Canonical correcta",
        severity: "ok",
        measuredValue: canonicalUrl,
        source: url,
        criterion: "La canonical debería auto-referenciar la página salvo duplicación intencional",
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
