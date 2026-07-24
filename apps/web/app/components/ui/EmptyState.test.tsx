// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EmptyState, ErrorState } from "./EmptyState";

afterEach(() => {
  cleanup();
});

describe("EmptyState", () => {
  it("variant='empty' (default) renderiza ícono + copy placeholder", () => {
    render(<EmptyState />);
    expect(screen.getByText("Todavia no hay nada por aca")).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("variant='error' renderiza role=alert + ícono AlertTriangle por defecto", () => {
    render(<ErrorState />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("variant='success' renderiza el ícono CheckCircle2 por defecto sin necesitar la prop `icon`", () => {
    // REGRESIÓN: audits/[id]/page.tsx es un Server Component (sin "use
    // client") y antes pasaba `icon={CheckCircle2}` directo a EmptyState (un
    // Client Component) para este caso -- React no puede serializar un
    // componente (función) como prop cruzando ese límite, y rompía en
    // runtime con "Functions cannot be passed directly to Client Components"
    // la primera vez que una auditoría real terminó sin issues. El variant
    // "success" resuelve el ícono enteramente del lado cliente, sin que el
    // caller necesite pasar un componente de ícono.
    render(<EmptyState variant="success" title="Sin issues criticos ni de advertencia" />);
    expect(screen.getByText("Sin issues criticos ni de advertencia")).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("título custom reemplaza el placeholder pero mantiene el ícono por variant", () => {
    render(<EmptyState variant="success" title="Todo bien" />);
    expect(screen.getByText("Todo bien")).toBeInTheDocument();
    expect(screen.queryByText("Todo en orden")).not.toBeInTheDocument();
  });
});
