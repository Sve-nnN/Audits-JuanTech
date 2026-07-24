// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Badge, ConfidenceBadge, SeverityBadge, DiffBadge } from "./Badge";

afterEach(() => {
  cleanup();
});

describe("Badge", () => {
  it("renderiza el texto sin ícono cuando no se pasa `icon`", () => {
    const { container } = render(<Badge variant="neutral">Sin ícono</Badge>);
    expect(screen.getByText("Sin ícono")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renderiza un ícono aria-hidden cuando se pasa `icon`", () => {
    render(<SeverityBadge severity="critical" />);
    const icon = document.querySelector("svg[aria-hidden='true']");
    expect(icon).toBeInTheDocument();
  });
});

describe("ConfidenceBadge", () => {
  it("renderiza ícono para confianza alto/medio/bajo y ningún ícono para no-detectado", () => {
    const { rerender } = render(<ConfidenceBadge confidence="alto">Alta</ConfidenceBadge>);
    expect(document.querySelector("svg")).toBeInTheDocument();

    rerender(<ConfidenceBadge confidence="medio">Media</ConfidenceBadge>);
    expect(document.querySelector("svg")).toBeInTheDocument();

    rerender(<ConfidenceBadge confidence="bajo">Baja</ConfidenceBadge>);
    expect(document.querySelector("svg")).toBeInTheDocument();

    rerender(<ConfidenceBadge confidence="no-detectado">No detectado</ConfidenceBadge>);
    expect(document.querySelector("svg")).toBeNull();
  });

  it("nunca crashea al resolver el ícono del lado cliente (regresión RSC)", () => {
    // Reproduce exactamente el uso real: un componente que consume
    // ConfidenceBadge con solo `confidence` (un string) como dato de entrada,
    // igual que StackTable.tsx (Server Component) -- si alguien reintroduce
    // un ícono como prop cruzando ese límite, esto seguiría pasando en jsdom
    // (esa violación solo se manifiesta en el pipeline real de Next.js), pero
    // confirma que ConfidenceBadge sigue resolviendo el ícono puramente a
    // partir del string de confianza, sin depender de un valor externo no
    // serializable.
    for (const confidence of ["alto", "medio", "bajo", "no-detectado"] as const) {
      expect(() =>
        render(<ConfidenceBadge confidence={confidence}>x</ConfidenceBadge>),
      ).not.toThrow();
      cleanup();
    }
  });

  it("renderiza children (el texto) igual que un Badge normal", () => {
    render(<ConfidenceBadge confidence="alto">Confianza alta</ConfidenceBadge>);
    expect(screen.getByText("Confianza alta")).toBeInTheDocument();
  });
});

describe("DiffBadge", () => {
  it("renderiza ícono por defecto y lo omite con icon={false}", () => {
    const { rerender } = render(<DiffBadge diff="new" />);
    expect(document.querySelector("svg")).toBeInTheDocument();

    rerender(<DiffBadge diff="new" icon={false} />);
    expect(document.querySelector("svg")).toBeNull();
  });
});
