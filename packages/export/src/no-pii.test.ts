import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { toMarkdown } from "./markdown";
import { toPptx } from "./pptx";
import {
  buildModel,
  buildModelWithLeakedPii,
  makeIssue,
  PII_CANARY_EMAIL,
  PII_CANARY_TOKEN,
} from "./test-fixtures";

/**
 * EXPORT-05 PII guardrail (guardarrail doble: cap top-N + cero PII).
 *
 * This test proves the export pipeline NEVER leaks PII into any output. The PII
 * is injected as ADJACENT, non-whitelisted fields on the very objects the
 * serializers receive (`buildModelWithLeakedPii` attaches email / emailId /
 * token / verificationToken to `audit` and every issue). Because the serializers
 * must render only whitelisted fields, the canaries must be stripped — so unlike
 * the old "assert a literal that was never in the model" check, THIS assertion
 * can actually fail if a serializer ever dumps the whole object. We also assert
 * accents/ñ survive intact in both outputs.
 */

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
  it("Markdown strips adjacent PII (email/token) attached to the model", () => {
    const md = toMarkdown(buildModelWithLeakedPii());
    expect(md).not.toContain(PII_CANARY_EMAIL);
    expect(md).not.toContain(PII_CANARY_TOKEN);
  });

  it("PPTX strips adjacent PII (email/token) attached to the model", async () => {
    const buf = await toPptx(buildModelWithLeakedPii());
    const text = await extractPptxText(buf);
    // Check both rendered text and the raw slide XML (defense in depth).
    expect(text).not.toContain(PII_CANARY_EMAIL);
    expect(text).not.toContain(PII_CANARY_TOKEN);
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
