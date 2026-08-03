import { extractMetaSocial, firstValue, MAX_MEASURED_VALUE_CHARS } from "@auditor/meta-social";
import { normalizeUrl } from "@auditor/crawler";
import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "SOCIAL-04";

const CRITERION =
  "og:url y la etiqueta canonical deben apuntar a la misma URL; cuando la página no declara canonical, la referencia es la URL de la propia página";

/**
 * Caps any fragment of site-controlled text before it reaches a persisted
 * measured value (mitigation T-30-06). Each half of a comparative value is
 * capped on its own, so a hostile value never eats the half that explains
 * the finding.
 */
const cap = (value: string) => value.slice(0, MAX_MEASURED_VALUE_CHARS);

/**
 * SOCIAL-04: og:url presence plus consistency with the canonical re-read
 * from the context's query object.
 *
 * The canonical is re-read here on purpose: checks share no state, the
 * context carries only the page and the query object, and depending on
 * TECH-04's output would make this verdict conditional on another check
 * having run. The comparison goes through the same normalization TECH-04
 * uses, so the report cannot carry two opposite verdicts about one page.
 *
 * Deliberate scope: this check demands consistency, not absolute format. An
 * og:url written as a relative path that resolves to the reference passes.
 */
export const ogUrlCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const value = firstValue(extractMetaSocial($), "og:url");

    if (!value) {
      return [
        {
          checkId: CHECK_ID,
          category: "social",
          title: "Falta la etiqueta og:url",
          severity: "warning",
          measuredValue: "sin og:url",
          source: url,
          criterion: CRITERION,
          recommendation:
            "Agrega una etiqueta meta og:url con la misma URL que declara la etiqueta canonical de la página.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    // Esta rama va antes de cualquier comparación: un esquema que la
    // normalización rechaza no tiene nada que comparar contra la referencia.
    const normalized = normalizeUrl(value, url);

    if (!normalized) {
      return [
        {
          checkId: CHECK_ID,
          category: "social",
          title: "og:url con URL no válida",
          severity: "warning",
          measuredValue: cap(value),
          source: url,
          criterion: CRITERION,
          recommendation:
            "Reemplaza el valor de og:url por una URL absoluta que empiece con http o https.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    // La canonical se relee del documento, sin importar nada de la carpeta
    // tech y sin asumir que TECH-04 haya corrido. El fallback al propio
    // valor crudo evita que una canonical rota arrastre este check a una
    // excepción o a un falso correcto.
    const canonicalHref = $('link[rel="canonical"]').first().attr("href")?.trim();
    const referenceRaw = canonicalHref || url;
    const reference = normalizeUrl(referenceRaw, url) ?? referenceRaw;

    if (normalized !== reference) {
      return [
        {
          checkId: CHECK_ID,
          category: "social",
          title: "og:url no coincide con la canonical",
          severity: "warning",
          measuredValue: `${cap(normalized)} (canonical: ${cap(reference)})`,
          source: url,
          criterion: CRITERION,
          recommendation:
            "Alinea la og:url con la URL que declara la etiqueta canonical; si la canonical es la correcta, copia ese mismo valor en og:url.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "social",
        title: "og:url correcta",
        severity: "ok",
        measuredValue: cap(normalized),
        source: url,
        criterion: CRITERION,
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
