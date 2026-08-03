import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// El resolutor se simula en todo el archivo: ningún caso hace una consulta DNS
// real, igual que ningún caso abre una conexión (el fetch global se sustituye).
const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));
vi.mock("node:dns/promises", () => ({
  lookup: lookupMock,
  default: { lookup: lookupMock },
}));

import { IMAGE_HEAD_BYTES, deriveTotalBytes, probeImage, readUpTo } from "./imageProbe";

/** Cuerpos que la fábrica sabe simular. `endless` es el servidor hostil. */
type FakeBody =
  | { kind: "chunks"; chunks: Uint8Array[] }
  | { kind: "endless"; chunkBytes: number }
  | { kind: "none" };

/**
 * Respuesta falsa con un lector de verdad y una cancelación espiable.
 *
 * Las cabeceras se construyen con la clase real del entorno para que la
 * lectura sea insensible a mayúsculas, igual que en producción.
 */
function fakeResponse(init: {
  status?: number;
  headers?: Record<string, string>;
  body?: FakeBody;
}): { res: Response; cancel: ReturnType<typeof vi.fn> } {
  const cancel = vi.fn(() => Promise.resolve());
  const body: FakeBody = init.body ?? { kind: "chunks", chunks: [] };
  let index = 0;

  const reader = {
    read: () => {
      if (body.kind === "endless") {
        return Promise.resolve({ done: false, value: new Uint8Array(body.chunkBytes) });
      }
      if (body.kind === "chunks" && index < body.chunks.length) {
        const value = body.chunks[index]!;
        index += 1;
        return Promise.resolve({ done: false, value });
      }
      return Promise.resolve({ done: true, value: undefined });
    },
    cancel,
  };

  const res = {
    status: init.status ?? 200,
    headers: new Headers(init.headers ?? {}),
    body: body.kind === "none" ? null : { getReader: () => reader },
  } as unknown as Response;

  return { res, cancel };
}

const PUBLIC_ADDRESS = [{ address: "93.184.216.34", family: 4 }];

beforeEach(() => {
  // Cuerpo de bloque a propósito: un hook cuyo cuerpo de expresión devuelve un
  // mock (invocable) lo interpreta Vitest 4 como función de limpieza.
  lookupMock.mockReset();
  lookupMock.mockResolvedValue(PUBLIC_ADDRESS);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readUpTo — el tope de lectura", () => {
  it("corta en IMAGE_HEAD_BYTES exactos un 200 que ignora el rango y emite trozos sin fin, y cancela el lector", async () => {
    // Trozos de 10 000 bytes: no dividen el tope, así que el último lo cruza y
    // obliga al recorte exacto.
    const { res, cancel } = fakeResponse({
      status: 200,
      body: { kind: "endless", chunkBytes: 10_000 },
    });

    const head = await readUpTo(res, IMAGE_HEAD_BYTES);

    expect(head.byteLength).toBe(IMAGE_HEAD_BYTES);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("no corta un cuerpo más corto que el tope: lo devuelve completo, sin relleno, y cancela igual", async () => {
    const { res, cancel } = fakeResponse({
      status: 206,
      body: {
        kind: "chunks",
        chunks: [
          new Uint8Array(100).fill(1),
          new Uint8Array(100).fill(2),
          new Uint8Array(100).fill(3),
        ],
      },
    });

    const head = await readUpTo(res, IMAGE_HEAD_BYTES);

    expect(head.byteLength).toBe(300);
    expect(head[0]).toBe(1);
    expect(head[299]).toBe(3);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("corta a cero una respuesta sin cuerpo, sin intentar leer", async () => {
    const { res } = fakeResponse({ status: 204, body: { kind: "none" } });

    const head = await readUpTo(res, IMAGE_HEAD_BYTES);

    expect(head.byteLength).toBe(0);
  });
});

describe("deriveTotalBytes — el tamaño del archivo, no el del fragmento", () => {
  it("tamaño total: un 206 con `bytes 0-65535/1234567` devuelve 1234567, no el tamaño del fragmento", () => {
    const { res } = fakeResponse({
      status: 206,
      headers: {
        "content-range": `bytes 0-${IMAGE_HEAD_BYTES - 1}/1234567`,
        "content-length": String(IMAGE_HEAD_BYTES),
      },
    });

    expect(deriveTotalBytes(res)).toBe(1234567);
  });

  it("tamaño total: un 200 lo toma de la cabecera de longitud de contenido", () => {
    const { res } = fakeResponse({ status: 200, headers: { "content-length": "845123" } });

    expect(deriveTotalBytes(res)).toBe(845123);
  });

  it("tamaño total: un 206 cuyo tamaño declarado es un asterisco devuelve nulo", () => {
    const { res } = fakeResponse({
      status: 206,
      headers: { "content-range": "bytes 0-65535/*" },
    });

    expect(deriveTotalBytes(res)).toBeNull();
  });

  it("tamaño total: una respuesta sin ninguna de las dos cabeceras devuelve nulo", () => {
    const { res } = fakeResponse({ status: 200, headers: {} });

    expect(deriveTotalBytes(res)).toBeNull();
  });

  it("tamaño total: un 206 sin cabecera de rango no cae de vuelta en la longitud del fragmento", () => {
    const { res } = fakeResponse({
      status: 206,
      headers: { "content-length": String(IMAGE_HEAD_BYTES) },
    });

    expect(deriveTotalBytes(res)).toBeNull();
  });

  it.each([
    ["no numérica", "ochocientos"],
    ["negativa", "-1"],
    ["con decimales", "1234.5"],
    ["absurdamente grande en notación exponencial", "1e400"],
  ])("tamaño total: una longitud de contenido %s devuelve nulo", (_forma, raw) => {
    const { res } = fakeResponse({ status: 200, headers: { "content-length": raw } });

    expect(deriveTotalBytes(res)).toBeNull();
  });

  it("tamaño total: un 206 con un tamaño declarado hostil en la cabecera de rango devuelve nulo", () => {
    const { res } = fakeResponse({
      status: 206,
      headers: { "content-range": "bytes 0-65535/-1" },
    });

    expect(deriveTotalBytes(res)).toBeNull();
  });
});

describe("probeImage — respaldo ante un rango no satisfacible", () => {
  it("416: un primer 416 se reintenta una única vez sin rango y produce éxito con exactamente dos llamadas de red", async () => {
    const first = fakeResponse({ status: 416 });
    const second = fakeResponse({
      status: 200,
      headers: { "content-type": "image/png", "content-length": "4096" },
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(first.res).mockResolvedValueOnce(second.res);
    vi.stubGlobal("fetch", fetchMock);

    const result = await probeImage("https://cdn.example.com/og.png");

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // El reintento va sin la cabecera de rango; es lo que lo hace un respaldo
    // y no la misma petición otra vez.
    const retryInit = fetchMock.mock.calls[1]![1] as { headers: Record<string, string> };
    expect(retryInit.headers).toEqual({});
    if (result.ok) {
      expect(result.status).toBe(200);
      expect(result.contentType).toBe("image/png");
      expect(result.totalBytes).toBe(4096);
    }
  });
});
