import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { MAX_MEASURED_VALUE_CHARS } from "@auditor/meta-social";
import { ogUrlCheck } from "./ogUrl";
import { socialPageChecks } from "./index";
import { canonicalCheck } from "../tech/canonical";
import { makePage } from "../../testUtils";
import { pageFingerprint } from "../../util";

const URL = "https://example.com/page";

function run(html: string, url = URL) {
  const $ = cheerio.load(html);
  const page = makePage({ url, html });
  return ogUrlCheck.run({ page, $ });
}

const SIN_OG = "<html><head></head><body></body></html>";

const doc = (ogUrl: string | null, canonical?: string) => {
  const canonicalTag = canonical ? `<link rel="canonical" href="${canonical}" />` : "";
  const ogTag = ogUrl === null ? "" : `<meta property="og:url" content="${ogUrl}" />`;
  return `<html><head>${canonicalTag}${ogTag}</head></html>`;
};

describe("ogUrlCheck (SOCIAL-04)", () => {
  it("marca como advertencia la ausencia de og:url", () => {
    const issues = run(SIN_OG);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.checkId).toBe("SOCIAL-04");
    expect(issues[0]?.category).toBe("social");
    expect(issues[0]?.severity).toBe("warning");
    expect(issues[0]?.measuredValue).toBe("sin og:url");
  });

  it("aprueba una og:url igual a la canonical explícita de la página", () => {
    const [issue] = run(doc(URL, URL));
    expect(issue?.severity).toBe("ok");
    expect(issue?.recommendation).toBe("Sin acción necesaria.");
  });

  it("marca como advertencia una og:url que apunta a otra URL que la canonical", () => {
    const [issue] = run(doc("https://example.com/otra", URL));
    expect(issue?.severity).toBe("warning");
    expect(issue?.title).toContain("no coincide");
    expect(issue?.measuredValue).toContain("canonical");
  });

  it("aprueba una og:url igual a la URL de la página cuando no hay canonical", () => {
    // Fallback lockeado en 30-CONTEXT.md: sin canonical, la referencia es la
    // propia página, y el criterio del check lo declara textualmente.
    const [issue] = run(doc(URL));
    expect(issue?.severity).toBe("ok");
  });

  it("marca como advertencia una og:url que apunta a otra dirección cuando no hay canonical", () => {
    const [issue] = run(doc("https://example.com/otra"));
    expect(issue?.severity).toBe("warning");
    expect(issue?.title).toContain("no coincide");
  });

  it("marca como advertencia una og:url con un esquema que no es http ni https", () => {
    // La rama de valor no utilizable va antes que la de coherencia: un
    // esquema que la normalización rechaza no tiene nada que comparar.
    const [issue] = run(doc("data:text/html,x", URL));
    expect(issue?.severity).toBe("warning");
    expect(issue?.title).toContain("no válida");
    expect(issue?.title).not.toContain("coincide");
  });

  it("recorta el valor medido al tope compartido de la categoría", () => {
    // Mitigación de T-30-06 con el mismo tope que aplican los checks
    // hermanos de la categoría.
    const larga = `javascript:${"a".repeat(489)}`;
    expect(larga).toHaveLength(500);
    const [issue] = run(doc(larga, URL));
    expect(issue?.severity).toBe("warning");
    expect(issue?.title).toContain("no válida");
    expect(MAX_MEASURED_VALUE_CHARS).toBe(80);
    expect(issue?.measuredValue).toHaveLength(MAX_MEASURED_VALUE_CHARS);
  });

  it("resuelve la canonical relativa contra la página antes de comparar", () => {
    const [issue] = run(doc(URL, "/page"));
    expect(issue?.severity).toBe("ok");
  });

  it("no contradice a canonicalCheck sobre una página con diferencias cosméticas", () => {
    // Invariante más cara del check: los dos veredictos se construyen con la
    // misma normalización, así que barra final y parámetro de tracking no
    // pueden producir dos juicios opuestos sobre la misma página. Con una
    // comparación de cadenas crudas este caso se pone en rojo mientras
    // canonicalCheck sigue en verde.
    const html = doc("https://example.com/page/", "https://example.com/page/?utm_source=news");
    const $ = cheerio.load(html);
    const page = makePage({ url: URL, html });

    const [canonicalIssue] = canonicalCheck.run({ page, $ });
    const [socialIssue] = ogUrlCheck.run({ page, $ });

    expect(canonicalIssue?.severity).toBe("ok");
    expect(socialIssue?.severity).toBe("ok");
  });

  it("emite el mismo fingerprint en todas las ramas sobre la misma URL", () => {
    // Contrato de fingerprint estable (convención C-5).
    const fingerprints = [
      SIN_OG,
      doc("data:text/html,x", URL),
      doc("https://example.com/otra", URL),
      doc(URL, URL),
    ].map((html) => run(html)[0]?.fingerprint);

    expect(new Set(fingerprints).size).toBe(1);
    expect(fingerprints[0]).toBe(pageFingerprint("SOCIAL-04", URL));
  });
});

describe("socialPageChecks (barrel)", () => {
  it("no repite ningún checkId", () => {
    const ids = socialPageChecks.map((check) => check.checkId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("mantiene los checkId en orden ascendente", () => {
    // La regla de orden del barrel deja de ser prosa: se mantiene verde por
    // construcción cuando las olas siguientes agregan sus checks al final.
    const ids = socialPageChecks.map((check) => check.checkId);
    expect(ids).toEqual([...ids].sort());
  });
});
