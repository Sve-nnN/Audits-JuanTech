// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PreviewImage } from "./PreviewImage";

afterEach(() => {
  cleanup();
});

const OG_IMAGE = "https://example.com/og image.jpg?v=1&x=2";

describe("PreviewImage", () => {
  it('con imageStatus="none" pinta el literal "Sin imagen" y ningún <img>', () => {
    const { container } = render(
      <PreviewImage auditId="a1" ogImage={null} imageStatus="none" aspectRatio="1.91 / 1" />,
    );

    expect(screen.getByText("Sin imagen")).toBeInTheDocument();
    expect(screen.queryByText("Imagen no disponible")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it('con imageStatus="unavailable" pinta el placeholder y no emite ningún request', () => {
    const { container } = render(
      <PreviewImage
        auditId="a1"
        ogImage={OG_IMAGE}
        imageStatus="unavailable"
        aspectRatio="1.91 / 1"
      />,
    );

    expect(screen.getByText("Imagen no disponible")).toBeInTheDocument();
    expect(
      screen.getByText(
        "La imagen declarada en og:image no se pudo verificar. Revisa el issue de esta página.",
      ),
    ).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it('con imageStatus="ok" pinta la imagen vía proxy, decorativa y perezosa', () => {
    const { container } = render(
      <PreviewImage auditId="a1" ogImage={OG_IMAGE} imageStatus="ok" aspectRatio="1.91 / 1" />,
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute(
      "src",
      `/api/audits/a1/preview-image?url=${encodeURIComponent(OG_IMAGE)}`,
    );
    // El valor crudo nunca se interpola: los separadores de query van escapados.
    expect(img?.getAttribute("src")).not.toContain("&x=2");
    expect(img?.getAttribute("alt")).toBe("");
    expect(img).toHaveAttribute("role", "presentation");
    expect(img).toHaveAttribute("loading", "lazy");
  });

  it('con imageStatus="ok" pero onError del <img>, conmuta al placeholder de error', () => {
    const { container } = render(
      <PreviewImage auditId="a1" ogImage={OG_IMAGE} imageStatus="ok" aspectRatio="1.91 / 1" />,
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    fireEvent.error(img as HTMLImageElement);

    expect(screen.getByText("Imagen no disponible")).toBeInTheDocument();
    expect(screen.getByText("No se pudo cargar la imagen.")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it('con imageStatus="ok" pero sin ogImage cae al literal "Sin imagen"', () => {
    const { container } = render(
      <PreviewImage auditId="a1" ogImage={null} imageStatus="ok" aspectRatio="1 / 1" />,
    );

    expect(screen.getByText("Sin imagen")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});
