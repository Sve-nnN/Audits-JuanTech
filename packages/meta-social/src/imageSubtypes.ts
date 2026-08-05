/**
 * Vocabulario de subtipos de IMG-01 y lectura del fingerprint persistido.
 *
 * Vive en el motor puro, junto a `TWITTER_CARD_VALUES` y los umbrales de
 * `og:image`, y no dentro del check, por la misma razón que aquellos: el panel
 * de preview de Phase 32 decide contra exactamente estos valores, y una copia
 * redeclarada garantiza que el panel y el issue terminen contradiciéndose.
 *
 * Que vivan acá y no en `packages/checks` tiene además una consecuencia dura de
 * empaquetado: `@auditor/report-model` lo consume y ese paquete lo resuelve el
 * bundle de `apps/web`. El barrel de `@auditor/checks` arrastra `@auditor/crawler`
 * y con él Crawlee/got-scraping, que dependen de módulos nativos de Node (`tls`)
 * y rompen el build de Next. `@auditor/meta-social` no tiene más dependencia de
 * runtime que Cheerio, así que cruzar este borde es seguro.
 */

/** checkId bajo el que se persisten los hallazgos de imagen social. */
export const OG_IMAGE_CHECK_ID = "IMG-01";

export const OG_IMAGE_UNREACHABLE_SUBTYPE = "og-image-unreachable";
export const OG_IMAGE_UNVERIFIABLE_SUBTYPE = "og-image-unverifiable";
export const OG_IMAGE_SVG_SUBTYPE = "og-image-svg";
export const OG_IMAGE_NOT_IMAGE_SUBTYPE = "og-image-not-image";
export const OG_IMAGE_UNDETERMINED_SUBTYPE = "og-image-undetermined";
export const OG_IMAGE_TOO_SMALL_SUBTYPE = "og-image-too-small";
/**
 * Un único subtipo para los dos avisos de dimensión (tamaño y proporción):
 * no pueden coexistir, y dos subtipos prometerían una fila que nunca aparece.
 */
export const OG_IMAGE_SUBOPTIMAL_SUBTYPE = "og-image-suboptimal";
export const OG_IMAGE_TOO_LARGE_SUBTYPE = "og-image-too-large";
export const OG_IMAGE_HEAVY_SUBTYPE = "og-image-heavy";

/**
 * Recupera el subtipo de un fingerprint persistido de IMG-01, cuya forma es
 * `IMG-01:<subtipo>:<url de la página>`. Devuelve `null` para el fingerprint de
 * otro check o con forma inesperada: el parseo falla cerrado y quien decide
 * sobre el resultado degrada, nunca inventa un veredicto.
 */
export function subtypeFromImgFingerprint(fingerprint: string): string | null {
  const prefix = `${OG_IMAGE_CHECK_ID}:`;
  if (!fingerprint.startsWith(prefix)) return null;
  const rest = fingerprint.slice(prefix.length);
  const end = rest.indexOf(":");
  if (end <= 0) return null;
  return rest.slice(0, end);
}
