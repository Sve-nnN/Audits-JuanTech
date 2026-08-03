import { describe, expect, it } from "vitest";
import { CHARSET_WINDOW_BYTES, hasCharsetInFirstKB } from "./charset";

/**
 * HTML inline y no fixtures: estos casos son sobre posiciones de bytes, no
 * sobre perfiles de CMS, y un archivo de fixture haría invisible el cálculo
 * del relleno, que es justamente lo que cada caso necesita dejar a la vista.
 */

const TEMPRANO = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>x</title></head></html>';

const HTTP_EQUIV =
  '<!DOCTYPE html><html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head></html>';

const SIN_DECLARACION = "<!DOCTYPE html><html><head><title>x</title></head><body></body></html>";

describe("hasCharsetInFirstKB", () => {
  it("acepta la declaración con el atributo de charset directo al inicio del documento", () => {
    expect(hasCharsetInFirstKB(TEMPRANO)).toBe(true);
  });

  it("acepta la forma http-equiv con el parámetro de charset dentro del contenido", () => {
    expect(hasCharsetInFirstKB(HTTP_EQUIV)).toBe(true);
  });

  it("rechaza un documento sin ninguna declaración de charset", () => {
    expect(hasCharsetInFirstKB(SIN_DECLARACION)).toBe(false);
  });

  it("rechaza la declaración empujada más allá de la ventana por relleno de un byte por carácter", () => {
    const relleno = "a".repeat(1100);
    const html = `<!--${relleno}--><meta charset="utf-8">`;
    expect(hasCharsetInFirstKB(html)).toBe(false);
  });

  it("rechaza la declaración que queda antes del carácter 1024 pero después del byte 1024", () => {
    // El caso que distingue una implementación por bytes de una por caracteres.
    // El relleno usa un carácter de dos bytes en UTF-8, así que la declaración
    // arranca en un índice de carácter POR DEBAJO de la ventana y en un offset
    // de bytes POR ENCIMA: una implementación que contara unidades de cadena
    // habría devuelto verdadero acá.
    const relleno = "é".repeat(600);
    const html = `<!--${relleno}--><meta charset="utf-8">`;
    const indiceDeCaracter = html.indexOf("<meta");
    const offsetDeBytes = Buffer.byteLength(html.substring(0, indiceDeCaracter), "utf8");

    expect(indiceDeCaracter).toBeLessThan(CHARSET_WINDOW_BYTES);
    expect(offsetDeBytes).toBeGreaterThanOrEqual(CHARSET_WINDOW_BYTES);
    expect(hasCharsetInFirstKB(html)).toBe(false);
  });

  it("rechaza la declaración partida por la frontera de la ventana", () => {
    // Abre antes del byte 1024 y su signo igual cae después: la ventana
    // recortada contiene el token a medias y no es una declaración.
    const relleno = "a".repeat(1015);
    const html = `${relleno}<meta charset="utf-8">`;
    expect(html.indexOf("<meta")).toBeLessThan(CHARSET_WINDOW_BYTES);
    expect(html.indexOf("=", html.indexOf("<meta"))).toBeGreaterThan(CHARSET_WINDOW_BYTES);
    expect(hasCharsetInFirstKB(html)).toBe(false);
  });

  it("rechaza la cadena vacía", () => {
    expect(hasCharsetInFirstKB("")).toBe(false);
  });

  it("declara la ventana en exactamente 1024 bytes", () => {
    expect(CHARSET_WINDOW_BYTES).toBe(1024);
  });

  it("resuelve un documento minificado de varios megabytes sin declaración en tiempo acotado", () => {
    // Etiqueta meta abierta y nunca cerrada, en una sola línea: es la forma
    // adversaria de T-30-03. El costo no depende del tamaño de entrada porque
    // la expresión regular corre sobre la ventana ya recortada.
    const html = `<meta ${"a".repeat(3_000_000)}`;
    const inicio = Date.now();
    const veredicto = hasCharsetInFirstKB(html);
    const transcurrido = Date.now() - inicio;

    expect(veredicto).toBe(false);
    expect(transcurrido).toBeLessThan(500);
  });
});
