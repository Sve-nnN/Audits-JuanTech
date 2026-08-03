import * as cheerio from "cheerio";
import type { Page } from "@auditor/db";
import type { IssueDraft, PageCheck, SiteCheck, NetworkCheck, RenderVerdictValue } from "./types";
import { onPageChecks } from "./checks/onpage";
import { techPageChecks, techSiteChecks } from "./checks/tech";
import { networkChecks as baseNetworkChecks } from "./checks/network";
import {
  schemaPageChecks,
  schemaSiteChecks,
  computeSchemaGraph,
  extractJsonLdBlocks,
  flattenNodes,
  type EntityGraph,
} from "./checks/schema";
import { aeoPageChecks, aeoSiteChecks, aeoNetworkChecks } from "./checks/aeo";
import { perfPageChecks } from "./checks/perf";
import { socialPageChecks } from "./checks/social";

export const pageChecks: PageCheck[] = [
  ...onPageChecks,
  ...techPageChecks,
  ...schemaPageChecks,
  ...aeoPageChecks,
  ...perfPageChecks,
  ...socialPageChecks,
];
export const siteChecks: SiteCheck[] = [...techSiteChecks, ...schemaSiteChecks, ...aeoSiteChecks];
export const networkChecks: NetworkCheck[] = [...baseNetworkChecks, ...aeoNetworkChecks];

export interface RunAllChecksOptions {
  pages: Page[];
  origin: string;
  robotsTxt?: string | null;
  sitemapUrls: string[];
  /** Set to false to skip network checks (e.g. in fast/offline test runs). */
  includeNetworkChecks?: boolean;
  /** BFS click-depth from home, keyed by normalized URL — see `SiteCheckCtx.depthByUrl`. */
  depthByUrl?: Record<string, number>;
  /** Per-page render verdict — see `SiteCheckCtx.renderVerdictByPageId`. */
  renderVerdictByPageId?: Record<string, RenderVerdictValue>;
}

export interface RunAllChecksResult {
  issues: IssueDraft[];
  /** Per-page entity graph (schema.org JSON-LD nodes/edges), keyed by `Page.id` — only pages with JSON-LD present. */
  pageSchemaGraphs: Map<string, EntityGraph>;
  /** Per-page flat JSON-LD entities (JsonLdNode.data), keyed by `Page.id` — only pages with JSON-LD present. Source for the entity property tree — Phase 24 (SDVIZ-02). */
  pageSchemaEntities: Map<string, Record<string, unknown>[]>;
}

/**
 * Runs every registered page-level, site-level and (optionally) network
 * check and returns the combined list of `IssueDraft`s, ready to persist,
 * plus the per-page entity graphs built from each page's JSON-LD (Phase 4).
 */
export async function runAllChecks(options: RunAllChecksOptions): Promise<RunAllChecksResult> {
  const { pages, origin, robotsTxt, sitemapUrls, includeNetworkChecks = true, depthByUrl, renderVerdictByPageId } =
    options;
  const issues: IssueDraft[] = [];
  const pageSchemaGraphs = new Map<string, EntityGraph>();
  const pageSchemaEntities = new Map<string, Record<string, unknown>[]>();

  for (const page of pages) {
    if (!page.html) continue;
    const $ = cheerio.load(page.html);
    for (const check of pageChecks) {
      issues.push(...check.run({ page, $ }));
    }
    const graph = computeSchemaGraph($);
    if (graph) pageSchemaGraphs.set(page.id, graph);
    const entities = flattenNodes(extractJsonLdBlocks($)).map((n) => n.data);
    if (entities.length > 0) pageSchemaEntities.set(page.id, entities);
  }

  const siteCtx = { pages, origin, robotsTxt, sitemapUrls, depthByUrl, renderVerdictByPageId };
  for (const check of siteChecks) {
    issues.push(...check.run(siteCtx));
  }

  if (includeNetworkChecks) {
    for (const check of networkChecks) {
      issues.push(...(await check.run(siteCtx)));
    }
  }

  return { issues, pageSchemaGraphs, pageSchemaEntities };
}
