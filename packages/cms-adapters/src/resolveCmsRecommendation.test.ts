import { describe, it, expect } from "vitest";
import type { AxisResult, Confidence, DetectedStack } from "@auditor/fingerprint";
import { resolveCmsRecommendation } from "./resolveCmsRecommendation";

/**
 * Construye un `AxisResult` de prueba. `signals` vacío siempre: el motor solo
 * lee `value`/`confidence`, nunca inspecciona las señales.
 */
function axis(value: string | null, confidence: Confidence): AxisResult {
  return { value, confidence, signals: [] };
}

/**
 * Construye un `DetectedStack` de prueba parametrizado por el eje `cms` y el eje
 * `builder` (los únicos que lee el motor). El resto de los ejes se fijan como
 * `no-detectado` y `analytics` como array vacío, replicando la forma real.
 */
function stackOf(params: {
  cmsValue: string | null;
  cmsConfidence: Confidence;
  builderValue?: string | null;
  builderConfidence?: Confidence;
}): DetectedStack {
  const none = axis(null, "no-detectado");
  return {
    cms: axis(params.cmsValue, params.cmsConfidence),
    builder: axis(
      params.builderValue ?? null,
      params.builderConfidence ?? "no-detectado",
    ),
    cdn: none,
    hosting: none,
    jsFramework: none,
    analytics: [],
  };
}

// Genéricos conocidos de entrada (arbitrarios pero estables): el contrato del
// motor es devolverlos IDÉNTICOS en cada caso de fallback (CMSFIX-04).
const GENERIC_ONPAGE_01 =
  "Agrega una etiqueta <title> única y descriptiva a la página.";
const GENERIC_TECH_10 =
  "Declara la relación hreflang entre las versiones por idioma de la página.";

describe("resolveCmsRecommendation — gating por confianza", () => {
  const CONFIDENCES: Confidence[] = ["alto", "medio", "bajo", "no-detectado"];

  for (const confidence of CONFIDENCES) {
    const activa = confidence === "alto" || confidence === "medio";
    it(`confidence "${confidence}" ${activa ? "activa la copy de plataforma" : "cae al genérico"}`, () => {
      const stack = stackOf({ cmsValue: "WordPress", cmsConfidence: confidence });
      const result = resolveCmsRecommendation(
        stack,
        "ONPAGE-01",
        GENERIC_ONPAGE_01,
      );
      if (activa) {
        expect(result).not.toBe(GENERIC_ONPAGE_01);
        expect(result?.startsWith("En WordPress")).toBe(true);
      } else {
        expect(result).toBe(GENERIC_ONPAGE_01);
      }
    });
  }
});

describe("resolveCmsRecommendation — caminos de fallback (nunca lanza)", () => {
  it("stack === null → devuelve el genérico idéntico", () => {
    expect(
      resolveCmsRecommendation(null, "ONPAGE-01", GENERIC_ONPAGE_01),
    ).toBe(GENERIC_ONPAGE_01);
  });

  it("label sin adaptador (Drupal, confianza alta) → genérico idéntico", () => {
    const stack = stackOf({ cmsValue: "Drupal", cmsConfidence: "alto" });
    expect(
      resolveCmsRecommendation(stack, "ONPAGE-01", GENERIC_ONPAGE_01),
    ).toBe(GENERIC_ONPAGE_01);
  });

  it("cms.value === null (confianza alta) → genérico idéntico", () => {
    const stack = stackOf({ cmsValue: null, cmsConfidence: "alto" });
    expect(
      resolveCmsRecommendation(stack, "ONPAGE-01", GENERIC_ONPAGE_01),
    ).toBe(GENERIC_ONPAGE_01);
  });

  it("checkId fuera de los 10 (TECH-10) con WordPress alto → genérico byte-idéntico (CMSFIX-04)", () => {
    const stack = stackOf({ cmsValue: "WordPress", cmsConfidence: "alto" });
    const result = resolveCmsRecommendation(stack, "TECH-10", GENERIC_TECH_10);
    // Identidad estricta: el motor no fabrica ni reescribe copy fuera del catálogo.
    expect(result).toBe(GENERIC_TECH_10);
  });

  it("generic === null se propaga como null (no se fabrica texto)", () => {
    const stack = stackOf({ cmsValue: "Drupal", cmsConfidence: "alto" });
    expect(resolveCmsRecommendation(stack, "ONPAGE-01", null)).toBeNull();
  });
});

describe("resolveCmsRecommendation — variante por builder (WordPress + ONPAGE-04)", () => {
  it("builder Elementor confiable difiere de la rama sin builder", () => {
    const conElementor = resolveCmsRecommendation(
      stackOf({
        cmsValue: "WordPress",
        cmsConfidence: "alto",
        builderValue: "Elementor",
        builderConfidence: "alto",
      }),
      "ONPAGE-04",
      "genérico alt text",
    );
    const rama = resolveCmsRecommendation(
      stackOf({ cmsValue: "WordPress", cmsConfidence: "alto" }),
      "ONPAGE-04",
      "genérico alt text",
    );
    expect(conElementor).toBeTruthy();
    expect(rama).toBeTruthy();
    expect(conElementor).not.toBe(rama);
  });
});

describe("resolveCmsRecommendation — el motor threadea el label (Wix ≠ Squarespace)", () => {
  it("Wix y Squarespace resuelven copy distinta para el mismo checkId, ambas ≠ genérico", () => {
    const generic = "genérico title";
    const wix = resolveCmsRecommendation(
      stackOf({ cmsValue: "Wix", cmsConfidence: "alto" }),
      "ONPAGE-01",
      generic,
    );
    const squarespace = resolveCmsRecommendation(
      stackOf({ cmsValue: "Squarespace", cmsConfidence: "alto" }),
      "ONPAGE-01",
      generic,
    );
    expect(wix).not.toBe(generic);
    expect(squarespace).not.toBe(generic);
    expect(wix).not.toBe(squarespace);
  });
});
