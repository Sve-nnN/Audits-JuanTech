const REQUEST_TIMEOUT_MS = 5_000;
const CONCURRENCY = 12;
/**
 * Hard cap on how many unique URLs a single network check will probe. On a
 * large crawl (hundreds of pages) the unique external-link / resource set can
 * be huge; probing every one (HEAD+GET, with timeouts) can take many minutes
 * and makes the audit look hung. Callers slice to this and report the cap.
 */
export const MAX_URLS_PER_NETWORK_CHECK = 150;

export type LinkCheckResult =
  | { url: string; ok: true; status: number }
  | { url: string; ok: false; status: number | null; reason: string };

/** HEAD request with GET fallback (some servers reject/misreport HEAD). */
async function checkOne(url: string): Promise<LinkCheckResult> {
  for (const method of ["HEAD", "GET"] as const) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { method, signal: controller.signal, redirect: "follow" });
      clearTimeout(timeout);
      if (res.status >= 400) {
        if (method === "HEAD") continue; // retry with GET before giving up
        return { url, ok: false, status: res.status, reason: `HTTP ${res.status}` };
      }
      return { url, ok: true, status: res.status };
    } catch (error) {
      clearTimeout(timeout);
      if (method === "HEAD") continue;
      const message = error instanceof Error ? error.message : "unknown error";
      return { url, ok: false, status: null, reason: message };
    }
  }
  return { url, ok: false, status: null, reason: "unreachable" };
}

/** Runs `checkOne` over `urls` with bounded concurrency. */
export async function checkLinks(urls: string[]): Promise<LinkCheckResult[]> {
  const results: LinkCheckResult[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < urls.length) {
      const current = index++;
      const url = urls[current];
      if (url === undefined) continue;
      results[current] = await checkOne(url);
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, urls.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
