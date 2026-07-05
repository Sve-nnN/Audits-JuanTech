import { describe, expect, it } from "vitest";
import { simhash, hammingDistance, exactContentHash } from "./simhash";

const LONG_TEXT_A =
  "Este es un artículo largo sobre auditorías de SEO técnico que cubre robots txt sitemap canonical y muchas otras cosas relevantes para el posicionamiento web de cualquier sitio moderno y competitivo en buscadores.";

describe("simhash", () => {
  it("returns null for empty text", () => {
    expect(simhash("")).toBeNull();
    expect(simhash("   ")).toBeNull();
  });

  it("produces identical hashes for identical text", () => {
    const a = simhash(LONG_TEXT_A);
    const b = simhash(LONG_TEXT_A);
    expect(a).not.toBeNull();
    expect(a).toBe(b);
    expect(hammingDistance(a!, b!)).toBe(0);
  });

  it("produces a smaller hamming distance for near-identical text than for unrelated text", () => {
    const modified = LONG_TEXT_A.replace("competitivo", "exigente");
    const unrelated =
      "Receta de cocina para preparar pasta italiana con tomate albahaca y queso parmesano fresco de temporada.";
    const a = simhash(LONG_TEXT_A);
    const bNear = simhash(modified);
    const bUnrelated = simhash(unrelated);
    expect(a).not.toBeNull();
    expect(bNear).not.toBeNull();
    expect(bUnrelated).not.toBeNull();
    expect(hammingDistance(a!, bNear!)).toBeLessThan(hammingDistance(a!, bUnrelated!));
  });

  it("produces a larger hamming distance for unrelated text", () => {
    const unrelated =
      "Receta de cocina para preparar pasta italiana con tomate albahaca y queso parmesano fresco de temporada.";
    const a = simhash(LONG_TEXT_A);
    const b = simhash(unrelated);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(hammingDistance(a!, b!)).toBeGreaterThan(0);
  });
});

describe("exactContentHash", () => {
  it("is stable for identical normalized text", () => {
    expect(exactContentHash("Hello World")).toBe(exactContentHash("hello   world"));
  });

  it("differs for different text", () => {
    expect(exactContentHash("Hello World")).not.toBe(exactContentHash("Goodbye World"));
  });
});
