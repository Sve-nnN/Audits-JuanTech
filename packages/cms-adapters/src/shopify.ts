import type { AxisResult } from "@auditor/fingerprint";
import type { CmsAdapter, CmsLabel } from "./types";

/**
 * Adaptador de Shopify. Catálogo plano de los 10 checkIds; `lookup` ignora
 * `label` y `builder` (Shopify no tiene granularidad por builder).
 *
 * Copy transcrito verbatim de 27-RESEARCH.md "Catálogo de copy por plataforma".
 * Español neutro sin voceo.
 */
const catalog: Record<string, string> = {
  "ONPAGE-01":
    "En Shopify, abre el recurso (Productos, Páginas o Colecciones); para la home ve a Tienda online → Preferencias. Busca la sección «Vista previa del motor de búsqueda», haz clic en «Editar» y completa el campo de título. Guarda.",
  "ONPAGE-02":
    "En Shopify, abre el recurso o, para la home, ve a Tienda online → Preferencias. En «Vista previa del motor de búsqueda» haz clic en «Editar» y completa el campo de descripción. Guarda.",
  "ONPAGE-03":
    "En Shopify el H1 lo define la plantilla del tema, y muchos temas lo aplican por defecto al nombre de la tienda o el logo, no al título del contenido. Ve a Tienda online → Temas → Personalizar y revisa la sección de encabezado; si necesitas reasignar la etiqueta al título real del producto o la página, edítala en «Editar código» del tema (busca la etiqueta h1 en las secciones del theme).",
  "ONPAGE-04":
    "En Shopify, ve a Productos (o Contenido → Archivos), selecciona la imagen y completa el campo «Texto alternativo»; en imágenes del tema, edítalo desde Personalizar. Guarda.",
  "ONPAGE-05":
    "En Shopify, la mayoría de los temas generan las etiquetas Open Graph a partir del título, la descripción y la imagen destacada del recurso: completa esos campos en el producto o página. Para la imagen social por defecto, revisa la configuración del tema en Tienda online → Temas → Personalizar.",
  "TECH-01":
    "En Shopify, robots.txt se genera automáticamente. Para personalizarlo, ve a Tienda online → Temas → «Editar código», crea el archivo robots.txt.liquid en la carpeta Templates y ajusta las reglas con los objetos Liquid provistos (edición avanzada, no cubierta por el soporte de Shopify).",
  "TECH-02":
    "En Shopify, el sitemap se genera automáticamente en /sitemap.xml y se actualiza al agregar o editar productos, colecciones, páginas o entradas; no requiere configuración. Envíalo en Google Search Console.",
  // TECH-04: cubre tanto la ubicación del campo (canonical.ts) como los
  // sub-casos de destino roto/en cadena/con noindex (canonicalDeep.ts).
  "TECH-04":
    "En Shopify las canonical se generan automáticamente en la mayoría de los casos; los problemas suelen venir de paginación de colecciones o URLs duplicadas. Corregirlo puede requerir ajustar theme.liquid («Editar código») o una app de SEO. Si la canonical actual apunta a un destino con noindex, en redirección o que forma una cadena hacia otra canonical, el ajuste es sobre ese destino, no sobre el campo.",
  "SD-01":
    "En Shopify, los temas modernos (por ejemplo Dawn) ya incluyen schema de Product, Organization y BreadcrumbList. Para tipos adicionales o personalización, instala una app de datos estructurados de la App Store o edita el tema.",
  "SD-02":
    "En Shopify, corrige el JSON-LD en su origen: si viene del tema, en «Editar código»; si viene de una app de schema, en la configuración de la app. Revisa comas, comillas y llaves del bloque inválido.",
};

export const shopifyAdapter: CmsAdapter = {
  lookup(checkId: string, _label: CmsLabel, _builder: AxisResult): string | null {
    return catalog[checkId] ?? null;
  },
};
