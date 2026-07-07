import { describe, it, expect, vi, type Mock } from "vitest";
import { runRenderSample, MAX_RENDER_PAGES } from "./renderSample";
import type { RenderSamplePage } from "./renderSample";
import { RENDER_CHECK_ID } from "./detect";
import type { RenderedSnapshot } from "./types";
import { launchBrowser, snapshotPage } from "./browser";

// Mock the browser module so the DEFAULT (non-injected) render path can be
// exercised without launching real Chromium in CI. Only `launchBrowser` and
// `snapshotPage` are stubbed; everything else keeps its real implementation.
vi.mock("./browser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./browser")>();
  return {
    ...actual,
    launchBrowser: vi.fn(),
    snapshotPage: vi.fn(),
  };
});

/** Builds `n` distinct 2xx HTML sample pages (page 0 is the homepage). */
function makePages(n: number): RenderSamplePage[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `page-${i}`,
    url: i === 0 ? "https://example.com/" : `https://example.com/p${i}`,
    finalUrl: null,
    statusCode: 200,
    contentType: "text/html",
    depth: i % 4,
    html: `<html><head><title>T${i}</title></head><body><h1>H${i}</h1><p>Contenido ${i}</p></body></html>`,
  }));
}

const richSnapshot = async (): Promise<RenderedSnapshot> => ({
  title: "Título",
  h1: "Encabezado",
  text: "Contenido renderizado con bastante texto visible para el usuario. ".repeat(4),
});

describe("runRenderSample", () => {
  it("caps rendered pages at MAX_RENDER_PAGES (never the full crawl)", async () => {
    const pages = makePages(40);
    const snapshot = vi.fn(richSnapshot);

    const issues = await runRenderSample({ auditId: "a1", pages, snapshot });

    expect(snapshot.mock.calls.length).toBeLessThanOrEqual(MAX_RENDER_PAGES);
    expect(issues.length).toBeLessThanOrEqual(MAX_RENDER_PAGES);
    expect(issues.length).toBeGreaterThan(0);
  });

  it("SSR page (rendered == raw) → verdict ssr, severity ok", async () => {
    const pages: RenderSamplePage[] = [
      {
        id: "p0",
        url: "https://example.com/",
        finalUrl: null,
        statusCode: 200,
        contentType: "text/html",
        depth: 0,
        html: `<html><head><title>Home</title></head><body><h1>Home</h1><p>Bienvenido a la home con contenido suficiente para el usuario.</p></body></html>`,
      },
    ];
    const snapshot = async (): Promise<RenderedSnapshot> => ({
      title: "Home",
      h1: "Home",
      text: "Home Bienvenido a la home con contenido suficiente para el usuario.",
    });

    const issues = await runRenderSample({ auditId: "a", pages, snapshot });

    expect(issues).toHaveLength(1);
    expect(issues[0]!.fingerprint).toBe(
      `${RENDER_CHECK_ID}:ssr:https://example.com/`,
    );
    expect(issues[0]!.severity).toBe("ok");
  });

  it("CSR page (rendered richer than raw) → verdict csr, severity warning", async () => {
    const pages: RenderSamplePage[] = [
      {
        id: "p0",
        url: "https://example.com/",
        finalUrl: null,
        statusCode: 200,
        contentType: "text/html",
        depth: 0,
        html: `<html><head></head><body><div id="root"></div></body></html>`,
      },
    ];
    const snapshot = async (): Promise<RenderedSnapshot> => ({
      title: "App",
      h1: "Bienvenido",
      text: "Bienvenido a la aplicación con mucho contenido renderizado por JavaScript en el cliente.",
    });

    const issues = await runRenderSample({ auditId: "a", pages, snapshot });

    expect(issues[0]!.fingerprint).toBe(
      `${RENDER_CHECK_ID}:csr:https://example.com/`,
    );
    expect(issues[0]!.severity).toBe("warning");
  });

  it("degradation (throw): a page whose render throws → undetermined, others still processed, resolves", async () => {
    const pages = makePages(3); // urls: /, /p1, /p2
    const snapshot = async (url: string): Promise<RenderedSnapshot> => {
      if (url.endsWith("/p1")) throw new Error("render failed");
      return richSnapshot();
    };

    const issues = await runRenderSample({ auditId: "a", pages, snapshot });

    expect(issues).toHaveLength(3);
    const undetermined = issues.find(
      (i) => i.fingerprint === `${RENDER_CHECK_ID}:undetermined:https://example.com/p1`,
    );
    expect(undetermined).toBeDefined();
    expect(undetermined!.severity).toBe("ok");
  });

  it("degradation (timeout): timeout-labeled rejection → undetermined, no propagation", async () => {
    const pages = makePages(1);
    const snapshot = async (): Promise<RenderedSnapshot> => {
      throw new Error("render timeout after 15000ms");
    };

    const issues = await runRenderSample({ auditId: "a", pages, snapshot });

    expect(issues).toHaveLength(1);
    expect(issues[0]!.fingerprint).toBe(
      `${RENDER_CHECK_ID}:undetermined:https://example.com/`,
    );
    expect(issues[0]!.severity).toBe("ok");
  });

  it("never throws: resolves with all-undetermined even when every render fails", async () => {
    const pages = makePages(5);
    const snapshot = async (): Promise<RenderedSnapshot> => {
      throw new Error("nope");
    };

    const issues = await runRenderSample({ auditId: "a", pages, snapshot });

    expect(issues.length).toBeGreaterThan(0);
    expect(
      issues.every(
        (i) => i.severity === "ok" && i.fingerprint.includes(":undetermined:"),
      ),
    ).toBe(true);
  });

  it("empty/no-valid-sample → resolves with empty issue array", async () => {
    const snapshot = vi.fn(richSnapshot);
    const issues = await runRenderSample({ auditId: "a", pages: [], snapshot });
    expect(issues).toEqual([]);
    expect(snapshot).not.toHaveBeenCalled();
  });

  it("default path: launchBrowser is called EXACTLY ONCE across a multi-page concurrent sample (no race, no orphan Chromium)", async () => {
    // Drive the REAL default render closure (no injected `snapshot`) so the
    // memoized-promise launch logic is under test. `launchBrowser` resolves on
    // a later tick so both concurrency lanes reach the `??=` before it settles —
    // this is exactly the race that used to launch (and orphan) a 2nd browser.
    const close = vi.fn().mockResolvedValue(undefined);
    const fakeBrowser = { close } as unknown as Awaited<
      ReturnType<typeof launchBrowser>
    >;
    (launchBrowser as Mock).mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve(fakeBrowser), 5)),
    );
    (snapshotPage as Mock).mockImplementation(async () => richSnapshot());

    const pages = makePages(6);
    const issues = await runRenderSample({ auditId: "a", pages });

    expect((launchBrowser as Mock).mock.calls.length).toBe(1);
    expect(snapshotPage).toHaveBeenCalledTimes(6);
    expect(close).toHaveBeenCalledTimes(1);
    expect(issues.length).toBe(6);
  });
});
