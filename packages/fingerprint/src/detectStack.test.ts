import { describe, it, expect } from "vitest";
import { detectStack } from "./detectStack";
import type { PageFingerprintInput } from "./types";
import {
  wordpressPage,
  shopifyPage,
  webflowPage,
  wixPage,
  squarespacePage,
  webflowCurrentCdnPage,
  wordpressElementorPage,
  wordpressGutenbergPage,
  wordpressBuilderTiePage,
  wordpressNoBuilderPage,
  cloudflarePage,
  fastlyPage,
  akamaiPage,
  hostingMaskedByCdnPage,
  hostingNginxPage,
  hostingerBehindCloudflarePage,
  nextjsPage,
  analyticsTrioPage,
  emptyPage,
  multiAxisPage,
} from "./__fixtures__/synthetic";
import { realBuilderFixtures } from "./__fixtures__/realSites";

const run = (page: PageFingerprintInput) => detectStack({ pages: [page] });

describe("detectStack — CMS (FPRINT-02)", () => {
  it("detects WordPress con confidence alto (paths + generator)", () => {
    expect(run(wordpressPage).cms).toMatchObject({ value: "WordPress", confidence: "alto" });
  });

  it("detects Shopify con confidence alto (headers + cookie inequívocos)", () => {
    expect(run(shopifyPage).cms).toMatchObject({ value: "Shopify", confidence: "alto" });
  });

  it("detects Webflow", () => {
    expect(run(webflowPage).cms).toMatchObject({ value: "Webflow", confidence: "alto" });
  });

  it("detects Webflow por el CDN actual cdn.prod.website-files.com (sin data-wf ni generator)", () => {
    // Regresión: antes solo matcheaba `assets.website-files.com` (host viejo).
    expect(run(webflowCurrentCdnPage).cms).toMatchObject({ value: "Webflow" });
  });

  it("detects Wix", () => {
    expect(run(wixPage).cms).toMatchObject({ value: "Wix", confidence: "alto" });
  });

  it("detects Squarespace", () => {
    expect(run(squarespacePage).cms).toMatchObject({ value: "Squarespace", confidence: "alto" });
  });

  it("normaliza header keys en mayúscula al matchear (Pitfall 5)", () => {
    const cased: PageFingerprintInput = {
      ...cloudflarePage,
      responseHeaders: { "CF-Ray": "8abc-EWR", Server: "cloudflare" },
    };
    expect(run(cased).cdn).toMatchObject({ value: "Cloudflare" });
  });
});

describe("detectStack — Builder (FPRINT-03)", () => {
  it("WordPress + Elementor -> builder Elementor", () => {
    expect(run(wordpressElementorPage).builder).toMatchObject({ value: "Elementor" });
  });

  it("WordPress + Gutenberg (marcador positivo) -> builder Gutenberg", () => {
    expect(run(wordpressGutenbergPage).builder).toMatchObject({ value: "Gutenberg" });
  });

  it("empate real de conteo entre dos builders -> no-detectado", () => {
    expect(run(wordpressBuilderTiePage).builder).toMatchObject({
      value: null,
      confidence: "no-detectado",
    });
  });

  it("WordPress sin marcadores de builder -> builder null y NUNCA Gutenberg", () => {
    const { cms, builder } = run(wordpressNoBuilderPage);
    expect(cms.value).toBe("WordPress");
    expect(builder.value).toBeNull();
    expect(builder.value).not.toBe("Gutenberg");
    expect(builder.confidence).toBe("no-detectado");
  });

  it("builder queda no-detectado cuando el CMS no es WordPress", () => {
    expect(run(shopifyPage).builder).toMatchObject({ value: null, confidence: "no-detectado" });
  });
});

describe("detectStack — CDN (FPRINT-04)", () => {
  it("detects Cloudflare (cf-ray + server)", () => {
    expect(run(cloudflarePage).cdn).toMatchObject({ value: "Cloudflare", confidence: "alto" });
  });

  it("detects Fastly", () => {
    expect(run(fastlyPage).cdn).toMatchObject({ value: "Fastly" });
  });

  it("detects Akamai", () => {
    expect(run(akamaiPage).cdn).toMatchObject({ value: "Akamai" });
  });
});

describe("detectStack — Hosting (FPRINT-05)", () => {
  it("hosting no-detectado cuando un CDN enmascara el origen", () => {
    expect(run(hostingMaskedByCdnPage).hosting).toMatchObject({
      value: null,
      confidence: "no-detectado",
    });
  });

  it("nginx genérico -> hosting bajo, nunca alto", () => {
    const { hosting } = run(hostingNginxPage);
    expect(hosting.value).toBe("Nginx");
    expect(hosting.confidence).toBe("bajo");
    expect(hosting.confidence).not.toBe("alto");
  });

  it("Hostinger detrás de Cloudflare -> hosting Hostinger alto (platform + panel)", () => {
    // Regresión (fingerprint-cms-not-detected): el CDN enmascara `server`, pero
    // `platform: hostinger` + `panel: hpanel` pasan y son inequívocos de Hostinger.
    expect(run(hostingerBehindCloudflarePage).hosting).toMatchObject({
      value: "Hostinger",
      confidence: "alto",
    });
  });
});

describe("detectStack — JS framework (FPRINT-06)", () => {
  it("detects Next.js (__NEXT_DATA__ + /_next/)", () => {
    expect(run(nextjsPage).jsFramework).toMatchObject({ value: "Next.js", confidence: "alto" });
  });
});

describe("detectStack — Analytics (FPRINT-07)", () => {
  it("devuelve un array con GA4 + GTM + Meta Pixel coexistiendo", () => {
    const { analytics } = run(analyticsTrioPage);
    expect(analytics).toHaveLength(3);
    const values = analytics.map((a) => a.value);
    expect(values).toContain("GA4");
    expect(values).toContain("Google Tag Manager");
    expect(values).toContain("Meta Pixel");
  });
});

describe("detectStack — No-detectado (FPRINT-08)", () => {
  it("input sin señales -> todos los ejes null/no-detectado y analytics []", () => {
    const stack = run(emptyPage);
    for (const axis of [stack.cms, stack.builder, stack.cdn, stack.hosting, stack.jsFramework]) {
      expect(axis.value).toBeNull();
      expect(axis.confidence).toBe("no-detectado");
      expect(axis.signals).toHaveLength(0);
    }
    expect(stack.analytics).toHaveLength(0);
  });
});

describe("detectStack — Independencia de ejes (no winner-take-all)", () => {
  it("WordPress + Cloudflare + Next.js poblados simultáneamente", () => {
    const stack = run(multiAxisPage);
    expect(stack.cms.value).toBe("WordPress");
    expect(stack.cdn.value).toBe("Cloudflare");
    expect(stack.jsFramework.value).toBe("Next.js");
    // builder queda no-detectado: WP sin marcadores de builder.
    expect(stack.builder.value).toBeNull();
  });

  it("sitio estático Hostinger tras Cloudflare: CDN + hosting detectan, el resto no-detectado (no se fuerza)", () => {
    // Regresión del bug reportado: antes solo detectaba Cloudflare. Ahora hosting
    // también resuelve Hostinger, mientras cms/builder/jsFramework/analytics
    // quedan no-detectado CORRECTAMENTE (el sitio no tiene esos marcadores).
    const stack = run(hostingerBehindCloudflarePage);
    expect(stack.cdn.value).toBe("Cloudflare");
    expect(stack.hosting.value).toBe("Hostinger");
    expect(stack.cms.value).toBeNull();
    expect(stack.builder.value).toBeNull();
    expect(stack.jsFramework.value).toBeNull();
    expect(stack.analytics).toHaveLength(0);
  });
});

describe("detectStack — aggregate (home->fallback, unión de headers/cookies)", () => {
  it("usa el HTML de una subpágina cuando la home no tiene html", () => {
    const homeNoHtml: PageFingerprintInput = { ...nextjsPage, isHome: true, html: null };
    const sub: PageFingerprintInput = { ...nextjsPage, url: "https://next.example.com/sub", isHome: false };
    expect(detectStack({ pages: [homeNoHtml, sub] }).jsFramework.value).toBe("Next.js");
  });

  it("agrega headers y cookies de todas las páginas", () => {
    const homeHtml: PageFingerprintInput = {
      url: "https://x.example.com/",
      isHome: true,
      html: `<html><body></body></html>`,
      responseHeaders: {},
      cookieNames: [],
    };
    const sub: PageFingerprintInput = {
      url: "https://x.example.com/p",
      isHome: false,
      html: null,
      responseHeaders: { "cf-ray": "8abc-EWR", server: "cloudflare" },
      cookieNames: [],
    };
    expect(detectStack({ pages: [homeHtml, sub] }).cdn.value).toBe("Cloudflare");
  });
});

describe("detectStack — builder (sitios reales, calibración)", () => {
  it.each(realBuilderFixtures)(
    "$page.url -> cms WordPress + builder $expectedBuilder",
    ({ page, expectedBuilder }) => {
      const stack = detectStack({ pages: [page] });
      expect(stack.cms.value).toBe("WordPress");
      expect(stack.builder.value).toBe(expectedBuilder);
    }
  );
});
