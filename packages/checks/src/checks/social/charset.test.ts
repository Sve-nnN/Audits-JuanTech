import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { charsetCheck } from "./charset";
import { socialPageChecks } from "./index";
import { pageChecks } from "../../registry";
import { makePage } from "../../testUtils";
import { pageFingerprint } from "../../util";

const URL = "https://example.com/page";

function run(html: string) {
  // El check no consume el objeto de consulta, pero el helper lo construye
  // igual para que el layout coincida con el de los otros siete tests.
  const $ = cheerio.load(html);
  const page = makePage({ url: URL, html });
  return charsetCheck.run({ page, $ });
}

const SIN_CHARSET = "<!DOCTYPE html><html><head><title>x</title></head><body></body></html>";

const CON_CHARSET =
  '<!DOCTYPE html><html><head><meta charset="utf-8"><title>x</title></head><body></body></html>';

// Relleno de dos bytes por carácter: la declaración queda antes del carácter
// 1024 y después del byte 1024, que es la regla lockeada de la fase.
const MULTIBYTE = `<!--${"é".repeat(600)}--><meta charset="utf-8">`;

describe("charsetCheck (SOCIAL-08)", () => {
  it("advierte cuando el documento no declara charset", () => {
    const issues = run(SIN_CHARSET);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("warning");
  });

  it("aprueba cuando el charset se declara al inicio del head", () => {
    const issues = run(CON_CHARSET);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("ok");
    expect(issues[0]?.recommendation).toBe("Sin acción necesaria.");
  });

  it("advierte cuando la declaración cae después del byte 1024 aunque esté antes del carácter 1024", () => {
    expect(MULTIBYTE.indexOf("<meta")).toBeLessThan(1024);
    const [issue] = run(MULTIBYTE);
    expect(issue?.severity).toBe("warning");
  });

  it("declara en el criterio que el charset por header no es observable", () => {
    // Resolución D-3: el veredicto se emite sobre un dato incompleto y el
    // texto que lee el usuario lo dice.
    const [issue] = run(SIN_CHARSET);
    expect(issue?.criterion).toContain("header HTTP");
  });

  it("nunca sube la severidad por encima de la advertencia", () => {
    // Assertado por igualdad y no por negación: es lo que fija D-3 en un test.
    const [issue] = run(SIN_CHARSET);
    expect(issue?.severity).toBe("warning");
  });

  it("emite el mismo fingerprint en las dos ramas sobre la misma URL", () => {
    const fingerprints = [SIN_CHARSET, CON_CHARSET].map((html) => run(html)[0]?.fingerprint);
    expect(new Set(fingerprints).size).toBe(1);
    expect(fingerprints[0]).toBe(pageFingerprint("SOCIAL-08", URL));
  });

  it("no emite ninguna fila cuando la página no tiene HTML", () => {
    const page = makePage({ url: URL });
    expect(charsetCheck.run({ page, $: undefined as never })).toEqual([]);
  });

  it("construye source y fingerprint con la URL final tras un redirect", () => {
    const finalUrl = "https://example.com/destino";
    const page = makePage({ url: URL, finalUrl, html: SIN_CHARSET });
    const [issue] = charsetCheck.run({ page, $: cheerio.load(SIN_CHARSET) });

    expect(issue?.source).toBe(finalUrl);
    expect(issue?.fingerprint).toBe(pageFingerprint("SOCIAL-08", finalUrl));
  });

  it("está cableado exactamente una vez en el catálogo global de checks", () => {
    const enCatalogo = pageChecks.filter((check) => check.checkId === "SOCIAL-08");
    expect(enCatalogo).toHaveLength(1);

    const ids = socialPageChecks.map((check) => check.checkId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
