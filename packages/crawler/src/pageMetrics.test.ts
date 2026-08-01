import { describe, it, expect } from "vitest";
import { extractPageMetrics } from "./pageMetrics";

describe("extractPageMetrics", () => {
  it("reads responseMs from timings.phases.total and htmlBytes from the HTML string", () => {
    const out = extractPageMetrics({ timings: { phases: { total: 1067 } } }, "<html>ok</html>");
    expect(out.responseMs).toBe(1067);
    expect(out.htmlBytes).toBe(15);
  });

  it("returns responseMs null when there is no response at all", () => {
    const out = extractPageMetrics(undefined, "<html></html>");
    expect(out.responseMs).toBeNull();
    expect(out.htmlBytes).toBe(13);
  });

  it("returns responseMs null when the response carries no timings", () => {
    const out = extractPageMetrics({}, "<html></html>");
    expect(out.responseMs).toBeNull();
  });

  it("returns responseMs null when phases has no total yet", () => {
    const out = extractPageMetrics({ timings: { phases: {} } }, "<html></html>");
    expect(out.responseMs).toBeNull();
  });

  it("returns htmlBytes null when there is no body", () => {
    const out = extractPageMetrics({ timings: { phases: { total: 42 } } }, undefined);
    expect(out.htmlBytes).toBeNull();
    expect(out.responseMs).toBe(42);
  });

  it("treats an empty HTML body as 0 bytes, never as missing data", () => {
    // Regresión (guard falsy): el guard es `== null`, no falsy. Una respuesta
    // de cero bytes es un valor legítimo y medible (p. ej. un 204 o un 200 con
    // cuerpo vacío); un guard falsy la convertiría en `null` y el check la
    // descartaría como "sin dato" en vez de reportarla.
    const out = extractPageMetrics({ timings: { phases: { total: 10 } } }, "");
    expect(out.htmlBytes).toBe(0);
    expect(out.htmlBytes).not.toBeNull();
  });

  it("counts UTF-8 bytes, not UTF-16 code units, for accented Spanish HTML", () => {
    // Regresión (bytes-vs-unidades): `String.length` cuenta unidades UTF-16,
    // no bytes. Medición real sobre github.com: 591675 unidades contra 591772
    // bytes; en sitios en español la brecha es proporcionalmente mayor porque
    // cada acento y cada eñe ocupan 2 bytes y 1 sola unidad UTF-16. La
    // aserción compara los dos números del MISMO string, sin valor mágico.
    const html = "<html><body><h1>Añadí más información técnica</h1></body></html>";
    const out = extractPageMetrics({ timings: { phases: { total: 10 } } }, html);
    expect(out.htmlBytes).toBeGreaterThan(html.length);
  });

  it("never throws for any combination of partial inputs", () => {
    expect(() => extractPageMetrics(undefined, undefined)).not.toThrow();
    expect(extractPageMetrics(undefined, undefined)).toEqual({
      responseMs: null,
      htmlBytes: null,
    });
  });
});
