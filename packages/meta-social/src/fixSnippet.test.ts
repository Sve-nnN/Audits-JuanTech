import { describe, it, expect } from "vitest";
import { buildFixSnippet } from "./fixSnippet";

describe("buildFixSnippet", () => {
  it("devuelve null sin campos: no hay nada que pegar", () => {
    expect(buildFixSnippet([])).toBeNull();
  });

  it("genera una única línea exacta para un solo campo, sin salto sobrante", () => {
    expect(buildFixSnippet([{ tag: "og:title", value: "Real" }])).toBe(
      '<meta property="og:title" content="Real">'
    );
  });

  it("une dos campos con un salto de línea, en el orden del array de entrada", () => {
    expect(
      buildFixSnippet([
        { tag: "og:url", value: "https://example.com/post" },
        { tag: "og:type", value: "website" },
      ])
    ).toBe(
      '<meta property="og:url" content="https://example.com/post">\n' +
        '<meta property="og:type" content="website">'
    );
  });

  it("escapa &, comillas dobles, < y > dentro del atributo content (T-32-11)", () => {
    expect(
      buildFixSnippet([
        { tag: "og:title", value: 'Tom & Jerry "el <mejor>" dúo' },
      ])
    ).toBe(
      '<meta property="og:title" content="Tom &amp; Jerry &quot;el &lt;mejor&gt;&quot; dúo">'
    );
  });

  it("no doble-escapa una entidad ya presente en el valor", () => {
    expect(buildFixSnippet([{ tag: "og:title", value: "&amp;" }])).toBe(
      '<meta property="og:title" content="&amp;amp;">'
    );
  });

  it("usa name= para twitter:card y property= para cualquier og:*", () => {
    expect(buildFixSnippet([{ tag: "twitter:card", value: "summary" }])).toBe(
      '<meta name="twitter:card" content="summary">'
    );
    expect(buildFixSnippet([{ tag: "og:description", value: "x" }])).toBe(
      '<meta property="og:description" content="x">'
    );
  });

  it("un valor hostil con un tag completo queda inerte como texto escapado", () => {
    const snippet = buildFixSnippet([
      { tag: "og:title", value: '"><script>alert(1)</script>' },
    ]);
    expect(snippet).toBe(
      '<meta property="og:title" content="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;">'
    );
    // Un solo `<meta` y un solo `>` de cierre real: no se inyectó un tag extra.
    expect(snippet?.match(/<meta /g)).toHaveLength(1);
  });
});
