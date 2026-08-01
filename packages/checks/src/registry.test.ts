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
 */

const ORIGIN = "https://example.com";
const URL = "https://example.com/page";
const PERF_CHECK_IDS = ["PERF-10", "PERF-11"] as const;
const RETIRED_CHECK_ID = "ONPAGE-05";

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
});
