import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { extractMetaSocial, firstValue } from "./extract";

function loadFixture(name: string) {
  const html = readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
  return extractMetaSocial(cheerio.load(html));
}

describe("extractMetaSocial", () => {
  it("agrupa en la misma clave una etiqueta emitida por property y otra por name", () => {
    const data = loadFixture("mixed-property-name.html");
    // Es la regresión del selector restringido: leer un solo atributo deja
    // fuera la mitad de las etiquetas del universo WordPress objetivo.
    expect(data.tags.get("og:title")).toEqual([
      "Titular emitido por property",
      "Titular emitido por name",
    ]);
  });

  it("normaliza la clave a minúsculas y con trim", () => {
    const data = loadFixture("mixed-property-name.html");
    expect(firstValue(data, "og:description")).toBe("Descripción con la clave sin normalizar");
  });

  it("no crea entrada para una etiqueta con el contenido vacío", () => {
    const data = loadFixture("mixed-property-name.html");
    expect(data.tags.has("og:image")).toBe(false);
  });

  it("descarta las etiquetas que no pertenecen a ninguno de los dos vocabularios", () => {
    const data = loadFixture("mixed-property-name.html");
    expect(data.tags.has("description")).toBe(false);
    expect(data.tags.has("viewport")).toBe(false);
    expect(data.tags.has("__proto__")).toBe(false);
  });

  it("preserva el orden de documento y firstValue devuelve el primer valor, no el último", () => {
    const data = loadFixture("mixed-property-name.html");
    // El protocolo Open Graph resuelve los conflictos a favor de la primera
    // etiqueta, así que colapsar al último valor validaría el recurso
    // equivocado y dejaría invisible el duplicado contradictorio.
    expect(firstValue(data, "og:title")).toBe("Titular emitido por property");
  });

  it("guarda una clave hostil como entrada corriente y deja Object.prototype intacto", () => {
    const antes = Object.getOwnPropertyNames(Object.prototype).length;
    const data = loadFixture("mixed-property-name.html");

    expect(data.tags.get("og:__proto__")).toEqual(["valor hostil"]);
    expect(Object.getOwnPropertyNames(Object.prototype)).toHaveLength(antes);
    expect(({} as Record<string, unknown>).valorHostil).toBeUndefined();
  });

  it("extrae las claves esperadas del perfil WordPress con Yoast, incluida la de card por name", () => {
    const data = loadFixture("yoast.html");

    for (const key of ["og:title", "og:description", "og:url", "og:type", "og:image"]) {
      expect(data.tags.has(key)).toBe(true);
    }
    // Yoast emite `twitter:card` por `name`, nunca por `property`.
    expect(firstValue(data, "twitter:card")).toBe("summary_large_image");
  });

  it("lee la clave del atributo name cuando property viene presente pero vacío", () => {
    const $ = cheerio.load(
      '<meta property="" name="og:title" content="Titular social valido" />',
    );
    expect(extractMetaSocial($).tags.get("og:title")).toEqual(["Titular social valido"]);
  });

  it("indexa las dos claves cuando una sola etiqueta sirve a los dos vocabularios", () => {
    const $ = cheerio.load(
      '<meta property="og:image" name="twitter:image" content="https://example.com/a.png" />',
    );
    const data = extractMetaSocial($);
    expect(data.tags.get("og:image")).toEqual(["https://example.com/a.png"]);
    expect(data.tags.get("twitter:image")).toEqual(["https://example.com/a.png"]);
  });

  it("cuenta una sola vez la etiqueta que repite la misma clave en los dos atributos", () => {
    const $ = cheerio.load(
      '<meta property="og:title" name="og:title" content="Titular unico" />',
    );
    expect(extractMetaSocial($).tags.get("og:title")).toEqual(["Titular unico"]);
  });

  it("firstValue devuelve undefined para una clave que no existe", () => {
    const data = loadFixture("yoast.html");
    expect(firstValue(data, "og:video")).toBeUndefined();
  });
});
