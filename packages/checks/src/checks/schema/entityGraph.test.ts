import { describe, expect, it } from "vitest";
import { extractJsonLdBlocks, flattenNodes } from "./extract";
import { buildEntityGraph } from "./entityGraph";
import * as cheerio from "cheerio";

const MULTI_ENTITY_HTML = `<html><body><script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "#organization",
      "name": "Juan Tech",
      "sameAs": ["https://linkedin.com/company/juantech"]
    },
    {
      "@type": "Person",
      "@id": "#person",
      "name": "Juan",
      "worksFor": { "@id": "#organization" },
      "sameAs": ["https://twitter.com/juan"]
    },
    {
      "@type": "ProfessionalService",
      "@id": "#service",
      "name": "Juan Tech Consulting",
      "provider": { "@id": "#person" }
    }
  ]
}
</script></body></html>`;

describe("buildEntityGraph (SD-05)", () => {
  it("builds nodes for every entity and edges for @id references + sameAs", () => {
    const $ = cheerio.load(MULTI_ENTITY_HTML);
    const nodes = flattenNodes(extractJsonLdBlocks($));
    const graph = buildEntityGraph(nodes);

    // 3 real entities + 2 external sameAs targets (LinkedIn, Twitter).
    expect(graph.nodes.filter((n) => n.type !== "External")).toHaveLength(3);
    expect(graph.nodes.some((n) => n.id === "#organization" && n.type === "Organization")).toBe(true);
    expect(graph.nodes.some((n) => n.id === "#person" && n.type === "Person")).toBe(true);
    expect(graph.nodes.some((n) => n.id === "#service" && n.type === "ProfessionalService")).toBe(true);

    // worksFor: Person -> Organization
    expect(
      graph.edges.some((e) => e.from === "#person" && e.to === "#organization" && e.rel === "worksFor")
    ).toBe(true);
    // provider: ProfessionalService -> Person
    expect(
      graph.edges.some((e) => e.from === "#service" && e.to === "#person" && e.rel === "provider")
    ).toBe(true);
    // sameAs edges to external nodes
    expect(
      graph.edges.some((e) => e.from === "#organization" && e.rel === "sameAs" && e.to.includes("linkedin"))
    ).toBe(true);
    expect(
      graph.edges.some((e) => e.from === "#person" && e.rel === "sameAs" && e.to.includes("twitter"))
    ).toBe(true);
  });

  it("returns an empty graph for nodes with no relations", () => {
    const $ = cheerio.load(
      `<html><body><script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script></body></html>`
    );
    const nodes = flattenNodes(extractJsonLdBlocks($));
    const graph = buildEntityGraph(nodes);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
  });

  it("assigns a synthetic id to nodes without @id", () => {
    const $ = cheerio.load(
      `<html><body><script type="application/ld+json">{"@type":"WebSite","name":"Acme Site"}</script></body></html>`
    );
    const nodes = flattenNodes(extractJsonLdBlocks($));
    const graph = buildEntityGraph(nodes);
    expect(graph.nodes[0]?.id).toMatch(/^#WebSite-/);
  });
});
