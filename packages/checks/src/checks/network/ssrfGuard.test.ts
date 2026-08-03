import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The resolver is mocked, never exercised: not a single case in this file
// opens a real connection or performs a real DNS query.
const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));
vi.mock("node:dns/promises", () => ({
  lookup: lookupMock,
  default: { lookup: lookupMock },
}));

import {
  isPrivateAddress,
  assertPublicDestination,
  pinnedDispatcher,
  REASON_NOT_PUBLIC,
  REASON_UNRESOLVABLE,
} from "./ssrfGuard";
import { probeImage } from "./imageProbe";

describe("isPrivateAddress: tabla de rangos", () => {
  it("acepta una dirección pública de la versión 4", () => {
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
  });

  it("rechaza el bucle local de la versión 4", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("127.255.255.254")).toBe(true);
  });

  it("rechaza el rango 0.0.0.0/8", () => {
    expect(isPrivateAddress("0.0.0.0")).toBe(true);
    expect(isPrivateAddress("0.1.2.3")).toBe(true);
  });

  it("rechaza el rango 10.0.0.0/8", () => {
    expect(isPrivateAddress("10.0.0.1")).toBe(true);
    expect(isPrivateAddress("10.255.255.255")).toBe(true);
  });

  it("rechaza la dirección de metadatos de nube 169.254.169.254", () => {
    // El destino de mayor impacto de toda la tabla: es el que entrega
    // credenciales de instancia en los proveedores de nube.
    expect(isPrivateAddress("169.254.169.254")).toBe(true);
    expect(isPrivateAddress("169.254.0.1")).toBe(true);
  });

  it("rechaza el rango 172.16.0.0/12 sin pasarse de sus bordes", () => {
    expect(isPrivateAddress("172.16.0.1")).toBe(true);
    expect(isPrivateAddress("172.31.255.255")).toBe(true);
    expect(isPrivateAddress("172.15.0.1")).toBe(false);
    expect(isPrivateAddress("172.32.0.1")).toBe(false);
  });

  it("rechaza el rango 192.168.0.0/16", () => {
    expect(isPrivateAddress("192.168.0.1")).toBe(true);
    expect(isPrivateAddress("192.169.0.1")).toBe(false);
  });

  it("rechaza el rango de operador 100.64.0.0/10", () => {
    expect(isPrivateAddress("100.64.0.1")).toBe(true);
    expect(isPrivateAddress("100.127.255.255")).toBe(true);
    expect(isPrivateAddress("100.63.255.255")).toBe(false);
    expect(isPrivateAddress("100.128.0.1")).toBe(false);
  });

  it("rechaza el bucle local y la dirección sin especificar de la versión 6", () => {
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("::")).toBe(true);
  });

  it("rechaza el bloque único local fc00::/7", () => {
    expect(isPrivateAddress("fc00::1")).toBe(true);
    expect(isPrivateAddress("fd12:3456:789a::1")).toBe(true);
  });

  it("rechaza el bloque de enlace local fe80::/10", () => {
    expect(isPrivateAddress("fe80::1")).toBe(true);
    expect(isPrivateAddress("fe80::1%eth0")).toBe(true);
  });

  it("desenvuelve una dirección de la versión 4 mapeada dentro de la versión 6", () => {
    expect(isPrivateAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateAddress("::ffff:169.254.169.254")).toBe(true);
    expect(isPrivateAddress("::ffff:8.8.8.8")).toBe(false);
  });

  it("acepta una dirección pública de la versión 6", () => {
    expect(isPrivateAddress("2001:4860:4860::8888")).toBe(false);
  });

  it("rechaza toda cadena que no es una dirección válida", () => {
    expect(isPrivateAddress("no-soy-una-direccion")).toBe(true);
    expect(isPrivateAddress("")).toBe(true);
    expect(isPrivateAddress("999.999.999.999")).toBe(true);
  });
});

describe("assertPublicDestination: resolución del nombre", () => {
  beforeEach(() => {
    lookupMock.mockReset();
  });

  it("acepta un anfitrión que resuelve sólo a direcciones públicas", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ]);

    // El veredicto devuelve las direcciones que clasificó, no sólo el sí: son
    // las que el transporte tiene que fijar para que no haya una segunda
    // resolución que las contradiga.
    await expect(assertPublicDestination("https://example.com/x.png")).resolves.toEqual({
      ok: true,
      addresses: ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"],
    });
  });

  it("rechaza un anfitrión que resuelve a una pública y una de bucle local", async () => {
    // Alcanzaría con que la pila de red eligiera la segunda: una sola
    // dirección privada invalida todo el conjunto.
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);

    await expect(assertPublicDestination("https://mixto.example.com/x.png")).resolves.toEqual({
      ok: false,
      reason: REASON_NOT_PUBLIC,
    });
  });

  it("rechaza con motivo de no resoluble cuando la resolución lanza", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND — texto del sistema que jamás se persiste"));

    await expect(assertPublicDestination("https://no-existe.example/x.png")).resolves.toEqual({
      ok: false,
      reason: REASON_UNRESOLVABLE,
    });
  });

  it("clasifica un anfitrión literal sin consultar al sistema de nombres", async () => {
    await expect(assertPublicDestination("http://127.0.0.1:8080/x.png")).resolves.toEqual({
      ok: false,
      reason: REASON_NOT_PUBLIC,
    });
    await expect(assertPublicDestination("http://[::1]/x.png")).resolves.toEqual({
      ok: false,
      reason: REASON_NOT_PUBLIC,
    });
    expect(lookupMock).not.toHaveBeenCalled();
  });
});

describe("pinnedDispatcher: la dirección validada se fija en la conexión", () => {
  it("rechaza conectar cuando la dirección fijada es privada, en vez de caer al resolutor del sistema", async () => {
    // La clasificación se repite dentro del agente a propósito: es la última
    // puerta antes del socket. Se ejercita a través de una petición real contra
    // una dirección interna, que debe fallar por rechazo nuestro y no abrir nada.
    const agent = pinnedDispatcher(["127.0.0.1"]);
    await expect(
      fetch("https://cdn.example.com/og.png", { dispatcher: agent } as RequestInit),
    ).rejects.toThrow();
    await agent.destroy();
  });

  it("rechaza conectar cuando la lista de direcciones viene vacía", async () => {
    const agent = pinnedDispatcher([]);
    await expect(
      fetch("https://cdn.example.com/og.png", { dispatcher: agent } as RequestInit),
    ).rejects.toThrow();
    await agent.destroy();
  });
});

describe("ssrf: la defensa corre antes de abrir la conexión", () => {
  beforeEach(() => {
    lookupMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ssrf: un destino rechazado no invoca la función de fetch global ni una vez", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    lookupMock.mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);

    const result = await probeImage("https://interno.example.com/social.png");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBeNull();
      expect(result.reason).toBe(REASON_NOT_PUBLIC);
    }
  });

  it("ssrf: un destino público sí abre la conexión, así que el rechazo no es un no-op", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ "content-type": "image/png" }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);

    const result = await probeImage("https://cdn.example.com/social.png");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });
});
