/**
 * Bounded-concurrency runner shared by the network checks.
 *
 * This is the runner that already lived inlined inside `checkLinks`
 * (`linkChecker.ts`), extracted verbatim in behaviour so the two consumers
 * cannot drift apart. The property every caller depends on is **order**:
 * `results[i]` always corresponds to `items[i]`, achieved with the same
 * pre-assigned index of the original — never by pushing results as they
 * settle, which would scramble the mapping between a probe result and the
 * page that declared it.
 */

/**
 * How many requests a network check issues in parallel. Same value the
 * network layer has used since the link checker: high enough to keep a
 * 150-URL sweep fast, low enough not to look like a burst against the
 * audited site.
 */
export const DEFAULT_NETWORK_CONCURRENCY = 12;

/** Runs `fn` over `items` with at most `limit` in flight, preserving input order. */
export function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index++;
      const item = items[current];
      if (item === undefined) continue;
      results[current] = await fn(item);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  return Promise.all(workers).then(() => results);
}
