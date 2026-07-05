import * as cheerio from "cheerio";
import type { IssueDraft, SiteCheck } from "../../types";
import { pageFingerprint } from "../../util";
import { extractJsonLdBlocks, flattenNodes } from "./extract";

const CHECK_ID = "SD-04";

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

/**
 * SD-04 (site-level): dangling `@id` references.
 *
 * A JSON-LD `@id` reference is only a real problem if the target node is
 * defined NOWHERE in the site. Sites routinely define a shared entity
 * (Organization, Person) once — typically on the homepage — with an absolute
 * `@id`, then reference it from every other page. Resolving references
 * per-page would flag all of those as "unresolved" (false positives), so we
 * build a site-wide registry of every defined `@id` across all crawled pages
 * first, and only flag references that resolve against no page at all.
 */
export const danglingIdRefsCheck: SiteCheck = {
  checkId: CHECK_ID,
  run({ pages }) {
    // 1) Site-wide set of every defined @id across all pages' JSON-LD.
    const definedIds = new Set<string>();
    const perPageNodes = new Map<string, ReturnType<typeof flattenNodes>>();

    for (const page of pages) {
      if (!page.html) continue;
      const $ = cheerio.load(page.html);
      const nodes = flattenNodes(extractJsonLdBlocks($));
      if (nodes.length === 0) continue;
      perPageNodes.set(page.id, nodes);
      for (const node of nodes) {
        const id = node.data["@id"];
        if (typeof id === "string") definedIds.add(id);
      }
    }

    // 2) Per page, flag references unresolved site-wide.
    const issues: IssueDraft[] = [];
    for (const page of pages) {
      const nodes = perPageNodes.get(page.id);
      if (!nodes) continue;
      const url = page.finalUrl ?? page.url;

      const dangling = new Set<string>();
      for (const node of nodes) {
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
            "Todo @id referenciado en el JSON-LD debe corresponder a un nodo definido en alguna página del sitio",
          recommendation:
            "Define como nodo completo (con su propio @type) cada @id que se referencia, o corrige la referencia si apunta a un identificador incorrecto.",
          fingerprint: pageFingerprint(CHECK_ID, `${url}:dangling`),
          pageId: page.id,
          scope: `dangling:${url}`,
        });
      }
    }

    return issues;
  },
};
