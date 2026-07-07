import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { toPptx, buildPptxDeck } from "./pptx";
import { buildModel, makeCandidates } from "./test-fixtures";

async function countSlidesInBuffer(buf: Uint8Array): Promise<number> {
  const zip = await JSZip.loadAsync(buf);
  return Object.keys(zip.files).filter((f) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(f)
  ).length;
}

describe("toPptx slide-count floor/ceiling", () => {
  it("SPARSE audit (0 issues) produces exactly 7 slides", async () => {
    const model = buildModel({ candidates: [] });
    const deck = buildPptxDeck(model);
    expect(deck.slides.length).toBe(7);
    const buf = await toPptx(model);
    expect(await countSlidesInBuffer(buf)).toBe(7);
  });

  it("typical audit produces between 7 and 12 slides", async () => {
    const model = buildModel({ candidatesCount: 12 });
    const deck = buildPptxDeck(model);
    expect(deck.slides.length).toBeGreaterThanOrEqual(7);
    expect(deck.slides.length).toBeLessThanOrEqual(12);
  });

  it("large audit (>50 candidates) stays <= 12 slides", async () => {
    const model = buildModel({ candidates: makeCandidates(80) });
    const deck = buildPptxDeck(model);
    expect(deck.slides.length).toBeLessThanOrEqual(12);
    expect(deck.slides.length).toBeGreaterThanOrEqual(7);
  });

  it("emits a valid PPTX ZIP (PK signature) that is not empty", async () => {
    const buf = await toPptx(buildModel({ candidatesCount: 5 }));
    expect(buf.length).toBeGreaterThan(0);
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
  });
});
