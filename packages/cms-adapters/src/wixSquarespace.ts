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
  // [REVISAR] Nombre exacto del control «Etiqueta SEO»/HTML tag en el panel de texto de Wix (RESEARCH A1) — verificación humana pendiente.
  "ONPAGE-03":
    "En el editor de Wix, selecciona el texto del título, abre el panel de texto y en «Etiqueta SEO» asígnale «Heading 1 (H1)»; usa un único H1 por página.",
  "ONPAGE-04":
    "En Wix, abre el Administrador de medios (Media Manager), selecciona la imagen → Settings → campo «Texto alternativo».",
  "ONPAGE-05":
    "En el editor de Wix, en el panel SEO de la página abre la pestaña «Compartir en redes» (Social Share) y define la imagen y el texto que se muestran al compartir el enlace.",
  // [REVISAR] Ruta exacta del editor de robots.txt en el dashboard de Wix (RESEARCH A3) — verificación humana pendiente.
  "TECH-01":
    "En Wix, ve al panel de tu sitio → Marketing y SEO → «Herramientas SEO» → editor de robots.txt, y edita el archivo. Los cambios aplican al dominio conectado.",
  "TECH-02":
    "En Wix, el sitemap se genera automáticamente en tudominio.com/sitemap.xml una vez publicado el sitio con un dominio conectado. Envíalo en Google Search Console desde las herramientas de SEO de Wix.",
  "TECH-04":
    "En el editor de Wix, ve a Páginas y menú → más acciones → «SEO básico» → pestaña «Avanzado» → «Etiquetas adicionales», y edita la URL canónica de la página.",
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
  // [REVISAR] En 7.1 el título de página no siempre se renderiza como H1 (RESEARCH A2) — verificación humana pendiente.
  "ONPAGE-03":
    "En Squarespace, edita el bloque de texto del encabezado principal y asígnale «Heading 1» en la barra de formato; deja un único H1 y baja los demás a H2/H3.",
  "ONPAGE-04":
    "En Squarespace, edita el bloque de imagen y completa el campo de texto alternativo (Alt Text) en las opciones de la imagen.",
  "ONPAGE-05":
    "En Squarespace, abre la configuración de la página → pestaña «Social» para la imagen de compartición; los títulos y descripciones de Open Graph derivan del SEO Title/Description y de Ajustes → Marketing → «SEO Appearance».",
  // [REVISAR] Texto/ubicación actual de la opción de ocultar de buscadores (RESEARCH A5) — verificación humana pendiente.
  "TECH-01":
    "En Squarespace, el archivo robots.txt lo gestiona la plataforma y no es editable por el usuario. Si necesitas evitar que una página se indexe, usa la opción «Hide this page from search engine results» en la pestaña SEO de esa página.",
  "TECH-02":
    "En Squarespace, el sitemap se genera automáticamente en /sitemap.xml y no es editable. Envíalo en Google Search Console.",
  "TECH-04":
    "En Squarespace el control de canonical es limitado y depende de la plantilla; normalmente se inyecta la etiqueta canonical vía código en Ajustes de la página → «Advanced» → «Code Injection».",
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
