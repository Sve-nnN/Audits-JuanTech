import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { MAX_MEASURED_VALUE_CHARS } from "@auditor/meta-social";
import { ogTypeCheck } from "./ogType";
import { socialPageChecks } from "./index";
import { makePage } from "../../testUtils";
import { pageFingerprint } from "../../util";

const URL = "https://example.com/page";

function run(html: string) {
  const $ = cheerio.load(html);
  const page = makePage({ url: URL, html });
  return ogTypeCheck.run({ page, $ });
}

const SIN_OG = "<html><head></head><body></body></html>";

const og = (content: string, attr: "property" | "name" = "property") =>
  `<html><head><meta ${attr}="og:type" content="${content}" /></head></html>`;

describe("ogTypeCheck (SOCIAL-05)", () => {
  it("marca como advertencia la ausencia de og:type", () => {
    const issues = run(SIN_OG);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.checkId).toBe("SOCIAL-05");
    expect(issues[0]?.category).toBe("social");
    expect(issues[0]?.severity).toBe("warning");
    expect(issues[0]?.measuredValue).toBe("sin og:type");
  });

  it("trata una etiqueta og:type con el contenido vacío igual que la ausencia", () => {
    const issues = run(og(""));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("warning");
    expect(issues[0]?.measuredValue).toBe("sin og:type");
  });

  it("aprueba un og:type con el valor website y reporta el valor encontrado", () => {
    const [issue] = run(og("website"));
    expect(issue?.severity).toBe("ok");
    expect(issue?.measuredValue).toBe("website");
    expect(issue?.recommendation).toBe("Sin acción necesaria.");
  });

  it("aprueba un og:type del vocabulario extendido del protocolo", () => {
    // El alcance del check termina en la presencia. Este caso se pone en rojo
    // si alguien compara el valor contra una lista corta de tipos comunes,
    // que es Deferred Idea de la fase por generar falsos positivos sobre los
    // vocabularios extendidos legítimos.
    const [issue] = run(og("music.playlist"));
    expect(issue?.severity).toBe("ok");
    expect(issue?.measuredValue).toBe("music.playlist");
  });

  it("aprueba el mismo og:type emitido con el atributo name en vez de property", () => {
    // Invariante de la fase: las dos variantes de emisor producen el mismo
    // veredicto, porque el check lee sólo por el extractor del paquete puro.
    const [issue] = run(og("website", "name"));
    expect(issue?.severity).toBe("ok");
  });

  it("recorta el valor medido al tope compartido de la categoría", () => {
    // Mitigación de T-30-06: el contenido de la etiqueta lo controla por
    // completo el sitio auditado y se persiste en la fila Issue, así que la
    // fila no puede crecer sin cota por decisión del sitio auditado.
    const largo = "a".repeat(500);
    expect(largo).toHaveLength(500);
    const [issue] = run(og(largo));
    expect(issue?.severity).toBe("ok");
    expect(MAX_MEASURED_VALUE_CHARS).toBe(80);
    expect(issue?.measuredValue).toHaveLength(MAX_MEASURED_VALUE_CHARS);
  });

  it("emite el mismo fingerprint en las dos ramas sobre la misma URL", () => {
    // Contrato de fingerprint estable (convención C-5).
    const fingerprints = [SIN_OG, og("website")].map((html) => run(html)[0]?.fingerprint);

    expect(new Set(fingerprints).size).toBe(1);
    expect(fingerprints[0]).toBe(pageFingerprint("SOCIAL-05", URL));
  });

  it("queda registrado en el barrel socialPageChecks junto a los otros dos checks de la ola", () => {
    // La aserción es de pertenencia y no de longitud exacta: cada ola
    // posterior suma checks al mismo array, y un conteo fijo aquí pondría en
    // rojo un archivo ajeno cada vez que la categoría crece.
    const ids = socialPageChecks.map((check) => check.checkId);
    expect(ids).toEqual(expect.arrayContaining(["SOCIAL-01", "SOCIAL-02", "SOCIAL-05"]));
  });
});
