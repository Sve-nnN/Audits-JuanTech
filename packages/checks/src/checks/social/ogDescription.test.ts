import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { ogDescriptionCheck } from "./ogDescription";
import { socialPageChecks } from "./index";
import { makePage } from "../../testUtils";
import { pageFingerprint } from "../../util";

const URL = "https://example.com/page";

function run(html: string) {
  const $ = cheerio.load(html);
  const page = makePage({ url: URL, html });
  return ogDescriptionCheck.run({ page, $ });
}

const SIN_OG = "<html><head></head><body></body></html>";

const og = (content: string, attr: "property" | "name" = "property") =>
  `<html><head><meta ${attr}="og:description" content="${content}" /></head></html>`;

/** Construye un contenido de longitud exacta, para que el caso no mienta si alguien lo edita. */
const texto = (largo: number) => "a".repeat(largo);

describe("ogDescriptionCheck (SOCIAL-02)", () => {
  it("marca como advertencia la ausencia de og:description", () => {
    const issues = run(SIN_OG);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.checkId).toBe("SOCIAL-02");
    expect(issues[0]?.category).toBe("social");
    expect(issues[0]?.severity).toBe("warning");
    expect(issues[0]?.measuredValue).toBe("sin og:description");
  });

  it("trata una etiqueta og:description con el contenido vacío igual que la ausencia", () => {
    const issues = run(og(""));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("warning");
    expect(issues[0]?.measuredValue).toBe("sin og:description");
  });

  it("marca como advertencia una og:description de 54 caracteres", () => {
    const contenido = texto(54);
    expect(contenido).toHaveLength(54);
    const [issue] = run(og(contenido));
    expect(issue?.severity).toBe("warning");
    expect(issue?.title).toContain("corta");
  });

  it("aprueba una og:description de exactamente 55 caracteres", () => {
    // Borde inferior exacto de la calibración social. Se pone en rojo si
    // alguien reusa el mínimo del check de meta description de buscadores.
    const contenido = texto(55);
    expect(contenido).toHaveLength(55);
    const [issue] = run(og(contenido));
    expect(issue?.severity).toBe("ok");
  });

  it("aprueba una og:description de exactamente 200 caracteres", () => {
    // Borde superior exacto de la calibración social. Se pone en rojo si
    // alguien reusa el máximo del check de meta description de buscadores.
    const contenido = texto(200);
    expect(contenido).toHaveLength(200);
    const [issue] = run(og(contenido));
    expect(issue?.severity).toBe("ok");
  });

  it("marca como advertencia una og:description de 201 caracteres", () => {
    const contenido = texto(201);
    expect(contenido).toHaveLength(201);
    const [issue] = run(og(contenido));
    expect(issue?.severity).toBe("warning");
    expect(issue?.title).toContain("larga");
  });

  it("aprueba la misma og:description emitida con el atributo name en vez de property", () => {
    // Invariante de la fase: las dos variantes de emisor producen el mismo
    // veredicto, porque el check lee sólo por el extractor del paquete puro.
    const contenido = texto(120);
    expect(contenido).toHaveLength(120);
    const [issue] = run(og(contenido, "name"));
    expect(issue?.severity).toBe("ok");
  });

  it("emite el mismo fingerprint en todas las ramas sobre la misma URL", () => {
    // Contrato de fingerprint estable (convención C-5): pasar de ausente a
    // corta se lee como "sigue presente" en el diff, nunca como
    // "resuelto más nuevo".
    const fingerprints = [SIN_OG, og(texto(54)), og(texto(201)), og(texto(120))].map(
      (html) => run(html)[0]?.fingerprint,
    );

    expect(new Set(fingerprints).size).toBe(1);
    expect(fingerprints[0]).toBe(pageFingerprint("SOCIAL-02", URL));
  });

  it("queda registrado en el barrel socialPageChecks de la categoría", () => {
    expect(socialPageChecks.map((check) => check.checkId)).toContain("SOCIAL-02");
  });
});
