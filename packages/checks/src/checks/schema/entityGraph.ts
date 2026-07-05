import type { CheerioAPI } from "cheerio";
import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";
import { extractJsonLdBlocks, flattenNodes, typesOf, type JsonLdNode } from "./extract";

const CHECK_ID = "SD-05";

export interface EntityGraphNode {
  id: string;
  type: string;
  label: string;
}

export interface EntityGraphEdge {
  from: string;
  to: string;
  rel: string;
}

/** Per-page entity graph: nodes are JSON-LD entities, edges are `@id`/`sameAs`/reference relations. */
export interface EntityGraph {
  nodes: EntityGraphNode[];
  edges: EntityGraphEdge[];
}

function nodeIdFor(node: JsonLdNode, index: number): string {
  const id = node.data["@id"];
  if (typeof id === "string" && id.length > 0) return id;
  const type = typesOf(node.data)[0] ?? "Thing";
  return `#${type}-${index}`;
}

function labelFor(node: JsonLdNode, id: string): string {
  const name = node.data["name"];
  if (typeof name === "string" && name.trim().length > 0) return name;
  return id;
}

/** Builds a `{ nodes, edges }` entity graph from a page's flattened JSON-LD nodes. */
export function buildEntityGraph(nodes: JsonLdNode[]): EntityGraph {
  const graphNodes: EntityGraphNode[] = [];
  const nodeIds = new Set<string>();
  const idOf = new Map<JsonLdNode, string>();
  const edges: EntityGraphEdge[] = [];

  nodes.forEach((node, index) => {
    const id = nodeIdFor(node, index);
    idOf.set(node, id);
    if (nodeIds.has(id)) return; // duplicate @id on the page: keep the first node's label/type
    nodeIds.add(id);
    const type = typesOf(node.data)[0] ?? "Thing";
    graphNodes.push({ id, type, label: labelFor(node, id) });
  });

  function ensureExternalNode(url: string): void {
    if (nodeIds.has(url)) return;
    nodeIds.add(url);
    graphNodes.push({ id: url, type: "External", label: url });
  }

  function collectEdges(value: unknown, rel: string, fromId: string): void {
    if (Array.isArray(value)) {
      for (const item of value) collectEdges(item, rel, fromId);
      return;
    }

    if (rel === "sameAs" && typeof value === "string") {
      ensureExternalNode(value);
      edges.push({ from: fromId, to: value, rel: "sameAs" });
      return;
    }

    if (typeof value === "object" && value !== null) {
      const obj = value as Record<string, unknown>;
      const refId = obj["@id"];
      if (typeof refId === "string" && nodeIds.has(refId) && refId !== fromId) {
        edges.push({ from: fromId, to: refId, rel });
      }
    }
  }

  for (const node of nodes) {
    const fromId = idOf.get(node);
    if (!fromId) continue;
    for (const [key, value] of Object.entries(node.data)) {
      if (key === "@id" || key === "@type" || key === "@context") continue;
      collectEdges(value, key, fromId);
    }
  }

  return { nodes: graphNodes, edges };
}

/** Extracts + flattens + builds the entity graph for a page's HTML in one call. Returns `null` if no JSON-LD. */
export function computeSchemaGraph($: CheerioAPI): EntityGraph | null {
  const nodes = flattenNodes(extractJsonLdBlocks($));
  if (nodes.length === 0) return null;
  return buildEntityGraph(nodes);
}

/** SD-05: informational check reporting the size of the entity graph built for this page. */
export const entityGraphCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const graph = computeSchemaGraph($);
    if (!graph) return [];

    return [
      {
        checkId: CHECK_ID,
        category: "schema",
        title: "Grafo de entidades construido",
        severity: "ok",
        measuredValue: `${graph.nodes.length} nodo(s), ${graph.edges.length} relación(es)`,
        source: url,
        criterion: "Informativo: relaciones entre entidades JSON-LD detectadas en la página",
        recommendation: "Sin acción necesaria. Consulta el detalle de la página para ver el grafo completo.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
