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

const mockedAssert = vi.mocked(assertPublicDestination);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Respuesta mínima con la única propiedad que `checkOne` lee. */
function response(status: number): Response {
  return { status } as unknown as Response;
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

  it("estado actual: una respuesta correcta devuelve éxito en el primer método", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(response(204));
    vi.stubGlobal("fetch", fetchSpy);

    const results = await checkLinks(["https://example.com/fine"]);

    expect(results[0]).toEqual({ url: "https://example.com/fine", ok: true, status: 204 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
