import { describe, expect, it } from "vitest";
import { buildLinkGraph } from "./buildLinkGraph";
import type { GraphPage } from "./types";

const ORIGIN = "https://example.com";

function page(url: string, links: string[], overrides: Partial<GraphPage> = {}): GraphPage {
  const html = links.length
    ? `<html><body>${links.map((href) => `<a href="${href}">link</a>`).join("")}</body></html>`
    : "<html><body>no links</body></html>";
  return {
    id: `id:${url}`,
    url,
    finalUrl: null,
    html,
    ...overrides,
  };
}

describe("buildLinkGraph", () => {
  it("Test 1: linear chain home -> a -> b assigns increasing depth", () => {
    const pages: GraphPage[] = [
      page("https://example.com", ["https://example.com/a"]),
      page("https://example.com/a", ["https://example.com/b"]),
      page("https://example.com/b", []),
    ];

    const graph = buildLinkGraph(pages, ORIGIN);

    expect(graph.depthByUrl["https://example.com/"]).toBe(0);
    expect(graph.depthByUrl["https://example.com/a"]).toBe(1);
    expect(graph.depthByUrl["https://example.com/b"]).toBe(2);
  });

  it("Test 2: multiple paths — shortest path wins", () => {
    const pages: GraphPage[] = [
      page("https://example.com", ["https://example.com/a", "https://example.com/b"]),
      page("https://example.com/a", ["https://example.com/b"]),
      page("https://example.com/b", []),
    ];

    const graph = buildLinkGraph(pages, ORIGIN);

    expect(graph.depthByUrl["https://example.com/b"]).toBe(1);
  });

  it("Test 3: unreachable/orphan page is excluded without throwing", () => {
    const pages: GraphPage[] = [
      page("https://example.com", ["https://example.com/a"]),
      page("https://example.com/a", []),
      page("https://example.com/orphan", []),
    ];

    const graph = buildLinkGraph(pages, ORIGIN);

    expect(graph.depthByUrl["https://example.com/orphan"]).toBeUndefined();
    expect(graph.nodes.some((n) => n.url === "https://example.com/orphan")).toBe(false);
  });

  it("Test 4: page with html null is excluded even if linked", () => {
    const pages: GraphPage[] = [
      page("https://example.com", ["https://example.com/a"]),
      page("https://example.com/a", [], { html: null }),
    ];

    const graph = buildLinkGraph(pages, ORIGIN);

    expect(graph.depthByUrl["https://example.com/a"]).toBeUndefined();
    expect(graph.nodes.some((n) => n.url === "https://example.com/a")).toBe(false);
  });

  it("Test 5: external links are ignored", () => {
    const pages: GraphPage[] = [
      page("https://example.com", ["https://external.com/page"]),
    ];

    const graph = buildLinkGraph(pages, ORIGIN);

    expect(graph.edges.some((e) => e.to.includes("external.com"))).toBe(false);
    expect(graph.nodes.some((n) => n.url.includes("external.com"))).toBe(false);
  });

  it("Test 6: home missing/unreachable degrades gracefully", () => {
    const pages: GraphPage[] = [page("https://example.com/a", [])];

    const graph = buildLinkGraph(pages, ORIGIN);

    expect(graph).toEqual({ nodes: [], edges: [], depthByUrl: {} });
  });

  it("Test 8: BFS discovered via pre-redirect url still yields outbound links (CR-01 regression)", () => {
    const pages: GraphPage[] = [
      // Home links to the pre-redirect url of /a, but /a's own crawled record
      // reports finalUrl as the trailing-slash variant.
      page("https://example.com", ["https://example.com/a"]),
      page("https://example.com/a", ["https://example.com/b"], {
        finalUrl: "https://example.com/a/",
      }),
      page("https://example.com/b", []),
    ];

    const graph = buildLinkGraph(pages, ORIGIN);

    expect(graph.depthByUrl["https://example.com/b"]).toBe(2);
  });

  it("Test 7: edges only reference reachable nodes present in depthByUrl", () => {
    const pages: GraphPage[] = [
      page("https://example.com", ["https://example.com/a", "https://example.com/orphan-target"]),
      page("https://example.com/a", []),
    ];

    const graph = buildLinkGraph(pages, ORIGIN);

    for (const edge of graph.edges) {
      expect(graph.depthByUrl[edge.from]).toBeDefined();
      expect(graph.depthByUrl[edge.to]).toBeDefined();
    }
  });
});
