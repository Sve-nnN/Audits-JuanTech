import { selectSample, type SamplePageInput } from "@auditor/psi";
import { detectRenderVerdict, undeterminedVerdict } from "./detect";
import { launchBrowser, snapshotPage, RENDER_CONCURRENCY } from "./browser";
import type { RenderIssueDraft, RenderedSnapshot } from "./types";

/**
 * Render sample cap. INDEPENDENT from the PSI sample (MAX_PSI_PAGES): the
 * render pass renders at most this many pages, never the full 500-URL crawl.
 * Kept small because each render launches a Chromium context.
 */
export const MAX_RENDER_PAGES = 10;

/**
 * A crawled page as consumed by the render pass: the `selectSample` inputs
 * plus the page id and the raw HTML already stored in `Page.html`.
 */
export interface RenderSamplePage extends SamplePageInput {
  /** Crawled page id — issues attach to this page. */
  id: string;
  /** Raw HTML from the crawl (the "raw" side of the comparison); null if absent. */
  html: string | null;
}

/** Injectable per-page render function (url → rendered snapshot). */
export type SnapshotFn = (url: string) => Promise<RenderedSnapshot>;

export interface RunRenderSampleArgs {
  auditId: string;
  pages: RenderSamplePage[];
  /**
   * Optional render function. Defaults to a browser-backed closure that
   * launches one Chromium browser and snapshots each url through it. Tests
   * inject a stub so no real Chromium ever launches.
   */
  snapshot?: SnapshotFn;
}

/**
 * Best-effort render pass (RENDER-01 source + RENDER-03 degradation).
 *
 * Reuses `selectSample` with its own cap (`MAX_RENDER_PAGES`), renders each
 * sampled page (at most `RENDER_CONCURRENCY` lanes), feeds raw-vs-rendered
 * into the pure `detectRenderVerdict`, and degrades ANY per-page failure,
 * block or timeout to an "undetermined" issue (severity `ok`) instead of
 * throwing. The whole function NEVER rejects: even if every page fails it
 * resolves with an all-undetermined issue array.
 *
 * The default browser lifecycle launches ONE browser lazily and closes it in
 * `finally` on every path (T-12-03) — no zombie browsers even if all renders
 * failed.
 */
export async function runRenderSample({
  pages,
  snapshot,
}: RunRenderSampleArgs): Promise<RenderIssueDraft[]> {
  const sample = selectSample(pages, MAX_RENDER_PAGES) as RenderSamplePage[];
  if (sample.length === 0) return [];

  // Lazily-launched, shared browser for the default (non-injected) path.
  // Memoize the launch PROMISE (not the resolved value): under concurrency 2
  // both lanes can evaluate `if (!browser)` before either launch resolves and
  // each would launch its own Chromium, orphaning one (OOM over real audits).
  // `??=` on the promise guarantees exactly one launch shared by all lanes.
  let browserPromise: ReturnType<typeof launchBrowser> | undefined;
  const render: SnapshotFn =
    snapshot ??
    (async (url) => {
      browserPromise ??= launchBrowser();
      return snapshotPage(await browserPromise, url);
    });

  const issues: RenderIssueDraft[] = [];
  let cursor = 0;

  async function runOne(page: RenderSamplePage): Promise<void> {
    const url = page.finalUrl ?? page.url;
    try {
      const rendered = await render(url);
      issues.push(
        detectRenderVerdict({
          url,
          pageId: page.id,
          rawHtml: page.html,
          rendered,
        }),
      );
    } catch {
      // RENDER-03: any failure / block / timeout degrades to "no determinado".
      issues.push(undeterminedVerdict(url, page.id));
    }
  }

  async function lane(): Promise<void> {
    while (cursor < sample.length) {
      const page = sample[cursor++];
      if (page) await runOne(page);
    }
  }

  try {
    await Promise.all(
      Array.from({ length: Math.min(RENDER_CONCURRENCY, sample.length) }, () =>
        lane(),
      ),
    );
  } finally {
    // Close the shared browser on every path (success or total failure).
    // Close via the SAME memoized promise so the single launched browser is
    // the one closed — no second, unreferenced Chromium can survive.
    if (browserPromise) {
      try {
        await (await browserPromise).close();
      } catch {
        // Never let a cleanup error mask the best-effort result.
      }
    }
  }

  return issues;
}
