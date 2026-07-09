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

/** A human label for an entity: prefer name/headline/title, else the type. */
function nameOf(data: Record<string, unknown>): string | null {
  for (const key of ["name", "headline", "title"]) {
    const v = data[key];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  // ListItem often carries its label under `item` (a string or a nested thing).
  const item = data["item"];
  if (typeof item === "string" && item.trim().length > 0) return item.trim();
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const itemName = (item as Record<string, unknown>)["name"];
    if (typeof itemName === "string" && itemName.trim().length > 0) return itemName.trim();
  }
  return null;
}

function labelFor(node: JsonLdNode, id: string): string {
  const name = nameOf(node.data);
  return name ?? id;
}

/** Label for a nested entity: `Type: Name`, prefixed with `[position]` for list items. */
function nestedLabel(data: Record<string, unknown>, type: string): string {
  const name = nameOf(data);
  const pos = data["position"];
  const prefix = typeof pos === "number" || typeof pos === "string" ? `[${pos}] ` : "";
  return name ? `${type}: ${prefix}${name}` : type;
}

function isEntityLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Builds a `{ nodes, edges }` entity graph from a page's flattened JSON-LD nodes. */
export function buildEntityGraph(nodes: JsonLdNode[]): EntityGraph {
  const graphNodes: EntityGraphNode[] = [];
  const nodeIds = new Set<string>();
  const idOf = new Map<JsonLdNode, string>();
  const edges: EntityGraphEdge[] = [];
  let syntheticSeq = 0;

  // Register the top-level (flattened) entities first, so @id references from
  // nested properties can resolve to them instead of duplicating a node.
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

  /** Registers a nested entity object as its own node and returns its id. */
  function addNestedNode(obj: Record<string, unknown>): string {
    const type = typesOf(obj)[0] ?? "Thing";
    const rawId = obj["@id"];
    const id =
      typeof rawId === "string" && rawId.length > 0 ? rawId : `#${type}-nested-${syntheticSeq++}`;
    if (!nodeIds.has(id)) {
      nodeIds.add(id);
      graphNodes.push({ id, type, label: nestedLabel(obj, type) });
    }
    return id;
  }

  /**
   * Walks a property value. Emits edges for `@id` references and `sameAs`
   * targets (as before), and — the expansion — turns every inline nested
   * entity (an object carrying an `@type`) into its own child node + a
   * property-labeled edge, then recurses into that child's own properties.
   */
  function walk(value: unknown, rel: string, fromId: string): void {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, rel, fromId);
      return;
    }

    if (rel === "sameAs" && typeof value === "string") {
      ensureExternalNode(value);
      edges.push({ from: fromId, to: value, rel: "sameAs" });
      return;
    }

    if (!isEntityLike(value)) return;
    const obj = value;

    // Reference to an already-registered top-level entity: just an edge.
    const refId = obj["@id"];
    if (typeof refId === "string" && nodeIds.has(refId) && refId !== fromId) {
      edges.push({ from: fromId, to: refId, rel });
      return;
    }

    // Inline nested entity (has a real @type): expand into a child node.
    if (typesOf(obj).length === 0) return;
    const childId = addNestedNode(obj);
    if (childId !== fromId) edges.push({ from: fromId, to: childId, rel });
    for (const [key, nested] of Object.entries(obj)) {
      if (key === "@id" || key === "@type" || key === "@context") continue;
      walk(nested, key, childId);
    }
  }

  for (const node of nodes) {
    const fromId = idOf.get(node);
    if (!fromId) continue;
    for (const [key, value] of Object.entries(node.data)) {
      if (key === "@id" || key === "@type" || key === "@context") continue;
      walk(value, key, fromId);
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
