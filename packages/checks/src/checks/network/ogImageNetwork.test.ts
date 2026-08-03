import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makePage } from "../../testUtils";
import type { SiteCheckCtx } from "../../types";
import { MAX_URLS_PER_NETWORK_CHECK } from "./linkChecker";

// Mock the transport so no real HTTP is issued — these cases test how the
// check COLLECTS, DEDUPES, CAPS and CLASSIFIES, never the transport itself.
vi.mock("./imageProbe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./imageProbe")>();
  return { ...actual, probeImages: vi.fn() };
});

// The end-to-end case runs the real transport, which validates the destination
// before connecting: the resolver is mocked so the suite never issues a real
// DNS query and the case does not depend on the network.
const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));
vi.mock("node:dns/promises", () => ({
  lookup: lookupMock,
  default: { lookup: lookupMock },
}));

import { probeImages, type ImageProbeResult } from "./imageProbe";
import { ogImageNetworkCheck } from "./ogImageNetwork";

const mockedProbeImages = vi.mocked(probeImages);

const ORIGIN = "https://aprendoclub.com";

/** Builds a context from `[pageUrl, ogImageValue | null]` pairs. */
function ctxWithOgImages(pairs: [string, string | null][]): SiteCheckCtx {
  return {
    pages: pairs.map(([pageUrl, image]) =>
      makePage({
        url: pageUrl,
        html: `<html><head>${image === null ? "" : `<meta property="og:image" content="${image}">`}</head><body>x</body></html>`,
      }),
    ),
    origin: ORIGIN,
    robotsTxt: null,
    sitemapUrls: [],
  } as unknown as SiteCheckCtx;
}

function ok(url: string): ImageProbeResult {
  return { ok: true, url, status: 200, contentType: "image/png", totalBytes: null, dimensions: null };
}

function notFound(url: string): ImageProbeResult {
  return { ok: false, url, status: 404, reason: "HTTP 404" };
}

describe("ogImageNetworkCheck (IMG-01)", () => {
  // Cuerpo de bloque a propósito: `mockReset()` devuelve el propio mock, que
  // es invocable, y Vitest 4 trata todo valor invocable devuelto por un hook
  // como función de limpieza — la llamaría sin argumentos al terminar el test.
  beforeEach(() => {
    mockedProbeImages.mockReset();
  });

  it("dedup: la misma og:image en tres páginas se sondea una sola vez", async () => {
    const image = "https://cdn.aprendoclub.com/social.png";
    mockedProbeImages.mockImplementation(async (urls) => urls.map((u) => ok(u)));

    await ogImageNetworkCheck.run(
      ctxWithOgImages([
        ["https://aprendoclub.com/a", image],
        ["https://aprendoclub.com/b", image],
        ["https://aprendoclub.com/c", image],
      ]),
    );

    // La aserción es sobre el argumento de la llamada de red, nunca sobre el
    // número de filas: es la única forma de probar el control de amplificación.
    expect(mockedProbeImages).toHaveBeenCalledTimes(1);
    expect(mockedProbeImages.mock.calls[0]?.[0]).toEqual([image]);
  });

  it("fan-out: una imagen rota compartida por tres páginas emite tres filas, una por página", async () => {
    const image = "https://cdn.aprendoclub.com/social.png";
    mockedProbeImages.mockImplementation(async (urls) => urls.map((u) => notFound(u)));

    const issues = await ogImageNetworkCheck.run(
      ctxWithOgImages([
        ["https://aprendoclub.com/a", image],
        ["https://aprendoclub.com/b", image],
        ["https://aprendoclub.com/c", image],
      ]),
    );

    expect(mockedProbeImages).toHaveBeenCalledTimes(1);
    expect(issues).toHaveLength(3);
    for (const issue of issues) {
      expect(issue.checkId).toBe("IMG-01");
      expect(issue.category).toBe("social");
      expect(issue.severity).toBe("critical");
      expect(issue.pageId).toBeTruthy();
    }
    expect(new Set(issues.map((i) => i.pageId)).size).toBe(3);
    expect(new Set(issues.map((i) => i.fingerprint)).size).toBe(3);
    // El subtipo va dentro del fingerprint y jamás dentro del campo checkId.
    for (const issue of issues) {
      expect(issue.fingerprint).toContain("IMG-01:og-image-unreachable");
    }
  });

  it("sin og:image: dos páginas sin la etiqueta no emiten filas ni tocan la red", async () => {
    const issues = await ogImageNetworkCheck.run(
      ctxWithOgImages([
        ["https://aprendoclub.com/a", null],
        ["https://aprendoclub.com/b", null],
      ]),
    );

    expect(issues).toHaveLength(0);
    expect(mockedProbeImages).not.toHaveBeenCalled();
  });

  it("sin og:image utilizable: un esquema que no es http ni https no emite fila ni toca la red", async () => {
    const issues = await ogImageNetworkCheck.run(
      ctxWithOgImages([["https://aprendoclub.com/a", "data:image/png;base64,iVBORw0KGgo="]]),
    );

    expect(issues).toHaveLength(0);
    expect(mockedProbeImages).not.toHaveBeenCalled();
  });

  it("cap: 150 imágenes únicas se sondean sin aviso; 151 se recortan a 150 con exactamente un aviso", async () => {
    mockedProbeImages.mockImplementation(async (urls) => urls.map((u) => ok(u)));

    const pairs = (count: number): [string, string | null][] =>
      Array.from({ length: count }, (_v, i) => [
        `https://aprendoclub.com/p${i}`,
        `https://cdn.aprendoclub.com/img-${i}.png`,
      ]);

    const atCap = await ogImageNetworkCheck.run(ctxWithOgImages(pairs(MAX_URLS_PER_NETWORK_CHECK)));
    expect(mockedProbeImages.mock.calls[0]?.[0]).toHaveLength(MAX_URLS_PER_NETWORK_CHECK);
    expect(atCap.filter((i) => i.scope === "og-images-capped")).toHaveLength(0);

    mockedProbeImages.mockClear();

    const overCap = await ogImageNetworkCheck.run(
      ctxWithOgImages(pairs(MAX_URLS_PER_NETWORK_CHECK + 1)),
    );
    expect(mockedProbeImages.mock.calls[0]?.[0]).toHaveLength(MAX_URLS_PER_NETWORK_CHECK);

    const capRows = overCap.filter((i) => i.scope === "og-images-capped");
    expect(capRows).toHaveLength(1);
    expect(capRows[0]?.severity).toBe("ok");
    expect(capRows[0]?.category).toBe("social");
    expect(capRows[0]?.pageId).toBeUndefined();
    expect(capRows[0]?.measuredValue).toContain(String(MAX_URLS_PER_NETWORK_CHECK));
    expect(capRows[0]?.measuredValue).toContain(String(MAX_URLS_PER_NETWORK_CHECK + 1));
  });

  it("alcanzabilidad: un 404 emite fila crítica y un 200 no emite ninguna fila en este plan", async () => {
    const broken = "https://cdn.aprendoclub.com/gone.png";
    mockedProbeImages.mockImplementationOnce(async (urls) => urls.map((u) => notFound(u)));

    const brokenIssues = await ogImageNetworkCheck.run(
      ctxWithOgImages([["https://aprendoclub.com/a", broken]]),
    );
    expect(brokenIssues).toHaveLength(1);
    expect(brokenIssues[0]?.severity).toBe("critical");
    expect(brokenIssues[0]?.measuredValue).toContain("HTTP 404");
    expect(brokenIssues.filter((i) => i.severity === "ok")).toHaveLength(0);

    mockedProbeImages.mockImplementationOnce(async (urls) => urls.map((u) => ok(u)));
    const fineIssues = await ogImageNetworkCheck.run(
      ctxWithOgImages([["https://aprendoclub.com/a", "https://cdn.aprendoclub.com/fine.png"]]),
    );
    expect(fineIssues).toHaveLength(0);
  });
});

/**
 * End-to-end: the reason this slice exists. No module mock behaviour here —
 * the real transport runs against a stubbed global fetch, through the real
 * `runAllChecks` catalog, so this is what proves the check is registered and
 * actually runs in production, not only in isolation.
 */
describe("IMG-01 de punta a punta por runAllChecks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    mockedProbeImages.mockReset();
  });

  it("una og:image que responde 404 llega al resultado como fila crítica de la categoría social", async () => {
    const actual = await vi.importActual<typeof import("./imageProbe")>("./imageProbe");
    mockedProbeImages.mockImplementation(actual.probeImages);
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({ "content-type": "text/html" }),
        text: async () => "",
      }),
    );

    const { runAllChecks } = await import("../../registry");

    const page = makePage({
      url: "https://aprendoclub.com/",
      html: `<html><head><title>x</title><meta property="og:image" content="https://cdn.aprendoclub.com/social.png"></head><body>x</body></html>`,
    });

    const { issues } = await runAllChecks({
      pages: [page],
      origin: ORIGIN,
      robotsTxt: null,
      sitemapUrls: [],
      includeNetworkChecks: true,
    });

    const imgIssues = issues.filter((i) => i.checkId === "IMG-01");
    expect(imgIssues.length).toBeGreaterThanOrEqual(1);
    expect(imgIssues[0]?.category).toBe("social");
    expect(imgIssues[0]?.severity).toBe("critical");
    expect(imgIssues[0]?.pageId).toBe(page.id);
  });
});
