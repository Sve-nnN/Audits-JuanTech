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

  it("expands inline nested entities into child nodes with property-labeled edges", () => {
    // aprendoclub-style: BlogPosting with nested author/publisher, no @id.
    const html = `<html><body><script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": "Cómo aprender SEO",
      "author": { "@type": "Person", "name": "Arianna Lupi" },
      "publisher": { "@type": "Organization", "name": "Aprendo Club" }
    }
    </script></body></html>`;
    const nodes = flattenNodes(extractJsonLdBlocks(cheerio.load(html)));
    const graph = buildEntityGraph(nodes);

    // Root + Person + Organization = 3 nodes (before: only the root showed).
    expect(graph.nodes).toHaveLength(3);
    expect(graph.nodes.some((n) => n.type === "Person" && n.label === "Person: Arianna Lupi")).toBe(true);
    expect(graph.nodes.some((n) => n.type === "Organization")).toBe(true);

    const root = graph.nodes.find((n) => n.type === "BlogPosting")!;
    expect(graph.edges.some((e) => e.from === root.id && e.rel === "author")).toBe(true);
    expect(graph.edges.some((e) => e.from === root.id && e.rel === "publisher")).toBe(true);
  });

  it("expands a BreadcrumbList's itemListElement array into one child per ListItem", () => {
    const html = `<html><body><script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Inicio" },
        { "@type": "ListItem", "position": 2, "name": "Blog" },
        { "@type": "ListItem", "position": 3, "name": "Empieza en SEO" }
      ]
    }
    </script></body></html>`;
    const nodes = flattenNodes(extractJsonLdBlocks(cheerio.load(html)));
    const graph = buildEntityGraph(nodes);

    const listItems = graph.nodes.filter((n) => n.type === "ListItem");
    expect(listItems).toHaveLength(3);
    expect(listItems.some((n) => n.label === "ListItem: [1] Inicio")).toBe(true);
    const root = graph.nodes.find((n) => n.type === "BreadcrumbList")!;
    expect(graph.edges.filter((e) => e.from === root.id && e.rel === "itemListElement")).toHaveLength(3);
  });
});
