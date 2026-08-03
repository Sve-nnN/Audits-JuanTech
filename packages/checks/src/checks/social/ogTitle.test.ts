import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { ogTitleCheck } from "./ogTitle";
import { makePage } from "../../testUtils";
import { pageFingerprint } from "../../util";

const URL = "https://example.com/page";

function run(html: string) {
  const $ = cheerio.load(html);
  const page = makePage({ url: URL, html });
  return ogTitleCheck.run({ page, $ });
}

const SIN_OG = "<html><head></head><body></body></html>";
const CORTO = "Nueve car";
const LARGO = "Un titular social muy largo que se corta en el preview social";
const VALIDO = "Titular social justo en rango.";

const og = (content: string, attr: "property" | "name" = "property") =>
  `<html><head><meta ${attr}="og:title" content="${content}" /></head></html>`;

describe("ogTitleCheck (SOCIAL-01)", () => {
  it("marca como crítica la ausencia de og:title", () => {
    const issues = run(SIN_OG);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("critical");
  });

  it("marca como advertencia un og:title de 9 caracteres", () => {
    expect(CORTO).toHaveLength(9);
    const [issue] = run(og(CORTO));
    expect(issue?.severity).toBe("warning");
    expect(issue?.title).toContain("corto");
  });

  it("marca como advertencia un og:title de 61 caracteres", () => {
    expect(LARGO).toHaveLength(61);
    const [issue] = run(og(LARGO));
    expect(issue?.severity).toBe("warning");
    expect(issue?.title).toContain("largo");
  });

  it("aprueba un og:title de 30 caracteres con la recomendación del catálogo", () => {
    expect(VALIDO).toHaveLength(30);
    const [issue] = run(og(VALIDO));
    expect(issue?.severity).toBe("ok");
    expect(issue?.recommendation).toBe("Sin acción necesaria.");
  });

  it("aprueba el mismo og:title emitido con el atributo name en vez de property", () => {
    // Invariante de la fase: las dos variantes de emisor producen el mismo
    // veredicto. Se pone en rojo si alguien reintroduce el selector restringido.
    const [issue] = run(og(VALIDO, "name"));
    expect(issue?.severity).toBe("ok");
  });

  it("trata como crítica una etiqueta og:title presente con el contenido vacío", () => {
    const [issue] = run(og(""));
    expect(issue?.severity).toBe("critical");
    expect(issue?.measuredValue).toBe("sin og:title");
  });

  it("emite el mismo fingerprint en todas las ramas sobre la misma URL", () => {
    // Contrato de fingerprint estable (convención C-5): pasar de ausente a
    // corto se lee como "sigue presente" en el diff, nunca como
    // "resuelto más nuevo".
    const fingerprints = [SIN_OG, og(CORTO), og(LARGO), og(VALIDO)].map(
      (html) => run(html)[0]?.fingerprint,
    );

    expect(new Set(fingerprints).size).toBe(1);
    expect(fingerprints[0]).toBe(pageFingerprint("SOCIAL-01", URL));
  });
});
