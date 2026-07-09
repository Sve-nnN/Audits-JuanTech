/**
 * Minimal Page shape this package needs — decoupled from `@auditor/db` so
 * `@auditor/graph` stays a pure, dependency-light package (same pattern as
 * `@auditor/render`'s `types.ts`).
 */
export interface GraphPage {
  id: string;
  url: string;
  finalUrl: string | null;
  html: string | null;
}

/** A crawled page reachable from home, as a node in the link graph. */
export interface GraphNode {
  url: string;
  pageId: string;
}

/** A directed internal link between two reachable nodes. */
export interface GraphEdge {
  from: string;
  to: string;
}

/**
 * Serializable link graph + real click-depth (BFS from home), ready to
 * persist once per audit (e.g. `Audit.stats.graph`).
 */
export interface LinkGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  depthByUrl: Record<string, number>;
  /**
   * Every crawled URL that receives at least one internal inbound link from
   * ANY page (not just pages reachable from home). Used to identify true orphan
   * pages: a crawled page whose normalized URL is absent here has zero internal
   * inlinks anywhere on the site. Keyed by the same normalized URL as `nodes`.
   */
  linkedUrls: string[];
}
