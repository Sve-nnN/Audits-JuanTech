import { describe, it, expect } from "vitest";
// pdf-parse@1.1.1's index.js has a debug block that reads a sample file when
// imported as the main module; import the lib entry directly to avoid it.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { toPdf } from "./pdf";
import { buildModel, makeIssue, makeCandidates } from "./test-fixtures";

/**
 * PDF text-extraction guardrail (EXPORT-01 + EXPORT-05):
 *   - accents/ñ preserved in HEADINGS (Khand) AND body (Geist Sans),
 *   - "Mostrando N de M" note when capped (top-N over priorityCandidates),
 *   - zero PII (fixture email/token in adjacent scope never leak),
 *   - Khand + Geist Sans actually embedded in the binary.
 */

// PII that lives in the "database" but is NOT part of the serialized ReportModel.
const FIXTURE_EMAIL = "fixture@example.com";
const FIXTURE_TOKEN = "tok_secret_do_not_leak_1234567890";

const BODY_ACCENTS = "áéíóúñ¿¡";
// Accented text that renders inside a Khand HEADING (issue title).
const HEADING_TITLE = "Configuración de canónicos áéíóúñ¿¡";

/** Model with an accented heading + accented body, and >50 candidates (cap). */
function accentedCappedModel() {
  const filler = makeCandidates(60); // > EXPORT_TOP_N (50) → forces the cap note.
  const highlighted = makeIssue({
    checkId: "TECH-04",
    severity: "critical",
    title: HEADING_TITLE, // heading (Khand) with accents
    measuredValue: BODY_ACCENTS, // body (Geist Sans) with accents
    criterion: `Criterio ${BODY_ACCENTS}`,
    recommendation: `Recomendación ${BODY_ACCENTS}`,
    url: "https://example.com/página",
  });
  return buildModel({ candidates: [highlighted, ...filler] });
}

async function extractPdfText(buf: Buffer): Promise<string> {
  const parsed = await pdfParse(buf);
  return parsed.text;
}

describe("toPdf (EXPORT-01 / EXPORT-05)", () => {
  it("produces a non-empty PDF binary (%PDF header)", async () => {
    const buf = await toPdf(accentedCappedModel());
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("preserves accents in a Khand HEADING (issue title + 'Scores por categoría')", async () => {
    const buf = await toPdf(accentedCappedModel());
    const text = await extractPdfText(buf);
    // Section heading (Khand) with an accent.
    expect(text).toContain("categoría");
    // Issue-title heading (Khand) with accents.
    expect(text).toContain("canónicos");
    expect(text).toContain("Configuración");
  });

  it("preserves accents/ñ (áéíóúñ¿¡) in the Geist Sans body", async () => {
    const buf = await toPdf(accentedCappedModel());
    const text = await extractPdfText(buf);
    expect(text).toContain(BODY_ACCENTS);
  });

  it("shows the 'Mostrando N de M' cap note when capped", async () => {
    const buf = await toPdf(accentedCappedModel());
    const text = await extractPdfText(buf);
    expect(text).toMatch(/Mostrando\s+\d+\s+de\s+\d+/);
  });

  it("does not leak the fixture email or token (zero PII)", async () => {
    const buf = await toPdf(accentedCappedModel());
    const text = await extractPdfText(buf);
    const binary = buf.toString("latin1");
    expect(text).not.toContain(FIXTURE_EMAIL);
    expect(text).not.toContain(FIXTURE_TOKEN);
    expect(binary).not.toContain(FIXTURE_EMAIL);
    expect(binary).not.toContain(FIXTURE_TOKEN);
  });

  it("embeds both Khand and Geist Sans fonts", async () => {
    const buf = await toPdf(accentedCappedModel());
    const binary = buf.toString("latin1");
    // Subset font PostScript names carry the family: Khand-* and Geist-*.
    expect(binary).toMatch(/Khand/);
    expect(binary).toMatch(/Geist/);
  });
});
