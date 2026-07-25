import type { AxisResult } from "@auditor/fingerprint";
import type { CmsAdapter, CmsLabel } from "./types";

/**
 * Adaptador de Webflow. Catálogo plano de los 10 checkIds; `lookup` ignora
 * `label` y `builder`.
 *
 * Copy transcrito verbatim de 27-RESEARCH.md "Catálogo de copy por plataforma".
 * Español neutro sin voceo.
 */
const catalog: Record<string, string> = {
  "ONPAGE-01":
    "En Webflow, abre el panel Pages → configuración de la página (ícono de engranaje) → «SEO settings» → campo «Title Tag». En páginas de colección del CMS, edítalo en la configuración de la plantilla de la colección (puedes vincularlo a un campo dinámico).",
  "ONPAGE-02":
    "En Webflow, abre configuración de la página → «SEO settings» → campo «Meta Description». En colecciones del CMS, vincúlalo a un campo de la colección.",
  "ONPAGE-03":
    "En Webflow Designer, selecciona el elemento de encabezado y, en Settings, fija su etiqueta como H1 (solo uno por página); convierte los demás en H2/H3.",
  "ONPAGE-04":
    "En Webflow Designer, selecciona la imagen → panel Settings → campo «Alt Text». En imágenes del CMS, vincula el alt a un campo de la colección para completarlo en todos los ítems.",
  "ONPAGE-05":
    "En Webflow, abre configuración de la página → «Open Graph Settings» y completa título, descripción e imagen; puedes marcar las casillas para reutilizar el «Title Tag» y la «Meta Description».",
  // [REVISAR] Nombre exacto de pestaña/campo robots.txt en el panel actual de Webflow (RESEARCH A4) — verificación humana pendiente.
  "TECH-01":
    "En Webflow, ve a Ajustes del sitio → pestaña «SEO» → campo «robots.txt» y agrega ahí tus reglas (por ejemplo User-agent y Disallow). Publica el sitio para aplicarlo.",
  // [REVISAR] Nombre exacto del toggle de sitemap en el panel actual de Webflow (RESEARCH A4) — verificación humana pendiente.
  "TECH-02":
    "En Webflow, ve a Ajustes del sitio → pestaña «SEO» y activa «Auto-generate sitemap» (o pega un sitemap personalizado). Publica el sitio; el sitemap queda en /sitemap.xml.",
  "TECH-04":
    'En Webflow no hay un campo nativo de canonical en todos los planes: agrega la etiqueta <link rel="canonical" href="..."> en configuración de la página → «Custom Code» (head) o en un elemento «Embed».',
  "SD-01":
    "En Webflow no hay soporte nativo de schema: genera el bloque JSON-LD y pégalo en configuración de la página → «Custom Code» (head) o en un elemento «Embed» dentro del contenido.",
  "SD-02":
    "En Webflow, edita el bloque JSON-LD donde lo pegaste («Custom Code» de la página o elemento «Embed») y corrige la sintaxis (comas, comillas, llaves).",
};

export const webflowAdapter: CmsAdapter = {
  lookup(checkId: string, _label: CmsLabel, _builder: AxisResult): string | null {
    return catalog[checkId] ?? null;
  },
};
