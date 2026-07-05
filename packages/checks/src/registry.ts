import * as cheerio from "cheerio";
import type { Page } from "@auditor/db";
import type { IssueDraft, PageCheck, SiteCheck, NetworkCheck } from "./types";
import { onPageChecks } from "./checks/onpage";
import { techPageChecks, techSiteChecks } from "./checks/tech";
import { networkChecks } from "./checks/network";

export const pageChecks: PageCheck[] = [...onPageChecks, ...techPageChecks];
export const siteChecks: SiteCheck[] = [...techSiteChecks];
export { networkChecks };

export interface RunAllChecksOptions {
  pages: Page[];
  origin: string;
  robotsTxt?: string | null;
  sitemapUrls: string[];
  /** Set to false to skip network checks (e.g. in fast/offline test runs). */
  includeNetworkChecks?: boolean;
}

/**
 * Runs every registered page-level, site-level and (optionally) network
 * check and returns the combined list of `IssueDraft`s, ready to persist.
 */
export async function runAllChecks(options: RunAllChecksOptions): Promise<IssueDraft[]> {
  const { pages, origin, robotsTxt, sitemapUrls, includeNetworkChecks = true } = options;
  const issues: IssueDraft[] = [];

  for (const page of pages) {
    if (!page.html) continue;
    const $ = cheerio.load(page.html);
    for (const check of pageChecks) {
      issues.push(...check.run({ page, $ }));
    }
  }

  const siteCtx = { pages, origin, robotsTxt, sitemapUrls };
  for (const check of siteChecks) {
    issues.push(...check.run(siteCtx));
  }

  if (includeNetworkChecks) {
    for (const check of networkChecks) {
      issues.push(...(await check.run(siteCtx)));
    }
  }

  return issues;
}
