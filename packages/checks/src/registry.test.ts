import { describe, expect, it } from "vitest";
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
 */

const ORIGIN = "https://example.com";
const URL = "https://example.com/page";
const PERF_CHECK_IDS = ["PERF-10", "PERF-11"] as const;

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
});
