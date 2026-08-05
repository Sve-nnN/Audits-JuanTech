import { describe, it, expect } from "vitest";
import { extractSocialPreview } from "./socialPreview";

const PAGE_URL = "https://example.com/blog/post";

/** Wraps meta/title markup in a minimal but real document. */
function doc(head: string): string {
  return `<!doctype html><html><head>${head}</head><body><p>contenido</p></body></html>`;
}

describe("extractSocialPreview", () => {
  it("prefiere og:title sobre el <title> nativo cuando los dos están", () => {
    const result = extractSocialPreview(
      doc(`<title>Nativo</title><meta property="og:title" content="Open Graph">`),
      PAGE_URL
    );
    expect(result.title).toBe("Open Graph");
    expect(result.ogTitleDeclared).toBe(true);
  });

  it("cae al <title> nativo cuando no hay og:title", () => {
    const result = extractSocialPreview(doc(`<title>Real</title>`), PAGE_URL);
    expect(result.title).toBe("Real");
    expect(result.ogTitleDeclared).toBe(false);
  });

  it("devuelve title null sin og:title ni <title>", () => {
    const result = extractSocialPreview(doc(``), PAGE_URL);
    expect(result.title).toBeNull();
    expect(result.ogTitleDeclared).toBe(false);
  });

  it("cae a la meta description nativa cuando no hay og:description", () => {
    const result = extractSocialPreview(
      doc(`<meta name="description" content="Real">`),
      PAGE_URL
    );
    expect(result.description).toBe("Real");
    expect(result.ogDescriptionDeclared).toBe(false);
  });

  it("prefiere og:description sobre la meta description nativa", () => {
    const result = extractSocialPreview(
      doc(
        `<meta name="description" content="Nativa"><meta property="og:description" content="Open Graph">`
      ),
      PAGE_URL
    );
    expect(result.description).toBe("Open Graph");
    expect(result.ogDescriptionDeclared).toBe(true);
  });

  it("deriva domain del pageUrl y nunca de og:url", () => {
    const result = extractSocialPreview(
      doc(`<meta property="og:url" content="https://otro-dominio.test/x">`),
      PAGE_URL
    );
    expect(result.domain).toBe("example.com");
    expect(result.pageUrl).toBe(PAGE_URL);
    expect(result.ogUrlDeclared).toBe(true);
  });

  it("degrada domain a cadena vacía sin lanzar cuando pageUrl no parsea", () => {
    const result = extractSocialPreview(doc(`<title>X</title>`), "no-es-una-url");
    expect(result.domain).toBe("");
    expect(result.pageUrl).toBe("no-es-una-url");
  });

  it("no devuelve Map, Set ni funciones (cruza el límite server→cliente)", () => {
    const result = extractSocialPreview(
      doc(`<title>X</title><meta property="og:image" content="https://cdn.test/a.png">`),
      PAGE_URL
    );
    for (const value of Object.values(result) as unknown[]) {
      expect(["string", "boolean", "object"]).toContain(typeof value);
      // Los únicos `object` admitidos son `null`: ni Map, ni Set, ni función.
      if (typeof value === "object") expect(value).toBeNull();
    }
    // Serializa y vuelve idéntico: prueba positiva de que todo es primitivo.
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("lee og:image, og:type y twitter:card cuando están declarados", () => {
    const result = extractSocialPreview(
      doc(
        `<meta property="og:image" content="https://cdn.test/a.png">
         <meta property="og:type" content="article">
         <meta name="twitter:card" content="summary_large_image">`
      ),
      PAGE_URL
    );
    expect(result.ogImage).toBe("https://cdn.test/a.png");
    expect(result.ogTypeDeclared).toBe(true);
    expect(result.twitterCardDeclared).toBe("summary_large_image");
  });

  it("deja ogImage null y las banderas en false cuando no hay ninguna etiqueta", () => {
    const result = extractSocialPreview(doc(``), PAGE_URL);
    expect(result.ogImage).toBeNull();
    expect(result.ogTypeDeclared).toBe(false);
    expect(result.ogUrlDeclared).toBe(false);
    expect(result.twitterCardDeclared).toBeNull();
  });

  it("solo ensancha la tarjeta de X con un summary_large_image explícito", () => {
    const variantFor = (card: string | null) =>
      extractSocialPreview(
        doc(card == null ? `` : `<meta name="twitter:card" content="${card}">`),
        PAGE_URL
      ).twitterCardVariant;

    expect(variantFor("summary_large_image")).toBe("summary_large_image");
    expect(variantFor("  SUMMARY_LARGE_IMAGE  ")).toBe("summary_large_image");
    // Ausente, inválido o summary explícito → siempre la variante chica.
    expect(variantFor(null)).toBe("summary");
    expect(variantFor("summary")).toBe("summary");
    expect(variantFor("photo")).toBe("summary");
    expect(variantFor("player")).toBe("summary");
  });

  it("aplica el respaldo OG→Twitter en título, descripción e imagen", () => {
    const result = extractSocialPreview(
      doc(
        `<meta property="og:title" content="OG título">
         <meta property="og:description" content="OG descripción">
         <meta property="og:image" content="https://cdn.test/og.png">`
      ),
      PAGE_URL
    );
    expect(result.twitterTitle).toBe("OG título");
    expect(result.twitterDescription).toBe("OG descripción");
    expect(result.twitterImage).toBe("https://cdn.test/og.png");
  });

  it("prefiere las etiquetas twitter:* propias cuando existen", () => {
    const result = extractSocialPreview(
      doc(
        `<meta property="og:title" content="OG título">
         <meta name="twitter:title" content="X título">
         <meta name="twitter:description" content="X descripción">
         <meta name="twitter:image" content="https://cdn.test/x.png">`
      ),
      PAGE_URL
    );
    expect(result.twitterTitle).toBe("X título");
    expect(result.twitterDescription).toBe("X descripción");
    expect(result.twitterImage).toBe("https://cdn.test/x.png");
  });

  it("trunca a 500 caracteres un título y una descripción desmedidos", () => {
    const long = "a".repeat(900);
    const result = extractSocialPreview(
      doc(
        `<meta property="og:title" content="${long}"><meta property="og:description" content="${long}">`
      ),
      PAGE_URL
    );
    expect(result.title).toHaveLength(500);
    expect(result.description).toHaveLength(500);
  });
});

/** Head con las 5 etiquetas candidatas del snippet declaradas y admitidas. */
const FULLY_DECLARED = `<meta property="og:title" content="Título">
   <meta property="og:description" content="Descripción">
   <meta property="og:url" content="https://example.com/blog/post">
   <meta property="og:type" content="article">
   <meta name="twitter:card" content="summary">`;

describe("extractSocialPreview — fixSnippet", () => {
  it("es null cuando las 5 etiquetas candidatas están declaradas", () => {
    expect(extractSocialPreview(doc(FULLY_DECLARED), PAGE_URL).fixSnippet).toBeNull();
  });

  it("omite og:title cuando tampoco hay <title> nativo: no hay valor real que ofrecer", () => {
    const snippet = extractSocialPreview(
      doc(`<meta property="og:description" content="D">
           <meta property="og:url" content="u">
           <meta property="og:type" content="website">
           <meta name="twitter:card" content="summary">`),
      PAGE_URL
    ).fixSnippet;
    expect(snippet).toBeNull();
  });

  it("usa el <title> nativo exacto cuando falta og:title", () => {
    const snippet = extractSocialPreview(
      doc(`<title>Guía de auditoría</title>
           <meta property="og:description" content="D">
           <meta property="og:url" content="u">
           <meta property="og:type" content="website">
           <meta name="twitter:card" content="summary">`),
      PAGE_URL
    ).fixSnippet;
    expect(snippet).toBe('<meta property="og:title" content="Guía de auditoría">');
  });

  it("omite og:description cuando tampoco hay meta description nativa", () => {
    const snippet = extractSocialPreview(
      doc(`<title>T</title>
           <meta property="og:title" content="T">
           <meta property="og:url" content="u">
           <meta property="og:type" content="website">
           <meta name="twitter:card" content="summary">`),
      PAGE_URL
    ).fixSnippet;
    expect(snippet).toBeNull();
  });

  it("usa la meta description nativa cuando falta og:description", () => {
    const snippet = extractSocialPreview(
      doc(`<meta name="description" content="Resumen real">
           <meta property="og:title" content="T">
           <meta property="og:url" content="u">
           <meta property="og:type" content="website">
           <meta name="twitter:card" content="summary">`),
      PAGE_URL
    ).fixSnippet;
    expect(snippet).toBe('<meta property="og:description" content="Resumen real">');
  });

  it("prellena og:url con la URL real rastreada, siempre disponible", () => {
    const snippet = extractSocialPreview(
      doc(`<meta property="og:title" content="T">
           <meta property="og:description" content="D">
           <meta property="og:type" content="website">
           <meta name="twitter:card" content="summary">`),
      PAGE_URL
    ).fixSnippet;
    expect(snippet).toBe(`<meta property="og:url" content="${PAGE_URL}">`);
  });

  it("prellena og:type con el default técnico website", () => {
    const snippet = extractSocialPreview(
      doc(`<meta property="og:title" content="T">
           <meta property="og:description" content="D">
           <meta property="og:url" content="u">
           <meta name="twitter:card" content="summary">`),
      PAGE_URL
    ).fixSnippet;
    expect(snippet).toBe('<meta property="og:type" content="website">');
  });

  it("propone twitter:card summary_large_image sólo cuando hay og:image", () => {
    const head = (extra: string) => `<meta property="og:title" content="T">
      <meta property="og:description" content="D">
      <meta property="og:url" content="u">
      <meta property="og:type" content="website">${extra}`;

    expect(extractSocialPreview(doc(head("")), PAGE_URL).fixSnippet).toBe(
      '<meta name="twitter:card" content="summary">'
    );
    expect(
      extractSocialPreview(
        doc(head(`<meta property="og:image" content="https://cdn.test/a.png">`)),
        PAGE_URL
      ).fixSnippet
    ).toBe('<meta name="twitter:card" content="summary_large_image">');
  });

  it("repone twitter:card cuando el valor declarado no está admitido", () => {
    const snippet = extractSocialPreview(
      doc(`<meta property="og:title" content="T">
           <meta property="og:description" content="D">
           <meta property="og:url" content="u">
           <meta property="og:type" content="website">
           <meta name="twitter:card" content="photo">`),
      PAGE_URL
    ).fixSnippet;
    expect(snippet).toBe('<meta name="twitter:card" content="summary">');
  });

  it("emite las 5 líneas en orden fijo cuando no hay ninguna etiqueta declarada", () => {
    const snippet = extractSocialPreview(
      doc(`<title>T real</title><meta name="description" content="D real">`),
      PAGE_URL
    ).fixSnippet;
    expect(snippet).toBe(
      [
        '<meta property="og:title" content="T real">',
        '<meta property="og:description" content="D real">',
        `<meta property="og:url" content="${PAGE_URL}">`,
        '<meta property="og:type" content="website">',
        '<meta name="twitter:card" content="summary">',
      ].join("\n")
    );
  });

  it("nunca propone og:image, ni siquiera cuando falta por completo", () => {
    const snippet = extractSocialPreview(doc(`<title>T</title>`), PAGE_URL).fixSnippet;
    expect(snippet).not.toContain("og:image");
  });

  it("escapa el contenido hostil del sitio auditado dentro del snippet (T-32-11)", () => {
    const snippet = extractSocialPreview(
      doc(`<title>A &amp; B "C"</title>`),
      PAGE_URL
    ).fixSnippet;
    expect(snippet).toContain('content="A &amp; B &quot;C&quot;">');
  });
});
