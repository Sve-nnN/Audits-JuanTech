import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Los tres módulos que abren red por el camino de los NetworkCheck se simulan a
// nivel de módulo, y la función de fetch global se simula aparte para los checks
// de red del grupo AEO: sin las cuatro, activar la red convertiría cada corrida
// de la suite en un cliente automático contra sitios de terceros.
vi.mock("./checks/network/imageProbe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./checks/network/imageProbe")>();
  return { ...actual, probeImages: vi.fn() };
});
vi.mock("./checks/network/linkChecker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./checks/network/linkChecker")>();
  return { ...actual, checkLinks: vi.fn() };
});
vi.mock("./checks/network/ssrfGuard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./checks/network/ssrfGuard")>();
  return { ...actual, assertPublicDestination: vi.fn() };
});

import { probeImages } from "./checks/network/imageProbe";
import { checkLinks } from "./checks/network/linkChecker";
import { assertPublicDestination } from "./checks/network/ssrfGuard";
import { pageChecks, runAllChecks } from "./registry";
import { makePage } from "./testUtils";

/**
 * Guardarraíl de contenido del registry.
 *
 * Hasta ahora ningún test verificaba QUÉ contiene `pageChecks`. Un check
 * implementado pero registrado a medias (agregado al barrel del grupo pero no
 * al spread del registry, o al revés) pasa completamente desapercibido: el
 * archivo existe, sus tests unitarios pasan en aislamiento, y el check
 * simplemente nunca corre en producción. Este archivo convierte ese defecto
 * silencioso en una suite roja.
 *
 * Nota sobre el guard de dato ausente: el caso de una página FALLIDA (sin
 * `html`) no es alcanzable por esta vía, porque `runAllChecks` la descarta con
 * `if (!page.html) continue` antes de correr cualquier PageCheck. Por eso el
 * guard se prueba con una página que sí tiene HTML pero cuyas métricas de
 * performance son `null` — el caso real de una auditoría anterior a la fase 28
 * que se reprocesa sin backfill.
 *
 * ---
 *
 * Corte de versión v1.6 — retiro de ONPAGE-05.
 *
 * El check `ONPAGE-05` (presencia de las cuatro etiquetas Open Graph básicas)
 * se retira del catálogo activo en v1.6: queda absorbido por la categoría
 * "Meta Tags / Social" y por los checks `SOCIAL-01..08`, que cubren el mismo
 * terreno con mucho más detalle. Los dos guardarrailes de abajo existen para
 * que cualquier reintroducción futura del check — por un merge, un revert o un
 * barrel mal editado — vuelva la suite roja en vez de pasar inadvertida.
 *
 * Consecuencias asumidas del corte, documentadas a propósito:
 *
 * 1. Los scores de auditorías anteriores a v1.6 NO son directamente
 *    comparables con los posteriores: el catálogo de la categoría on-page
 *    cambió, así que el baseline del score cambió con él.
 * 2. Las filas `Issue` históricas con `checkId === "ONPAGE-05"` se conservan
 *    intactas en base de datos. No hay migración, backfill ni limpieza: el
 *    historial ya emitido es un registro que el usuario puede volver a abrir.
 *    Su copy de fix por CMS la sigue resolviendo `packages/cms-adapters` en
 *    tiempo de lectura vía `resolveCmsRecommendation`, por eso ese catálogo
 *    tampoco se toca.
 * 3. Consecuencia visible en el diff histórico: el check emitía SIEMPRE una
 *    fila por página (severidad `ok`, `warning` o `warning`, nunca cero), así
 *    que la primera auditoría posterior al corte de un sitio ya auditado va a
 *    marcar todos esos fingerprints como resueltos aunque el usuario no haya
 *    corregido nada. Queda documentado y NO se capa ni se filtra en la UI: la
 *    lógica de cap o filtrado es alcance de producto de una fase posterior.
 *
 * ---
 *
 * Por qué hasta la fase 31 todos los casos apagaban la red, y por qué ahora hay
 * dos que no.
 *
 * Los `NetworkCheck` salen a internet, y una suite no puede depender de acceso
 * saliente ni convertirse en un cliente automático contra sitios de terceros:
 * por eso los cuatro casos originales apagan la red explícitamente y siguen
 * haciéndolo. El costo de esa decisión es que la capa de red se registra
 * por un camino distinto al de los checks de página — su propio barrel y su
 * propio spread en `networkChecks` — y ningún caso lo recorría. Un check de red
 * agregado al barrel de su carpeta pero no al catálogo, o al revés, pasaba
 * completamente desapercibido, que es exactamente el defecto silencioso contra
 * el que existe el resto de este archivo.
 *
 * Los dos casos con la red activa cierran ese hueco simulando a nivel de módulo
 * las tres puertas de red de la capa (el sondeo de imagen, el verificador de
 * enlaces y la validación de destino) más la función de fetch global. La
 * validación de destino devuelve aceptación a propósito: estos casos prueban el
 * REGISTRO del check, no la defensa, que ya tiene sus propios tests.
 */

const ORIGIN = "https://example.com";
const URL = "https://example.com/page";
const PERF_CHECK_IDS = ["PERF-10", "PERF-11"] as const;
const RETIRED_CHECK_ID = "ONPAGE-05";
const SOCIAL_CHECK_IDS = [
  "SOCIAL-01",
  "SOCIAL-02",
  "SOCIAL-03",
  "SOCIAL-04",
  "SOCIAL-05",
  "SOCIAL-06",
  "SOCIAL-07",
  "SOCIAL-08",
] as const;

/** Identificador del check de red de la categoría social, incorporado en la fase 31. */
const SOCIAL_NETWORK_CHECK_ID = "IMG-01";

/** Los tres checks que componen la capa de red del catálogo. */
const NETWORK_CHECK_IDS = ["TECH-12", "TECH-13", SOCIAL_NETWORK_CHECK_ID] as const;

const NETWORK_PAGE_HTML =
  "<html><head>" +
  '<meta property="og:image" content="https://cdn.example.com/og.png" />' +
  "</head><body>" +
  '<a href="https://otro-dominio.com/externo">externo</a>' +
  '<img src="https://cdn.example.com/foto.png" alt="foto" />' +
  "</body></html>";

describe("registry — pageChecks", () => {
  it("incluye los dos checks de performance por página", () => {
    const registered = pageChecks.map((c) => c.checkId);
    for (const id of PERF_CHECK_IDS) {
      expect(registered).toContain(id);
    }
  });

  it("no tiene checkIds duplicados", () => {
    const registered = pageChecks.map((c) => c.checkId);
    expect(new Set(registered).size).toBe(registered.length);
  });

  it("ya no incluye el check retirado en v1.6", () => {
    const registered = pageChecks.map((c) => c.checkId);
    expect(registered).not.toContain(RETIRED_CHECK_ID);
  });

  it("incluye los ocho checks de la categoría social", () => {
    const registered = pageChecks.map((c) => c.checkId);
    for (const id of SOCIAL_CHECK_IDS) {
      expect(registered).toContain(id);
    }
  });
});

describe("registry — runAllChecks ejecuta los checks de performance de punta a punta", () => {
  it("devuelve exactamente una fila crítica de cada checkId nuevo para una página que dispara los dos", async () => {
    const page = makePage({
      url: URL,
      html: "<html><body><h1>Hola</h1></body></html>",
      responseMs: 1501,
      htmlBytes: 307201,
    });

    const { issues } = await runAllChecks({
      pages: [page],
      origin: ORIGIN,
      sitemapUrls: [],
      includeNetworkChecks: false,
    });

    for (const id of PERF_CHECK_IDS) {
      const rows = issues.filter((i) => i.checkId === id);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.severity).toBe("critical");
      expect(rows[0]?.pageId).toBe(page.id);
    }
  });

  it("no devuelve ninguna fila de los checks nuevos cuando las métricas están en null", async () => {
    // La página tiene HTML (así que `runAllChecks` sí la procesa), pero las dos
    // métricas faltan: es la prueba de que el guard `== null` funciona dentro
    // del pipeline real y no sólo en aislamiento.
    const page = makePage({
      url: URL,
      html: "<html><body><h1>Hola</h1></body></html>",
      responseMs: null,
      htmlBytes: null,
    });

    const { issues } = await runAllChecks({
      pages: [page],
      origin: ORIGIN,
      sitemapUrls: [],
      includeNetworkChecks: false,
    });

    expect(issues.filter((i) => PERF_CHECK_IDS.includes(i.checkId as never))).toEqual([]);
  });

  it("no devuelve ninguna fila del check retirado sobre una página con las cuatro etiquetas Open Graph", async () => {
    // Las cuatro etiquetas presentes son exactamente el caso que el check
    // retirado resolvía emitiendo una fila de severidad `ok`: si siguiera
    // registrado, este filtro traería una fila y el test fallaría.
    const page = makePage({
      url: URL,
      html: `<html><head><meta property="og:title" content="Título" /><meta property="og:description" content="Descripción" /><meta property="og:image" content="https://example.com/og.png" /><meta property="og:url" content="${URL}" /></head><body><h1>Hola</h1></body></html>`,
    });

    const { issues } = await runAllChecks({
      pages: [page],
      origin: ORIGIN,
      sitemapUrls: [],
      includeNetworkChecks: false,
    });

    expect(issues.filter((i) => i.checkId === RETIRED_CHECK_ID)).toEqual([]);
  });

  it("emite al menos una fila de problema de cada uno de los ocho checks sociales", async () => {
    // El HTML está roto a propósito en las ocho dimensiones que evalúa la
    // categoría: og:title duplicado con contenidos distintos y los dos por
    // debajo del mínimo, og:description muy corta, og:image relativa, og:url
    // apuntando a otro dominio, y ausencia total de og:type, twitter:card y
    // declaración de charset. Sin canonical explícita, para que SOCIAL-04
    // caiga en el respaldo de la URL de la propia página.
    //
    // El aserto se hace sobre fila de PROBLEMA y no sobre fila de aprobado a
    // propósito: la fila `ok` existe por convención de la fase 30 y es
    // candidata a quitarse en una recalibración futura, mientras que la fila
    // de problema es lo que prueba de verdad la alcanzabilidad — el check no
    // sólo está en la lista, corrió sobre HTML real y emitió su veredicto.
    const page = makePage({
      url: URL,
      html:
        "<html><head>" +
        '<meta property="og:title" content="Corto" />' +
        '<meta name="og:title" content="Otro" />' +
        '<meta property="og:description" content="Breve" />' +
        '<meta property="og:image" content="/img/og.png" />' +
        '<meta property="og:url" content="https://otro-dominio.com/x" />' +
        "</head><body><h1>Hola</h1></body></html>",
    });

    const { issues } = await runAllChecks({
      pages: [page],
      origin: ORIGIN,
      sitemapUrls: [],
      includeNetworkChecks: false,
    });

    for (const id of SOCIAL_CHECK_IDS) {
      const rows = issues.filter((i) => i.checkId === id);
      expect(rows.length).toBeGreaterThanOrEqual(1);
      for (const row of rows) {
        expect(row.category).toBe("social");
        expect(row.pageId).toBe(page.id);
      }
      expect(rows.some((r) => r.severity !== "ok")).toBe(true);
    }
  });
});

describe("registry — runAllChecks con los checks de red activos", () => {
  const mockedProbeImages = vi.mocked(probeImages);
  const mockedCheckLinks = vi.mocked(checkLinks);
  const mockedAssertPublicDestination = vi.mocked(assertPublicDestination);

  beforeEach(() => {
    mockedProbeImages.mockReset();
    mockedCheckLinks.mockReset();
    mockedAssertPublicDestination.mockReset();
    mockedAssertPublicDestination.mockResolvedValue({ ok: true, addresses: ["93.184.216.34"] });
    // Los checks de red del grupo AEO piden por su cuenta; sin esto saldrían a
    // internet aunque las tres puertas de la capa de red estén simuladas.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers(),
        text: async () => "",
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("emite filas de IMG-01 con categoría social y el pageId de la página, y dedupea la petición", async () => {
    mockedCheckLinks.mockResolvedValue([]);
    mockedProbeImages.mockImplementation(async (urls) =>
      urls.map((url) => ({
        ok: true as const,
        url,
        status: 200,
        contentType: "image/png",
        totalBytes: 40 * 1024,
        // Por debajo del piso: dispara una rama de problema conocida.
        dimensions: { width: 150, height: 150, type: "png" },
      })),
    );

    const page = makePage({ url: URL, html: NETWORK_PAGE_HTML });

    const { issues } = await runAllChecks({
      pages: [page],
      origin: ORIGIN,
      sitemapUrls: [],
      includeNetworkChecks: true,
    });

    const rows = issues.filter((i) => i.checkId === SOCIAL_NETWORK_CHECK_ID);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      expect(row.category).toBe("social");
      // Es lo que prueba que el fan-out por página llegó vivo hasta el catálogo.
      expect(row.pageId).toBe(page.id);
    }

    // El dedupe también funciona por el camino de producción: una sola llamada
    // con un arreglo de una sola URL.
    expect(mockedProbeImages).toHaveBeenCalledTimes(1);
    expect(mockedProbeImages.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it("emite filas de los tres checks de la capa de red, lo que convierte el registro en invariante", async () => {
    mockedCheckLinks.mockImplementation(async (urls) =>
      urls.map((url) => ({ ok: false as const, url, status: 404, reason: "HTTP 404" })),
    );
    mockedProbeImages.mockImplementation(async (urls) =>
      urls.map((url) => ({ ok: false as const, url, status: 404, reason: "HTTP 404" })),
    );

    const page = makePage({ url: URL, html: NETWORK_PAGE_HTML });

    const { issues } = await runAllChecks({
      pages: [page],
      origin: ORIGIN,
      sitemapUrls: [],
      includeNetworkChecks: true,
    });

    const emitted = new Set(issues.map((i) => i.checkId));
    for (const id of NETWORK_CHECK_IDS) {
      expect(emitted).toContain(id);
    }
  });
});
