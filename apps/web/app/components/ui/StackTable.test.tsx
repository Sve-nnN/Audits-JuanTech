// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import type { ReportStack, ReportStackAxis, Confidence } from "@auditor/report-model";
import { StackTable, CONFIDENCE_BADGE } from "./StackTable";

afterEach(() => {
  cleanup(); // globals off → desmontar entre tests.
});

function axis(value: string | null, confidence: Confidence): ReportStackAxis {
  return { value, confidence };
}

/** Stack completo con overrides; por defecto 5 ejes detectados + 3 analytics. */
function makeStack(over: Partial<ReportStack> = {}): ReportStack {
  return {
    cms: over.cms ?? axis("WordPress (Elementor)", "alto"),
    cdn: over.cdn ?? axis("Cloudflare", "medio"),
    hosting: over.hosting ?? axis("Vercel", "bajo"),
    jsFramework: over.jsFramework ?? axis("Next.js", "alto"),
    analytics:
      over.analytics ??
      [axis("GA4", "alto"), axis("GTM", "alto"), axis("Meta Pixel", "medio")],
  };
}

describe("StackTable", () => {
  it("mapea confianza→variante y nunca usa la variante critical", () => {
    expect(CONFIDENCE_BADGE).toEqual({
      alto: "ok",
      medio: "warning",
      bajo: "warningSubtle",
      "no-detectado": "neutral",
    });
    expect(Object.values(CONFIDENCE_BADGE)).not.toContain("critical");
  });

  it("REGRESIÓN: CONFIDENCE_BADGE (exportado de un Server Component) nunca contiene un ícono/función", () => {
    // StackTable.tsx no lleva "use client" -- cualquier valor exportado de acá
    // que termine pasado como prop a un Client Component (Badge) debe ser
    // serializable (string, number, plain object/array). Un componente lucide
    // es una función; pasarlo así rompía en runtime con "Functions cannot be
    // passed directly to Client Components" la primera vez que una auditoría
    // real renderizó esta tabla. El ícono correspondiente ahora vive
    // enteramente en Badge.tsx (Client Component) vía ConfidenceBadge — este
    // test evita que alguien reintroduzca un ícono acá por error.
    for (const value of Object.values(CONFIDENCE_BADGE)) {
      expect(typeof value).toBe("string");
    }
  });

  it("renderiza siempre 5 filas en orden con th scope=row", () => {
    render(<StackTable stack={makeStack()} />);
    const headers = screen.getAllByRole("rowheader").map((el) => el.textContent);
    expect(headers).toEqual([
      "CMS",
      "CDN / proxy",
      "Hosting",
      "Framework JS",
      "Analytics",
    ]);
  });

  it("renderiza el CMS combinado 'WordPress (Elementor)' como texto en una sola celda", () => {
    render(<StackTable stack={makeStack()} />);
    expect(screen.getByText("WordPress (Elementor)")).toBeInTheDocument();
  });

  it("muestra la etiqueta de confianza por eje detectado (alta/media/baja)", () => {
    render(
      <StackTable
        stack={makeStack({
          cms: axis("WordPress", "alto"),
          cdn: axis("Cloudflare", "medio"),
          hosting: axis("Vercel", "bajo"),
          jsFramework: axis(null, "no-detectado"),
          analytics: [],
        })}
      />,
    );
    expect(screen.getByText("Confianza alta")).toBeInTheDocument();
    expect(screen.getByText("Confianza media")).toBeInTheDocument();
    expect(screen.getByText("Confianza baja")).toBeInTheDocument();
  });

  it("muestra un eje no-detectado con 'No detectado con certeza' + Badge 'No detectado' sin ocultar la fila", () => {
    render(<StackTable stack={makeStack({ hosting: axis(null, "no-detectado") })} />);
    const row = screen.getByRole("rowheader", { name: "Hosting" }).closest("tr")!;
    expect(within(row).getByText("No detectado con certeza")).toBeInTheDocument();
    expect(within(row).getByText("No detectado")).toBeInTheDocument();
    // Las 5 filas siguen presentes: ningún eje se oculta.
    expect(screen.getAllByRole("rowheader")).toHaveLength(5);
  });

  it("Analytics con 0 herramientas → estado no detectado", () => {
    render(<StackTable stack={makeStack({ analytics: [] })} />);
    const row = screen.getByRole("rowheader", { name: "Analytics" }).closest("tr")!;
    expect(within(row).getByText("No detectado con certeza")).toBeInTheDocument();
  });

  it("Analytics con 1 herramienta → un chip, sin estado no detectado", () => {
    render(<StackTable stack={makeStack({ analytics: [axis("GA4", "alto")] })} />);
    const row = screen.getByRole("rowheader", { name: "Analytics" }).closest("tr")!;
    expect(within(row).getByText("GA4")).toBeInTheDocument();
    expect(within(row).queryByText("No detectado con certeza")).not.toBeInTheDocument();
  });

  it("Analytics con N herramientas → N chips con el nombre como texto", () => {
    render(
      <StackTable
        stack={makeStack({
          analytics: [
            axis("GA4", "alto"),
            axis("GTM", "alto"),
            axis("Meta Pixel", "medio"),
          ],
        })}
      />,
    );
    const row = screen.getByRole("rowheader", { name: "Analytics" }).closest("tr")!;
    expect(within(row).getByText("GA4")).toBeInTheDocument();
    expect(within(row).getByText("GTM")).toBeInTheDocument();
    expect(within(row).getByText("Meta Pixel")).toBeInTheDocument();
  });

  it("cada chip de analytics expone su confianza como texto accesible (WR-02: color nunca señal única)", () => {
    render(
      <StackTable
        stack={makeStack({
          analytics: [axis("GA4", "alto"), axis("Meta Pixel", "medio")],
        })}
      />,
    );
    const row = screen.getByRole("rowheader", { name: "Analytics" }).closest("tr")!;
    // El texto de confianza acompaña al nombre en el mismo chip, no solo color+icono.
    expect(within(row).getByText(/\(Confianza alta\)/)).toBeInTheDocument();
    expect(within(row).getByText(/\(Confianza media\)/)).toBeInTheDocument();
  });

  it("renderiza los value como texto plano (React escapa, sin inyección de HTML)", () => {
    const payload = '<img src=x onerror="alert(1)">';
    const { container } = render(
      <StackTable stack={makeStack({ cms: axis(payload, "alto") })} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(payload)).toBeInTheDocument();
  });
});
