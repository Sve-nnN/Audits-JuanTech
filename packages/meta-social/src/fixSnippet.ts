/**
 * Constructor puro del bloque `<meta>` que el lector del reporte copia y pega
 * en el `<head>` de su página.
 *
 * Sólo arma HTML a partir de valores que el llamador ya extrajo de la página
 * real: este módulo nunca decide QUÉ etiquetas faltan ni inventa un valor. Esa
 * decisión vive en `report-model/src/socialPreview.ts`, que es el único lugar
 * que conoce el estado declarado de cada etiqueta.
 */

/** Las 5 etiquetas que el snippet puede proponer. `og:image` queda deliberadamente fuera. */
export type FixSnippetTag =
  | "og:title"
  | "og:description"
  | "og:url"
  | "og:type"
  | "twitter:card";

export interface FixSnippetField {
  tag: FixSnippetTag;
  value: string;
}

/**
 * Escape de valor de atributo HTML (mitigación T-32-11). El `&` va primero para
 * no re-escapar las entidades que los reemplazos siguientes acaban de insertar.
 *
 * El contenido llega del sitio auditado, así que un `"` suelto rompería el
 * atributo `content` y un `<` podría cerrar el tag e inyectar markup extra en
 * el snippet que el usuario pega en SU propio sitio.
 */
function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Arma el snippet copiable. Devuelve `null` cuando no hay nada que proponer,
 * que es la señal para que la UI no monte el bloque en absoluto.
 */
export function buildFixSnippet(fields: FixSnippetField[]): string | null {
  if (fields.length === 0) return null;
  return fields
    .map(({ tag, value }) => {
      const attr = tag.startsWith("og:") ? "property" : "name";
      return `<meta ${attr}="${tag}" content="${escapeAttr(value)}">`;
    })
    .join("\n");
}
