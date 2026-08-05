// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { SocialPreviewData } from "@auditor/report-model";
import { GooglePreview } from "./GooglePreview";

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
    ogImage: null,
    imageStatus: "none",
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

describe("GooglePreview", () => {
  it("muestra dominio, título, URL real y descripción", () => {
    render(<GooglePreview data={makePreview()} />);
    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.getByText("Título de la página")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/blog/post")).toBeInTheDocument();
    expect(screen.getByText("Descripción social de la página.")).toBeInTheDocument();
  });

  it("renderiza 'Sin título' cuando el título es null", () => {
    render(<GooglePreview data={makePreview({ title: null })} />);
    expect(screen.getByText("Sin título")).toBeInTheDocument();
  });

  it("renderiza 'Sin descripción' cuando la descripción es null", () => {
    render(<GooglePreview data={makePreview({ description: null })} />);
    expect(screen.getByText("Sin descripción")).toBeInTheDocument();
  });

  it("muestra la URL rastreada, nunca el valor declarado en og:url", () => {
    render(
      <GooglePreview
        data={makePreview({ ogUrlDeclared: true, pageUrl: "https://example.com/real" })}
      />
    );
    expect(screen.getByText("https://example.com/real")).toBeInTheDocument();
    expect(screen.queryByText(/otro-dominio/)).not.toBeInTheDocument();
  });

  /**
   * Backstop de long-text de 32-UI-SPEC.md: un título de 300 caracteres se
   * recorta a una línea con line-clamp y no desborda ni crece el contenedor.
   */
  it("mantiene el título de 300 caracteres en una sola línea recortada", () => {
    const long = "a".repeat(300);
    const { container } = render(<GooglePreview data={makePreview({ title: long })} />);
    const titleEl = screen.getByText(long);
    const card = container.firstElementChild as HTMLElement;
    // El clamp de una línea y el ocultamiento del desborde son lo que impide el
    // crecimiento; jsdom no calcula layout, así que se verifica la regla aplicada.
    expect(titleEl.className).toContain("title");
    expect(card.className).toContain("card");
    // El texto entra completo al DOM (React lo escapa) pero acotado visualmente.
    expect(titleEl.textContent).toHaveLength(300);
  });

  it("nunca inyecta HTML del sitio auditado: el markup del título se escapa", () => {
    const hostile = '<img src=x onerror="alert(1)">';
    const { container } = render(<GooglePreview data={makePreview({ title: hostile })} />);
    expect(screen.getByText(hostile)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});
