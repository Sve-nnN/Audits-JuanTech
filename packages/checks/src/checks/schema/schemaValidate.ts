import type { IssueDraft, PageCheck } from "../../types";
import { pageFingerprint } from "../../util";
import { extractJsonLdBlocks, flattenNodes, hasProp, typesOf } from "./extract";

// Retirado de schemaPageChecks (ver index.ts); se mantiene exportado sólo para
// consumidores/tests externos. El sufijo -legacy evita colisionar con el
// checkId "SD-04" de danglingIdRefsCheck (danglingIds.ts), que sigue activo.
const CHECK_ID = "SD-04-legacy";

interface SchemaRule {
  required: string[];
  recommended: string[];
}

/**
 * Local, pragmatic schema.org rule set for common types (Classy-Schema
 * style): required properties (missing -> error) and recommended properties
 * (missing -> warning). Not an exhaustive vocabulary validator — extensible.
 */
export const SCHEMA_RULES: Record<string, SchemaRule> = {
  // Identidad del sitio/negocio
  Organization: { required: ["name"], recommended: ["url", "logo", "sameAs"] },
  WebSite: { required: ["name", "url"], recommended: ["potentialAction"] },
  WebPage: { required: ["name"], recommended: ["description", "url"] },
  Person: { required: ["name"], recommended: ["url", "sameAs", "jobTitle"] },
  // Negocio local: nombre + dirección son la base para el panel local de Google
  LocalBusiness: {
    required: ["name", "address"],
    recommended: ["telephone", "openingHours", "geo", "priceRange"],
  },
  ProfessionalService: { required: ["name"], recommended: ["address", "telephone", "sameAs"] },
  // Contenido editorial: headline + author requeridos; fecha/imagen/publisher recomendados
  Article: { required: ["headline", "author"], recommended: ["datePublished", "image", "publisher"] },
  BlogPosting: {
    required: ["headline", "author"],
    recommended: ["datePublished", "image", "publisher"],
  },
  // Ficha de producto (rich result de Product)
  Product: { required: ["name"], recommended: ["image", "description", "offers", "brand"] },
  Offer: { required: ["price", "priceCurrency"], recommended: ["availability"] },
  // Reseña: reviewRating recomendado (su ausencia degrada, no invalida)
  Review: { required: [], recommended: ["reviewRating", "author", "itemReviewed"] },
  // Evento: nombre + fecha de inicio son la base del rich result de Event
  Event: {
    required: ["name", "startDate"],
    recommended: ["location", "endDate", "offers", "description"],
  },
  // Receta
  Recipe: {
    required: ["name"],
    recommended: ["image", "recipeIngredient", "recipeInstructions", "author"],
  },
  // Estructuras de página
  FAQPage: { required: ["mainEntity"], recommended: [] },
  BreadcrumbList: { required: ["itemListElement"], recommended: [] },
};

/** SD-04 (Classy Schema style): validates required/recommended properties per type. Dangling `@id` refs are checked site-wide by danglingIdRefsCheck. */
export const schemaValidateCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const nodes = flattenNodes(extractJsonLdBlocks($));
    if (nodes.length === 0) return [];

    const issues: IssueDraft[] = [];

    for (const node of nodes) {
      const types = typesOf(node.data);

      for (const type of types) {
        const rule = SCHEMA_RULES[type];
        if (!rule) continue;

        const missingRequired = rule.required.filter((p) => !hasProp(node.data, p));
        const missingRecommended = rule.recommended.filter((p) => !hasProp(node.data, p));
        const idLabel = typeof node.data["@id"] === "string" ? ` (${node.data["@id"] as string})` : "";

        if (missingRequired.length > 0) {
          issues.push({
            checkId: CHECK_ID,
            category: "schema",
            title: `${type}: faltan propiedades requeridas`,
            severity: "critical",
            measuredValue: `${type}${idLabel} — faltan: ${missingRequired.join(", ")}`,
            source: url,
            criterion: `El tipo ${type} debe incluir: ${rule.required.join(", ")}`,
            recommendation: `Agrega las propiedades requeridas (${missingRequired.join(", ")}) al bloque ${type} para que sea válido según schema.org.`,
            fingerprint: pageFingerprint(CHECK_ID, `${url}:${type}:required`),
            pageId: page.id,
          });
        }

        if (missingRecommended.length > 0) {
          issues.push({
            checkId: CHECK_ID,
            category: "schema",
            title: `${type}: faltan propiedades recomendadas`,
            severity: "warning",
            measuredValue: `${type}${idLabel} — faltan: ${missingRecommended.join(", ")}`,
            source: url,
            criterion: `El tipo ${type} debería incluir: ${rule.recommended.join(", ")}`,
            recommendation: `Considera agregar las propiedades recomendadas (${missingRecommended.join(", ")}) al bloque ${type} para maximizar su elegibilidad en resultados enriquecidos.`,
            fingerprint: pageFingerprint(CHECK_ID, `${url}:${type}:recommended`),
            pageId: page.id,
          });
        }
      }

    }

    // NOTE: dangling `@id` reference detection lives in the SITE-level check
    // (danglingIdRefsCheck) so that cross-page references — e.g. an internal
    // page pointing at the site-wide `#person`/`#organization` node defined
    // once on the homepage — resolve against the whole audit's JSON-LD and
    // are not flagged as false positives per page.

    if (issues.length === 0) {
      issues.push({
        checkId: CHECK_ID,
        category: "schema",
        title: "Datos estructurados válidos según schema.org",
        severity: "ok",
        measuredValue: `${nodes.length} entidad(es) validada(s), sin errores`,
        source: url,
        criterion: "Los tipos schema.org detectados cumplen sus propiedades requeridas/recomendadas",
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, `${url}:ok`),
        pageId: page.id,
      });
    }

    return issues;
  },
};
