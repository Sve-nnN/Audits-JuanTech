import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { ogDuplicatesCheck } from "./ogDuplicates";
import { makePage } from "../../testUtils";
import { pageFingerprint } from "../../util";

const URL = "https://example.com/page";

function run(html: string) {
  const $ = cheerio.load(html);
  const page = makePage({ url: URL, html });
  return ogDuplicatesCheck.run({ page, $ });
}

const head = (...metas: string[]) => `<html><head>${metas.join("")}</head><body></body></html>`;

const meta = (key: string, content: string, attr: "property" | "name" = "property") =>
  `<meta ${attr}="${key}" content="${content}" />`;

const warnings = (issues: ReturnType<typeof run>) => issues.filter((i) => i.severity === "warning");

describe("ogDuplicatesCheck (SOCIAL-06)", () => {
  it("marca una única advertencia cuando la misma clave og trae contenidos distintos", () => {
    const issues = run(head(meta("og:title", "Primero"), meta("og:title", "Segundo")));
    const warns = warnings(issues);
    expect(issues).toHaveLength(1);
    expect(warns).toHaveLength(1);
    expect(warns[0]?.checkId).toBe("SOCIAL-06");
    expect(warns[0]?.category).toBe("social");
    expect(warns[0]?.fingerprint).toBe(pageFingerprint("SOCIAL-06:og:title", URL));
    expect(warns[0]?.measuredValue).toBe("2 etiquetas, 2 valores distintos");
  });

  it("no marca nada cuando la clave repetida trae exactamente el mismo contenido", () => {
    // Regla de negocio lockeada: repetir no es el defecto, contradecirse sí.
    // Una plantilla de CMS que emite dos veces la misma etiqueta es redundante
    // pero no ambigua, y marcarla convierte el check en ruido.
    const issues = run(head(meta("og:title", "Mismo"), meta("og:title", "Mismo")));
    expect(warnings(issues)).toHaveLength(0);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("ok");
  });

  it("marca el cruce de los dos atributos de emisor con contenidos distintos", () => {
    // Regresión de D-2: una consulta restringida a `property` deja este caso
    // invisible por construcción, no sólo por defecto de implementación.
    const issues = run(head(meta("og:title", "Por property"), meta("og:title", "Por name", "name")));
    const warns = warnings(issues);
    expect(warns).toHaveLength(1);
    expect(warns[0]?.fingerprint).toContain("SOCIAL-06:og:title");
  });

  it("agrupa claves con mayúsculas mezcladas junto a su forma en minúsculas", () => {
    const issues = run(head(meta("og:title", "Minúsculas"), meta("OG:Title", "Mayúsculas")));
    const warns = warnings(issues);
    expect(warns).toHaveLength(1);
    expect(warns[0]?.measuredValue).toBe("2 etiquetas, 2 valores distintos");
  });

  it("emite una fila por cada clave en conflicto, con fingerprints distintos", () => {
    const issues = run(
      head(
        meta("og:title", "Uno"),
        meta("og:title", "Dos"),
        meta("og:description", "Alfa"),
        meta("og:description", "Beta"),
      ),
    );
    const warns = warnings(issues);
    expect(warns).toHaveLength(2);
    expect(new Set(warns.map((i) => i.fingerprint)).size).toBe(2);
  });

  it("deja fuera de alcance los duplicados del vocabulario de X", () => {
    // Open Question 4: el requisito nombra únicamente Open Graph. La og:title
    // suelta está para que el check aplique y se vea que aun así no marca.
    const issues = run(
      head(
        meta("og:title", "Título"),
        meta("twitter:title", "Uno", "name"),
        meta("twitter:title", "Dos", "name"),
      ),
    );
    expect(warnings(issues)).toHaveLength(0);
    expect(issues[0]?.severity).toBe("ok");
  });

  it("no emite ninguna fila en una página sin etiquetas de Open Graph", () => {
    const issues = run(head(meta("twitter:card", "summary", "name")));
    expect(issues).toHaveLength(0);
  });

  it("emite la fila de aprobado, sin subtipo, cuando la clave og aparece una sola vez", () => {
    const issues = run(head(meta("og:title", "Único")));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("ok");
    expect(issues[0]?.title).toBe("Sin etiquetas og duplicadas");
    expect(issues[0]?.recommendation).toBe("Sin acción necesaria.");
    expect(issues[0]?.fingerprint).toBe(pageFingerprint("SOCIAL-06", URL));
    expect(issues[0]?.measuredValue).toBe("1 propiedad og distinta");
  });
});
