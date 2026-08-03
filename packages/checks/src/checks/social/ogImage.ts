import { extractMetaSocial, firstValue, MAX_MEASURED_VALUE_CHARS } from "@auditor/meta-social";
import { normalizeUrl } from "@auditor/crawler";
import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "SOCIAL-03";

const CRITERION =
  "Toda página compartible debe declarar og:image con una URL absoluta en HTTPS para que las plataformas puedan mostrar la imagen de vista previa";

/**
 * Caps any fragment of site-controlled text before it reaches a persisted
 * measured value (mitigation T-30-06). The cap is the category-wide constant
 * declared in the pure engine; this file never declares one of its own.
 */
const cap = (value: string) => value.slice(0, MAX_MEASURED_VALUE_CHARS);

/**
 * SOCIAL-03: og:image presence plus absolute-HTTPS format.
 *
 * The check never opens a network connection: verifying that the image
 * actually exists, how much it weighs or what dimensions it has is Phase 31
 * scope, and the `PageCheck` contract is synchronous.
 */
export const ogImageCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const value = firstValue(extractMetaSocial($), "og:image");

    if (!value) {
      return [
        {
          checkId: CHECK_ID,
          category: "social",
          title: "Falta la etiqueta og:image",
          severity: "critical",
          measuredValue: "sin og:image",
          source: url,
          criterion: CRITERION,
          recommendation:
            "Agrega una etiqueta meta og:image con la URL absoluta y en HTTPS de la imagen que quieres que aparezca al compartir la página.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    // Esta rama va antes de la resolución: un valor sin protocolo resuelve
    // bien contra la página, así que después ya no sería distinguible de una
    // URL absoluta correcta.
    if (value.startsWith("//")) {
      return [
        {
          checkId: CHECK_ID,
          category: "social",
          title: "og:image sin protocolo",
          severity: "critical",
          measuredValue: cap(value),
          source: url,
          criterion: CRITERION,
          recommendation:
            "Escribe la og:image con el protocolo incluido: los rastreadores de redes sociales no resuelven una URL que empieza con doble barra y la vista previa queda sin imagen.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    // La resolución devuelve nulo tanto para lo que no se puede parsear como
    // para todo esquema distinto de http y https, así que es ella la que
    // decide y no una lista propia de esquemas.
    const resolved = normalizeUrl(value, url);

    if (!resolved) {
      return [
        {
          checkId: CHECK_ID,
          category: "social",
          title: "og:image con URL no válida",
          severity: "critical",
          measuredValue: cap(value),
          source: url,
          criterion: CRITERION,
          recommendation:
            "Reemplaza el valor de og:image por una URL absoluta que empiece con https; un esquema distinto de http o https no produce imagen de vista previa.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    // La comparación se hace sobre una copia en minúsculas porque en
    // producción existen esquemas escritos en mayúsculas, y compararlos tal
    // cual clasificaría una URL absoluta válida como relativa.
    const lowered = value.toLowerCase();
    const isAbsolute = lowered.startsWith("http://") || lowered.startsWith("https://");

    if (!isAbsolute) {
      return [
        {
          checkId: CHECK_ID,
          category: "social",
          title: "og:image con URL relativa",
          severity: "critical",
          measuredValue: cap(value),
          source: url,
          criterion: CRITERION,
          recommendation:
            "Convierte la og:image en una URL absoluta con dominio y protocolo: los rastreadores de Facebook y LinkedIn traen la página desde sus propios servidores y no resuelven rutas relativas.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    if (resolved.startsWith("http://")) {
      return [
        {
          checkId: CHECK_ID,
          category: "social",
          title: "og:image sobre HTTP",
          severity: "critical",
          measuredValue: cap(resolved),
          source: url,
          criterion: CRITERION,
          recommendation:
            "Sirve la imagen de og:image sobre HTTPS y actualiza la etiqueta con la URL segura.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "social",
        title: "og:image correcta",
        severity: "ok",
        measuredValue: cap(resolved),
        source: url,
        criterion: CRITERION,
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
