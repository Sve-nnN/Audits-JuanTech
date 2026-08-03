import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Se simula la defensa de destino porque resolver nombres de verdad haría de
// esta suite un test de red. Lo que se prueba acá es el CABLEADO: que la
// defensa corra antes del fetch, no cuál es su veredicto (eso lo cubre
// ssrfGuard.test.ts).
vi.mock("./ssrfGuard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ssrfGuard")>();
  return { ...actual, assertPublicDestination: vi.fn() };
});

import { assertPublicDestination } from "./ssrfGuard";
import { DEFAULT_NETWORK_CONCURRENCY } from "./concurrency";
import { checkLinks, UNVERIFIABLE_DESTINATION_REASON } from "./linkChecker";
import { MAX_REDIRECT_HOPS, REASON_TOO_MANY_REDIRECTS } from "./redirects";

const mockedAssert = vi.mocked(assertPublicDestination);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Respuesta mínima con la única propiedad que `checkOne` lee. */
function response(status: number): Response {
  return { status, headers: new Headers() } as unknown as Response;
}

/** Respuesta de redirección con la cabecera que el bucle de saltos consume. */
function redirect(status: number, location?: string): Response {
  return {
    status,
    headers: new Headers(location === undefined ? {} : { location }),
  } as unknown as Response;
}

describe("checkLinks", () => {
  beforeEach(() => {
    mockedAssert.mockReset();
    mockedAssert.mockResolvedValue({ ok: true, addresses: ["93.184.216.34"] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ssrf: un destino rechazado por la defensa no abre ni una conexión", async () => {
    mockedAssert.mockResolvedValue({ ok: false, reason: "destino no público" });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const results = await checkLinks(["http://169.254.169.254/latest/meta-data/"]);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      url: "http://169.254.169.254/latest/meta-data/",
      ok: false,
      status: null,
      reason: UNVERIFIABLE_DESTINATION_REASON,
    });
    // La aserción que prueba que la defensa corre ANTES y no después: si
    // corriera después, el resultado sería el mismo pero la conexión ya estaría
    // abierta y el daño hecho.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ssrf: un destino aceptado por la defensa sigue el flujo normal", async () => {
    mockedAssert.mockResolvedValue({ ok: true, addresses: ["93.184.216.34"] });
    const fetchSpy = vi.fn().mockResolvedValue(response(200));
    vi.stubGlobal("fetch", fetchSpy);

    const results = await checkLinks(["https://example.com/ok"]);

    expect(results[0]).toEqual({ url: "https://example.com/ok", ok: true, status: 200 });
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("orden: cinco URLs resueltas al revés devuelven resultados alineados con la entrada", async () => {
    const urls = [
      "https://example.com/a",
      "https://example.com/b",
      "https://example.com/c",
      "https://example.com/d",
      "https://example.com/e",
    ];
    // La última URL de la entrada resuelve primero y la primera resuelve
    // última: si el runner acumulara por orden de resolución, el arreglo
    // saldría invertido.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const position = urls.indexOf(input);
        await sleep((urls.length - position) * 10);
        return response(200 + position);
      }),
    );

    const results = await checkLinks(urls);

    expect(results.map((r) => r.url)).toEqual(urls);
    expect(results.map((r) => r.status)).toEqual([200, 201, 202, 203, 204]);
  });

  it("concurrencia: nunca hay más peticiones en vuelo que el límite compartido", async () => {
    const urls = Array.from({ length: 40 }, (_i, i) => `https://example.com/${i}`);
    let inFlight = 0;
    let maxInFlight = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await sleep(5);
        inFlight -= 1;
        return response(200);
      }),
    );

    const results = await checkLinks(urls);

    expect(results).toHaveLength(urls.length);
    expect(maxInFlight).toBeLessThanOrEqual(DEFAULT_NETWORK_CONCURRENCY);
    expect(maxInFlight).toBe(DEFAULT_NETWORK_CONCURRENCY);
  });

  it("estado actual: un status de error en los dos métodos devuelve fallo con ese status", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(response(404));
    vi.stubGlobal("fetch", fetchSpy);

    const results = await checkLinks(["https://example.com/gone"]);

    expect(results[0]).toEqual({
      url: "https://example.com/gone",
      ok: false,
      status: 404,
      reason: "HTTP 404",
    });
    // HEAD primero y GET después: el respaldo por método sigue vivo.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("ssrf: una redirección hacia un destino que la defensa rechaza no abre la segunda conexión", async () => {
    // El bypass más barato de esta capa y el que CR-02 dejaba abierto: el
    // enlace apunta a un anfitrión público que contesta 302 hacia la dirección
    // de metadatos. Con seguimiento automático la conexión interna se abría
    // dentro del transporte, sin pasar nunca por la defensa.
    mockedAssert
      .mockResolvedValueOnce({ ok: true, addresses: ["93.184.216.34"] })
      .mockResolvedValueOnce({ ok: false, reason: "destino no público" });
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(redirect(302, "http://169.254.169.254/latest/meta-data/"));
    vi.stubGlobal("fetch", fetchSpy);

    const results = await checkLinks(["https://evil.example/x"]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(results[0]).toEqual({
      url: "https://evil.example/x",
      ok: false,
      status: null,
      reason: UNVERIFIABLE_DESTINATION_REASON,
    });
  });

  it("redirección: un salto hacia un destino público se sigue y el resultado conserva la URL de entrada", async () => {
    // La contraparte del caso anterior: sin esto, rechazar todo cumpliría la
    // aserción de arriba sin verificar un solo enlace.
    mockedAssert.mockResolvedValue({ ok: true, addresses: ["93.184.216.34"] });
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(redirect(301, "https://example.com/destino"))
      .mockResolvedValueOnce(response(200));
    vi.stubGlobal("fetch", fetchSpy);

    const results = await checkLinks(["https://example.com/vieja"]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1]![0]).toBe("https://example.com/destino");
    expect(results[0]).toEqual({ url: "https://example.com/vieja", ok: true, status: 200 });
  });

  it("redirección: ninguna petición se emite con seguimiento automático", async () => {
    mockedAssert.mockResolvedValue({ ok: true, addresses: ["93.184.216.34"] });
    const fetchSpy = vi.fn().mockResolvedValue(response(200));
    vi.stubGlobal("fetch", fetchSpy);

    await checkLinks(["https://example.com/ok"]);

    const init = fetchSpy.mock.calls[0]![1] as { redirect: string };
    expect(init.redirect).toBe("manual");
  });

  it("redirección: una cadena más larga que el presupuesto de saltos se corta", async () => {
    mockedAssert.mockResolvedValue({ ok: true, addresses: ["93.184.216.34"] });
    const fetchSpy = vi.fn().mockResolvedValue(redirect(302, "https://example.com/otra"));
    vi.stubGlobal("fetch", fetchSpy);

    const results = await checkLinks(["https://example.com/bucle"]);

    expect(fetchSpy).toHaveBeenCalledTimes(MAX_REDIRECT_HOPS + 1);
    expect(results[0]).toEqual({
      url: "https://example.com/bucle",
      ok: false,
      status: null,
      reason: REASON_TOO_MANY_REDIRECTS,
    });
  });

  it("redirección: un 3xx sin cabecera de destino se reporta con su status", async () => {
    mockedAssert.mockResolvedValue({ ok: true, addresses: ["93.184.216.34"] });
    const fetchSpy = vi.fn().mockResolvedValue(redirect(302));
    vi.stubGlobal("fetch", fetchSpy);

    const results = await checkLinks(["https://example.com/sin-destino"]);

    expect(results[0]).toEqual({
      url: "https://example.com/sin-destino",
      ok: false,
      status: 302,
      reason: "HTTP 302",
    });
  });

  it("estado actual: una respuesta correcta devuelve éxito en el primer método", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(response(204));
    vi.stubGlobal("fetch", fetchSpy);

    const results = await checkLinks(["https://example.com/fine"]);

    expect(results[0]).toEqual({ url: "https://example.com/fine", ok: true, status: 204 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
