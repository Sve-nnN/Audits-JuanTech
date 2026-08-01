import { describe, expect, it } from "vitest";
import { CATEGORY_WEIGHTS } from "@auditor/scoring";
import type { Category } from "@auditor/scoring";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "./labels";
import { CATS } from "./test-fixtures";

/**
 * Guardarraíl de exhaustividad del orden de categorías de los exports.
 *
 * TypeScript exige exhaustividad en un `Record<Category, T>`, pero NO en un
 * array `Category[]` ni en un literal casteado con `as`. Eso hace que agregar
 * una categoría nueva al union deje tres sitios de este paquete en silencio:
 * `CATEGORY_ORDER` (que decide qué categorías se imprimen en Markdown, PDF y
 * PPTX), `CATEGORY_LABEL` y el array `CATS` de las fixtures (que decide qué
 * categorías ejercitan los tests de los tres serializadores). Una categoría
 * omitida no rompe compilación y no pone rojo ningún test: simplemente
 * desaparece del reporte exportado. Este archivo convierte ese defecto
 * silencioso en una suite roja.
 *
 * La fuente de verdad en runtime es `Object.keys(CATEGORY_WEIGHTS)`, porque
 * `CATEGORY_WEIGHTS` está tipado `Record<Category, number>` y por lo tanto es
 * exhaustivo por construcción. Deliberadamente NO se declara acá una lista
 * literal de categorías: sería un cuarto sitio que puede desincronizarse.
 */
const ALL_CATEGORIES = (Object.keys(CATEGORY_WEIGHTS) as Category[]).sort();

describe("CATEGORY_ORDER / CATEGORY_LABEL — exhaustividad de categorías", () => {
  it("CATEGORY_ORDER cubre todas las categorías de CATEGORY_WEIGHTS", () => {
    expect([...CATEGORY_ORDER].sort()).toEqual(
      (Object.keys(CATEGORY_WEIGHTS) as Category[]).sort()
    );
  });

  it("CATEGORY_LABEL tiene una etiqueta por cada categoría de CATEGORY_WEIGHTS", () => {
    expect((Object.keys(CATEGORY_LABEL) as Category[]).sort()).toEqual(
      (Object.keys(CATEGORY_WEIGHTS) as Category[]).sort()
    );
  });

  it("las fixtures de export ejercitan todas las categorías de CATEGORY_WEIGHTS", () => {
    expect([...CATS].sort()).toEqual(
      (Object.keys(CATEGORY_WEIGHTS) as Category[]).sort()
    );
  });

  it("no queda ninguna categoría sin cubrir en los tres sitios a la vez", () => {
    // Redundante por diseño con los tres casos de arriba: fija en un solo
    // assert que los tres arrays coinciden entre sí, para que un fallo señale
    // de inmediato cuál de los tres se quedó atrás.
    expect({
      order: [...CATEGORY_ORDER].sort(),
      labels: (Object.keys(CATEGORY_LABEL) as Category[]).sort(),
      fixtures: [...CATS].sort(),
    }).toEqual({
      order: ALL_CATEGORIES,
      labels: ALL_CATEGORIES,
      fixtures: ALL_CATEGORIES,
    });
  });
});
