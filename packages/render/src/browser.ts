import { chromium, type Browser } from "playwright";
import type { RenderedSnapshot } from "./types";

/**
 * Hard per-page render timeout (ms). Bounds a hung/malicious navigation
 * (T-12-04) so a single page can never stall the render pass; on timeout the
 * caller degrades that page to "no determinado" (RENDER-03).
 */
export const RENDER_TIMEOUT_MS = 15000;

/**
 * Max concurrent render lanes. Capped low on purpose: each Chromium context
 * is memory-heavy and the worker also runs the PSI/Lighthouse pass, so more
 * than 2 risks OOM in the container (T-12-03).
 */
export const RENDER_CONCURRENCY = 2;

/**
 * Launches a SINGLE headless Chromium browser for the whole render pass.
 * Never launch one browser per page — reuse this handle across many contexts.
 *
 * Args are tuned for the pinned `mcr.microsoft.com/playwright:v1.61.1-noble`
 * image and low-`/dev/shm` containers: `--disable-dev-shm-usage` is the
 * documented fallback so Chromium doesn't crash on the default 64MB shm
 * (see CLAUDE.md → "Development Tools" / "What NOT to Use").
 */
export function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
}

/** Collapse whitespace + trim, mirroring the raw-side normalization in detect.ts. */
function normalize(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Races a promise against a hard timeout. Belt-and-suspenders on top of
 * Playwright's own `goto` timeout so an evaluate/hang past navigation is still
 * bounded by RENDER_TIMEOUT_MS.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`render timeout after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, guard]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Renders `url` in a fresh browser context and returns the normalized
 * title / first-H1 / visible body text (`RenderedSnapshot`).
 *
 * CRITICAL (T-12-03): the context is closed in `finally` on EVERY path
 * (success, thrown navigation error, timeout) so no page/context leaks and no
 * zombie processes accumulate under concurrency. Accepts an injectable
 * `browser` so tests can drive it without launching real Chromium.
 */
export async function snapshotPage(
  browser: Browser,
  url: string,
): Promise<RenderedSnapshot> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(RENDER_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(RENDER_TIMEOUT_MS);

    const raw = await withTimeout(
      (async () => {
        // `load` (not `networkidle`): by the load event the framework bundle has
        // downloaded and run, so a CSR SPA has already rendered content into the
        // DOM — enough to compare raw vs rendered. `networkidle` waits for the
        // network to go quiet, which long-polling / analytics / websockets keep
        // busy, forcing a timeout that wrongly degrades the page to
        // "no determinado" (WR-1). The 15s hard bound still caps a true hang.
        await page.goto(url, {
          waitUntil: "load",
          timeout: RENDER_TIMEOUT_MS,
        });
        return page.evaluate((): { title: string; h1: string; text: string } => {
          // The callback is serialized and executed inside the browser, where
          // `document` is a real global. We reach it via `globalThis` with a
          // minimal local shim so this file never requires the ambient DOM lib
          // in consumers that typecheck this package's source (e.g. the worker,
          // whose tsconfig lib is Node-only). This keeps DOM types isolated to
          // @auditor/render without leaking a browser lib into the worker.
          const doc = (
            globalThis as unknown as {
              document: {
                title: string;
                body: { innerText: string } | null;
                querySelector(selector: string): { textContent: string | null } | null;
              };
            }
          ).document;
          const h1 = doc.querySelector("h1");
          return {
            title: doc.title ?? "",
            h1: h1?.textContent ?? "",
            text: doc.body?.innerText ?? "",
          };
        });
      })(),
      RENDER_TIMEOUT_MS,
    );

    return {
      title: normalize(raw.title),
      h1: normalize(raw.h1),
      text: normalize(raw.text),
    };
  } finally {
    // Runs on success, nav error AND timeout — the leak-free guarantee.
    await context.close();
  }
}
