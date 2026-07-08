// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { JsonLdBadge } from "./JsonLdBadge";

afterEach(() => {
  cleanup(); // globals off → sin auto-cleanup; desmontar entre tests.
});

describe("JsonLdBadge", () => {
  it("estado error: un issue schema critical → 'JSON-LD con errores'", () => {
    render(<JsonLdBadge schemaSeverities={["critical"]} nodeCount={2} />);
    expect(screen.getByText("JSON-LD con errores")).toBeInTheDocument();
  });

  it("estado advertencia: warning sin critical → 'JSON-LD con advertencias'", () => {
    render(<JsonLdBadge schemaSeverities={["warning"]} nodeCount={2} />);
    expect(screen.getByText("JSON-LD con advertencias")).toBeInTheDocument();
  });

  it("estado correcto: sin problemas y con grafo → '{n} entidad(es) JSON-LD'", () => {
    render(<JsonLdBadge schemaSeverities={["ok"]} nodeCount={3} />);
    expect(screen.getByText("3 entidad(es) JSON-LD")).toBeInTheDocument();
  });

  it("estado sin JSON-LD: sin problemas y sin grafo → 'Sin JSON-LD'", () => {
    render(<JsonLdBadge schemaSeverities={[]} nodeCount={0} />);
    expect(screen.getByText("Sin JSON-LD")).toBeInTheDocument();
  });

  it("caso mixto critical+warning → precedencia error 'JSON-LD con errores'", () => {
    render(<JsonLdBadge schemaSeverities={["warning", "critical"]} nodeCount={1} />);
    expect(screen.getByText("JSON-LD con errores")).toBeInTheDocument();
    expect(screen.queryByText("JSON-LD con advertencias")).not.toBeInTheDocument();
  });
});
