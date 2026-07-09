import { describe, it, expect } from "vitest";
import { classifyTemplate, TEMPLATE_ORDER } from "./template";

describe("classifyTemplate", () => {
  it("classifies empty path / root as home", () => {
    expect(classifyTemplate("https://example.com/")).toBe("home");
    expect(classifyTemplate("https://example.com")).toBe("home");
  });

  it("classifies product segments", () => {
    expect(classifyTemplate("https://example.com/producto/zapatos")).toBe("product");
    expect(classifyTemplate("https://example.com/product/zapatos")).toBe("product");
    expect(classifyTemplate("https://example.com/p/123")).toBe("product");
  });

  it("classifies category segments", () => {
    expect(classifyTemplate("https://example.com/categoria/ropa")).toBe("category");
    expect(classifyTemplate("https://example.com/category/ropa")).toBe("category");
    expect(classifyTemplate("https://example.com/c/ropa")).toBe("category");
    expect(classifyTemplate("https://example.com/coleccion/ropa")).toBe("category");
    expect(classifyTemplate("https://example.com/collection/ropa")).toBe("category");
  });

  it("classifies article segments", () => {
    expect(classifyTemplate("https://example.com/blog/mi-post")).toBe("article");
    expect(classifyTemplate("https://example.com/articulo/mi-post")).toBe("article");
    expect(classifyTemplate("https://example.com/article/mi-post")).toBe("article");
    expect(classifyTemplate("https://example.com/post/mi-post")).toBe("article");
    expect(classifyTemplate("https://example.com/noticias/mi-post")).toBe("article");
    expect(classifyTemplate("https://example.com/news/mi-post")).toBe("article");
  });

  it("classifies unmatched paths as other", () => {
    expect(classifyTemplate("https://example.com/sobre-nosotros")).toBe("other");
  });

  it("never throws on malformed URLs, degrading to other", () => {
    expect(classifyTemplate("not-a-valid-url")).toBe("other");
  });

  it("matches case-insensitively", () => {
    expect(classifyTemplate("https://example.com/PRODUCTO/1")).toBe("product");
  });

  it("matches full segments only, not substrings", () => {
    expect(classifyTemplate("https://example.com/productos-especiales")).toBe("other");
  });

  it("resolves match priority as product > category > article", () => {
    expect(classifyTemplate("https://example.com/categoria/producto/1")).toBe("product");
  });

  it("exports TEMPLATE_ORDER in display order", () => {
    expect(TEMPLATE_ORDER).toEqual(["home", "category", "product", "article", "other"]);
  });
});
