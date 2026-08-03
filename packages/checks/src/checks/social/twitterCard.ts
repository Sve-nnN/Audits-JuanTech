import {
  extractMetaSocial,
  firstValue,
  MAX_MEASURED_VALUE_CHARS,
  TWITTER_CARD_VALUES,
} from "@auditor/meta-social";
import type { IssueDraft, PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "SOCIAL-07";

const CARD_CRITERION = `twitter:card debe declararse con uno de los valores admitidos: ${TWITTER_CARD_VALUES.join(", ")}`;

const CARD_RECOMMENDATION =
  "Declara la etiqueta twitter:card con uno de los valores admitidos; para páginas de contenido el habitual es summary_large_image.";

/**
 * Caps any fragment of site-controlled text before it reaches a persisted
 * measured value (mitigation T-30-06). The cap is the category-wide constant
 * declared in the pure engine; this file never declares one of its own.
 */
const cap = (value: string) => value.slice(0, MAX_MEASURED_VALUE_CHARS);

/**
 * Los tres campos secundarios cuya clave del vocabulario de X coincide con la
 * de Open Graph por simple concatenación de prefijo. El subtipo va literal y
 * no compuesto porque es un valor persistido: se lee tal cual en el diff entre
 * auditorías y conviene poder encontrarlo por búsqueda de texto.
 */
const FALLBACK_FIELDS = [
  { field: "title", subtype: "missing-title" },
  { field: "description", subtype: "missing-description" },
  { field: "image", subtype: "missing-image" },
] as const;

/** SOCIAL-07: twitter:card validity plus the Open Graph fallback rule for the secondary fields. */
export const twitterCardCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const data = extractMetaSocial($);

    const issues: IssueDraft[] = [];
    const push = (
      subtype: string,
      title: string,
      criterion: string,
      recommendation: string,
      measuredValue?: string,
    ) => {
      issues.push({
        checkId: CHECK_ID,
        category: "social",
        title,
        severity: "warning",
        measuredValue,
        source: url,
        criterion,
        recommendation,
        fingerprint: pageFingerprint(`${CHECK_ID}:${subtype}`, url),
        pageId: page.id,
      });
    };

    // La tarjeta se evalúa siempre, tenga o no la página etiquetas de Open
    // Graph: es el único campo del vocabulario de X sin equivalente al que
    // hacer fallback, así que este check no tiene rama de no aplicabilidad.
    const card = firstValue(data, "twitter:card");

    if (!card) {
      push(
        "card-missing",
        "Falta la etiqueta twitter:card",
        CARD_CRITERION,
        CARD_RECOMMENDATION,
        "sin twitter:card",
      );
    } else if (!TWITTER_CARD_VALUES.includes(card.trim().toLowerCase())) {
      // La comparación es insensible a mayúsculas y a espacios alrededor de
      // forma deliberada: marcar como inválido un valor que sólo difiere en
      // capitalización sería un falso positivo sobre algo que X interpreta bien.
      push(
        "card-invalid",
        "Valor de twitter:card no admitido",
        CARD_CRITERION,
        "Corrige el valor de twitter:card por uno de los valores admitidos; para páginas de contenido el habitual es summary_large_image.",
        cap(card),
      );
    }

    for (const { field, subtype } of FALLBACK_FIELDS) {
      const twitterKey = `twitter:${field}`;
      const ogKey = `og:${field}`;

      // Una sola expresión de dos términos, no una rama que marca y otra que
      // perdona: X recurre a Open Graph cuando falta su propia etiqueta, así
      // que penalizar la ausencia del `twitter:*` con el `og:*` presente sería
      // un falso positivo en casi todo el universo objetivo. Es la única
      // exclusión que REQUIREMENTS.md nombra de forma explícita.
      if (!firstValue(data, twitterKey) && !firstValue(data, ogKey)) {
        push(
          subtype,
          `Falta ${twitterKey} y también ${ogKey}`,
          `X usa ${twitterKey} y, cuando falta, recurre a ${ogKey}: sólo hay problema cuando faltan las dos`,
          `Agrega ${ogKey} o ${twitterKey}; preferentemente ${ogKey}, porque esa misma etiqueta la usan también el resto de las plataformas.`,
          `sin ${twitterKey} ni ${ogKey}`,
        );
      }
    }

    if (issues.length > 0) return issues;

    // Inalcanzable con la tarjeta ausente: el acumulador sólo queda vacío
    // cuando la tarjeta existe y su valor es admitido.
    return [
      {
        checkId: CHECK_ID,
        category: "social",
        title: "Twitter Card correcta",
        severity: "ok",
        measuredValue: cap(card ?? ""),
        source: url,
        criterion: CARD_CRITERION,
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
