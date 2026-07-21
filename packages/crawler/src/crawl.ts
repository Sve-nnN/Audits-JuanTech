import { CheerioCrawler, Configuration, type CheerioCrawlingContext } from "@crawlee/cheerio";
import { prisma } from "@auditor/db";
import { normalizeUrl, sameRegistrableDomain } from "./normalizeUrl";
import { isAllowed, DEFAULT_USER_AGENT } from "./robots";
import { discoverSitemapUrls } from "./sitemap";
import { curateHeaders, parseCookieNames } from "./captureHeaders";

const HARD_URL_CAP = 500;
const DEFAULT_MAX_CONCURRENCY = 5;
const DEFAULT_MAX_REQUESTS_PER_MINUTE = 120;
const REQUEST_HANDLER_TIMEOUT_SECS = 30;
const MAX_REQUEST_RETRIES = 2;
/**
 * For an audit crawler, 4xx/5xx responses are DATA, not errors: we must
 * record the actual status code (404, 410, 500, …) so later phases can flag
 * broken internal pages (TECH-03). Ignoring the full 400–599 range routes
 * these responses to requestHandler (with their statusCode) instead of
 * burning retries and landing in failedRequestHandler with a null status.
 * genuine transport failures (DNS, TLS, timeouts) still fail normally.
 */
const IGNORED_HTTP_ERROR_STATUS_CODES = Array.from({ length: 200 }, (_v, i) => 400 + i);
/** Throttle onProgress callbacks so we don't hammer Postgres every page. */
const PROGRESS_THROTTLE_MS = 2_000;

export interface RunCrawlOptions {
  auditId: string;
  startUrl: string;
  urlLimit: number;
  userAgent?: string;
  onProgress?: (progress: { discovered: number; crawled: number; total: number }) => void | Promise<void>;
}

export interface CrawlSummary {
  discovered: number;
  crawled: number;
  failed: number;
}

interface PageRequestData {
  depth: number;
  fromSitemap: boolean;
}

/**
 * Runs a bounded, polite crawl for `auditId` starting from `startUrl`:
 * - Seeds from sitemap URLs (via robots.txt `Sitemap:` or `/sitemap.xml`);
 *   falls back to link-crawling from the home page if none are found.
 * - Respects robots.txt (disallowed URLs are never fetched).
 * - Persists a `Page` row per crawled URL (upsert on [auditId, url]).
 * - Never exceeds `min(urlLimit, 500)` requests.
 * - A single failing/slow page records `Page.error` and does not abort the crawl.
 */
export async function runCrawl(options: RunCrawlOptions): Promise<CrawlSummary> {
  const { auditId, startUrl, userAgent = DEFAULT_USER_AGENT, onProgress } = options;
  const maxRequestsPerCrawl = Math.max(1, Math.min(options.urlLimit, HARD_URL_CAP));

  const origin = new URL(startUrl).origin;
  const normalizedStartUrl = normalizeUrl(startUrl) ?? startUrl;

  const sitemapUrls = await discoverSitemapUrls(origin);
  const seedFromSitemap = sitemapUrls.length > 0;
  const seedUrls = seedFromSitemap ? sitemapUrls : [normalizedStartUrl];

  let discovered = 0;
  let crawled = 0;
  let failed = 0;
  const seen = new Set<string>();
  let lastProgressAt = 0;

  async function reportProgress(force = false): Promise<void> {
    if (!onProgress) return;
    const now = Date.now();
    if (!force && now - lastProgressAt < PROGRESS_THROTTLE_MS) return;
    lastProgressAt = now;
    await onProgress({ discovered, crawled, total: maxRequestsPerCrawl });
  }

  // In-memory, non-persisted storage: concurrent audits (each a separate
  // runCrawl() call, possibly in the same worker process) never collide,
  // and nothing is written to disk/repo.
  const config = new Configuration({
    storageClientOptions: { persistStorage: false },
    purgeOnStart: true,
  });

  const crawler = new CheerioCrawler(
    {
      maxConcurrency: DEFAULT_MAX_CONCURRENCY,
      maxRequestsPerMinute: DEFAULT_MAX_REQUESTS_PER_MINUTE,
      maxRequestsPerCrawl,
      requestHandlerTimeoutSecs: REQUEST_HANDLER_TIMEOUT_SECS,
      maxRequestRetries: MAX_REQUEST_RETRIES,
      ignoreHttpErrorStatusCodes: IGNORED_HTTP_ERROR_STATUS_CODES,
      useSessionPool: true,
      preNavigationHooks: [
        (_ctx, gotOptions) => {
          gotOptions.headers = { ...gotOptions.headers, "user-agent": userAgent };
        },
      ],
      async requestHandler(ctx: CheerioCrawlingContext) {
        const { request, response, body, contentType, $ } = ctx;
        const userData = request.userData as PageRequestData;
        const url = normalizeUrl(request.url) ?? request.url;

        const finalUrl = normalizeUrl(request.loadedUrl ?? request.url) ?? request.loadedUrl ?? request.url;
        const redirectUrls = (response as { redirectUrls?: URL[] } | undefined)?.redirectUrls;
        const redirectChain =
          redirectUrls && redirectUrls.length > 0 ? redirectUrls.map((u) => u.toString()) : undefined;
        const statusCode = response?.statusCode ?? null;
        // Fingerprinting raw material from headers already loaded here — no extra
        // request (FPRINT-01). Only curated headers + cookie NAMES are persisted.
        const responseHeaders = curateHeaders(response?.headers ?? {});
        const cookieNames = parseCookieNames(response?.headers?.["set-cookie"]);
        const html = typeof body === "string" ? body : body?.toString("utf-8");
        // Extract the HTML <title> once from the already-loaded Cheerio `$`
        // (no HTML re-parse anywhere else — ARCH-03). Empty/missing => NULL.
        const title = $("title").first().text().trim() || null;

        await prisma.page.upsert({
          where: { auditId_url: { auditId, url } },
          create: {
            auditId,
            url,
            title,
            statusCode,
            finalUrl,
            redirectChain: redirectChain as never,
            contentType: contentType?.type ?? null,
            depth: userData?.depth ?? 0,
            fromSitemap: userData?.fromSitemap ?? false,
            html,
            responseHeaders: responseHeaders as never,
            cookieNames,
            fetchedAt: new Date(),
          },
          update: {
            title,
            statusCode,
            finalUrl,
            redirectChain: redirectChain as never,
            contentType: contentType?.type ?? null,
            html,
            responseHeaders: responseHeaders as never,
            cookieNames,
            fetchedAt: new Date(),
            error: null,
          },
        });

        crawled++;
        await reportProgress();

        // Link-crawl fallback: only follow internal links when we didn't
        // seed from a sitemap (sitemap already gives us the full URL set).
        // Links are extracted and robots-filtered manually (rather than via
        // enqueueLinks' synchronous transformRequestFunction) so the same
        // async isAllowed() used for seed URLs also gates discovered links.
        if (!seedFromSitemap) {
          const hrefs = new Set<string>();
          $("a[href]").each((_i, el) => {
            const href = $(el).attr("href");
            if (href) hrefs.add(href);
          });

          const toEnqueue: { url: string; userData: PageRequestData }[] = [];
          for (const href of hrefs) {
            const normalized = normalizeUrl(href, request.loadedUrl ?? request.url);
            if (!normalized) continue;
            if (!sameRegistrableDomain(normalized, origin)) continue;
            if (seen.has(normalized)) continue;
            if (!(await isAllowed(normalized, userAgent))) continue;
            seen.add(normalized);
            discovered++;
            toEnqueue.push({
              url: normalized,
              userData: { depth: (userData?.depth ?? 0) + 1, fromSitemap: false },
            });
          }

          if (toEnqueue.length > 0) {
            await crawler.addRequests(
              toEnqueue.map((r) => ({ url: r.url, userData: r.userData }))
            );
          }
        }
      },
      async errorHandler({ request }) {
        // Called before each retry (< maxRequestRetries). No persistence
        // here — only the final failedRequestHandler records Page.error, to
        // avoid clobbering a row with a transient mid-retry error message.
        void request;
      },
      async failedRequestHandler({ request }, error) {
        const url = normalizeUrl(request.url) ?? request.url;
        const userData = request.userData as PageRequestData;
        failed++;

        await prisma.page.upsert({
          where: { auditId_url: { auditId, url } },
          create: {
            auditId,
            url,
            depth: userData?.depth ?? 0,
            fromSitemap: userData?.fromSitemap ?? false,
            error: error.message ?? "Unknown crawl error",
            fetchedAt: new Date(),
          },
          update: {
            error: error.message ?? "Unknown crawl error",
            fetchedAt: new Date(),
          },
        });

        await reportProgress();
      },
    },
    config
  );

  // Filter seed URLs through robots.txt before enqueueing so disallowed
  // URLs (including ones from the sitemap itself) are never fetched.
  const initialRequests: { url: string; userData: PageRequestData }[] = [];
  for (const url of seedUrls) {
    const normalized = normalizeUrl(url) ?? url;
    if (seen.has(normalized)) continue;
    if (!(await isAllowed(normalized, userAgent))) continue;
    seen.add(normalized);
    discovered++;
    initialRequests.push({ url: normalized, userData: { depth: 0, fromSitemap: seedFromSitemap } });
  }

  await reportProgress(true);

  if (initialRequests.length === 0) {
    // Nothing crawlable (e.g. robots.txt blocks everything). Return empty summary.
    return { discovered, crawled, failed };
  }

  await crawler.run(initialRequests);
  await reportProgress(true);

  return { discovered, crawled, failed };
}
