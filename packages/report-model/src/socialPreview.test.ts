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
