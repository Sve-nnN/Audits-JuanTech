import * as cheerio from "cheerio";
import type { IssueDraft, SiteCheck } from "../../types";
import { extractVisibleText, siteFingerprint, wordCount } from "../../util";
import { exactContentHash, hammingDistance, simhash, SIMHASH_HAMMING_THRESHOLD } from "../../simhash";

const CHECK_ID = "TECH-08";
/** Pages with fewer words than this are skipped (near-empty pages create noise, not real duplicates). */
const MIN_WORDS_FOR_COMPARISON = 50;

/**
 * TECH-08: duplicate & near-duplicate content across the crawled set.
 * - Exact duplicates: identical normalized visible-text hash.
 * - Near-duplicates: 64-bit SimHash within `SIMHASH_HAMMING_THRESHOLD` Hamming
 *   distance (see simhash.ts for the tuneable threshold note).
 */
export const duplicateContentCheck: SiteCheck = {
  checkId: CHECK_ID,
  run({ pages }) {
    const issues: IssueDraft[] = [];

    const entries: { url: string; text: string; exactHash: string; sim: bigint }[] = [];
    for (const page of pages) {
      if (!page.html) continue;
      const $ = cheerio.load(page.html);
      const text = extractVisibleText($);
      if (wordCount(text) < MIN_WORDS_FOR_COMPARISON) continue;
      const sim = simhash(text);
      if (sim === null) continue;
      entries.push({ url: page.finalUrl ?? page.url, text, exactHash: exactContentHash(text), sim });
    }

    // Exact duplicates: group by hash.
    const exactGroups = new Map<string, string[]>();
    for (const entry of entries) {
      const group = exactGroups.get(entry.exactHash) ?? [];
      group.push(entry.url);
      exactGroups.set(entry.exactHash, group);
    }

    const dedupedUrlsInExactGroups = new Set<string>();
    for (const [, urls] of exactGroups) {
      if (urls.length < 2) continue;
      for (const url of urls) dedupedUrlsInExactGroups.add(url);
      const scope = `exact:${urls.slice().sort().join(",")}`;
      issues.push({
        checkId: CHECK_ID,
        category: "tech",
        title: "Contenido duplicado exacto",
        severity: "critical",
        measuredValue: `${urls.length} páginas con contenido idéntico`,
        source: urls.join(", "),
        criterion: "Cada página indexable debería tener contenido único",
        recommendation:
          "Consolida estas páginas duplicadas en una sola URL (con redirect 301) o diferencia su contenido; si deben coexistir, usa canonical hacia la versión principal.",
        fingerprint: siteFingerprint(CHECK_ID, scope),
        scope,
      });
    }

    // Near-duplicates: pairwise Hamming distance, skipping URLs already
    // flagged as exact duplicates of each other to avoid double-reporting.
    const reportedPairs = new Set<string>();
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (!a || !b) continue;
        if (a.exactHash === b.exactHash) continue; // already reported as exact
        const distance = hammingDistance(a.sim, b.sim);
        if (distance > SIMHASH_HAMMING_THRESHOLD) continue;

        const pairKey = [a.url, b.url].sort().join("|");
        if (reportedPairs.has(pairKey)) continue;
        reportedPairs.add(pairKey);

        const scope = `near:${pairKey}`;
        issues.push({
          checkId: CHECK_ID,
          category: "tech",
          title: "Contenido casi duplicado (near-duplicate)",
          severity: "warning",
          measuredValue: `distancia Hamming ${distance}/64 entre ${a.url} y ${b.url}`,
          source: `${a.url}, ${b.url}`,
          criterion: `SimHash con distancia Hamming <= ${SIMHASH_HAMMING_THRESHOLD} se considera near-duplicate`,
          recommendation:
            "Diferencia el contenido de estas páginas o consolídalas si cubren el mismo tema; el contenido casi idéntico compite por las mismas keywords y diluye relevancia.",
          fingerprint: siteFingerprint(CHECK_ID, scope),
          scope,
        });
      }
    }

    return issues;
  },
};
