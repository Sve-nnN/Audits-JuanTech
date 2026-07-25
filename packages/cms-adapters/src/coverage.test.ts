import { describe, it, expect } from "vitest";
import type { AxisResult } from "@auditor/fingerprint";
import { SUPPORTED_CHECK_IDS } from "./types";
import type { CmsLabel } from "./types";
import { registry } from "./registry";
import { wordpressAdapter } from "./wordpress";
import { wixSquarespaceAdapter } from "./wixSquarespace";

const CMS_LABELS: CmsLabel[] = [
  "WordPress",
  "Shopify",
  "Webflow",
  "Wix",
  "Squarespace",
];

/** Builder sin detección: fuerza la rama en WordPress y no toca al resto. */
const builderNone: AxisResult = {
  value: null,
  confidence: "no-detectado",
  signals: [],
};

/** Builder Elementor con confianza alta: activa la variante específica en WP. */
const builderElementorAlto: AxisResult = {
  value: "Elementor",
  confidence: "alto",
  signals: [],
};

describe("cobertura de catálogos cms-adapters", () => {
  it("las 50 combinaciones (5 labels × 10 checkIds) devuelven un string no vacío", () => {
    for (const label of CMS_LABELS) {
      const adapter = registry[label]; // ← consume el registry real de producción
      for (const checkId of SUPPORTED_CHECK_IDS) {
        const result = adapter.lookup(checkId, label, builderNone);
        expect(
          result?.trim().length ?? 0,
          `falta o está vacía la entrada ${label} / ${checkId}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("itera exactamente 50 combinaciones", () => {
    expect(CMS_LABELS.length * SUPPORTED_CHECK_IDS.length).toBe(50);
  });
});

describe("variantes por builder de WordPress", () => {
  const GRANULARES = ["ONPAGE-04", "SD-01", "SD-02"] as const;

  for (const checkId of GRANULARES) {
    it(`${checkId}: builder Elementor confiable difiere de la rama sin builder`, () => {
      const conElementor = wordpressAdapter.lookup(
        checkId,
        "WordPress",
        builderElementorAlto,
      );
      const rama = wordpressAdapter.lookup(checkId, "WordPress", builderNone);
      expect(conElementor).toBeTruthy();
      expect(rama).toBeTruthy();
      expect(conElementor).not.toBe(rama);
    });
  }

  it("un checkId no granular (ONPAGE-01) no cambia con el builder", () => {
    const conElementor = wordpressAdapter.lookup(
      "ONPAGE-01",
      "WordPress",
      builderElementorAlto,
    );
    const sinBuilder = wordpressAdapter.lookup(
      "ONPAGE-01",
      "WordPress",
      builderNone,
    );
    expect(conElementor).toBe(sinBuilder);
  });

  it("builder Elementor con confianza baja cae a la rama (no usa la variante)", () => {
    const builderElementorBajo: AxisResult = {
      value: "Elementor",
      confidence: "bajo",
      signals: [],
    };
    const conBajo = wordpressAdapter.lookup(
      "ONPAGE-04",
      "WordPress",
      builderElementorBajo,
    );
    const rama = wordpressAdapter.lookup("ONPAGE-04", "WordPress", builderNone);
    expect(conBajo).toBe(rama);
  });
});

describe("Wix distinto de Squarespace bajo el mismo adaptador", () => {
  for (const checkId of ["ONPAGE-01", "ONPAGE-03"] as const) {
    it(`${checkId}: copy Wix ≠ copy Squarespace`, () => {
      const wix = wixSquarespaceAdapter.lookup(checkId, "Wix", builderNone);
      const squarespace = wixSquarespaceAdapter.lookup(
        checkId,
        "Squarespace",
        builderNone,
      );
      expect(wix).toBeTruthy();
      expect(squarespace).toBeTruthy();
      expect(wix).not.toBe(squarespace);
    });
  }
});

describe("checkId fuera del catálogo", () => {
  it("devuelve null (nunca lanza) para un checkId no soportado", () => {
    for (const label of CMS_LABELS) {
      const adapter = registry[label]; // ← consume el registry real de producción
      expect(adapter.lookup("TECH-10", label, builderNone)).toBeNull();
    }
  });
});
