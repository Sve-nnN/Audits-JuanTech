import { describe, it, expect } from "vitest";
import {
  subtypeFromImgFingerprint,
  OG_IMAGE_CHECK_ID,
  OG_IMAGE_UNREACHABLE_SUBTYPE,
  OG_IMAGE_UNVERIFIABLE_SUBTYPE,
  OG_IMAGE_SVG_SUBTYPE,
  OG_IMAGE_NOT_IMAGE_SUBTYPE,
  OG_IMAGE_UNDETERMINED_SUBTYPE,
  OG_IMAGE_TOO_SMALL_SUBTYPE,
  OG_IMAGE_SUBOPTIMAL_SUBTYPE,
  OG_IMAGE_TOO_LARGE_SUBTYPE,
  OG_IMAGE_HEAVY_SUBTYPE,
} from "./imageSubtypes";

describe("subtypeFromImgFingerprint", () => {
  it("recupera el subtipo de un fingerprint real de IMG-01", () => {
    expect(
      subtypeFromImgFingerprint(`IMG-01:${OG_IMAGE_TOO_SMALL_SUBTYPE}:https://x.com/a`)
    ).toBe("og-image-too-small");
    expect(
      subtypeFromImgFingerprint(`IMG-01:${OG_IMAGE_UNREACHABLE_SUBTYPE}:https://x.com/a`)
    ).toBe("og-image-unreachable");
    // La URL de la página lleva sus propios dos puntos: sólo cuenta el primer par.
    expect(
      subtypeFromImgFingerprint(`IMG-01:${OG_IMAGE_SUBOPTIMAL_SUBTYPE}:https://x.com/a?t=1:2`)
    ).toBe("og-image-suboptimal");
  });

  it("devuelve null para el fingerprint de otro check", () => {
    expect(subtypeFromImgFingerprint("SOCIAL-01:https://x.com/a")).toBeNull();
  });

  it("devuelve null ante una forma inesperada (falla cerrado)", () => {
    expect(subtypeFromImgFingerprint("IMG-01:og-image-svg")).toBeNull();
    expect(subtypeFromImgFingerprint("IMG-01::https://x.com/a")).toBeNull();
    expect(subtypeFromImgFingerprint("")).toBeNull();
  });

  it("declara el checkId y los 9 subtipos con sus valores persistidos", () => {
    expect(OG_IMAGE_CHECK_ID).toBe("IMG-01");
    expect([
      OG_IMAGE_UNREACHABLE_SUBTYPE,
      OG_IMAGE_UNVERIFIABLE_SUBTYPE,
      OG_IMAGE_SVG_SUBTYPE,
      OG_IMAGE_NOT_IMAGE_SUBTYPE,
      OG_IMAGE_UNDETERMINED_SUBTYPE,
      OG_IMAGE_TOO_SMALL_SUBTYPE,
      OG_IMAGE_SUBOPTIMAL_SUBTYPE,
      OG_IMAGE_TOO_LARGE_SUBTYPE,
      OG_IMAGE_HEAVY_SUBTYPE,
    ]).toEqual([
      "og-image-unreachable",
      "og-image-unverifiable",
      "og-image-svg",
      "og-image-not-image",
      "og-image-undetermined",
      "og-image-too-small",
      "og-image-suboptimal",
      "og-image-too-large",
      "og-image-heavy",
    ]);
  });
});
