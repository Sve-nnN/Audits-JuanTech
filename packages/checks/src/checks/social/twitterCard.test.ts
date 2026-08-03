import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { MAX_MEASURED_VALUE_CHARS } from "@auditor/meta-social";
import { twitterCardCheck } from "./twitterCard";
import { makePage } from "../../testUtils";
import { pageFingerprint } from "../../util";

const URL = "https://example.com/page";

function run(html: string) {
  const $ = cheerio.load(html);
  const page = makePage({ url: URL, html });
  return twitterCardCheck.run({ page, $ });
}

function bySubtype(issues: ReturnType<typeof run>, subtype: string) {
  return issues.find((i) => i.fingerprint.includes(`SOCIAL-07:${subtype}`));
}

const head = (...metas: string[]) => `<html><head>${metas.join("")}</head><body></body></html>`;

const meta = (key: string, content: string, attr: "property" | "name" = "name") =>
  `<meta ${attr}="${key}" content="${content}" />`;

const OG_COMPLETO = [
  meta("og:title", "Título social", "property"),
  meta("og:description", "Descripción social", "property"),
  meta("og:image", "https://example.com/img.png", "property"),
];

const VACIA = head();

describe("twitterCardCheck (SOCIAL-07)", () => {
  it("emite las cuatro filas en una página sin tarjeta y sin Open Graph", () => {
    const issues = run(VACIA);
    expect(issues).toHaveLength(4);
    expect(bySubtype(issues, "card-missing")?.measuredValue).toBe("sin twitter:card");
    expect(bySubtype(issues, "missing-title")).toBeDefined();
    expect(bySubtype(issues, "missing-description")).toBeDefined();
    expect(bySubtype(issues, "missing-image")).toBeDefined();
  });

  it("emite una sola fila de aprobado con tarjeta válida y los tres equivalentes de Open Graph", () => {
    const issues = run(head(meta("twitter:card", "summary_large_image"), ...OG_COMPLETO));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.checkId).toBe("SOCIAL-07");
    expect(issues[0]?.severity).toBe("ok");
    expect(issues[0]?.title).toBe("Twitter Card correcta");
    expect(issues[0]?.recommendation).toBe("Sin acción necesaria.");
    expect(issues[0]?.fingerprint).toBe(pageFingerprint("SOCIAL-07", URL));
  });

  it("marca un valor de tarjeta que no está en la lista admitida", () => {
    const issues = run(head(meta("twitter:card", "carousel"), ...OG_COMPLETO));
    const invalida = bySubtype(issues, "card-invalid");
    expect(invalida?.severity).toBe("warning");
    expect(invalida?.measuredValue).toBe("carousel");
  });

  it("marca como no admitido un valor antiguo retirado del vocabulario", () => {
    // Asunción A1 de la investigación, no hecho verificado: X retiró `photo`,
    // `gallery` y `product` junto con su validador público, así que no queda
    // oráculo automatizable. Si se comprobara lo contrario, el arreglo es
    // agregar el valor a TWITTER_CARD_VALUES, no tocar este check.
    const issues = run(head(meta("twitter:card", "photo"), ...OG_COMPLETO));
    expect(bySubtype(issues, "card-invalid")?.measuredValue).toBe("photo");
  });

  it("acepta un valor admitido escrito con mayúsculas y con espacios alrededor", () => {
    const issues = run(head(meta("twitter:card", "  Summary_Large_Image  "), ...OG_COMPLETO));
    expect(bySubtype(issues, "card-invalid")).toBeUndefined();
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("ok");
  });

  it("no marca la falta de twitter:image cuando og:image está presente", () => {
    // Regla anti falso positivo lockeada: X hace fallback a Open Graph.
    const issues = run(head(meta("twitter:card", "summary"), ...OG_COMPLETO));
    expect(bySubtype(issues, "missing-image")).toBeUndefined();
  });

  it("marca la imagen exactamente una vez cuando faltan twitter:image y og:image", () => {
    const issues = run(
      head(
        meta("twitter:card", "summary"),
        meta("og:title", "Título social", "property"),
        meta("og:description", "Descripción social", "property"),
      ),
    );
    const porImagen = issues.filter((i) => i.fingerprint.includes("SOCIAL-07:missing-image"));
    expect(porImagen).toHaveLength(1);
    expect(porImagen[0]?.measuredValue).toBe("sin twitter:image ni og:image");
    expect(porImagen[0]?.title).toBe("Falta twitter:image y también og:image");
  });

  it("no marca el título cuando existe twitter:title aunque falte og:title", () => {
    const issues = run(
      head(
        meta("twitter:card", "summary"),
        meta("twitter:title", "Título de X"),
        meta("og:description", "Descripción social", "property"),
        meta("og:image", "https://example.com/img.png", "property"),
      ),
    );
    expect(bySubtype(issues, "missing-title")).toBeUndefined();
  });

  it("acota el valor medido de una tarjeta de longitud hostil", () => {
    const hostil = "x".repeat(500);
    const issues = run(head(meta("twitter:card", hostil), ...OG_COMPLETO));
    const invalida = bySubtype(issues, "card-invalid");
    expect(invalida?.measuredValue?.length).toBe(MAX_MEASURED_VALUE_CHARS);
    expect(invalida?.measuredValue?.length).toBeLessThanOrEqual(MAX_MEASURED_VALUE_CHARS);
  });

  it("da un fingerprint distinto a cada una de las cuatro filas", () => {
    const issues = run(VACIA);
    expect(new Set(issues.map((i) => i.fingerprint)).size).toBe(issues.length);
  });
});
