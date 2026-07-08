import type { CheerioAPI } from "cheerio";
import type { Page } from "@auditor/db";

export type IssueSeverityValue = "critical" | "warning" | "ok";

/**
 * A single finding produced by a check, ready to persist as an `Issue` row
 * (minus `id`/`auditId`/`createdAt`, which the caller fills in).
 *
 * `fingerprint` must be stable across re-runs of the same audit config
 * (`checkId` + normalized URL for page-level, `checkId` + `scope` for
 * site-level) so Phase 6+ can diff issues between audits.
 */
export interface IssueDraft {
  checkId: string;
  category: string;
  title: string;
  severity: IssueSeverityValue;
  measuredValue?: string;
  source?: string;
  criterion?: string;
  recommendation?: string;
  fingerprint: string;
  /** Page-level issues attach to a specific crawled page. */
  pageId?: string;
  /** Site-level issues use `scope` instead of `pageId` (e.g. "sitemap", "robots.txt"). */
  scope?: string;
}

/** Context handed to a page-level check: one already-crawled page + its parsed HTML. */
export interface PageCheckCtx {
  page: Page;
  $: CheerioAPI;
}

/** Context handed to a site-level check: the whole crawled set + site-wide metadata. */
export interface SiteCheckCtx {
  pages: Page[];
  origin: string;
  robotsTxt?: string | null;
  sitemapUrls: string[];
  /**
   * BFS click-depth from home, keyed by normalized URL — computed once by
   * the worker via `@auditor/graph` and passed through; checks never read
   * `Page.depth`, which is always 0 in sitemap-seeded crawls.
   */
  depthByUrl?: Record<string, number>;
}

export interface PageCheck {
  checkId: string;
  run(ctx: PageCheckCtx): IssueDraft[];
}

export interface SiteCheck {
  checkId: string;
  run(ctx: SiteCheckCtx): IssueDraft[];
}

/** Network checks need to fetch external URLs, so they run async over the whole set. */
export interface NetworkCheck {
  checkId: string;
  run(ctx: SiteCheckCtx): Promise<IssueDraft[]>;
}
