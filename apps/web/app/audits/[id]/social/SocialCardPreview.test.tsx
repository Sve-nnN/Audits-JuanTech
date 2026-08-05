// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { SocialPreviewData } from "@auditor/report-model";
import { SocialCardPreview } from "./SocialCardPreview";

afterEach(() => {
  cleanup();
});

function makePreview(over: Partial<SocialPreviewData> = {}): SocialPreviewData {
  return {
    pageId: "p-1",
    pageUrl: "https://example.com/blog/post",
    domain: "example.com",
    title: "Título de la página",
    ogTitleDeclared: true,
    description: "Descripción social de la página.",
    ogDescriptionDeclared: true,
    ogImage: "https://example.com/og.jpg",
    imageStatus: "ok",
    ogUrlDeclared: false,
    ogTypeDeclared: false,
    twitterCardDeclared: null,
    twitterCardVariant: "summary",
    twitterTitle: null,
    twitterDescription: null,
    twitterImage: null,
    fixSnippet: null,
    ...over,
  };
}

describe("SocialCardPreview", () => {
  it("con datos completos renderiza imagen 1.91:1, dominio, título y descripción", () => {
    const { container } = render(<SocialCardPreview data={makePreview()} auditId="a1" />);

    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.getByText("Título de la página")).toBeInTheDocument();
    expect(screen.getByText("Descripción social de la página.")).toBeInTheDocument();

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe(
      `/api/audits/a1/preview-image?url=${encodeURIComponent("https://example.com/og.jpg")}`,
    );
    expect((img?.parentElement as HTMLElement).style.aspectRatio).toBe("1.91 / 1");
  });

  it("renderiza 'Sin título' cuando el título es null", () => {
    render(<SocialCardPreview data={makePreview({ title: null })} auditId="a1" />);
    expect(screen.getByText("Sin título")).toBeInTheDocument();
  });

  it("renderiza 'Sin descripción' cuando la descripción es null", () => {
    render(<SocialCardPreview data={makePreview({ description: null })} auditId="a1" />);
    expect(screen.getByText("Sin descripción")).toBeInTheDocument();
  });

  /**
   * Backstop de long-text de 32-UI-SPEC.md: el título entra completo al DOM
   * pero con la regla de clamp aplicada; jsdom no calcula layout, así que se
   * verifica la regla, no la geometría.
   */
  it("mantiene el título de 300 caracteres en un solo nodo recortado", () => {
    const long = "a".repeat(300);
    render(<SocialCardPreview data={makePreview({ title: long })} auditId="a1" />);

    const titleEl = screen.getByText(long);
    expect(titleEl.className).toContain("title");
    expect(titleEl.textContent).toHaveLength(300);
    expect(titleEl.children).toHaveLength(0);
  });

  it("nunca inyecta HTML del sitio auditado: el markup del título se escapa", () => {
    const hostile = '<img src=x onerror="alert(1)">';
    const { container } = render(
      <SocialCardPreview
        data={makePreview({ title: hostile, ogImage: null, imageStatus: "none" })}
        auditId="a1"
      />,
    );

    expect(screen.getByText(hostile)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});
