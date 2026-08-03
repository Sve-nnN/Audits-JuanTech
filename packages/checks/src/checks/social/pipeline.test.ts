import { describe, expect, it } from "vitest";
import { runAllChecks } from "../../registry";
import { makePage } from "../../testUtils";
import { pageFingerprint } from "../../util";

/**
 * Verificación de punta a punta del tracer de Phase 30: la fila SOCIAL-01 sale
 * por el pipeline real de producción (`runAllChecks` sobre el registry real),
 * no por un cableado propio del test.
 */

const CHECK_ID = "SOCIAL-01";
const ORIGIN = "https://example.com";
const URL = "https://example.com/pagina";

/** og:title de 34 caracteres: dentro del rango válido de 10 a 60. */
const VALID_TITLE = "Auditoría SEO técnica automatizada";

async function socialRows(html: string) {
  const page = makePage({ url: URL, html });
  const { issues } = await runAllChecks({
    pages: [page],
    origin: ORIGIN,
    sitemapUrls: [],
    includeNetworkChecks: false,
  });
  return { page, rows: issues.filter((i) => i.checkId === CHECK_ID) };
}

describe("SOCIAL-01 de punta a punta por runAllChecks", () => {
  it("emite una fila crítica de categoría social sobre una página sin ninguna etiqueta og", async () => {
    const { page, rows } = await socialRows("<html><head></head><body><h1>Hola</h1></body></html>");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.category).toBe("social");
    expect(rows[0]?.severity).toBe("critical");
    expect(rows[0]?.pageId).toBe(page.id);
    expect(rows[0]?.fingerprint).toBe(pageFingerprint(CHECK_ID, URL));
  });

  it("emite una sola fila ok cuando el og:title válido viene por el atributo property", async () => {
    const { rows } = await socialRows(
      `<html><head><meta property="og:title" content="${VALID_TITLE}" /></head><body><h1>Hola</h1></body></html>`,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.severity).toBe("ok");
  });

  it("emite una sola fila ok cuando el mismo og:title válido viene por el atributo name", async () => {
    // Es la regresión del Pitfall 1: un selector restringido a `property`
    // pierde esta etiqueta y reporta una ausencia falsa. El extractor
    // unificado la ve igual que la anterior.
    const { rows } = await socialRows(
      `<html><head><meta name="og:title" content="${VALID_TITLE}" /></head><body><h1>Hola</h1></body></html>`,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.severity).toBe("ok");
  });
});
