import { describe, expect, it } from "vitest";
import { responseTimeCheck } from "./responseTime";
import { runAllChecks } from "../../registry";
import { makePage } from "../../testUtils";

const URL = "https://example.com/page";

function run(responseMs: number | null) {
  const page = makePage({ url: URL, html: "<html><body>ok</body></html>", responseMs });
  return responseTimeCheck.run({ page, $: undefined as never });
}

describe("responseTimeCheck (PERF-10)", () => {
  it("emits no issue at all when the metric is missing (null)", () => {
    // Vía `runAllChecks` este caso no es alcanzable (el registry filtra las
    // páginas sin html antes de correr los PageCheck), pero sí lo es al
    // reprocesar auditorías anteriores a esta fase, que no tienen backfill.
    expect(run(null)).toEqual([]);
  });

  it("treats 0 ms as a real measurement, not as missing data", () => {
    // El guard es `== null`, no falsy: 0 ms es un valor legítimo y debe
    // producir una fila `ok` en vez de desaparecer del reporte.
    const [issue] = run(0);
    expect(issue?.severity).toBe("ok");
    expect(issue?.measuredValue).toBe("0 ms");
  });

  it("keeps the exact warning threshold (600 ms) as ok", () => {
    // Comparación estrictamente mayor: el límite exacto cuenta como el
    // escalón inferior.
    expect(run(600)[0]?.severity).toBe("ok");
  });

  it("flags 601 ms as warning", () => {
    expect(run(601)[0]?.severity).toBe("warning");
  });

  it("keeps the exact critical threshold (1500 ms) as warning", () => {
    expect(run(1500)[0]?.severity).toBe("warning");
  });

  it("flags 1501 ms as critical", () => {
    expect(run(1501)[0]?.severity).toBe("critical");
  });

  it("emits the catalog-standard issue shape (checkId, category, source, fingerprint, pageId)", () => {
    const page = makePage({ url: URL, html: "<html></html>", responseMs: 2000 });
    const [issue] = responseTimeCheck.run({ page, $: undefined as never });
    expect(issue).toMatchObject({
      checkId: "PERF-10",
      category: "perf",
      source: URL,
      fingerprint: `PERF-10:${URL}`,
      pageId: page.id,
    });
    // El criterio debe aclarar que la medición es nuestra, no de campo, para
    // que no se lea como un TTFB real de usuario (CrUX, que PSI ya publica en
    // la misma categoría `perf`).
    expect(issue?.criterion).toContain("desde nuestro servidor");
  });

  it("uses finalUrl over url for source and fingerprint when they differ", () => {
    const page = makePage({
      url: URL,
      finalUrl: "https://example.com/final",
      html: "<html></html>",
      responseMs: 700,
    });
    const [issue] = responseTimeCheck.run({ page, $: undefined as never });
    expect(issue?.source).toBe("https://example.com/final");
    expect(issue?.fingerprint).toBe("PERF-10:https://example.com/final");
  });
});

describe("responseTimeCheck registration (end to end via runAllChecks)", () => {
  it("produces exactly one critical PERF-10 issue for a slow page", async () => {
    // Prueba que el registro quedó completo en las tres capas (barrel del
    // grupo, `pageChecks` del registry y barrel del paquete): si falta
    // cualquiera, el check nunca corre y este caso devuelve 0 issues.
    const page = makePage({
      url: URL,
      html: "<html><body><h1>Hola</h1></body></html>",
      responseMs: 1501,
    });

    const { issues } = await runAllChecks({
      pages: [page],
      origin: "https://example.com",
      sitemapUrls: [],
      includeNetworkChecks: false,
    });

    const perf10 = issues.filter((i) => i.checkId === "PERF-10");
    expect(perf10).toHaveLength(1);
    expect(perf10[0]?.severity).toBe("critical");
    expect(perf10[0]?.category).toBe("perf");
  });
});
