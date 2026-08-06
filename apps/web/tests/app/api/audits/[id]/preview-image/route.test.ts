import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Contrato de seguridad del proxy de imágenes sociales (PREVIEW-04).
 *
 * Ningún test de este archivo asserta sobre un mensaje de error expuesto al
 * cliente: todas las ramas de rechazo devuelven un status genérico con cuerpo
 * vacío (T-32-09). Lo que se prueba es el status y, sobre todo, que la
 * conexión hacia un destino no público NUNCA se abre.
 */

vi.mock("@auditor/db", () => ({
  prisma: {
    audit: { findUnique: vi.fn() },
  },
}));

vi.mock("@auditor/checks/network", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@auditor/checks/network")>()),
  assertPublicDestination: vi.fn(),
  resolveRedirect: vi.fn(),
  pinnedDispatcher: vi.fn(() => ({ destroy: () => Promise.resolve() })),
}));

import { prisma } from "@auditor/db";
import {
  assertPublicDestination,
  resolveRedirect,
  pinnedDispatcher,
} from "@auditor/checks/network";
import { GET } from "../../../../../../app/api/audits/[id]/preview-image/route";

const findUnique = vi.mocked(prisma.audit.findUnique);
const mockedAssert = vi.mocked(assertPublicDestination);
const mockedResolveRedirect = vi.mocked(resolveRedirect);
const mockedPinnedDispatcher = vi.mocked(pinnedDispatcher);

const SITE = "https://example.com";
const IMAGE_URL = `${SITE}/og.jpg`;

function call(query: string, id = "a1"): Promise<Response> {
  return GET(new Request(`http://localhost/api/audits/${id}/preview-image${query}`), {
    params: Promise.resolve({ id }),
  });
}

function imageResponse(bytes: Uint8Array, contentType: string, status = 200): Response {
  return new Response(bytes.slice().buffer as ArrayBuffer, {
    status,
    headers: { "content-type": contentType },
  });
}

const PIXEL = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue({ resolvedUrl: SITE } as never);
  mockedAssert.mockResolvedValue({ ok: true, addresses: ["93.184.216.34"] });
});

describe("GET /api/audits/[id]/preview-image", () => {
  it("responde 404 con cuerpo vacío cuando la auditoría no tiene resolvedUrl persistida", async () => {
    findUnique.mockResolvedValue(null as never);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await call(`?url=${encodeURIComponent(IMAGE_URL)}`);

    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("responde 400 cuando falta el parámetro url o no es parseable", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await call("")).status).toBe(400);
    expect((await call("?url=no-es-una-url")).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("responde 403 cuando el origin no coincide EXACTAMENTE con el de resolvedUrl", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const foreign = await call(`?url=${encodeURIComponent("https://evil.example.net/og.jpg")}`);
    expect(foreign.status).toBe(403);
    expect(await foreign.text()).toBe("");

    // Mismo host, esquema distinto: sigue siendo otro origin.
    const scheme = await call(`?url=${encodeURIComponent("http://example.com/og.jpg")}`);
    expect(scheme.status).toBe(403);

    // Subdominio: tampoco es el mismo origin.
    const sub = await call(`?url=${encodeURIComponent("https://cdn.example.com/og.jpg")}`);
    expect(sub.status).toBe(403);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockedAssert).not.toHaveBeenCalled();
  });

  it("responde 403 sin abrir conexión cuando assertPublicDestination rechaza el destino", async () => {
    mockedAssert.mockResolvedValue({ ok: false, reason: "destino no público" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await call(`?url=${encodeURIComponent(IMAGE_URL)}`);

    expect(res.status).toBe(403);
    expect(await res.text()).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sirve los bytes con Content-Type re-derivado, inline y nosniff", async () => {
    const fetchMock = vi.fn().mockResolvedValue(imageResponse(PIXEL, "image/jpeg; charset=binary"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await call(`?url=${encodeURIComponent(IMAGE_URL)}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("content-disposition")).toBe("inline");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PIXEL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.redirect).toBe("manual");
  });

  it("rechaza con 404 un Content-Type fuera del allowlist y nunca lo reenvía", async () => {
    const html = new TextEncoder().encode("<script>alert(1)</script>");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(imageResponse(html, "text/html")));

    const res = await call(`?url=${encodeURIComponent(IMAGE_URL)}`);

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBeNull();
    expect(await res.text()).toBe("");
  });

  it("sigue manualmente una redirección hacia otro origen público revalidando SSRF", async () => {
    const hop = "https://cdn.example.net/real.png";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: hop } }),
      )
      .mockResolvedValueOnce(imageResponse(PIXEL, "image/png"));
    vi.stubGlobal("fetch", fetchMock);
    mockedResolveRedirect.mockResolvedValue({
      kind: "follow",
      url: hop,
      addresses: ["198.51.100.7"],
    });

    const res = await call(`?url=${encodeURIComponent(IMAGE_URL)}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(mockedResolveRedirect).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(hop);
  });

  it("responde 403 y no abre la segunda conexión cuando el salto apunta a un destino no público", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    mockedResolveRedirect.mockResolvedValue({
      kind: "reject",
      url: "http://169.254.169.254/",
      status: null,
      reason: "destino no público",
    });

    const res = await call(`?url=${encodeURIComponent(IMAGE_URL)}`);

    expect(res.status).toBe(403);
    expect(await res.text()).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("responde 404 genérico cuando el origen devuelve un status de error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    const res = await call(`?url=${encodeURIComponent(IMAGE_URL)}`);

    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
  });

  it("responde 404 genérico cuando el fetch falla o se agota el tiempo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET en 10.0.0.5")));

    const res = await call(`?url=${encodeURIComponent(IMAGE_URL)}`);

    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
  });

  // WR-02: cualquier excepción que escape de `fetchImage` — no sólo la de
  // `fetch()` — debe degradar al mismo 404 genérico sin cuerpo, nunca
  // propagar y dejar que el manejo de errores por defecto de Next.js tome el
  // control (T-32-09). `pinnedDispatcher` se llama fuera del `try/catch`
  // interno del loop de saltos, así que un throw suyo es el caso que
  // ejercita el catch-all de nivel superior.
  it("responde 404 genérico cuando pinnedDispatcher lanza fuera del try/catch interno", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockedPinnedDispatcher.mockImplementationOnce(() => {
      throw new Error("fallo inesperado del dispatcher");
    });

    const res = await call(`?url=${encodeURIComponent(IMAGE_URL)}`);

    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
