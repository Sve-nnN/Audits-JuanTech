import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";
import { extractJsonLdBlocks, flattenNodes, typesOf } from "./extract";

const CHECK_ID = "SD-03";

/** Types with a well-known SEO/AEO impact (rich results, AI-answer eligibility, entity disambiguation). */
const HIGH_IMPACT_TYPES = new Set([
  "Organization",
  "WebSite",
  "FAQPage",
  "Article",
  "BlogPosting",
  "Product",
  "BreadcrumbList",
  "Person",
  "ProfessionalService",
  "LocalBusiness",
  "Event",
  "Recipe",
  "Review",
]);

/** SD-03: classifies detected `@type`s and flags the ones with known SEO/AEO impact. */
export const schemaTypesCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const nodes = flattenNodes(extractJsonLdBlocks($));
    if (nodes.length === 0) return [];

    const typeCounts = new Map<string, number>();
    for (const node of nodes) {
      for (const t of typesOf(node.data)) {
        typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
      }
    }

    if (typeCounts.size === 0) return [];

    const entries = Array.from(typeCounts.entries());
    const typesList = entries.map(([t, c]) => (c > 1 ? `${t} x${c}` : t));
    const highImpact = entries.filter(([t]) => HIGH_IMPACT_TYPES.has(t)).map(([t]) => t);

    return [
      {
        checkId: CHECK_ID,
        category: "schema",
        title: "Tipos de datos estructurados detectados",
        severity: "ok",
        measuredValue: typesList.join(", "),
        source: url,
        criterion:
          "Clasificación informativa de los tipos schema.org presentes y su impacto potencial en SEO/AEO",
        recommendation:
          highImpact.length > 0
            ? `Tipos de alto impacto detectados (${highImpact.join(", ")}); mantenlos completos y actualizados.`
            : "Considera agregar tipos de alto impacto (Organization, Article, FAQPage, Product, etc.) si aplican al contenido de la página.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
