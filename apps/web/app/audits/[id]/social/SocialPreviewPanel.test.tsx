// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { SocialPreviewData } from "@auditor/report-model";
import { SocialPreviewPanel } from "./SocialPreviewPanel";

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
    twitterCardDeclared: "summary",
    twitterCardVariant: "summary",
    twitterTitle: "Título para X",
    twitterDescription: "Descripción para X.",
    twitterImage: "https://example.com/twitter.jpg",
    fixSnippet: null,
    ...over,
  };
}

function tabs(): HTMLElement[] {
  return screen.getAllByRole("tab", { hidden: true });
}

/** Los 3 paneles viven siempre en el DOM; sólo uno no está `hidden`. */
function panels(): HTMLElement[] {
  return screen.getAllByRole("tabpanel", { hidden: true });
}

describe("SocialPreviewPanel", () => {
  it("monta con Google activo y los otros dos paneles presentes pero hidden", () => {
    const { container } = render(<SocialPreviewPanel data={makePreview()} auditId="a1" />);

    const [google, meta, x] = tabs();
    expect(google).toHaveTextContent("Google");
    expect(meta).toHaveTextContent("Facebook / LinkedIn");
    expect(x).toHaveTextContent("X");

    expect(google).toHaveAttribute("aria-selected", "true");
    expect(meta).toHaveAttribute("aria-selected", "false");
    expect(x).toHaveAttribute("aria-selected", "false");

    const [gp, mp, xp] = panels();
    expect(gp).not.toHaveAttribute("hidden");
    expect(mp).toHaveAttribute("hidden");
    expect(xp).toHaveAttribute("hidden");

    // Nunca desmontados: el contenido de los tres sigue en el árbol.
    expect(container.innerHTML).toContain("Título para X");
  });

  it("mantiene exactamente un tab con tabIndex 0 (roving tabindex)", () => {
    render(<SocialPreviewPanel data={makePreview()} auditId="a1" />);

    const focusable = () => tabs().filter((t) => t.getAttribute("tabindex") === "0");
    expect(focusable()).toHaveLength(1);
    expect(focusable()[0]).toHaveTextContent("Google");

    fireEvent.keyDown(tabs()[0], { key: "ArrowRight" });
    expect(focusable()).toHaveLength(1);
    expect(focusable()[0]).toHaveTextContent("Facebook / LinkedIn");
  });

  it("ArrowRight avanza con wrap desde X hasta Google", () => {
    render(<SocialPreviewPanel data={makePreview()} auditId="a1" />);

    fireEvent.keyDown(tabs()[0], { key: "ArrowRight" });
    expect(tabs()[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[1]).toHaveFocus();
    expect(panels()[1]).not.toHaveAttribute("hidden");

    fireEvent.keyDown(tabs()[1], { key: "ArrowRight" });
    expect(tabs()[2]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tabs()[2], { key: "ArrowRight" });
    expect(tabs()[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[0]).toHaveFocus();
  });

  it("ArrowLeft desde el primer tab envuelve hasta el último", () => {
    render(<SocialPreviewPanel data={makePreview()} auditId="a1" />);

    fireEvent.keyDown(tabs()[0], { key: "ArrowLeft" });
    expect(tabs()[2]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[2]).toHaveFocus();
    expect(panels()[2]).not.toHaveAttribute("hidden");
    expect(panels()[0]).toHaveAttribute("hidden");
  });

  it("Home lleva al primer tab y End al último", () => {
    render(<SocialPreviewPanel data={makePreview()} auditId="a1" />);

    fireEvent.keyDown(tabs()[0], { key: "End" });
    expect(tabs()[2]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[2]).toHaveFocus();

    fireEvent.keyDown(tabs()[2], { key: "Home" });
    expect(tabs()[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[0]).toHaveFocus();
  });

  it("Enter y Espacio activan el panel del tab enfocado", () => {
    render(<SocialPreviewPanel data={makePreview()} auditId="a1" />);

    fireEvent.click(tabs()[1]);
    expect(panels()[1]).not.toHaveAttribute("hidden");

    fireEvent.keyDown(tabs()[1], { key: "Enter" });
    expect(tabs()[1]).toHaveAttribute("aria-selected", "true");
    expect(panels()[1]).not.toHaveAttribute("hidden");

    fireEvent.keyDown(tabs()[1], { key: " " });
    expect(tabs()[1]).toHaveAttribute("aria-selected", "true");
    expect(panels()[1]).not.toHaveAttribute("hidden");
  });

  it("cruza aria-controls/aria-labelledby entre cada tab y su panel", () => {
    render(<SocialPreviewPanel data={makePreview()} auditId="a1" />);

    tabs().forEach((tab, i) => {
      const panel = panels()[i];
      expect(tab).toHaveAttribute("aria-controls", panel.id);
      expect(panel).toHaveAttribute("aria-labelledby", tab.id);
      expect(panel).toHaveAttribute("tabindex", "0");
    });
  });

  it("monta FixSnippet cuando hay snippet que ofrecer", () => {
    render(
      <SocialPreviewPanel
        data={makePreview({ fixSnippet: '<meta property="og:type" content="website">' })}
        auditId="a1"
      />,
    );

    expect(screen.getByText("Etiquetas que faltan")).toBeInTheDocument();
    expect(
      screen.getByText('<meta property="og:type" content="website">'),
    ).toBeInTheDocument();
  });

  it("no renderiza FixSnippet en absoluto cuando fixSnippet es null", () => {
    const { container } = render(<SocialPreviewPanel data={makePreview()} auditId="a1" />);

    expect(screen.queryByText("Etiquetas que faltan")).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain("Etiquetas que faltan");
  });
});
