import { describe, expect, it } from "vitest";
import { CATEGORY_WEIGHTS } from "@auditor/scoring";
import type { Category } from "@auditor/scoring";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "./labels";

/**
 * Guardarraíl de exhaustividad del orden de categorías del reporte en pantalla.
 *
 * TypeScript exige exhaustividad en un `Record<Category, T>` como
 * `CATEGORY_LABEL`, pero NO en un array `Category[]` como `CATEGORY_ORDER`.
 * Ese array decide qué tarjetas de score y qué secciones de detalle se
 * renderizan: una categoría nueva en el union que quede fuera del array
 * desaparece de la pantalla sin romper compilación y sin poner rojo ningún
 * test. Este archivo convierte ese defecto silencioso en una suite roja.
 *
 * La fuente de verdad en runtime es `Object.keys(CATEGORY_WEIGHTS)`, exhaustivo
 * por construcción al estar tipado `Record<Category, number>`. Deliberadamente
 * no se declara acá una lista literal de categorías, que sería otro sitio más
 * capaz de desincronizarse.
 */
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

  /**
   * Las etiquetas de la UI y las de `packages/export/src/labels.ts` son gemelas
   * verbatim POR DISEÑO (la web no depende del paquete de export, así que el
   * copy está duplicado a propósito). El literal esperado se escribe acá a mano
   * justamente para que un cambio unilateral en cualquiera de los dos lados
   * ponga esta suite en rojo en vez de dejar el reporte en pantalla y el
   * exportado diciendo cosas distintas.
   */
  it("la etiqueta de la categoría social es verbatim la misma que usa el paquete de export", () => {
    expect(CATEGORY_LABEL.social).toBe("Meta Tags / Social");
  });
});
