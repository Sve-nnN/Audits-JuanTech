import type { IssueDraft, PageCheck } from "../../types";
import { pageFingerprint } from "../../util";
import { extractJsonLdBlocks, flattenNodes, hasProp, typesOf } from "./extract";

const CHECK_ID = "SD-04";

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
  Organization: { required: ["name"], recommended: ["url", "logo", "sameAs"] },
  WebSite: { required: ["name", "url"], recommended: ["potentialAction"] },
  WebPage: { required: ["name"], recommended: ["description", "url"] },
  FAQPage: { required: ["mainEntity"], recommended: [] },
  Person: { required: ["name"], recommended: ["url", "sameAs", "jobTitle"] },
  Article: { required: ["headline", "author"], recommended: ["datePublished", "image", "publisher"] },
  BlogPosting: {
    required: ["headline", "author"],
    recommended: ["datePublished", "image", "publisher"],
  },
  ProfessionalService: { required: ["name"], recommended: ["address", "telephone", "sameAs"] },
  BreadcrumbList: { required: ["itemListElement"], recommended: [] },
  Product: { required: ["name"], recommended: ["image", "description", "offers"] },
  Offer: { required: ["price", "priceCurrency"], recommended: ["availability"] },
};

/**
 * Collects every `@id` referenced inside a node's property values (not the
 * node's own `@id`). A "reference" is an object whose only key is `@id`
 * (e.g. `{ "@id": "#organization" }`), the standard JSON-LD way of pointing
 * at another node instead of inlining it.
 */
function collectReferencedIds(data: Record<string, unknown>): string[] {
  const ids: string[] = [];

  function walk(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (typeof value !== "object" || value === null) return;

    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);

    if (typeof obj["@id"] === "string" && keys.length === 1) {
      ids.push(obj["@id"] as string);
      return;
    }

    for (const key of keys) {
      if (key === "@id") continue;
      walk(obj[key]);
    }
  }

  walk(data);
  return ids;
}

/** SD-04 (Classy Schema style): validates required/recommended properties per type + dangling `@id` references. */
export const schemaValidateCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const nodes = flattenNodes(extractJsonLdBlocks($));
    if (nodes.length === 0) return [];

    const definedIds = new Set<string>();
    for (const node of nodes) {
      const id = node.data["@id"];
      if (typeof id === "string") definedIds.add(id);
    }

    const issues: IssueDraft[] = [];
    const dangling = new Set<string>();

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

      for (const ref of collectReferencedIds(node.data)) {
        if (!definedIds.has(ref)) dangling.add(ref);
      }
    }

    if (dangling.size > 0) {
      issues.push({
        checkId: CHECK_ID,
        category: "schema",
        title: "Referencias @id sin resolver",
        severity: "warning",
        measuredValue: `${dangling.size} referencia(s): ${Array.from(dangling).join(", ")}`,
        source: url,
        criterion:
          "Todo @id referenciado dentro del grafo JSON-LD debe corresponder a un nodo definido en la misma página",
        recommendation:
          "Define como nodo completo (con su propio @type) cada @id que se referencia, o corrige la referencia si apunta a un identificador incorrecto.",
        fingerprint: pageFingerprint(CHECK_ID, `${url}:dangling`),
        pageId: page.id,
      });
    }

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
