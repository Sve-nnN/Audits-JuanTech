import { describe, it, expect } from "vitest";
import {
  detectRenderVerdict,
  undeterminedVerdict,
  RENDER_CHECK_ID,
  RENDER_CSR_RATIO,
} from "./detect";
import type { RenderedSnapshot } from "./types";

const URL = "https://example.com/page";
const PAGE_ID = "page-123";

function ssrHtml(): string {
  return `<!doctype html><html><head><title>Guía completa de SEO técnico</title></head><body><h1>Guía completa de SEO técnico</h1><main><p>Este es el contenido principal de la página con bastante texto visible para el usuario y los rastreadores.</p></main></body></html>`;
}

const fullSnapshot: RenderedSnapshot = {
  title: "Guía completa de SEO técnico",
  h1: "Guía completa de SEO técnico",
  text: "Guía completa de SEO técnico Este es el contenido principal de la página con bastante texto visible para el usuario y los rastreadores.",
};

describe("detectRenderVerdict", () => {
  it("SSR: raw HTML already contains title/H1/text → verdict ssr, severity ok", () => {
    const issue = detectRenderVerdict({
      url: URL,
      pageId: PAGE_ID,
      rawHtml: ssrHtml(),
      rendered: fullSnapshot,
    });
    expect(issue.checkId).toBe(RENDER_CHECK_ID);
    expect(issue.category).toBe("aeo");
    expect(issue.severity).toBe("ok");
    expect(issue.fingerprint).toBe(`${RENDER_CHECK_ID}:ssr:${URL}`);
    expect(issue.source).toBe(URL);
    expect(issue.pageId).toBe(PAGE_ID);
  });

  it("CSR (missing key content): empty raw body, rendered has content → verdict csr, severity warning", () => {
    const issue = detectRenderVerdict({
      url: URL,
      pageId: PAGE_ID,
      rawHtml: `<!doctype html><html><head></head><body><div id="root"></div></body></html>`,
      rendered: fullSnapshot,
    });
    expect(issue.severity).toBe("warning");
    expect(issue.fingerprint).toBe(`${RENDER_CHECK_ID}:csr:${URL}`);
    expect(issue.category).toBe("aeo");
  });

  it("CSR (ratio): raw text far below rendered (< 0.60) even with title → verdict csr, severity warning", () => {
    // Raw has title + h1 but almost no body text; rendered is much longer.
    const rawHtml = `<!doctype html><html><head><title>Guía completa de SEO técnico</title></head><body><h1>Guía completa de SEO técnico</h1><p>Cargando</p></body></html>`;
    const rendered: RenderedSnapshot = {
      title: "Guía completa de SEO técnico",
      h1: "Guía completa de SEO técnico",
      text: "Guía completa de SEO técnico ".repeat(40),
    };
    const issue = detectRenderVerdict({ url: URL, pageId: PAGE_ID, rawHtml, rendered });
    expect(issue.severity).toBe("warning");
    expect(issue.fingerprint).toBe(`${RENDER_CHECK_ID}:csr:${URL}`);
    expect(issue.measuredValue).toBeDefined();
  });

  it("null rawHtml is treated as empty raw side → csr, no throw", () => {
    const issue = detectRenderVerdict({
      url: URL,
      pageId: PAGE_ID,
      rawHtml: null,
      rendered: fullSnapshot,
    });
    expect(issue.severity).toBe("warning");
    expect(issue.fingerprint).toBe(`${RENDER_CHECK_ID}:csr:${URL}`);
  });

  it("never emits severity critical across ssr/csr/ratio/null paths", () => {
    const inputs = [
      { rawHtml: ssrHtml(), rendered: fullSnapshot },
      { rawHtml: `<html><body></body></html>`, rendered: fullSnapshot },
      { rawHtml: null, rendered: fullSnapshot },
    ];
    for (const input of inputs) {
      const issue = detectRenderVerdict({ url: URL, pageId: PAGE_ID, ...input });
      expect(issue.severity).not.toBe("critical");
    }
  });

  it("fingerprint differs between ssr and csr for distinct pages", () => {
    const ssr = detectRenderVerdict({
      url: "https://example.com/a",
      pageId: "a",
      rawHtml: ssrHtml(),
      rendered: fullSnapshot,
    });
    const csr = detectRenderVerdict({
      url: "https://example.com/b",
      pageId: "b",
      rawHtml: `<html><body></body></html>`,
      rendered: fullSnapshot,
    });
    expect(ssr.fingerprint).not.toBe(csr.fingerprint);
    expect(ssr.fingerprint).toBe(`${RENDER_CHECK_ID}:ssr:https://example.com/a`);
    expect(csr.fingerprint).toBe(`${RENDER_CHECK_ID}:csr:https://example.com/b`);
  });

  it("RENDER_CSR_RATIO is the tunable threshold at 0.60", () => {
    expect(RENDER_CSR_RATIO).toBe(0.6);
  });
});

describe("undeterminedVerdict", () => {
  it("returns an undetermined verdict with severity ok and stable fingerprint", () => {
    const issue = undeterminedVerdict(URL, PAGE_ID);
    expect(issue.checkId).toBe(RENDER_CHECK_ID);
    expect(issue.category).toBe("aeo");
    expect(issue.severity).toBe("ok");
    expect(issue.fingerprint).toBe(`${RENDER_CHECK_ID}:undetermined:${URL}`);
    expect(issue.source).toBe(URL);
    expect(issue.pageId).toBe(PAGE_ID);
  });
});
