import { parsePsiResponse, extractDiagnostics, type RawPsiResponse } from "./parser";
import type { PsiRunResult, PsiStrategy } from "./types";

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

// PSI's lab run (Lighthouse) is genuinely slow — 30-45s is common for a
// single page+strategy. 60s gives real audits room to finish without hanging
// the worker job indefinitely.
const REQUEST_TIMEOUT_MS = 60_000;
// Keyless PSI is rate-limited (~1 req/s, small burst quota). Retry a couple
// of times with backoff on 429/5xx; give up on 4xx (client errors won't
// resolve themselves) or when retries are exhausted.
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(targetUrl: string, strategy: PsiStrategy): string {
  const params = new URLSearchParams({
    url: targetUrl,
    strategy,
    category: "performance",
  });
  const apiKey = process.env.PSI_API_KEY;
  if (apiKey) params.set("key", apiKey);
  return `${PSI_ENDPOINT}?${params.toString()}`;
}

/**
 * Runs a single PageSpeed Insights check for `url` + `strategy`. Never
 * throws — failures (timeout, rate limit, malformed response) are reported
 * as `{ ok: false, error }` so a single bad page+strategy never fails the
 * whole audit (PERF-04).
 */
export async function runPsi(url: string, strategy: PsiStrategy): Promise<PsiRunResult> {
  let lastError = "unknown error";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(buildUrl(url, strategy), { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        lastError = `PSI HTTP ${res.status}`;
        // Only retry on rate-limit/server errors; client errors (400, 404 for
        // an unreachable URL, etc.) won't resolve on retry.
        if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
          await sleep(RETRY_BASE_DELAY_MS * attempt);
          continue;
        }
        return { ok: false, error: lastError };
      }

      const json = (await res.json()) as RawPsiResponse;
      const metrics = { ...parsePsiResponse(json), diagnostics: extractDiagnostics(json) };
      return { ok: true, metrics };
    } catch (error) {
      clearTimeout(timeout);
      lastError =
        error instanceof Error
          ? error.name === "AbortError"
            ? `PSI timed out after ${REQUEST_TIMEOUT_MS}ms`
            : error.message
          : "unknown error";
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }
    }
  }

  return { ok: false, error: lastError };
}
