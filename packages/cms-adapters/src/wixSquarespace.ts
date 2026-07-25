import type { AxisResult } from "@auditor/fingerprint";
import type { CmsAdapter, CmsLabel } from "./types";

/**
 * Adaptador técnico compartido por Wix y Squarespace. El `registry` (Plan 02)
 * mapea AMBAS labels a este mismo objeto; `lookup` ramifica sobre `label` para
 * elegir el catálogo interno, porque las dos plataformas tienen UI de edición
 * bastante distinta y devuelven copy diferente por checkId (decisión lockeada
 * de CONTEXT).
 *
 * Copy transcrito verbatim de 27-RESEARCH.md "Catálogo de copy por plataforma".
 * Español neutro sin voceo.
 */
const wixCatalog: Record<string, string> = {
  "ONPAGE-01":
    "En el editor de Wix, ve a Páginas y menú → ícono de más acciones junto a la página → «SEO básico», y completa el campo de título de la página.",
  "ONPAGE-02":
    "En el editor de Wix, ve a Páginas y menú → más acciones → «SEO básico», y completa el campo de descripción (meta description).",
  "ONPAGE-03":
    "En el editor de Wix, selecciona el texto del título → «Editar texto» → pestaña «SEO y accesibilidad» → en el menú «Elegir etiqueta HTML» selecciona «Heading 1 (H1)»; usa un único H1 por página.",
  "ONPAGE-04":
    "En Wix, abre el Administrador de medios (Media Manager), selecciona la imagen → Settings → campo «Texto alternativo».",
  "ONPAGE-05":
    "En el editor de Wix, en el panel SEO de la página abre la pestaña «Compartir en redes» (Social Share) y define la imagen y el texto que se muestran al compartir el enlace.",
  "TECH-01":
    "En Wix, ve al panel de tu sitio → «SEO & GEO» → sección «Tools and settings» → «Robots.txt Editor», y edita el archivo. Los cambios aplican al dominio conectado.",
  "TECH-02":
    "En Wix, el sitemap se genera automáticamente en tudominio.com/sitemap.xml una vez publicado el sitio con un dominio conectado. Envíalo en Google Search Console desde las herramientas de SEO de Wix.",
  // TECH-04: cubre tanto la ubicación del campo (canonical.ts) como los
  // sub-casos de destino roto/en cadena/con noindex (canonicalDeep.ts).
  "TECH-04":
    "En el editor de Wix, ve a Páginas y menú → más acciones → «SEO básico» → pestaña «Avanzado» → «Etiquetas adicionales», y edita la URL canónica de la página. Si el problema es el destino de esa URL (con noindex, en redirección o en cadena hacia otra canonical), corrígelo ahí mismo, no solo la ubicación del campo.",
  "SD-01":
    "En Wix se genera algo de schema básico por tipo de página, pero es incompleto y no editable; para schema adicional o personalizado usa el editor de código personalizado de Wix en el <head> del sitio.",
  "SD-02":
    "En Wix, corrige el JSON-LD en el editor de código personalizado donde lo agregaste, revisando comas, comillas y llaves.",
};

const squarespaceCatalog: Record<string, string> = {
  "ONPAGE-01":
    "En Squarespace, pasa el cursor sobre la página en el panel Pages, abre su configuración → pestaña «SEO» → campo «SEO Title». Para el formato global y la home, ve a Ajustes → Marketing → «SEO Appearance».",
  "ONPAGE-02":
    "En Squarespace, abre la configuración de la página → pestaña «SEO» → campo «SEO Description».",
  "ONPAGE-03":
    "En Squarespace, edita el bloque de texto del encabezado principal y asígnale «Heading 1» en la barra de formato; deja un único H1 y baja los demás a H2/H3. En plantillas donde el título no es un bloque de texto editable (por ejemplo páginas de producto o de colección), la etiqueta H1 depende de la plantilla y requiere ajuste por código en Ajustes de la página → «Advanced» → «Code Injection».",
  "ONPAGE-04":
    "En Squarespace, edita el bloque de imagen y completa el campo de texto alternativo (Alt Text) en las opciones de la imagen.",
  "ONPAGE-05":
    "En Squarespace, abre la configuración de la página → pestaña «Social» para la imagen de compartición; los títulos y descripciones de Open Graph derivan del SEO Title/Description y de Ajustes → Marketing → «SEO Appearance».",
  "TECH-01":
    "En Squarespace, el archivo robots.txt lo gestiona la plataforma y no es editable por el usuario. Si necesitas evitar que una página se indexe, abre el panel Pages → configuración de la página → pestaña «SEO» y activa «Hide page from search results». Nota: las páginas de inicio y los ítems individuales de colección no tienen este control.",
  "TECH-02":
    "En Squarespace, el sitemap se genera automáticamente en /sitemap.xml y no es editable. Envíalo en Google Search Console.",
  // TECH-04: cubre tanto la ubicación del campo (canonical.ts) como los
  // sub-casos de destino roto/en cadena/con noindex (canonicalDeep.ts).
  "TECH-04":
    "En Squarespace el control de canonical es limitado y depende de la plantilla; normalmente se inyecta la etiqueta canonical vía código en Ajustes de la página → «Advanced» → «Code Injection». Si el problema es el destino de esa URL (con noindex, en redirección o en cadena hacia otra canonical), corrígelo en ese mismo código, no solo la ubicación del campo.",
  "SD-01":
    "En Squarespace hay schema básico limitado; para schema personalizado, agrega el JSON-LD vía inyección de código de la página («Code Injection») o bloques de código en entradas de blog.",
  "SD-02":
    "En Squarespace, corrige el JSON-LD en la inyección de código de la página o el bloque de código donde lo agregaste, revisando comas, comillas y llaves.",
};

export const wixSquarespaceAdapter: CmsAdapter = {
  lookup(checkId: string, label: CmsLabel, _builder: AxisResult): string | null {
    const catalog = label === "Squarespace" ? squarespaceCatalog : wixCatalog;
    return catalog[checkId] ?? null;
  },
};
