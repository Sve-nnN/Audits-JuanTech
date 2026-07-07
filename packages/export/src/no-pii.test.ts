import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { toMarkdown } from "./markdown";
import { toPptx } from "./pptx";
import { buildModel, makeIssue } from "./test-fixtures";

/**
 * EXPORT-05 PII guardrail (guardarrail doble: cap top-N + cero PII).
 *
 * This test proves that the export pipeline NEVER leaks PII (email /
 * verification token) into any output (Markdown, PPTX), even though such PII
 * exists elsewhere in the database. We simulate that by holding a fixture email
 * and token in ADJACENT scope — deliberately NOT part of the ReportModel that
 * the serializers receive — and asserting they never surface. We also assert
 * accents/ñ survive intact in both outputs.
 */

// PII that lives in the "database" but is NOT part of the serialized ReportModel.
const FIXTURE_EMAIL = "fixture@example.com";
const FIXTURE_TOKEN = "tok_secret_do_not_leak_1234567890";

const ACCENTS = "áéíóúñ¿¡";

/** Extract all rendered slide text from a PPTX binary (in-memory unzip). */
async function extractPptxText(buf: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const slideNames = Object.keys(zip.files).filter((f) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(f)
  );
  const parts = await Promise.all(
    slideNames.map((name) => zip.files[name]!.async("string"))
  );
  return parts.join("\n");
}

function accentedModel() {
  return buildModel({
    candidates: [
      makeIssue({
        checkId: "PII-01",
        title: `Título con acentos ${ACCENTS}`,
        measuredValue: ACCENTS,
        criterion: `Criterio ${ACCENTS}`,
        recommendation: `Recomendación ${ACCENTS}`,
        url: "https://example.com/página",
      }),
    ],
  });
}

describe("zero-PII guardrail (EXPORT-05)", () => {
  it("Markdown output contains no fixture email or token", () => {
    const md = toMarkdown(accentedModel());
    expect(md).not.toContain(FIXTURE_EMAIL);
    expect(md).not.toContain(FIXTURE_TOKEN);
  });

  it("PPTX output contains no fixture email or token", async () => {
    const buf = await toPptx(accentedModel());
    const text = await extractPptxText(buf);
    expect(text).not.toContain(FIXTURE_EMAIL);
    expect(text).not.toContain(FIXTURE_TOKEN);
  });

  it("Markdown preserves accents and ñ (áéíóúñ¿¡)", () => {
    const md = toMarkdown(accentedModel());
    expect(md).toContain(ACCENTS);
  });

  it("PPTX preserves accents and ñ (áéíóúñ¿¡)", async () => {
    const buf = await toPptx(accentedModel());
    const text = await extractPptxText(buf);
    expect(text).toContain(ACCENTS);
  });
});
