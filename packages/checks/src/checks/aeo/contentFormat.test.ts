import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { contentFormatCheck } from "./contentFormat";
import { makePage } from "../../testUtils";

function run(html: string, url = "https://example.com/page") {
  const $ = cheerio.load(html);
  const page = makePage({ url });
  return contentFormatCheck.run({ page, $ });
}

const SHORT_PARAGRAPH = Array.from({ length: 20 }, (_v, i) => `palabra${i}`).join(" ");
const LONG_PARAGRAPH = Array.from({ length: 250 }, (_v, i) => `palabra${i}`).join(" ");

describe("contentFormatCheck (AEO-04)", () => {
  it("flags good format: question headings + lists + concise paragraphs", () => {
    const html = `<html><body>
      <h2>¿Qué es esto?</h2>
      <p>${SHORT_PARAGRAPH}</p>
      <ul><li>uno</li><li>dos</li></ul>
    </body></html>`;
    const [issue] = run(html);
    expect(issue?.severity).toBe("ok");
    expect(issue?.measuredValue).toContain("1/1 encabezados como pregunta");
  });

  it("flags warning when no question headings, lists or tables are present", () => {
    const html = `<html><body>
      <h2>Sección informativa</h2>
      <p>${SHORT_PARAGRAPH}</p>
    </body></html>`;
    const [issue] = run(html);
    expect(issue?.severity).toBe("warning");
  });

  it("flags warning when average paragraph length is too long", () => {
    const html = `<html><body>
      <h2>¿Cómo funciona?</h2>
      <p>${LONG_PARAGRAPH}</p>
    </body></html>`;
    const [issue] = run(html);
    expect(issue?.severity).toBe("warning");
    expect(issue?.measuredValue).toContain("palabras/párrafo");
  });

  it("counts tables toward extractable format", () => {
    const html = `<html><body>
      <h2>Datos</h2>
      <table><tr><td>a</td></tr></table>
      <p>${SHORT_PARAGRAPH}</p>
    </body></html>`;
    const [issue] = run(html);
    expect(issue?.severity).toBe("ok");
  });
});
