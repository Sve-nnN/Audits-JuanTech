import type { AxisResult } from "@auditor/fingerprint";
import type { CmsAdapter, CmsLabel } from "./types";

/**
 * Adaptador de WordPress. La mayoría de los checkIds resuelven a nivel
 * plataforma; ONPAGE-04 (alt text), SD-01 (JSON-LD presencia) y SD-02 (JSON-LD
 * validez) tienen variantes por builder (Elementor/Divi/WPBakery/Gutenberg).
 *
 * Copy transcrito verbatim de 27-RESEARCH.md "Catálogo de copy por plataforma".
 * Español neutro sin voceo (COPY-01..03).
 */

/**
 * Builders de WordPress con variante de copy propia. La variante específica
 * solo se usa cuando el eje `builder` los detecta con confianza {alto, medio}
 * (Pitfall 5); en cualquier otro caso se devuelve la copy base con ramas.
 */
const BUILDER_VARIANTS = new Set(["Elementor", "Divi", "WPBakery", "Gutenberg"]);
const ACTIVATING_BUILDER = new Set(["alto", "medio"]);

/**
 * checkIds con granularidad por builder. El resto resuelve siempre a nivel
 * plataforma (ignora el builder).
 */
const GRANULAR_CHECK_IDS = new Set(["ONPAGE-04", "SD-01", "SD-02"]);

/**
 * Catálogo base a nivel plataforma. Para los 3 checkIds granulares la entrada
 * base es la copy con ramas ("Si usas el editor nativo... Si usas Elementor...")
 * que se devuelve cuando no hay un builder confiable.
 */
const catalog: Record<string, string> = {
  "ONPAGE-01":
    "En WordPress, edita la entrada o página y completa el campo «Título SEO» del panel de tu plugin SEO (en Yoast SEO: bloque «Yoast SEO» debajo del editor → «Editar fragmento»; en Rank Math: metabox de Rank Math → pestaña «General»). Si no tienes ninguno instalado, el título sale del <title> del tema: instala Yoast SEO o Rank Math, o edítalo en el código del tema.",
  "ONPAGE-02":
    "En WordPress, edita la entrada o página y completa el campo «Meta descripción» del panel de tu plugin SEO (Yoast SEO: «Editar fragmento» debajo del editor; Rank Math: metabox → pestaña «General»). Sin plugin SEO instalado, instala Yoast SEO o Rank Math, o agrega la etiqueta en el código del tema.",
  "ONPAGE-03":
    "En WordPress el H1 suele ser el título de la entrada/página. Deja un único H1: en el editor de bloques, mantén el título principal como H1 y cambia los demás encabezados a H2/H3 desde el selector de nivel del bloque de encabezado. En Elementor, Divi o WPBakery, ajusta la etiqueta HTML (H1/H2) del widget de título en las opciones del elemento.",
  // ONPAGE-04: copy con ramas (builder no-detectado). Variantes por builder abajo.
  "ONPAGE-04":
    "En WordPress, si usas el editor nativo (Gutenberg): selecciona la imagen y completa el campo «Texto alternativo» en el panel del bloque, o desde Medios → la imagen → «Texto alternativo». Si usas Elementor: selecciona el widget de imagen → pestaña «Contenido» → campo «Alt». Si usas WPBakery o Divi: el campo alt está dentro de las opciones del módulo de imagen del builder.",
  "ONPAGE-05":
    "En WordPress, con Yoast SEO abre la pestaña «Social» del panel Yoast (o Yoast SEO → Ajustes → «Compartir en redes» para los valores por defecto); con Rank Math usa la pestaña «Social» del metabox. Ahí defines título, descripción e imagen de Open Graph. Sin plugin SEO, instala Yoast SEO o Rank Math.",
  "TECH-01":
    "En WordPress, edita robots.txt desde tu plugin SEO: Yoast SEO → Herramientas → «Editor de archivos»; Rank Math → Ajustes generales → «Editar robots.txt» (requiere modo avanzado). Sin plugin, crea un archivo robots.txt en la raíz del dominio o instala Yoast SEO o Rank Math.",
  "TECH-02":
    "En WordPress, activa el sitemap XML de tu plugin SEO: en Yoast SEO → Ajustes → «Funciones del sitio» → «Mapas XML del sitio» (queda en /sitemap_index.xml); en Rank Math → «Sitemap Settings». Declara la URL del sitemap en robots.txt y envíala en Google Search Console. Sin plugin, instala Yoast SEO o Rank Math.",
  "TECH-04":
    "En WordPress, con Yoast SEO o Rank Math el campo canonical está en la pestaña «Avanzado» del panel SEO de cada entrada o página. Sin plugin SEO, requiere editar el tema/código: instala Yoast SEO o Rank Math para gestionarlo sin tocar código.",
  // SD-01: copy con ramas (builder no-detectado). Variantes por builder abajo.
  "SD-01":
    "En WordPress, Yoast SEO y Rank Math generan JSON-LD básico automáticamente (Organization, Article, breadcrumbs). Para tipos adicionales (FAQPage, Product, Review) usa el schema del plugin SEO, un plugin de schema dedicado, o bloques del builder. Si usas Elementor Pro, incluye widgets de schema (versión Pro). Sin plugin SEO, instala Yoast SEO o Rank Math.",
  // SD-02: copy con ramas (builder no-detectado). Variantes por builder abajo.
  "SD-02":
    "En WordPress, si el JSON-LD lo generan Yoast SEO o Rank Math no deberías tener errores de sintaxis; si agregaste bloques a mano (un bloque HTML personalizado, un plugin de schema, o un widget de Elementor Pro), corrige ahí las comas, comillas y llaves del bloque marcado.",
};

/**
 * Variantes de copy por builder para los 3 checkIds granulares. Divi y WPBakery
 * comparten texto en SD-01/SD-02 (fila "Divi / WPBakery" de RESEARCH).
 */
const builderCatalog: Record<string, Partial<Record<string, string>>> = {
  "ONPAGE-04": {
    Elementor:
      "En WordPress con Elementor, selecciona el widget de imagen → pestaña «Contenido» → campo «Alt» (o completa el «Texto alternativo» en la biblioteca de Medios, que Elementor reutiliza).",
    Divi:
      "En WordPress con Divi, abre las opciones del módulo de imagen → pestaña «Contenido» → campo «Alt Text», o completa el «Texto alternativo» de la imagen en la biblioteca de Medios.",
    WPBakery:
      "En WordPress con WPBakery, edita el elemento «Single Image» del builder y completa su campo de texto alternativo, o el «Texto alternativo» de la imagen en la biblioteca de Medios.",
    Gutenberg:
      "En WordPress (editor nativo), selecciona la imagen en el editor y completa el campo «Texto alternativo» en el panel del bloque, o desde Medios → la imagen → «Texto alternativo».",
  },
  "SD-01": {
    Elementor:
      "En WordPress con Elementor, Yoast SEO o Rank Math ya generan el schema base; para tipos adicionales usa los widgets de schema de Elementor Pro (versión Pro) o el schema del plugin SEO.",
    Divi:
      "En WordPress con Divi o WPBakery, apóyate en el schema que generan Yoast SEO o Rank Math; para tipos adicionales usa el generador de schema del plugin SEO o un plugin de schema dedicado (estos builders no generan JSON-LD por sí solos).",
    WPBakery:
      "En WordPress con Divi o WPBakery, apóyate en el schema que generan Yoast SEO o Rank Math; para tipos adicionales usa el generador de schema del plugin SEO o un plugin de schema dedicado (estos builders no generan JSON-LD por sí solos).",
    Gutenberg:
      "En WordPress (editor nativo), Yoast SEO o Rank Math generan el JSON-LD base; para tipos adicionales usa el generador de schema del plugin SEO o un plugin de schema dedicado.",
  },
  "SD-02": {
    Elementor:
      "En WordPress con Elementor, corrige el JSON-LD donde lo agregaste: el widget de schema de Elementor Pro (versión Pro), un bloque HTML personalizado, o el plugin de schema. Revisa comas, comillas y llaves.",
    Divi:
      "En WordPress con Divi o WPBakery, corrige el JSON-LD en el módulo de código donde lo insertaste o en tu plugin de schema, revisando comas, comillas y llaves.",
    WPBakery:
      "En WordPress con Divi o WPBakery, corrige el JSON-LD en el módulo de código donde lo insertaste o en tu plugin de schema, revisando comas, comillas y llaves.",
    Gutenberg:
      "En WordPress (editor nativo), corrige el JSON-LD en el bloque HTML personalizado o en el plugin de schema donde lo agregaste, revisando comas, comillas y llaves.",
  },
};

export const wordpressAdapter: CmsAdapter = {
  lookup(checkId: string, _label: CmsLabel, builder: AxisResult): string | null {
    if (GRANULAR_CHECK_IDS.has(checkId)) {
      const value = builder.value;
      const useVariant =
        value != null &&
        BUILDER_VARIANTS.has(value) &&
        ACTIVATING_BUILDER.has(builder.confidence);
      if (useVariant) {
        const variant = builderCatalog[checkId]?.[value as string];
        if (variant) return variant;
      }
    }
    return catalog[checkId] ?? null;
  },
};
