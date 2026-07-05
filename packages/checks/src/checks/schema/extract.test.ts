import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { extractJsonLdBlocks, flattenNodes } from "./extract";

function load(html: string) {
  return cheerio.load(html);
}

describe("extractJsonLdBlocks", () => {
  it("extracts and parses a single valid block", () => {
    const $ = load(
      `<html><body><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme"}</script></body></html>`
    );
    const blocks = extractJsonLdBlocks($);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.error).toBeUndefined();
    expect(blocks[0]?.parsed).toMatchObject({ "@type": "Organization", name: "Acme" });
  });

  it("captures a parse error for invalid JSON without throwing", () => {
    const $ = load(
      `<html><body><script type="application/ld+json">{ "@type": "Organization", }</script></body></html>`
    );
    const blocks = extractJsonLdBlocks($);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.error).toBeTruthy();
    expect(blocks[0]?.parsed).toBeUndefined();
  });

  it("captures multiple blocks in document order", () => {
    const $ = load(`<html><body>
      <script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script>
      <script type="application/ld+json">{"@type":"WebSite","name":"Acme site","url":"https://acme.example"}</script>
    </body></html>`);
    const blocks = extractJsonLdBlocks($);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.index).toBe(0);
    expect(blocks[1]?.index).toBe(1);
  });

  it("returns an empty list when there is no JSON-LD", () => {
    const $ = load(`<html><body><p>no schema here</p></body></html>`);
    expect(extractJsonLdBlocks($)).toHaveLength(0);
  });
});

describe("flattenNodes", () => {
  it("flattens a top-level array of entities", () => {
    const $ = load(
      `<html><body><script type="application/ld+json">[{"@type":"Organization","name":"Acme"},{"@type":"Person","name":"Jane"}]</script></body></html>`
    );
    const nodes = flattenNodes(extractJsonLdBlocks($));
    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n.data["@type"])).toEqual(["Organization", "Person"]);
  });

  it("flattens an @graph array into individual nodes", () => {
    const $ = load(`<html><body><script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "Organization", "@id": "#org", "name": "Acme" },
          { "@type": "Person", "@id": "#person", "name": "Jane", "worksFor": { "@id": "#org" } }
        ]
      }
    </script></body></html>`);
    const nodes = flattenNodes(extractJsonLdBlocks($));
    expect(nodes).toHaveLength(2);
    const org = nodes.find((n) => n.data["@id"] === "#org");
    const person = nodes.find((n) => n.data["@id"] === "#person");
    expect(org).toBeTruthy();
    expect(person).toBeTruthy();
  });

  it("skips blocks that failed to parse", () => {
    const $ = load(`<html><body>
      <script type="application/ld+json">{ invalid json </script>
      <script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script>
    </body></html>`);
    const nodes = flattenNodes(extractJsonLdBlocks($));
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.data["@type"]).toBe("Organization");
  });
});
