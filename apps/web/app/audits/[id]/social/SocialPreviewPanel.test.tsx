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

function tab(i: number): HTMLElement {
  const el = tabs()[i];
  if (!el) throw new Error(`no hay tab en la posición ${i}`);
  return el;
}

function panel(i: number): HTMLElement {
  const el = panels()[i];
  if (!el) throw new Error(`no hay tabpanel en la posición ${i}`);
  return el;
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

    fireEvent.keyDown(tab(0), { key: "ArrowRight" });
    expect(focusable()).toHaveLength(1);
    expect(focusable()[0]).toHaveTextContent("Facebook / LinkedIn");
  });

  it("ArrowRight avanza con wrap desde X hasta Google", () => {
    render(<SocialPreviewPanel data={makePreview()} auditId="a1" />);

    fireEvent.keyDown(tab(0), { key: "ArrowRight" });
    expect(tab(1)).toHaveAttribute("aria-selected", "true");
    expect(tab(1)).toHaveFocus();
    expect(panel(1)).not.toHaveAttribute("hidden");

    fireEvent.keyDown(tab(1), { key: "ArrowRight" });
    expect(tab(2)).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tab(2), { key: "ArrowRight" });
    expect(tab(0)).toHaveAttribute("aria-selected", "true");
    expect(tab(0)).toHaveFocus();
  });

  it("ArrowLeft desde el primer tab envuelve hasta el último", () => {
    render(<SocialPreviewPanel data={makePreview()} auditId="a1" />);

    fireEvent.keyDown(tab(0), { key: "ArrowLeft" });
    expect(tab(2)).toHaveAttribute("aria-selected", "true");
    expect(tab(2)).toHaveFocus();
    expect(panel(2)).not.toHaveAttribute("hidden");
    expect(panel(0)).toHaveAttribute("hidden");
  });

  it("Home lleva al primer tab y End al último", () => {
    render(<SocialPreviewPanel data={makePreview()} auditId="a1" />);

    fireEvent.keyDown(tab(0), { key: "End" });
    expect(tab(2)).toHaveAttribute("aria-selected", "true");
    expect(tab(2)).toHaveFocus();

    fireEvent.keyDown(tab(2), { key: "Home" });
    expect(tab(0)).toHaveAttribute("aria-selected", "true");
    expect(tab(0)).toHaveFocus();
  });

  it("Enter y Espacio activan el panel del tab enfocado", () => {
    render(<SocialPreviewPanel data={makePreview()} auditId="a1" />);

    fireEvent.click(tab(1));
    expect(panel(1)).not.toHaveAttribute("hidden");

    fireEvent.keyDown(tab(1), { key: "Enter" });
    expect(tab(1)).toHaveAttribute("aria-selected", "true");
    expect(panel(1)).not.toHaveAttribute("hidden");

    fireEvent.keyDown(tab(1), { key: " " });
    expect(tab(1)).toHaveAttribute("aria-selected", "true");
    expect(panel(1)).not.toHaveAttribute("hidden");
  });

  it("cruza aria-controls/aria-labelledby entre cada tab y su panel", () => {
    render(<SocialPreviewPanel data={makePreview()} auditId="a1" />);

    for (let i = 0; i < 3; i += 1) {
      expect(tab(i)).toHaveAttribute("aria-controls", panel(i).id);
      expect(panel(i)).toHaveAttribute("aria-labelledby", tab(i).id);
      expect(panel(i)).toHaveAttribute("tabindex", "0");
    }
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
