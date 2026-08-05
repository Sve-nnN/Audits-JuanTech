// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { FixSnippet } from "./FixSnippet";

const SNIPPET =
  '<meta property="og:title" content="Título real">\n<meta name="twitter:card" content="summary">';

/** Instala (o retira) `navigator.clipboard`; jsdom no lo trae por defecto. */
function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true });
}

let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;
let anchorClick: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  createObjectURL = vi.fn(() => "blob:mock");
  revokeObjectURL = vi.fn();
  Object.defineProperty(URL, "createObjectURL", {
    value: createObjectURL,
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: revokeObjectURL,
    configurable: true,
  });
  anchorClick = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  setClipboard(undefined);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Click que deja correr las promesas del handler antes de aserciones. */
async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

describe("FixSnippet", () => {
  it("con Clipboard API copia el texto exacto y anuncia la confirmación, que caduca a los 4000ms", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard({ writeText });

    render(<FixSnippet snippet={SNIPPET} />);
    const button = screen.getByRole("button", { name: /copiar snippet/i });
    expect(button).toHaveAttribute("type", "button");

    await click(button);

    expect(writeText).toHaveBeenCalledWith(SNIPPET);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Copiado al portapapeles");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(createObjectURL).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText("Copiado al portapapeles")).not.toBeInTheDocument();
  });

  it("sin Clipboard API muestra 'Descargar snippet' desde el montaje y descarga al hacer click", async () => {
    setClipboard(undefined);

    render(<FixSnippet snippet={SNIPPET} />);
    const button = screen.getByRole("button", { name: /descargar snippet/i });
    expect(button).toHaveAttribute("type", "button");
    expect(screen.queryByRole("button", { name: /copiar snippet/i })).not.toBeInTheDocument();

    await click(button);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe("text/html");
    await expect(blob.text()).resolves.toBe(SNIPPET);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Copiado al portapapeles")).not.toBeInTheDocument();
  });

  it("si writeText rechaza, cae a la descarga sin anunciar 'Copiado'", async () => {
    const writeText = vi.fn(() => Promise.reject(new Error("denied")));
    setClipboard({ writeText });

    render(<FixSnippet snippet={SNIPPET} />);
    const button = screen.getByRole("button", { name: /copiar snippet/i });

    await click(button);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Copiado al portapapeles")).not.toBeInTheDocument();
  });

  it("muestra el snippet como texto inerte dentro de <code>, nunca como HTML", () => {
    const { container } = render(<FixSnippet snippet={SNIPPET} />);

    const code = container.querySelector("pre code");
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe(SNIPPET);
    // El markup del snippet no se interpretó: no hay <meta> real en el árbol.
    expect(container.querySelector("meta")).toBeNull();
  });

  it("backstop de desbordamiento: 5 etiquetas largas entran completas en el bloque scrolleable y el botón queda fuera de él", () => {
    const long = [
      `<meta property="og:title" content="${"t".repeat(300)}">`,
      `<meta property="og:description" content="${"d".repeat(300)}">`,
      `<meta property="og:url" content="https://example.com/${"a".repeat(300)}">`,
      '<meta property="og:type" content="website">',
      '<meta name="twitter:card" content="summary_large_image">',
    ].join("\n");

    const { container } = render(<FixSnippet snippet={long} />);

    const pre = container.querySelector("pre");
    expect(pre?.textContent).toBe(long);
    // El botón vive fuera del contenedor scrolleable: siempre alcanzable.
    const button = screen.getByRole("button", { name: /copiar snippet|descargar snippet/i });
    expect(pre?.contains(button)).toBe(false);
  });

  it("muestra el encabezado y la ayuda del contrato de copy", () => {
    render(<FixSnippet snippet={SNIPPET} />);

    expect(screen.getByText("Etiquetas que faltan")).toBeInTheDocument();
    expect(
      screen.getByText("Pega estas etiquetas dentro del <head> de la página.")
    ).toBeInTheDocument();
  });
});
