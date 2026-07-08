// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportMenu } from "./ExportMenu";

const AUDIT_ID = "audit-123";

/**
 * Construye un Response falso que satisface el camino fetch→blob→descarga:
 * ok=true, blob() resuelve, y expone el header Content-Disposition con filename.
 */
function okResponse(filename = "auditoria-example-audit-123.pdf") {
  return {
    ok: true,
    status: 200,
    blob: vi.fn().mockResolvedValue(new Blob(["data"], { type: "application/octet-stream" })),
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-disposition"
          ? `attachment; filename="${filename}"`
          : null,
    },
  } as unknown as Response;
}

let clickSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Descarga observable sin navegación real.
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();
  clickSpy = vi.fn();
  // Interceptar el click del enlace temporal (evita navegación jsdom).
  HTMLAnchorElement.prototype.click = clickSpy;
  global.fetch = vi.fn().mockResolvedValue(okResponse());
});

afterEach(() => {
  vi.restoreAllMocks();
});

function fetchMock() {
  return global.fetch as unknown as ReturnType<typeof vi.fn>;
}

describe("ExportMenu", () => {
  it("el trigger expone aria-haspopup=menu y aria-expanded=false cerrado", () => {
    render(<ExportMenu auditId={AUDIT_ID} />);
    const trigger = screen.getByRole("button", { name: /exportar/i });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("Enter/Space/ArrowDown abren el menú, mueven foco al primer item y ponen aria-expanded=true", async () => {
    const user = userEvent.setup();
    render(<ExportMenu auditId={AUDIT_ID} />);
    const trigger = screen.getByRole("button", { name: /exportar/i });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toHaveFocus();
  });

  it("ArrowUp sobre el trigger abre y enfoca el último item", async () => {
    const user = userEvent.setup();
    render(<ExportMenu auditId={AUDIT_ID} />);
    const trigger = screen.getByRole("button", { name: /exportar/i });
    trigger.focus();
    await user.keyboard("{ArrowUp}");
    const items = screen.getAllByRole("menuitem");
    expect(items[items.length - 1]).toHaveFocus();
  });

  it("ArrowDown/ArrowUp navegan entre los 3 menuitem con wrap", async () => {
    const user = userEvent.setup();
    render(<ExportMenu auditId={AUDIT_ID} />);
    const trigger = screen.getByRole("button", { name: /exportar/i });
    trigger.focus();
    await user.keyboard("{ArrowDown}"); // abre → item 0
    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(items[2]).toHaveFocus();
    await user.keyboard("{ArrowDown}"); // wrap → item 0
    expect(items[0]).toHaveFocus();
    await user.keyboard("{ArrowUp}"); // wrap hacia arriba → item 2
    expect(items[2]).toHaveFocus();
  });

  it("Esc cierra el menú y devuelve el foco al trigger", async () => {
    const user = userEvent.setup();
    render(<ExportMenu auditId={AUDIT_ID} />);
    const trigger = screen.getByRole("button", { name: /exportar/i });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("activar PDF pega a /api/audits/<id>/export?format=pdf y dispara la descarga", async () => {
    const user = userEvent.setup();
    render(<ExportMenu auditId={AUDIT_ID} />);
    const trigger = screen.getByRole("button", { name: /exportar/i });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    await user.click(screen.getByRole("menuitem", { name: /^PDF$/i }));
    await waitFor(() => expect(fetchMock()).toHaveBeenCalledTimes(1));
    expect(fetchMock().mock.calls[0][0]).toContain(
      `/api/audits/${AUDIT_ID}/export?format=pdf`
    );
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
  });

  it("Markdown (para IA) usa format=md", async () => {
    const user = userEvent.setup();
    render(<ExportMenu auditId={AUDIT_ID} />);
    const trigger = screen.getByRole("button", { name: /exportar/i });
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: /Markdown/i }));
    await waitFor(() => expect(fetchMock()).toHaveBeenCalledTimes(1));
    expect(fetchMock().mock.calls[0][0]).toContain("export?format=md");
  });

  it("Presentación (PPTX) usa format=pptx", async () => {
    const user = userEvent.setup();
    render(<ExportMenu auditId={AUDIT_ID} />);
    const trigger = screen.getByRole("button", { name: /exportar/i });
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: /Presentación/i }));
    await waitFor(() => expect(fetchMock()).toHaveBeenCalledTimes(1));
    expect(fetchMock().mock.calls[0][0]).toContain("export?format=pptx");
  });

  it("un segundo disparo mientras está en loading NO produce un segundo fetch", async () => {
    const user = userEvent.setup();
    // fetch que nunca resuelve → el control queda en loading.
    let resolveFetch: (v: Response) => void = () => {};
    global.fetch = vi.fn(
      () => new Promise<Response>((res) => (resolveFetch = res))
    );
    render(<ExportMenu auditId={AUDIT_ID} />);
    const trigger = screen.getByRole("button", { name: /exportar/i });
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: /^PDF$/i }));
    await waitFor(() => expect(fetchMock()).toHaveBeenCalledTimes(1));
    // El trigger quedó en loading/disabled; un segundo click no reabre ni dispara.
    await user.click(trigger);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    resolveFetch(okResponse());
  });

  it("un fallo de fetch muestra role=alert y se limpia al reintentar", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("network"));
    render(<ExportMenu auditId={AUDIT_ID} />);
    const trigger = screen.getByRole("button", { name: /exportar/i });
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: /^PDF$/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/no se pudo generar el archivo/i);

    // Reintento exitoso: el error se limpia antes/durante el nuevo fetch.
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      okResponse()
    );
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: /^PDF$/i }));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    );
  });

  it("responde !ok como error inline", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      blob: vi.fn(),
      headers: { get: () => null },
    } as unknown as Response);
    render(<ExportMenu auditId={AUDIT_ID} />);
    const trigger = screen.getByRole("button", { name: /exportar/i });
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: /^PDF$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no se pudo generar el archivo/i
    );
  });
});
