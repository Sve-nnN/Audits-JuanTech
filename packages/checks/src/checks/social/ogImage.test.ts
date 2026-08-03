import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { MAX_MEASURED_VALUE_CHARS } from "@auditor/meta-social";
import { ogImageCheck } from "./ogImage";
import { makePage } from "../../testUtils";
import { pageFingerprint } from "../../util";

const URL = "https://example.com/page";

function run(html: string) {
  const $ = cheerio.load(html);
  const page = makePage({ url: URL, html });
  return ogImageCheck.run({ page, $ });
}

const SIN_OG = "<html><head></head><body></body></html>";

const og = (content: string, attr: "property" | "name" = "property") =>
  `<html><head><meta ${attr}="og:image" content="${content}" /></head></html>`;

const ogDoble = (primera: string, segunda: string) =>
  `<html><head><meta property="og:image" content="${primera}" /><meta property="og:image" content="${segunda}" /></head></html>`;

const ABSOLUTA = "https://example.com/img/preview.png";
const INSEGURA = "http://example.com/img/preview.png";
const RELATIVA = "/img/preview.png";

describe("ogImageCheck (SOCIAL-03)", () => {
  it("marca como crítica la ausencia de og:image", () => {
    const issues = run(SIN_OG);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.checkId).toBe("SOCIAL-03");
    expect(issues[0]?.category).toBe("social");
    expect(issues[0]?.severity).toBe("critical");
    expect(issues[0]?.measuredValue).toBe("sin og:image");
  });

  it("marca como crítica una og:image con ruta relativa", () => {
    // Pitfall 6 de la investigación de milestone: hoy ningún check del
    // catálogo detecta que la vista previa de Facebook y LinkedIn queda rota.
    const issues = run(og(RELATIVA));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("critical");
    expect(issues[0]?.title).toContain("relativa");
  });

  it("aprueba la misma imagen escrita como URL absoluta https", () => {
    const issues = run(og(ABSOLUTA));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("ok");
    expect(issues[0]?.recommendation).toBe("Sin acción necesaria.");
  });

  it("marca como crítica una og:image sin protocolo y la distingue de la relativa", () => {
    const [issue] = run(og("//cdn.example.com/img/preview.png"));
    expect(issue?.severity).toBe("critical");
    expect(issue?.title).toContain("sin protocolo");
    expect(issue?.title).not.toContain("relativa");
  });

  it("marca como crítica una og:image sobre http en una página servida sobre https", () => {
    const [issue] = run(og(INSEGURA));
    expect(issue?.severity).toBe("critical");
    expect(issue?.title).toContain("HTTP");
    expect(issue?.measuredValue).toBe(INSEGURA);
  });

  it("marca como crítica una og:image con un esquema que no es http ni https", () => {
    // La función de normalización es la que decide, no una lista propia de
    // esquemas: por eso la rama de valor no válido va antes que la relativa.
    const [issue] = run(og("javascript:alert(1)"));
    expect(issue?.severity).toBe("critical");
    expect(issue?.title).toContain("no válida");
    expect(issue?.title).not.toContain("relativa");
  });

  it("recorta el valor medido al tope compartido de la categoría", () => {
    // Mitigación de T-30-06: una corrida escribe una fila por página y hasta
    // 500 páginas, así que un valor hostil se amplifica quinientas veces.
    const larga = `/${"a".repeat(499)}`;
    expect(larga).toHaveLength(500);
    const [issue] = run(og(larga));
    expect(issue?.severity).toBe("critical");
    expect(MAX_MEASURED_VALUE_CHARS).toBe(80);
    expect(issue?.measuredValue).toHaveLength(MAX_MEASURED_VALUE_CHARS);
  });

  it("resuelve el veredicto con la primera etiqueta og:image en orden de documento", () => {
    // Regla de precedencia del protocolo Open Graph: quedarse con la última
    // invierte el veredicto sobre la misma página.
    const [primeraValida] = run(ogDoble(ABSOLUTA, RELATIVA));
    expect(primeraValida?.severity).toBe("ok");

    const [primeraRelativa] = run(ogDoble(RELATIVA, ABSOLUTA));
    expect(primeraRelativa?.severity).toBe("critical");
    expect(primeraRelativa?.title).toContain("relativa");
  });

  it("aprueba la misma og:image emitida con el atributo name en vez de property", () => {
    // Invariante de la generalización registrada en 30-01: las dos variantes
    // de emisor producen el mismo veredicto.
    const [issue] = run(og(ABSOLUTA, "name"));
    expect(issue?.severity).toBe("ok");
  });

  it("emite el mismo fingerprint en todas las ramas sobre la misma URL", () => {
    // Contrato de fingerprint estable (convención C-5): pasar de ausente a
    // relativa se lee como la misma incidencia en el diff entre auditorías.
    const fingerprints = [SIN_OG, og(RELATIVA), og(INSEGURA), og(ABSOLUTA)].map(
      (html) => run(html)[0]?.fingerprint,
    );

    expect(new Set(fingerprints).size).toBe(1);
    expect(fingerprints[0]).toBe(pageFingerprint("SOCIAL-03", URL));
  });
});
