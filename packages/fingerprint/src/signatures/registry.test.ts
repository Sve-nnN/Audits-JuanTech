import { describe, it, expect } from "vitest";
import type { Axis } from "../types";
import { registry } from "./registry";

const AXES: Axis[] = ["cms", "builder", "cdn", "hosting", "jsFramework", "analytics"];

describe("signatures registry", () => {
  it("expone exactamente las 6 claves de eje", () => {
    expect(Object.keys(registry).sort()).toEqual([...AXES].sort());
  });

  it("cada eje tiene al menos una signature", () => {
    for (const axis of AXES) {
      expect(registry[axis].length).toBeGreaterThanOrEqual(1);
    }
  });

  it("integridad de bucket: toda signature declara el axis de su clave", () => {
    for (const axis of AXES) {
      for (const sig of registry[axis]) {
        expect(sig.axis).toBe(axis);
      }
    }
  });

  it("el eje builder incluye una signature Gutenberg (marcador positivo, nunca default)", () => {
    const gutenberg = registry.builder.filter((s) => s.value === "Gutenberg");
    expect(gutenberg.length).toBe(1);
  });

  it("cms es multi-señal: WordPress tiene más de una signature", () => {
    const wp = registry.cms.filter((s) => s.value === "WordPress");
    expect(wp.length).toBeGreaterThan(1);
  });

  it("cada signature.test devuelve un número (conteo), no un boolean", () => {
    const emptyCtx = {
      responseHeaders: {},
      cookieNames: [],
      html: "",
      // Instancia cheerio mínima suficiente para .length sobre selectores.
      $: (() => {
        const fn = () => ({ length: 0 });
        return fn as unknown as import("cheerio").CheerioAPI;
      })(),
    };
    for (const axis of AXES) {
      for (const sig of registry[axis]) {
        const result = sig.test(emptyCtx);
        expect(typeof result).toBe("number");
        expect(result).toBe(0); // sin señales => 0 marcadores
      }
    }
  });
});
