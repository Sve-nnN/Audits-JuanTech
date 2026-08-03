import { extractMetaSocial } from "@auditor/meta-social";
import type { IssueDraft, PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "SOCIAL-06";

const CRITERION =
  "Cada propiedad de Open Graph de valor único debe declararse una sola vez; ante etiquetas repetidas con valores distintos las plataformas usan la primera y descartan el resto";

/**
 * Las únicas propiedades de Open Graph que admiten un solo valor.
 *
 * Es una lista blanca y no una lista negra porque el protocolo define familias
 * enteras de arrays (`og:image*`, `og:video*`, `og:audio*`,
 * `og:locale:alternate`) donde repetir la etiqueta con valores distintos es la
 * forma documentada de declarar varios recursos o varios idiomas alternos. Un
 * WordPress multilingüe con Yoast o Polylang emite una etiqueta
 * `og:locale:alternate` por idioma en cada página: marcarlas sería un falso
 * positivo sistemático en el universo objetivo. Cualquier extensión de un
 * proveedor que no esté en esta lista se trata como repetible.
 */
const SINGLE_VALUED_OG_KEYS = new Set([
  "og:title",
  "og:description",
  "og:url",
  "og:type",
  "og:site_name",
  "og:locale",
  "og:determiner",
]);

/** SOCIAL-06: duplicate Open Graph keys declared with conflicting values. */
export const ogDuplicatesCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;

    // El agrupado sale entero del extractor y nunca de una consulta propia del
    // documento: la identidad de la etiqueta es la clave normalizada que ya
    // unifica los dos atributos de emisor, así que una lectura restringida a
    // `property` volvería indetectable justamente el caso que este check
    // existe para encontrar — la misma clave emitida por los dos atributos con
    // contenidos contradictorios (corrección D-2). Se recorre el `Map` tal
    // cual, sin acumulador propio indexado por la clave, porque la clave la
    // controla el sitio auditado (mitigación T-30-01).
    const data = extractMetaSocial($);

    // Alcance limitado a Open Graph por lectura literal del requisito
    // (Open Question 4 de la investigación): las claves del vocabulario de X
    // duplicadas no producen hallazgo en esta versión.
    const ogEntries = Array.from(data.tags).filter(([key]) => key.startsWith("og:"));

    // Una página sin ninguna etiqueta de Open Graph no tiene nada que
    // duplicar. Emitir aquí una fila de aprobado sería un aprobado trivial en
    // el perfil de sitio que peor puntúa (Pitfall 5).
    if (ogEntries.length === 0) return [];

    const issues: IssueDraft[] = [];

    for (const [key, values] of ogEntries) {
      if (!SINGLE_VALUED_OG_KEYS.has(key)) continue;

      // Las dos condiciones juntas, nunca una sola: repetir la misma etiqueta
      // con el mismo valor exacto es redundante pero no ambiguo y no se marca.
      const distinct = new Set(values);
      if (values.length > 1 && distinct.size > 1) {
        issues.push({
          checkId: CHECK_ID,
          category: "social",
          title: `Etiqueta ${key} duplicada con valores distintos`,
          severity: "warning",
          // Dos números derivados, nunca el contenido de las etiquetas: ese
          // texto lo controla el sitio auditado y no entra al campo persistido.
          measuredValue: `${values.length} etiquetas, ${distinct.size} valores distintos`,
          source: url,
          criterion: CRITERION,
          recommendation: `Deja una sola etiqueta ${key} con el valor correcto y elimina las repetidas: las plataformas toman la primera y descartan el resto, así que las demás sólo producen señales contradictorias.`,
          // El subtipo es la clave, y por el filtro de arriba sólo puede ser
          // una de las siete constantes de `SINGLE_VALUED_OG_KEYS`: no es texto
          // que controle el sitio auditado, así que no necesita la cota de
          // T-30-06 que sí aplican los checks que copian el contenido.
          fingerprint: pageFingerprint(`${CHECK_ID}:${key}`, url),
          pageId: page.id,
        });
      }
    }

    if (issues.length > 0) return issues;

    const total = ogEntries.length;

    return [
      {
        checkId: CHECK_ID,
        category: "social",
        title: "Sin etiquetas og duplicadas",
        severity: "ok",
        measuredValue: total === 1 ? "1 propiedad og distinta" : `${total} propiedades og distintas`,
        source: url,
        criterion: CRITERION,
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
