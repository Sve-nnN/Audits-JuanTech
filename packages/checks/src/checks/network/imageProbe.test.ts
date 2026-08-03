import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// El resolutor se simula en todo el archivo: ningún caso hace una consulta DNS
// real, igual que ningún caso abre una conexión (el fetch global se sustituye).
const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));
vi.mock("node:dns/promises", () => ({
  lookup: lookupMock,
  default: { lookup: lookupMock },
}));

import {
  IMAGE_HEAD_BYTES,
  deriveTotalBytes,
  probeImage,
  readDimensions,
  readUpTo,
} from "./imageProbe";
import {
  MAX_REDIRECT_HOPS,
  REASON_INVALID_REDIRECT,
  REASON_TOO_MANY_REDIRECTS,
} from "./redirects";
import { REASON_NOT_PUBLIC } from "./ssrfGuard";

/** Cuerpos que la fábrica sabe simular. `endless` es el servidor hostil. */
type FakeBody =
  | { kind: "chunks"; chunks: Uint8Array[] }
  | { kind: "endless"; chunkBytes: number }
  | { kind: "aborted" }
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
      if (body.kind === "aborted") {
        // El servidor que corta el cuerpo despues de mandar las cabeceras, y el
        // timer que dispara durante la lectura: los dos llegan acá.
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        return Promise.reject(error);
      }
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

/**
 * Cabecera PNG mínima de 24 bytes, construida en memoria: firma de ocho bytes,
 * longitud del bloque IHDR, la etiqueta, y ancho y alto como enteros de 32 bits
 * con el byte más significativo primero, en los desplazamientos 16 y 20.
 */
function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13, false); // longitud del bloque IHDR
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
}

/**
 * Cabecera GIF mínima de 10 bytes: firma de seis caracteres, y ancho y alto
 * como enteros de 16 bits con el byte menos significativo primero, en los
 * desplazamientos 6 y 8.
 */
function gifHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(10);
  bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0); // "GIF89a"
  const view = new DataView(bytes.buffer);
  view.setUint16(6, width, true);
  view.setUint16(8, height, true);
  return bytes;
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

describe("readDimensions — dimensiones desde el fragmento parcial", () => {
  it("dimensiones desde buffer: 24 bytes de cabecera PNG bastan para leer 1200 por 630", () => {
    const result = readDimensions(pngHeader(1200, 630));

    expect(result).toMatchObject({ width: 1200, height: 630, type: "png" });
  });

  it("dimensiones desde buffer: 10 bytes de cabecera GIF bastan para leer 200 por 200", () => {
    const result = readDimensions(gifHeader(200, 200));

    expect(result).toMatchObject({ width: 200, height: 200, type: "gif" });
  });

  it("dimensiones desde buffer: una cabecera PNG truncada a 12 bytes devuelve nulo y no lanza", () => {
    const truncated = pngHeader(1200, 630).subarray(0, 12);

    expect(() => readDimensions(truncated)).not.toThrow();
    expect(readDimensions(truncated)).toBeNull();
  });

  it("dimensiones desde buffer: un buffer de basura que no es ningún formato devuelve nulo y no lanza", () => {
    const garbage = new Uint8Array(64).fill(0x7a);

    expect(() => readDimensions(garbage)).not.toThrow();
    expect(readDimensions(garbage)).toBeNull();
  });

  it("dimensiones desde buffer: un fragmento vacío devuelve nulo sin llamar a la librería", () => {
    expect(readDimensions(new Uint8Array(0))).toBeNull();
  });
});

/**
 * El camino de redirecciones es el control de seguridad central de la fase:
 * validar sólo la URL inicial es el bypass clásico de esta defensa. Sin estos
 * casos, un refactor que sacara la revalidación del bucle dejaría la suite en
 * verde.
 */
describe("probeImage — un corte del cuerpo no descarta la respuesta", () => {
  it("un cuerpo que se corta tras las cabeceras conserva status y tipo de contenido, y sólo pierde las dimensiones", async () => {
    // El modo de falla que esto evita: un CDN lento producía
    // `{ ok: false, reason: "tiempo agotado" }` y de ahí un `critical` de
    // "imagen social inalcanzable" abanicado por cada página que declara la
    // imagen. La respuesta ya era evidencia válida.
    lookupMock.mockResolvedValue(PUBLIC_ADDRESS);
    const { res } = fakeResponse({
      status: 200,
      headers: { "content-type": "image/png", "content-length": "845123" },
      body: { kind: "aborted" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));

    const result = await probeImage("https://cdn.example.com/og.png");

    expect(result).toMatchObject({
      ok: true,
      status: 200,
      contentType: "image/png",
      totalBytes: 845123,
      dimensions: null,
    });
  });
});

describe("probeImage — redirecciones", () => {
  it("ssrf: un Location hacia la dirección de metadatos se rechaza en el salto, sin abrir la segunda conexión", async () => {
    lookupMock
      .mockReset()
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]) // salto 1: público
      .mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }]); // salto 2: metadatos
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        fakeResponse({ status: 302, headers: { location: "http://interno.example/" } }).res,
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await probeImage("https://cdn.example.com/og.png");

    expect(fetchMock).toHaveBeenCalledTimes(1); // nunca se abrió el salto 2
    expect(result).toMatchObject({ ok: false, status: null, reason: REASON_NOT_PUBLIC });
    // La URL reportada es la del salto rechazado, no la inicial: nombrar el
    // destino que se refutó es todo el diagnóstico.
    expect((result as { url: string }).url).toBe("http://interno.example/");
  });

  it("un salto hacia un destino público se sigue, así que el rechazo anterior no es un no-op", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        fakeResponse({ status: 301, headers: { location: "https://cdn.example.com/final.png" } })
          .res,
      )
      .mockResolvedValueOnce(
        fakeResponse({
          status: 200,
          headers: { "content-type": "image/png", "content-length": "4096" },
          body: { kind: "chunks", chunks: [pngHeader(1200, 630)] },
        }).res,
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await probeImage("https://cdn.example.com/og.png");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![0]).toBe("https://cdn.example.com/final.png");
    expect(result).toMatchObject({
      ok: true,
      url: "https://cdn.example.com/final.png",
      status: 200,
      dimensions: { width: 1200, height: 630 },
    });
  });

  it("un Location relativo se resuelve contra la URL del salto en curso, no contra la inicial", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        fakeResponse({ status: 302, headers: { location: "/estatico/og.png" } }).res,
      )
      .mockResolvedValueOnce(
        fakeResponse({ status: 200, headers: { "content-type": "image/png" } }).res,
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await probeImage("https://cdn.example.com/carpeta/og.png");

    expect(fetchMock.mock.calls[1]![0]).toBe("https://cdn.example.com/estatico/og.png");
    expect(result).toMatchObject({ ok: true, url: "https://cdn.example.com/estatico/og.png" });
  });

  it("una cadena más larga que el presupuesto de saltos se corta y no gira sin fin", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const fetchMock = vi.fn(
      async () =>
        fakeResponse({ status: 302, headers: { location: "https://cdn.example.com/otra.png" } })
          .res,
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await probeImage("https://cdn.example.com/og.png");

    expect(fetchMock).toHaveBeenCalledTimes(MAX_REDIRECT_HOPS + 1);
    expect(result).toMatchObject({ ok: false, status: null, reason: REASON_TOO_MANY_REDIRECTS });
  });

  it("un 3xx sin cabecera de destino se reporta con su status, sin inventar un salto", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({ status: 307 }).res);
    vi.stubGlobal("fetch", fetchMock);

    const result = await probeImage("https://cdn.example.com/og.png");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: false,
      url: "https://cdn.example.com/og.png",
      status: 307,
      reason: "HTTP 307",
    });
  });

  it("un Location que no es una URL ni resuelto contra la base se reporta como redirección no válida", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(fakeResponse({ status: 302, headers: { location: "http://" } }).res);
    vi.stubGlobal("fetch", fetchMock);

    const result = await probeImage("https://cdn.example.com/og.png");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: false,
      url: "https://cdn.example.com/og.png",
      status: 302,
      reason: REASON_INVALID_REDIRECT,
    });
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

  it("dimensiones desde buffer: una sola respuesta 206 trae a la vez status, tipo de contenido, tamaño total y dimensiones", async () => {
    const { res } = fakeResponse({
      status: 206,
      headers: {
        "content-type": "image/png",
        "content-range": `bytes 0-23/1234567`,
        "content-length": "24",
      },
      body: { kind: "chunks", chunks: [pngHeader(1200, 630)] },
    });
    const fetchMock = vi.fn().mockResolvedValue(res);
    vi.stubGlobal("fetch", fetchMock);

    const result = await probeImage("https://cdn.example.com/og.png");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: true,
      status: 206,
      contentType: "image/png",
      totalBytes: 1234567,
      dimensions: { width: 1200, height: 630 },
    });
  });
});
