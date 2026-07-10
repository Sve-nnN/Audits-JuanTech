import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { schemaEntityValidateCheck } from "./schemaEntityValidate";
import { makePage } from "../../testUtils";

function run(html: string, url = "https://example.com/page") {
  const $ = cheerio.load(html);
  const page = makePage({ url });
  return schemaEntityValidateCheck.run({ page, $ });
}

describe("schemaEntityValidateCheck (SD-07)", () => {
  it("emite warning (nunca critical) cuando una entidad tiene requerida faltante", () => {
    const issues = run(
      `<html><body><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization"}</script></body></html>`
    );
    expect(issues.some((i) => i.severity === "warning")).toBe(true);
    expect(issues.every((i) => i.severity !== "critical")).toBe(true);
  });

  it("emite un único IssueDraft ok cuando todas las entidades son válidas", () => {
    const issues = run(`<html><body><script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Organization","name":"Acme","url":"https://acme.example","logo":"https://acme.example/logo.png","sameAs":["https://twitter.com/acme"]}
    </script></body></html>`);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("ok");
  });

  it("devuelve [] cuando no hay JSON-LD en la página", () => {
    const issues = run(`<html><body><p>Sin datos estructurados</p></body></html>`);
    expect(issues).toEqual([]);
  });

  it("nunca produce un IssueDraft con severidad critical en ningún caso", () => {
    const scenarios = [
      `<html><body><script type="application/ld+json">{"@type":"Product","name":"Zapato","aggregateRating":{"ratingValue":"4.5"}}</script></body></html>`,
      `<html><body><script type="application/ld+json">{"@type":"BlogPosting","headline":"Hola"}</script></body></html>`,
      `<html><body><script type="application/ld+json">{"@type":"Organization"}</script></body></html>`,
    ];
    for (const html of scenarios) {
      const issues = run(html);
      expect(issues.every((i) => i.severity !== "critical")).toBe(true);
    }
  });

  it("usa CHECK_ID SD-07 y categoría schema", () => {
    const issues = run(
      `<html><body><script type="application/ld+json">{"@type":"Organization"}</script></body></html>`
    );
    expect(issues[0]?.checkId).toBe("SD-07");
    expect(issues[0]?.category).toBe("schema");
  });
});
