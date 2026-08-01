import { describe, expect, it } from "vitest";
import { htmlSizeCheck } from "./htmlSize";
import { runAllChecks } from "../../registry";
import { makePage } from "../../testUtils";

const URL = "https://example.com/page";

function run(htmlBytes: number | null) {
  const page = makePage({ url: URL, html: "<html></html>", htmlBytes });
  return htmlSizeCheck.run({ page, $: undefined as never });
}

describe("htmlSizeCheck (PERF-11)", () => {
  it("emits no issue at all when the metric is missing (null)", () => {
    // Vía `runAllChecks` este caso no es alcanzable (el registry filtra las
    // páginas sin html antes de correr los PageCheck), pero sí lo es al
    // reprocesar auditorías anteriores a esta fase, que no tienen backfill.
    expect(run(null)).toEqual([]);
  });

  it("treats 0 bytes as a real measurement, not as missing data", () => {
    // El guard es `== null`, no falsy: 0 bytes es un valor legítimo y debe
    // producir una fila `ok` en vez de desaparecer del reporte.
    const [issue] = run(0);
    expect(issue?.severity).toBe("ok");
    expect(issue?.measuredValue).toBe("0 KB");
  });

  it("keeps the exact warning threshold (100 KB) as ok", () => {
    // Comparación estrictamente mayor: el límite exacto cuenta como el
    // escalón inferior.
    expect(run(102400)[0]?.severity).toBe("ok");
  });

  it("flags one byte over the warning threshold as warning", () => {
    expect(run(102401)[0]?.severity).toBe("warning");
  });

  it("keeps the exact critical threshold (300 KB) as warning", () => {
    expect(run(307200)[0]?.severity).toBe("warning");
  });

  it("flags one byte over the critical threshold as critical", () => {
    expect(run(307201)[0]?.severity).toBe("critical");
  });

  it("reports the measured size in KB, rounded (150 KB exactos)", () => {
    expect(run(153600)[0]?.measuredValue).toBe("150 KB");
  });

  it("rounds the KB value instead of truncating it", () => {
    // 102912 / 1024 = 100.5 → 101 KB con redondeo, 100 KB con truncamiento.
    expect(run(102912)[0]?.measuredValue).toBe("101 KB");
  });

  it("emits the catalog-standard issue shape (checkId, category, source, fingerprint, pageId)", () => {
    const page = makePage({ url: URL, html: "<html></html>", htmlBytes: 400000 });
    const [issue] = htmlSizeCheck.run({ page, $: undefined as never });
    expect(issue).toMatchObject({
      checkId: "PERF-11",
      category: "perf",
      severity: "critical",
      source: URL,
      fingerprint: `PERF-11:${URL}`,
      pageId: page.id,
    });
    // El criterio debe aclarar que la medición es del HTML sin comprimir: la
    // brecha contra los bytes transferidos que muestra el navegador va de 3.6x
    // a 7.4x sobre los sitios reales medidos, y sin la aclaración el usuario
    // asume que el reporte está mal.
    expect(issue?.criterion).toContain("sin comprimir");
  });

  it("uses a different title for the problem branch and the ok branch", () => {
    expect(run(400000)[0]?.title).not.toBe(run(1024)[0]?.title);
    expect(run(1024)[0]?.recommendation).toBe("Sin acción necesaria.");
  });

  it("uses finalUrl over url for source and fingerprint when they differ", () => {
    const page = makePage({
      url: URL,
      finalUrl: "https://example.com/final",
      html: "<html></html>",
      htmlBytes: 200000,
    });
    const [issue] = htmlSizeCheck.run({ page, $: undefined as never });
    expect(issue?.source).toBe("https://example.com/final");
    expect(issue?.fingerprint).toBe("PERF-11:https://example.com/final");
  });
});

describe("htmlSizeCheck registration (end to end via runAllChecks)", () => {
  it("produces exactly one critical PERF-11 issue for a heavy page", async () => {
    // Prueba que el registro quedó completo en las tres capas (barrel del
    // grupo, `pageChecks` del registry y barrel del paquete): si falta
    // cualquiera, el check nunca corre y este caso devuelve 0 issues.
    const page = makePage({
      url: URL,
      html: "<html><body><h1>Hola</h1></body></html>",
      htmlBytes: 307201,
    });

    const { issues } = await runAllChecks({
      pages: [page],
      origin: "https://example.com",
      sitemapUrls: [],
      includeNetworkChecks: false,
    });

    const perf11 = issues.filter((i) => i.checkId === "PERF-11");
    expect(perf11).toHaveLength(1);
    expect(perf11[0]?.severity).toBe("critical");
    expect(perf11[0]?.category).toBe("perf");
  });
});
