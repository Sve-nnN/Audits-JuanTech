// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { SocialPreviewData } from "@auditor/report-model";
import { XPreview } from "./XPreview";

afterEach(() => {
  cleanup();
});

const OG_IMAGE = "https://example.com/og.jpg";
const TWITTER_IMAGE = "https://example.com/twitter.jpg";

function makePreview(over: Partial<SocialPreviewData> = {}): SocialPreviewData {
  return {
    pageId: "p-1",
    pageUrl: "https://example.com/blog/post",
    domain: "example.com",
    title: "Título nativo",
    ogTitleDeclared: true,
    description: "Descripción nativa.",
    ogDescriptionDeclared: true,
    ogImage: OG_IMAGE,
    imageStatus: "ok",
    ogUrlDeclared: false,
    ogTypeDeclared: false,
    twitterCardDeclared: "summary_large_image",
    twitterCardVariant: "summary_large_image",
    twitterTitle: "Título para X",
    twitterDescription: "Descripción para X.",
    twitterImage: TWITTER_IMAGE,
    twitterImageStatus: "ok",
    fixSnippet: null,
    ...over,
  };
}

function srcFor(url: string): string {
  return `/api/audits/a1/preview-image?url=${encodeURIComponent(url)}`;
}

describe("XPreview", () => {
  it('con twitterCardVariant="summary_large_image" usa el layout ancho 1.91:1', () => {
    const { container } = render(<XPreview data={makePreview()} auditId="a1" />);

    expect(screen.getByText("Título para X")).toBeInTheDocument();
    expect(screen.getByText("Descripción para X.")).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();

    const img = container.querySelector("img");
    expect((img?.parentElement as HTMLElement).style.aspectRatio).toBe("1.91 / 1");
  });

  it("la variante ancha se alimenta de twitterImage, nunca de ogImage", () => {
    const { container } = render(<XPreview data={makePreview()} auditId="a1" />);

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe(srcFor(TWITTER_IMAGE));
    expect(img?.getAttribute("src")).not.toBe(srcFor(OG_IMAGE));
  });

  /**
   * CR-01: IMG-01 sólo prueba `og:image` por red; cuando `twitter:image` es una
   * URL DISTINTA, su propio veredicto (`twitterImageStatus`) manda, nunca el de
   * `og:image` (`imageStatus`). og:image roto no debe bloquear un
   * twitter:image válido y jamás intentado.
   */
  it("con og:image roto pero twitterImage distinto y OK, sí intenta cargar la imagen (ambas variantes)", () => {
    const wide = render(
      <XPreview
        data={makePreview({ imageStatus: "unavailable", twitterImageStatus: "ok" })}
        auditId="a1"
      />,
    );
    expect(wide.container.querySelector("img")?.getAttribute("src")).toBe(srcFor(TWITTER_IMAGE));
    expect(screen.queryByText("Imagen no disponible")).not.toBeInTheDocument();
    wide.unmount();

    render(
      <XPreview
        data={makePreview({
          imageStatus: "unavailable",
          twitterImageStatus: "ok",
          twitterCardDeclared: "summary",
          twitterCardVariant: "summary",
        })}
        auditId="a1"
      />,
    );
    expect(screen.queryByText("Imagen no disponible")).not.toBeInTheDocument();
  });

  /**
   * CR-01, caso inverso: og:image está OK pero el twitter:image propio está
   * marcado no disponible — el placeholder debe respetar SU verdicto, no el de
   * og:image.
   */
  it("con og:image OK pero twitterImage propio no disponible, muestra el placeholder", () => {
    const { container } = render(
      <XPreview
        data={makePreview({ imageStatus: "ok", twitterImageStatus: "unavailable" })}
        auditId="a1"
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Imagen no disponible")).toBeInTheDocument();
  });

  it('con twitterCardVariant="summary" usa el layout horizontal con imagen 1:1', () => {
    const { container } = render(
      <XPreview
        data={makePreview({ twitterCardDeclared: "summary", twitterCardVariant: "summary" })}
        auditId="a1"
      />,
    );

    const img = container.querySelector("img");
    expect((img?.parentElement as HTMLElement).style.aspectRatio).toBe("1 / 1");
    expect(screen.getByText("Título para X")).toBeInTheDocument();
    expect(screen.getByText("Descripción para X.")).toBeInTheDocument();
  });

  it("sin twitter:card declarado pinta la variante summary y marca el campo ausente", () => {
    const { container } = render(
      <XPreview
        data={makePreview({ twitterCardDeclared: null, twitterCardVariant: "summary" })}
        auditId="a1"
      />,
    );

    expect(screen.getByText("Sin twitter:card")).toBeInTheDocument();
    const img = container.querySelector("img");
    expect((img?.parentElement as HTMLElement).style.aspectRatio).toBe("1 / 1");
  });

  it("con twitter:card declarado no muestra el literal de campo ausente", () => {
    render(<XPreview data={makePreview()} auditId="a1" />);
    expect(screen.queryByText("Sin twitter:card")).not.toBeInTheDocument();
  });

  it("marca los campos de X ausentes con los mismos literales", () => {
    render(
      <XPreview
        data={makePreview({ twitterTitle: null, twitterDescription: null })}
        auditId="a1"
      />,
    );

    expect(screen.getByText("Sin título")).toBeInTheDocument();
    expect(screen.getByText("Sin descripción")).toBeInTheDocument();
  });

  /** Backstop de long-text: el título largo queda en un solo nodo con clamp. */
  it("mantiene el título de 300 caracteres en un solo nodo recortado (ambas variantes)", () => {
    const long = "a".repeat(300);

    const large = render(<XPreview data={makePreview({ twitterTitle: long })} auditId="a1" />);
    const largeTitle = screen.getByText(long);
    expect(largeTitle.className).toContain("title");
    expect(largeTitle.textContent).toHaveLength(300);
    large.unmount();

    render(
      <XPreview
        data={makePreview({
          twitterTitle: long,
          twitterCardDeclared: "summary",
          twitterCardVariant: "summary",
        })}
        auditId="a1"
      />,
    );
    const summaryTitle = screen.getByText(long);
    expect(summaryTitle.className).toContain("title");
    expect(summaryTitle.textContent).toHaveLength(300);
  });

  it("nunca inyecta HTML del sitio auditado: el markup del título se escapa", () => {
    const hostile = '<img src=x onerror="alert(1)">';
    const { container } = render(
      <XPreview
        data={makePreview({ twitterTitle: hostile, twitterImage: null, imageStatus: "none" })}
        auditId="a1"
      />,
    );

    expect(screen.getByText(hostile)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});
